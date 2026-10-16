# Form filler commands

Run these commands in the project terminal.

## Pearson correlation and the primary null hypothesis

Final analysis also blocks matches to the local synthetic source, email addresses in `test-form-used-emails.json`, and explicit test-data labels. Keep `synthetic-test-responses.csv` and the test submission history: missing or invalid screening files stop analysis rather than silently skipping checks. These checks flag known contamination; they do not authenticate other rows. The test runner no longer cycles a short source batch across additional emails.

```powershell
npm.cmd run analyze:pearson -- --final "Actual Survey Result.xlsx" --pilot "latest-response.xlsx" --out "reports/my-pearson-run"
```

Requires Python 3 and Node.js. Use the actual pilot export and a new output directory. Creates `pearson-results.md` and `pearson-results.json`, preserving workbooks. The primary test compares each respondent's mean F:S (Social Network, 14 items) with mean T:AA (Customer Acquisition, 8 items). Verify the first worksheet's column order. Numeric 1–4 and the export's exact English labels such as `4 - Strongly Agree` are supported. No answers are generated or imputed.

The command screens normalized scored patterns against the pilot and within the final data. Missing/invalid scores or flagged patterns block inference (exit code 2), with source row numbers in the JSON. Successful calculation exits 0, but still requires verification of genuine independent collection and statistical assumptions. Repeated patterns are review flags, not proof of identity or fabrication. There is no automatic deduplication or bypass for flagged data.

The primary hypothesis uses a two-sided Pearson test at 0.05, as stated in `RESEARCH PAPER.docx`: reject H0 only if unrounded p <= 0.05; otherwise fail to reject H0. Dimension comparisons are exploratory with unadjusted p-values. Constant variables or fewer than three paired responses are not testable. The command cannot guarantee rejection or authenticate source data.

Open `local-replica/dist/index.html` for the Pearson demonstration interface. Its generated and manually entered batches remain test data. Cronbach's alpha is still a separate pilot reliability measure; existing alpha reports are historical, not final Pearson results.

```powershell
npm.cmd run test:pearson
python test-pearson-cli.py
```

## Audit final responses for reused pilot patterns

Requires Python 3, with no additional packages:

```powershell
python audit-survey.py --final "Actual Survey Result.xlsx" --pilot "latest-response.xlsx" --out "reports/survey-audit"
```

Use the actual pilot export for `--pilot`. The command compares exact stored values in F:AA on each workbook's first worksheet; verify that both files have the same 22 items in the same column order. It preserves the source workbooks and writes all rows into two review files, retaining source Excel row numbers:

- `flagged-for-review.csv`: every pilot-pattern match, every occurrence of a repeated final pattern, and responses with missing scored answers.
- `unflagged-unverified.csv`: remaining rows, still requiring provenance verification.
- `summary.json`: counts, source paths, and SHA-256 hashes.

The output directory must be new; choose another `--out` path for subsequent runs. Exit code 2 means flagged rows were found; 0 means no pattern flags, not that respondents were authenticated. Errors exit nonzero.

This command supports investigation; it cannot reconstruct genuinely collected answers or make the final dataset valid by deleting duplicates. Obtain original responses and collection records from the Google Forms owner, identify pilot/automated submissions, and recollect genuine final responses where necessary before computing research findings. CSV output contains respondent data and should be kept private.

The simulated B. Sharing, C. Relationship, and Customer Acquisition generators preserve each item's specified frequencies and assign responses using a shared respondent ordering to model a common underlying trait. Their alphas describe this explicit simulation assumption; they are not evidence about actual survey reliability.

## Generate a simulated B. Sharing dataset

```sh
npm.cmd run sample:sharing
```

