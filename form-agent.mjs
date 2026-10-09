import { chromium } from 'playwright';
import { readResponses } from './csv-input.mjs';
import { selectChoice } from './form-controls.mjs';
import { loadUsedEmails, selectUnused, saveUsedEmail } from './used-emails.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const url = 'https://docs.google.com/forms/d/e/1FAIpQLSfXh2c91worY-PM5FTCyHS2ymS-vS4xHfgkgMHtC5UkYY1gCw/viewform';
const [command, file, ...flags] = process.argv.slice(2);
if (!['inspect', 'fill'].includes(command) || (command === 'fill' && !file)) {
  console.error('Usage: node form-agent.mjs inspect | fill answers.csv [--limit N] [--random] [--submit] [--auto]');
  process.exit(1);
}
function option(name, fallback) {
  const index = flags.indexOf(name);
  if (index < 0) return fallback;
  if (!flags[index + 1] || flags[index + 1].startsWith('--')) throw new Error(`Missing value for ${name}`);
  return flags[index + 1];
}
const emailTitle = option('--email-title', 'Email');
const limitValue = option('--limit', null);
if (limitValue !== null && (!/^\d+$/.test(limitValue) || !Number.isSafeInteger(Number(limitValue)) || Number(limitValue) < 1)) {
  throw new Error('--limit must be a positive whole number, such as --limit 5.');
}
const limit = limitValue === null ? undefined : Number(limitValue);
const answersFile = option('--answers', null);
const shared = answersFile ? JSON.parse(readFileSync(answersFile, 'utf8')) : {};
if (!shared || Array.isArray(shared) || typeof shared !== 'object' || Object.values(shared).some(value => typeof value !== 'string')) {
  throw new Error('Shared answers must be a JSON object mapping question titles to strings.');
}
const historyFile = new URL('./used-emails.json', import.meta.url).pathname;
const rows = command === 'fill' ? selectUnused(
  readResponses(readFileSync(file), emailTitle).map(row => ({ ...shared, ...row })),
  emailTitle, loadUsedEmails(historyFile), limit,
) : [];
if (command === 'fill' && !rows.length) {
  console.log('No unused emails remain.');
  process.exit(0);
}
if (command === 'fill') console.log(`Processing ${rows.length} response(s) from ${file}.`);
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
const terminal = createInterface({ input: process.stdin, output: process.stdout });
const ask = message => terminal.question(message);
const autoMode = flags.includes('--auto');
const randomMode = autoMode || flags.includes('--random');
const submitMode = autoMode || flags.includes('--submit');
const nextButton = () => page.getByRole('button', { name: /^\s*(Next|Susunod)\s*$/i });
const submitButton = () => page.getByRole('button', { name: /^\s*(Submit|Isumite|Ipasa)\s*$/i });
async function waitForControls() {
  await page.waitForLoadState('load');
  try {
    await nextButton().or(submitButton()).first().waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    const labels = await page.getByRole('button').allTextContents();
    throw new Error(`Could not identify Next or Submit. Visible button labels: ${JSON.stringify(labels)}`);
  }
}
const confirmationMessage = () => page.getByText(/Your response has been recorded|Naitala na ang iyong tugon|Naitala ang iyong tugon/i);
const pick = items => items[Math.floor(Math.random() * items.length)];

async function randomAnswer(group, title) {
  if (/consent|voluntar|I Agree|sumasang.ayon/i.test(await group.innerText())) {
    if (autoMode) {
      const agreeName = /^(I Agree\b|Agree\b|Sumasang[ -]?ayon\b|Oo\b)/i;
      for (const role of ['radio', 'checkbox']) {
        const agree = group.getByRole(role, { name: agreeName });
        if (await agree.count() === 1) { await selectChoice(agree); return; }
      }
      throw new Error('Could not identify a unique affirmative consent option.');
    }
    await ask('Choose your consent response manually in the browser, then press Enter: ');
    return;
  }
  // Handle each radio group separately, including rows in multiple-choice grids.
  const radioGroups = group.getByRole('radiogroup');
  if (await radioGroups.count()) {
    for (const radioGroup of await radioGroups.all()) {
      const choices = await radioGroup.getByRole('radio').all();
      if (choices.length) await selectChoice(pick(choices));
    }
    return;
  }
  for (const role of ['radio', 'checkbox']) {
    const choices = await group.getByRole(role).all();
    if (choices.length) { await selectChoice(pick(choices)); return; }
  }
  const dropdown = group.getByRole('listbox');
  if (await dropdown.count() === 1) {
    await dropdown.click();
    const choices = [];
    for (const choice of await page.getByRole('option').all()) {
      if (await choice.isVisible() && !/^(Choose|Pumili)$/i.test((await choice.innerText()).trim())) choices.push(choice);
    }
    if (choices.length) { await pick(choices).click(); return; }
  }
  const fields = group.locator('input:not([type=hidden]):not([type=radio]):not([type=checkbox]), textarea');
  if (await fields.count() === 1) {
    const field = fields.first();
    const type = await field.getAttribute('type');
    if (!type || ['text', 'search'].includes(type) || await field.evaluate(element => element.tagName === 'TEXTAREA')) {
      await field.fill(`TEST RESPONSE ${Math.floor(Math.random() * 10000)}`);
      return;
    }
  }
  if (autoMode) throw new Error(`Unsupported automatic question: "${title}". Configure it with --answers.`);
  await ask(`Question "${title}" needs a manual test answer. Fill it in the browser, then press Enter: `);
}

