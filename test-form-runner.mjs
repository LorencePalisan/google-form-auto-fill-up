import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { readResponses } from "./csv-input.mjs";
import { readFormItems } from "./form-schema.mjs";
import { selectTestQualifier, parseSocialWeights } from "./test-qualifier-choice.mjs";
import { selectTestBatch, testBatchStatus } from "./test-batch-rows.mjs";
import {
  loadUsedEmails,
  saveUsedEmail,
} from "./used-emails.mjs";

const url =
  "https://docs.google.com/forms/d/e/1FAIpQLSeEBmONXMFEsAIhIlMhMj5GByvQME-pGh18XTlTmBMPHfkKzg/viewform?usp=dialog";
const expectedTitle =
  "The Relationship of Social Network to Customer Acquisition among Gadget Repair Services";
const args = process.argv.slice(2);
if (
  args.some(
    (a, i) =>
      !["--status", "--submit", "--headless", "--limit", "--social-weights"].includes(a) &&
      !["--limit", "--social-weights"].includes(args[i - 1]),
  )
)
  throw Error(
    "Usage: node test-form-runner.mjs [--status] [--limit N] [--social-weights 40,30,30] [--submit] [--headless]",
  );
const index = args.indexOf("--limit");
const weightsIndex = args.indexOf("--social-weights");
const socialWeights = weightsIndex < 0 ? undefined : parseSocialWeights(args[weightsIndex + 1] || '');
const limit = index < 0 ? 1 : Number(args[index + 1]);
if (!Number.isSafeInteger(limit) || limit < 1)
  throw Error("Limit must be a positive integer.");
const source = readResponses(
  readFileSync(new URL("./synthetic-test-responses.csv", import.meta.url)),
);
const emails = readResponses(
  readFileSync(new URL("./sample.csv", import.meta.url)),
).map((r) => r.Email);
if (
  emails.length < source.length ||
  emails.some((e) => typeof e !== "string" || !/^\S+@\S+\.\S+$/.test(e))
)
  throw Error("sample.csv must provide enough valid email addresses.");
