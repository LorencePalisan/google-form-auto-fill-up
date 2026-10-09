# Google Form CSV filler

## Using your sample.csv

To run without terminal prompts, fill random answers, select the affirmative consent option, and submit the next 5 unused emails:

```sh
npm run fill -- sample.csv --limit 5 --auto
```

`--auto` includes random answering and submission. It stops on unsupported questions, required sign-in, validation errors, or unrecognized controls rather than requesting input. You can supply `--answers answers.json` for fields requiring specific values. Confirmed submissions are saved in history as usual. This mode submits synthetic data; use it for authorized testing on a test copy of the form.

For synthetic test answers, use:

```sh
npm run fill -- sample.csv --limit 1 --random
```

This selects random options, uses `TEST RESPONSE` placeholders for text, and keeps CSV emails and configured shared answers. Consent is selected manually. Unsupported fields also pause for manual input. Review each page before continuing. Random responses are synthetic test data, not actual participant responses. Use a test copy of the questionnaire to keep them separate from research data. English and Filipino navigation labels are supported.

`sample.csv` is a headerless email list. It is supported directly, including the first address:

```sh
npm run fill -- sample.csv
```

The program fills the email and pauses on each page so you can complete other questions. Press Enter in the terminal to let it navigate to the next page.

To process only the first 5 emails:

```sh
npm run fill -- sample.csv --limit 5
```

Replace `5` with any positive whole number. The limit applies to unused emails. Without `--limit`, all unused emails are processed.

Confirmed submissions are saved immediately in `used-emails.json` beside the program. Future runs skip those addresses, even if you use a different CSV. Email comparisons ignore case and surrounding spaces; duplicate addresses within a CSV are skipped too. Keep this history file to preserve progress. Run one instance at a time.

In review mode, submit in the browser and then press Enter so the program can verify the confirmation page and save the email. Type `skip` to leave a response unsubmitted without recording it. Interrupted or failed responses are not marked used. Submissions made before this feature was installed cannot be detected automatically. If the browser confirms submission but the program stops before saving history, check the history before retrying that address.

For shared answers, create an `answers.json` object with exact question titles as keys and answer strings as values, then run:

```sh
npm run fill -- sample.csv --answers answers.json
```

If email detection fails, specify the exact question title with `--email-title "Your email address"`. Add `--submit` only after supplying all required answers and checking a response manually. Email-only data does not provide answers to the other required questions. The program does not invent them.

Uses a visible Playwright browser to fill one response per CSV row. No AI service or API key is needed. Only submit responses you are authorized to provide.

## Setup

Install Node.js 20 or newer, then run:

```sh
npm install
npx playwright install chromium
npm run inspect
```

Sign in manually if prompted. The inspect command prints questions and available choices on the current form page. For a multi-page form, navigate manually and inspect subsequent pages as needed.

Create `answers.csv` with exact question titles as headers, excluding the required-field asterisk. Put one response on each row. Use exact option labels; separate checkbox selections with `|`. Quote CSV values containing commas or newlines. Example (replace these headers with the actual questions):

```csv
Name,Email,Interests
Alex,alex@example.com,Music|Sports
Sam,sam@example.com,Art
```

Review each response manually:

```sh
npm run fill -- answers.csv
```

To explicitly enable automatic submission for every row:

```sh
npm run fill -- answers.csv --submit
```

The program stops on an error and leaves the browser open until you press Enter. Restarting skips submissions already saved in the history file.

Supports ordinary text, radio, checkbox, dropdown, and English-language Next/Submit buttons. Grids, uploads, compound date/time fields, duplicate question titles, and branching forms may require changes. It does not bypass sign-in, CAPTCHA, or response limits. Google UI changes can require selector updates. Do not commit CSV files containing personal data.

The target form could not be accessed from the development environment. Browser behavior and actual question compatibility must be verified locally before batch submission.
