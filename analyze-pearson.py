"""Audit an XLSX export before testing the paper's primary Pearson hypothesis."""
import argparse
import csv
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("audit_survey", ROOT / "audit-survey.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def score(value):
    labels = {"1 - Strongly Disagree": 1, "2 - Disagree": 2,
              "3 - Agree": 3, "4 - Strongly Agree": 4}
    text = value.strip()
    number = labels[text] if text in labels else float(text)
    if number not in (1, 2, 3, 4):
        raise ValueError("Expected a Likert score from 1 to 4")
    return int(number)


def canonical_rows(rows):
    result, invalid = [], []
    for row, cells in rows:
        converted = dict(cells)
        try:
            converted.update({c: str(score(cells.get(c, ""))) for c in audit.COLS})
        except ValueError:
            invalid.append(row)
        result.append((row, converted))
    return result, invalid


def synthetic_flags(headers, rows, root=ROOT):
    """Screen local test provenance even when a pattern occurs only once."""
    history_path = root / "test-form-used-emails.json"
    library_path = root / "synthetic-test-responses.csv"
    history = json.loads(history_path.read_text(encoding="utf-8-sig"))
    if not isinstance(history, list) or any(not isinstance(v, str) for v in history):
        raise ValueError("Invalid synthetic submission history; analysis stopped.")
    emails = {v.strip().lower() for v in history}
    patterns = set()
    with library_path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        fields = [v for v in (reader.fieldnames or []) if v not in ("DataType", "TestRespondentID", "Batch")]
        if len(fields) != 22:
            raise ValueError("Synthetic source must contain 22 scored items; analysis stopped.")
        for item in reader:
            patterns.add(tuple(str(score(item[f])) for f in fields))
    email_columns = [c for c, title in headers.items() if "email" in title.lower() or "e-mail" in title.lower()]
    type_columns = [c for c, title in headers.items() if title.strip().lower() in ("datatype", "data type")]
    found = {}
    for row, cells in rows:
        reasons = []
        if audit.pattern(cells) in patterns:
            reasons.append("matches_synthetic_source_pattern")
        if any(cells.get(c, "").strip().lower() in emails for c in email_columns):
            reasons.append("email_in_synthetic_submission_history")
        if any("synthetic" in cells.get(c, "").lower() or "test" in cells.get(c, "").lower() for c in type_columns):
            reasons.append("explicit_test_data_label")
        if reasons:
            found[row] = reasons
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--final", required=True, type=Path)
    parser.add_argument("--pilot", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=Path("reports/pearson-analysis"))
    args = parser.parse_args()
    headers, final_rows = audit.read_workbook(args.final)
    _, pilot_rows = audit.read_workbook(args.pilot)
    if not final_rows or not pilot_rows:
        parser.error("Both workbooks must contain responses.")
    final_rows, invalid = canonical_rows(final_rows)
    pilot_rows, invalid_pilot = canonical_rows(pilot_rows)
    if invalid_pilot:
        parser.error("Pilot has incomplete or invalid scored items; verify the source.")
    reviewed, _ = audit.audit(final_rows, pilot_rows)
    provenance_flags = synthetic_flags(headers, final_rows)
    for row, _, reasons, _ in reviewed:
        reasons.extend(provenance_flags.get(row, []))
    flagged = [{"excel_row": row, "reasons": reasons} for row, _, reasons, _ in reviewed if reasons]
    scored = []
    for row, cells in final_rows:
        if row in invalid:
            continue
        try:
            scored.append([score(v) for v in audit.pattern(cells)])
        except ValueError:
            invalid.append(row)
    report = {
        "status": "BLOCKED_DATA_REVIEW" if flagged or invalid else "CONDITIONAL_ANALYSIS",
        "source": str(args.final.resolve()),
        "source_sha256": hashlib.sha256(args.final.read_bytes()).hexdigest(),
        "pilot": str(args.pilot.resolve()),
        "pilot_sha256": hashlib.sha256(args.pilot.read_bytes()).hexdigest(),
        "responses": len(final_rows), "flagged_count": len(flagged),
        "flagged_rows": flagged, "invalid_score_rows": invalid,
        "synthetic_screening": "Compared normalized patterns with synthetic-test-responses.csv and emails with test-form-used-emails.json; missing/invalid screening files stop analysis. Explicit test labels also block analysis.",
        "hypothesis": "H0: population correlation between Social Network and Customer Acquisition is zero; H1: nonzero.",
        "method": "Two-sided Pearson r, significance level 0.05; reject if unrounded p <= 0.05.",
        "scoring": "Social Network: mean F:S (14 items); Customer Acquisition: mean T:AA (8 items). Brand Visibility F:I; Sharing J:N; Relationship O:S. No reverse coding. Verify column/item order against the questionnaire.",
        "limitations": "Pattern screening does not authenticate respondents. Verify genuine independent collection, eligibility, scoring, linearity, influential outliers, and suitability of the normal-model test before using findings. Exploratory dimension p-values are unadjusted and do not decide the primary hypothesis. Correlation does not establish causation.",
        "results": [],
    }
    if not flagged and not invalid:
        script = "import './local-replica/dist/pearson.js';let s='';for await(const c of process.stdin)s+=c;console.log(JSON.stringify(PearsonAnalysis.analyze(JSON.parse(s))));"
        result = subprocess.run(["node", "--input-type=module", "-e", script], input=json.dumps(scored),
                                text=True, capture_output=True, cwd=ROOT, check=True)
        report["results"] = json.loads(result.stdout)
    args.out.mkdir(parents=True, exist_ok=False)
    (args.out / "pearson-results.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    lines = ["# Pearson correlation analysis", "", f"Status: {report['status']}", "", report["hypothesis"], "", report["scoring"], ""]
    if flagged or invalid:
        lines += [f"Analysis withheld: {len(flagged)} flagged responses; {len(invalid)} responses with invalid scores.",
                  "No null-hypothesis decision is supported by this run. Obtain and verify original collection records; do not substitute generated answers."]
    else:
        lines += ["| Comparison with Customer Acquisition | Role | n | r | Two-sided p | Conditional decision |",
                  "| --- | --- | --- | --- | --- | --- |"]
        for r in report["results"]:
            r_text = 'N/A' if r['r'] is None else f"{r['r']:.6f}"
            p_text = 'N/A' if r['p'] is None else ('< 1e-15' if r['p'] < 1e-15 else f"{r['p']:.8g}")
            lines.append(f"| {r['variable']} | {r['role']} | {r['n']} | {r_text} | {p_text} | {r['decision']} |")
            if r["reason"]:
                lines.append(f"\n{r['variable']}: {r['reason']}\n")
    lines += ["", report["method"], "", report["limitations"], "",
              "Method reference: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html", ""]
    (args.out / "pearson-results.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"{report['status']}: {len(final_rows)} responses; {len(flagged)} flagged; {len(invalid)} invalid. Report: {args.out / 'pearson-results.md'}")
    return 2 if flagged or invalid else 0


if __name__ == "__main__":
    raise SystemExit(main())
