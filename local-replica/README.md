# Local Pearson correlation lab

Open `dist/index.html` in a browser. No server or installation is needed. Generate a repeatable synthetic batch, append manual test entries, view Pearson results, and export test responses or demonstration results. Data stay in memory until exported.

The primary comparison follows `RESEARCH PAPER.docx`: each respondent's mean of 14 Social Network items versus their mean of 8 Customer Acquisition items. The four sections contain 4, 5, 5, and 8 items. Items receive equal weight within the overall construct; there is no reverse coding. Confirm scoring against the finalized questionnaire.

The primary two-sided test is H0: population correlation = 0 versus H1: nonzero, at significance level 0.05. It reports r, paired n, and p; rejects H0 only when unrounded p <= 0.05; otherwise fails to reject H0, which does not prove no relationship exists. Fewer than three paired responses or a constant variable returns N/A. Dimension comparisons are exploratory with unadjusted p-values and do not decide the primary hypothesis.

The implementation uses the regularized incomplete beta function, equivalent to the Pearson Student t test with n-2 degrees of freedom. Reference: [SciPy Pearson documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html). Review independent collection, linearity, influential outliers and normal-model assumptions before interpretation. Correlation does not demonstrate causation.

All browser batches and exports remain synthetic demonstrations. The default shared tendency mode uses one tendency across all sections per respondent, demonstrating association between Social Network and Customer Acquisition. With 39 responses and seed 20261010, the primary result is r = 0.867867 and p = 8.54065e-13 (Reject H0). Other seeds or sample sizes can yield different decisions. Within-section correlated mode uses independent section tendencies; uniform and positive modes sample items independently. It does not tune data to produce significance. Browser decisions cannot establish research findings.

For actual XLSX files, run from the project root:

```powershell
npm.cmd run analyze:pearson -- --final "Actual Survey Result.xlsx" --pilot "latest-response.xlsx" --out "reports/my-pearson-run"
```

Use a new output directory each time. Requires Python 3 and Node.js, with no additional packages. The command blocks analysis if any row matches a pilot pattern, repeats a final pattern, or has missing/invalid scores. It does not delete or replace responses. Pattern matches require review; they are not by themselves proof of fabrication. Passing screening does not authenticate respondents or verify statistical assumptions.

Cronbach's alpha remains appropriate for the pilot reliability assessment described in your paper. Existing reliability utilities and historical alpha reports are preserved; Pearson is now the lab's main analysis view.

Validation: `npm.cmd run test:pearson` checks numerical results, both decisions, edge cases and scoring. `python test-pearson-cli.py` checks workbook parsing, audit blocking and analysis.