Creates `data/samples/simulated-test-b-sharing.csv` with 39 simulated respondents and five Likert items (`Q1`–`Q5`), then prints each item’s category frequencies and percentages plus Cronbach’s alpha computed from the generated respondent-level data. The default seed is `20261010`; rerunning the command produces the same dataset and alpha. Use `node generate-sharing-sample.mjs --seed 123 --output another-simulated-sample.csv` to choose a different seed or output filename. This dataset is for code testing only, not actual survey results.

## Generate a simulated C. Relationship dataset

```sh
npm.cmd run sample:relationship
```

Creates `data/samples/simulated-test-c-relationship.csv` with 39 simulated respondents and five Likert items (`Q1`–`Q5`), then prints each item’s category frequencies and percentages plus Cronbach’s alpha computed from the generated respondent-level data. It uses the reproducible default seed (`20261010`). This dataset is for code testing only, not actual survey results.

## Print a hypothetical Likert summary table

```sh
npm.cmd run table:likert
```

Prints respondent counts, weighted totals, and percentages of the 156-point maximum for the four hypothetical items. It validates that each item has exactly 39 responses and flags any supplied totals that do not match the scale formula. The values are sample data, not actual survey results.

## Generate a simulated Customer Acquisition dataset

```sh
npm.cmd run sample:acquisition
```

Creates `data/samples/simulated-test-customer-acquisition.csv` with 39 hypothetical respondents answering eight Likert items. It validates every item's frequencies total exactly 39, then prints response counts and percentages, weighted totals, and Cronbach’s alpha computed from the generated respondent-level data. This is simulated educational data, not actual survey results.

## Install dependencies

```sh
npm install
npx playwright install chromium
```

## Inspect the form

```sh
npm run inspect
```

Prints the questions and choices on the current page. Press Enter when the form is visible.

## Fill one email with manual answers

```sh
npm run fill -- sample.csv --limit 1
```

Fills the next unused email. Answer remaining questions in the browser, then press Enter in the terminal to let the program navigate. On the final page, submit in the browser and press Enter to confirm completion. Type `skip` at the final prompt to leave the response unsubmitted.

## Random answers with manual review

```sh
npm run fill -- sample.csv --limit 1 --random
```

Generates random options and test text. Consent is selected manually in the browser. Review each page and press Enter to continue. Typing `i agree` in the terminal does not select the form's consent option.

## Fully automatic run

```sh
npm run fill -- sample.csv --limit 3 --auto
```

Processes the next 3 unused emails, selects the affirmative consent option, generates random answers, navigates, and submits without terminal prompts. Replace `3` with the desired count.

Use synthetic responses on a test copy of the questionnaire, separate from research data. Unsupported questions, validation errors, or CAPTCHA may stop the run. This command does not bypass CAPTCHA.

## Process all unused emails automatically

```sh
npm run fill -- sample.csv --auto
```

## Use configured shared answers

Create `answers.json` with exact question titles as keys and answer strings as values. For checkboxes, separate selections with `|`.

```json
{
  "Example question title": "Exact option label"
}
```

Review mode:

```sh
npm run fill -- sample.csv --limit 1 --answers answers.json
```

Automatic mode (remaining questions receive random test answers):

```sh
npm run fill -- sample.csv --limit 1 --answers answers.json --auto
```

## Specify the email question title

```sh
npm run fill -- sample.csv --limit 1 --email-title "Email" --auto
```

Replace `Email` with the exact title if automatic email matching fails.

## Submit configured answers without random answers

```sh
npm run fill -- sample.csv --limit 1 --answers answers.json --submit
```

Requires all required answers in the CSV or shared answers file. Unlike `--auto`, this mode keeps the initial readiness prompt and does not generate random answers.

## Check an error

```sh
cat last-error.json
```

The latest caught browser error is saved here with button labels and validation messages. A successful run does not remove an earlier error log.

## Check used emails

```sh
cat used-emails.json
```

Created after the first confirmed submission. Keep this file: future runs skip these emails. `--limit` applies after skipping used and duplicate emails. Submissions made before tracking was added are not included automatically. Run only one instance at a time.