const history = new URL("./test-form-used-emails.json", import.meta.url);
const used = loadUsedEmails(history);
const status = testBatchStatus(source, emails, used);
function printStatus() {
  const uniqueEmails = [...new Set(emails.map(email => email.trim().toLowerCase()))];
  console.log(`Email addresses: ${uniqueEmails.length}; already in submission history: ${uniqueEmails.filter(email => used.has(email)).length}.`);
  console.log(`Source test rows: ${status.sourceRows}; unused paired rows: ${status.remainingPairedRows}; unused emails without source rows: ${status.unpairedUnusedEmails}.`);
}
function printRecovery() {
  console.error('For a local synthetic Pearson demonstration, run: npm.cmd run demo:pearson');
  console.error('This generates local responses and results without emails or form submissions.');
  if (!source.length) {
    console.error('Missing input: synthetic-test-responses.csv contains headers but no answer rows.');
    console.error('--limit selects existing rows; it does not create responses. --social-weights only controls test qualifier choices.');
    console.error('For an authorized test, restore the original test-answer CSV and use a test form. Keep submission history intact to avoid resubmitting used emails.');
  }
  console.error('For final research, obtain the original participant-response workbook and run:');
  console.error('npm.cmd run analyze:pearson -- --final "PATH_TO_GENUINE_FINAL.xlsx" --pilot "PATH_TO_VERIFIED_PILOT.xlsx" --out "reports/new-pearson-run"');
  console.error('Replace both workbook paths with existing verified exports and choose a new output folder.');
}
if (args.includes("--status")) {
  printStatus();
  if (!source.length) printRecovery();
  console.log("Status only: no browser opened and no responses submitted.");
  process.exit(0);
}
let rows;
try {
  rows = selectTestBatch(source, emails, used, limit);
} catch (error) {
  console.error(`Run stopped: ${error.message}`);
  printStatus();
  printRecovery();
  process.exit(2);
}
if (!rows.length) {
  console.log("No unused paired test rows remain. Pilot/test rows cannot be recycled.");
  process.exit(0);
}
const browser = await chromium.launch({
  headless: args.includes("--headless"),
});
try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByText(expectedTitle, { exact: true }).first().waitFor();
  const items = await readFormItems(page);
  const grids = items.filter((q) => q[3] === 7);
  if (grids.length !== 4 || grids.reduce((n, q) => n + q[4].length, 0) !== 22)
    throw Error("Unexpected questionnaire structure.");
  const prepared = rows.map(({ answers, email }) => {
    if (answers.DataType !== "SYNTHETIC TEST ONLY")
      throw Error("Input must be labeled synthetic test data.");
    const destination = new URL(url);
    destination.searchParams.set("usp", "pp_url");
    destination.searchParams.set("emailAddress", email);
    const entries = [];
    for (const q of items) {
      if (q[3] === 7) {
        for (const entry of q[4]) {
          const key = `${q[1]} [${entry[3][0]}]`,
            score = answers[key];
          if (!/^[1-4]$/.test(score || ""))
            throw Error(`Missing or invalid score: ${key}`);
          const choices = entry[1]
            .map((c) => c[0])
            .filter((c) => c.startsWith(`${score} - `));
          if (choices.length !== 1) throw Error(`Cannot map score for ${key}`);
          entries.push([entry[0], choices[0]]);
        }
      } else if (q[3] === 2) {
        // Preserve affirmative consent; randomize eligible test qualifiers per row.
        const labels = q[4][0][1].map((c) => c[0]);
        const choice = selectTestQualifier(labels, socialWeights);
        entries.push([q[4][0][0], choice]);
      } else throw Error("Unsupported test-form question.");
    }
    for (const [id, value] of entries)
      destination.searchParams.set(`entry.${id}`, value);
    return { destination: destination.href, email, entries };
  });
  for (const [i, row] of prepared.entries()) {
    await page.goto(row.destination, { waitUntil: "domcontentloaded" });
    let finished = false;
    for (let step = 0; step < 15; step++) {
      const next = page.getByRole("button", { name: /^(Next|Susunod)$/i });
      const submit = page.getByRole("button", {
        name: /^(Submit|Isumite|Ipasa)$/i,
      });
      await next.or(submit).first().waitFor();
      if (await submit.count()) {
        finished = true;
        break;
      }
      const before = await page.locator('[role="heading"]').allTextContents();
      await next.click();
      await page.waitForFunction(
        (previous) =>
          JSON.stringify(
            [...document.querySelectorAll('[role="heading"]')].map(
              (e) => e.textContent,
            ),
          ) !== JSON.stringify(previous),
        before,
      );
    }
    if (!finished) throw Error("Did not reach final page.");
    // Google retains prior-page answers in hidden form fields. Check the full
    // payload before allowing submission, including each of the 22 scores.
    const payload = await page
      .locator("form")
      .first()
      .evaluate((form) => Array.from(new FormData(form).entries()));
    // Earlier pages are serialized by Google in partialResponse, while the
    // current page contributes entry.* fields directly.
    const partial = payload.find(([key]) => key === "partialResponse")?.[1];
    function collect(value) {
      if (!Array.isArray(value)) return;
      if (Number.isInteger(value[1]) && Array.isArray(value[2])) {
        for (const answer of value[2])
          if (typeof answer === "string")
            payload.push([`entry.${value[1]}`, answer]);
      }
      value.forEach(collect);
    }
    if (partial) collect(JSON.parse(partial));
    for (const [id, value] of row.entries) {
      if (!payload.some(([key, v]) => key === `entry.${id}` && v === value))
        throw Error(
          `Prefilled answer not preserved for entry ${id}; nothing submitted for this row.`,
        );
    }
    const savedEmail = partial ? JSON.parse(partial)[6] : null;
    if (
      savedEmail !== row.email &&
      !payload.some(([key, v]) => key === "emailAddress" && v === row.email)
    )
      throw Error("Email not preserved.");
    if (args.includes("--submit")) {
      await page
        .getByRole("button", { name: /^(Submit|Isumite|Ipasa)$/i })
        .click();
      await page
        .getByText(
          /Your response has been recorded|Naitala na ang iyong tugon|Naitala ang iyong tugon/i,
        )
        .waitFor();
      saveUsedEmail(history, row.email);
      console.log(
        `Confirmed synthetic test submission ${i + 1}/${prepared.length}.`,
      );
    } else
      console.log(
        `Verified test row ${i + 1}/${prepared.length}: all 22 scores and email preserved. NOT submitted.`,
      );
  }
} finally {
  await browser.close();
}
