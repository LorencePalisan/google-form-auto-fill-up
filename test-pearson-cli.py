import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent
COLS = list("FGHIJKLMNOPQRSTUVWXYZ") + ["AA"]


def workbook(path, rows, labels=False):
    names = ["1 - Strongly Disagree", "2 - Disagree", "3 - Agree", "4 - Strongly Agree"]
    records = []
    for index, values in enumerate([["Item " + c for c in COLS]] + rows, 1):
        cells = []
        for c, value in zip(COLS, values):
            text = names[value - 1] if labels and index > 1 else str(value)
            cells.append(f'<c r="{c}{index}" t="inlineStr"><is><t>{escape(text)}</t></is></c>')
        records.append(f'<row r="{index}">{"".join(cells)}</row>')
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Test" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr("xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
        z.writestr("xl/worksheets/sheet1.xml", '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + ''.join(records) + '</sheetData></worksheet>')


class CommandTests(unittest.TestCase):
    def run_analysis(self, rows, pilot, labels=False):
        with tempfile.TemporaryDirectory(prefix="pearson-test-", dir=ROOT) as folder:
            folder = Path(folder)
            workbook(folder / "final.xlsx", rows, labels)
            workbook(folder / "pilot.xlsx", pilot)
            command = [sys.executable, str(ROOT / "analyze-pearson.py"), "--final", str(folder / "final.xlsx"),
                       "--pilot", str(folder / "pilot.xlsx"), "--out", str(folder / "report")]
            run = subprocess.run(command, capture_output=True, text=True)
            self.assertIn(run.returncode, (0, 2), run.stderr)
            return run.returncode, json.loads((folder / "report/pearson-results.json").read_text())

    def test_labels_match_numeric_pilot_and_block_inference(self):
        code, report = self.run_analysis([[2]*22, [3]*22, [4]*22], [[2]*22], True)
        self.assertEqual(code, 2)
        self.assertEqual(report["flagged_count"], 1)
        self.assertEqual(report["results"], [])
        self.assertEqual(report["invalid_score_rows"], [])

    def test_unflagged_fixture_runs_scoring_and_hypothesis_test(self):
        code, report = self.run_analysis([[v]*22 for v in [1, 2, 3, 4]], [[1]*14+[4]*8], True)
        self.assertEqual(code, 0)
        self.assertEqual(report["results"][0]["decision"], "Reject H0")
        self.assertEqual(report["results"][0]["n"], 4)

    def test_duplicate_final_and_invalid_scores_block(self):
        code, report = self.run_analysis([[2]*22, [2]*22, [5]*22], [[1]*22])
        self.assertEqual(code, 2)
        self.assertEqual(report["flagged_count"], 2)
        self.assertEqual(report["invalid_score_rows"], [4])
        self.assertEqual(report["results"], [])


if __name__ == "__main__":
    unittest.main()
