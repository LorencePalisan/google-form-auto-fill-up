# Form filler commands

Run these commands in the project terminal.

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