async function questions() {
  const groups = page.getByRole('listitem');
  const result = [];
  for (const group of await groups.all()) {
    const heading = group.getByRole('heading').first();
    if (!await heading.count()) continue;
    // Sections and descriptions also appear as listitems with headings.
    // Only listitems containing an answer control are questions.
    const controls = group.locator('input:not([type="hidden"]), textarea, select, [role="radio"], [role="checkbox"], [role="listbox"], [role="textbox"], input[type="file"]');
    if (!await controls.count()) continue;
    const title = (await heading.innerText()).replace(/\s*\*\s*$/, '').trim();
    result.push({ title, group });
  }
  return result;
}

async function fillQuestion(group, value) {
  const text = group.locator('input:not([type=hidden]):not([type=radio]):not([type=checkbox]), textarea');
  if (await text.count() === 1) { await text.fill(value); return; }
  const checks = group.getByRole('checkbox');
  if (await checks.count()) {
    for (const answer of value.split('|').map(s => s.trim())) {
      await selectChoice(group.getByRole('checkbox', { name: answer, exact: true }));
    }
    return;
  }
  if (await group.getByRole('radio').count()) {
    await selectChoice(group.getByRole('radio', { name: value, exact: true }));
    return;
  }
  const dropdown = group.getByRole('listbox');
  if (await dropdown.count() === 1) {
    await dropdown.click();
    await page.getByRole('option', { name: value, exact: true }).click();
    return;
  }
  throw new Error('Unsupported question type; handle it manually or extend fillQuestion().');
}

try {
  await page.goto(url);
  if (autoMode) {
    await page.getByRole('listitem').filter({ has: page.getByRole('heading') }).first().waitFor({ timeout: 15000 });
  } else {
    await ask('If sign-in is required, complete it in the browser. Press Enter when the form is visible: ');
  }
  if (command === 'inspect') {
    for (const { title, group } of await questions()) {
      console.log(`\nQuestion: ${title}\n${await group.innerText()}`);
    }
  } else {
    for (const [index, row] of rows.entries()) {
      if (index) await page.goto(url);
      const matched = new Set();
      while (true) {
        await waitForControls();
        for (const { title, group } of await questions()) {
          const key = title in row ? title : (
            emailTitle in row && (/^e-?mail(?: address)?$/i.test(title) || await group.locator('input[type=email]').count() === 1)
              ? emailTitle : null
          );
          if (key === null) {
            if (randomMode) await randomAnswer(group, title);
            continue;
          }
          if (matched.has(title)) throw new Error(`Duplicate question title: ${title}`);
          matched.add(key);
          if (row[key] !== '') {
            try { await fillQuestion(group, row[key]); }
            catch (error) { throw new Error(`Row ${index + 1}, question "${title}": ${error.message}`); }
          }
        }
        const next = nextButton();
        if (!await next.count() && !await submitButton().count()) {
          throw new Error('Could not identify Next or Submit. Check the button language; this page is not assumed to be the final page.');
        }
        if (!submitMode) {
          await ask(`Row ${index + 1}/${rows.length}: complete any remaining questions on this page, then press Enter (leave navigation to the program): `);
        }
        if (!await next.count()) break;
        const before = await page.locator('[role="heading"]').allTextContents();
        await next.click();
        await page.waitForFunction(previous => JSON.stringify([...document.querySelectorAll('[role="heading"]')].map(element => element.textContent)) !== JSON.stringify(previous), before);
      }
      const unused = Object.keys(row).filter(key => !matched.has(key));
      if (unused.length) throw new Error(`Unmatched CSV columns: ${unused.join(', ')}`);
      if (submitMode) {
        await submitButton().click();
        await confirmationMessage().waitFor();
        saveUsedEmail(historyFile, row[emailTitle]);
        console.log(`Submitted row ${index + 1}/${rows.length}`);
      } else {
        const confirmation = await ask(`Row ${index + 1}/${rows.length} filled. Submit in the browser, then press Enter. To leave it unsubmitted, type skip: `);
        if (confirmation.trim().toLowerCase() !== 'skip') {
          await confirmationMessage().waitFor();
          saveUsedEmail(historyFile, row[emailTitle]);
          console.log('Submission confirmed; email saved to history.');
        }
      }
    }
  }
} catch (error) {
  console.error(error.message);
  try {
    const diagnostic = {
      time: new Date().toISOString(),
      url: page.url(),
      error: error.stack || String(error),
      buttons: await page.getByRole('button').allTextContents(),
      validation: await page.locator('[role="alert"]').allTextContents(),
    };
    writeFileSync(new URL('./last-error.json', import.meta.url), JSON.stringify(diagnostic, null, 2) + '\n', { mode: 0o600 });
    console.error('Diagnostic saved to last-error.json.');
  } catch (diagnosticError) {
    console.error(`Could not save diagnostic: ${diagnosticError.message}`);
  }
  process.exitCode = 1;
  if (!autoMode) await ask('Stopped. Inspect the browser; press Enter to close: ');
} finally {
  terminal.close();
  await browser.close();
}
