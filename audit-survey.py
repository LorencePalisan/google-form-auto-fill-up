"""Audit XLSX F:AA patterns without changing responses; Python standard library only."""
import argparse
import collections
import csv
import hashlib
import json
import posixpath
import sys
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
COLS = list("FGHIJKLMNOPQRSTUVWXYZ") + ["AA"]


def read_workbook(path):
    with zipfile.ZipFile(path) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = ["".join(n.text or "" for n in item.findall(".//s:t", NS))
                       for item in ET.fromstring(archive.read("xl/sharedStrings.xml"))]
        book = ET.fromstring(archive.read("xl/workbook.xml"))
        sheet = book.find("s:sheets/s:sheet", NS)
        rel_id = sheet.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        target = next(r.get("Target") for r in relationships if r.get("Id") == rel_id)
        member = target.lstrip("/") if target.startswith("/") else posixpath.normpath("xl/" + target)
        rows = []
        for row in ET.fromstring(archive.read(member)).findall(".//s:sheetData/s:row", NS):
            cells = {}
            for cell in row.findall("s:c", NS):
                column = "".join(c for c in cell.get("r") if c.isalpha())
                if cell.find("s:f", NS) is not None and column in COLS:
                    raise ValueError(f"{path}: formula in scored cell {cell.get('r')}; export raw responses first")
                value = cell.findtext("s:v", default="", namespaces=NS)
                if cell.get("t") == "s":
                    value = strings[int(value)]
                elif cell.get("t") == "inlineStr":
                    value = "".join(n.text or "" for n in cell.findall(".//s:t", NS))
                cells[column] = value
            if any(cells.values()):
                rows.append((int(row.get("r")), cells))
        if not rows or rows[0][0] != 1 or any(not rows[0][1].get(c) for c in COLS):
            raise ValueError(f"{path}: expected questionnaire headers in F1:AA1")
        return rows[0][1], rows[1:]


def pattern(cells):
    return tuple(cells.get(c, "") for c in COLS)


def audit(final_rows, pilot_rows):
    pilot = {pattern(c) for _, c in pilot_rows if all(pattern(c))}
    counts = collections.Counter(pattern(c) for _, c in final_rows)
    result = []
    for row, cells in final_rows:
        key = pattern(cells)
        reasons = []
        if not all(key):
            reasons.append("incomplete_scored_answers")
        if key in pilot:
            reasons.append("matches_pilot_pattern")
        if counts[key] > 1:
            reasons.append("repeated_final_pattern")
        result.append((row, cells, reasons, counts[key]))
    return result, counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--final", required=True, type=Path)
    parser.add_argument("--pilot", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=Path("reports/survey-audit"))
    args = parser.parse_args()
    headers, final_rows = read_workbook(args.final)
    _, pilot_rows = read_workbook(args.pilot)
    if not final_rows or not pilot_rows:
        parser.error("Both files must contain responses.")
    if any(not all(pattern(c)) for _, c in pilot_rows):
        parser.error("Pilot contains incomplete F:AA answers; verify the source before auditing.")
    result, counts = audit(final_rows, pilot_rows)
    # A new directory prevents accidental overwriting of sources or prior audits.
    args.out.mkdir(parents=True, exist_ok=False)
    columns = sorted(set(headers) | {k for _, cells in final_rows for k in cells},
                     key=lambda c: (len(c), c))
    for name, flagged in [("flagged-for-review.csv", True), ("unflagged-unverified.csv", False)]:
        with (args.out / name).open("w", newline="", encoding="utf-8-sig") as stream:
            writer = csv.writer(stream)
            writer.writerow(["source_excel_row", "review_reasons", "pattern_frequency"] +
                            [headers.get(c, c) for c in columns])
            for row, cells, reasons, frequency in result:
                if bool(reasons) == flagged:
                    writer.writerow([row, "|".join(reasons), frequency] + [cells.get(c, "") for c in columns])
    summary = {
        "final_source": str(args.final.resolve()),
        "pilot_source": str(args.pilot.resolve()),
        "final_sha256": hashlib.sha256(args.final.read_bytes()).hexdigest(),
        "pilot_sha256": hashlib.sha256(args.pilot.read_bytes()).hexdigest(),
        "comparison": "Exact stored values, first worksheet, F:AA; verify both files use the same item order.",
        "responses": len(result), "distinct_patterns": len(counts),
        "pilot_pattern_matches": sum("matches_pilot_pattern" in r for _, _, r, _ in result),
        "flagged": sum(bool(r) for _, _, r, _ in result),
        "unflagged_unverified": sum(not r for _, _, r, _ in result),
        "status": "PROVENANCE_REVIEW_REQUIRED",
        "note": "Matching patterns flag review, not proof of identity or fabrication. No output is authenticated research data. Obtain original collection records; do not regenerate answers or treat deduplication as validation.",
    }
    (args.out / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 2 if summary["flagged"] else 0


if __name__ == "__main__":
    sys.exit(main())
