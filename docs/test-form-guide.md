# Submit the saved synthetic batch to the test copy

## Recycling removed

Check remaining paired rows without opening a browser or submitting:

```powershell
node test-form-runner.mjs --status
```

An exhausted batch stops with exit code 2 and a count summary instead of an unhandled stack trace. If unused paired rows are zero, this batch cannot resume. Do not reset history to reuse already submitted rows.

Each unique email is paired with at most one source row in file order. The runner now stops before opening the browser if the requested batch exceeds the remaining paired source rows. It never wraps around the source CSV. A 39-row source cannot support 365 submissions, and adding email addresses does not create additional answers. Keep both inputs and submission history intact across restarts.

Earlier instructions to resume hundreds of synthetic submissions from this 39-row source no longer apply. Existing submitted responses are not repaired by this change and must not be used as final research data.

This runner targets the form ending `Sen6Ha6e9_89YQ6OPYrG-XwK6jA4CPYRA1qbGir8TevVU_qjA` and requires its visible title to be `The Relationship of Social Network to Customer Acquisition among Gadget Repair Services`. The input rows remain synthetic test data. The previously verified test copy was a different form; validation of this destination is still pending.

It pairs rows in `synthetic-test-responses.csv` with emails in `sample.csv` in file order. It preserves all 22 scores and affirmative consent on the test copy. For each row, it independently randomizes the repair service and social media platform with equal probability among eligible options, excluding `None` and `None of the above`. These are test fixtures, not participant statements. This affects future runs only; existing submissions and submission history remain unchanged.

Subsequent batches continue through the unused emails in `sample.csv`, cycling through the 39 saved synthetic score rows. Duplicate emails are skipped, and each email keeps its score-row assignment across restarts. Keep both input files in their existing order.

Verify one row without submitting:

```powershell
node test-form-runner.mjs --limit 1
```

Submit up to 39 unused test rows:

```powershell
node test-form-runner.mjs --limit 39 --submit
```

To give the second question Facebook 40%, Instagram 30%, and TikTok 30% chances:

```powershell
node test-form-runner.mjs --limit 39 --social-weights 40,30,30 --submit
```

The percentages apply independently to each response; batch totals can vary. `None` is excluded. Repair service choices remain equally random with `None of the above` excluded. Omitting `--social-weights` keeps equal chances for the three platforms.

The runner checks the full saved payload before each submission and records confirmed emails in `test-form-used-emails.json`. It does not use or reset the original form's history. Do not run multiple instances or reorder/change either input file partway through a batch. If interrupted after submission but before confirmation/history recording, check the response sheet before retrying. Do not use the original `--auto` command for this batch: it generates new answers.

A live no-submit check verified the first row's 22 scores and email through all form pages. Submission confirmation has not yet been tested. After submitting, export the test response sheet to compare all rows and recompute alpha; incomplete batches will not necessarily match the local report.
