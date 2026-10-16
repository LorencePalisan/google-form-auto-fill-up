import csv
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("analysis", ROOT / "analyze-pearson.py")
analysis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analysis)


class ScreeningTests(unittest.TestCase):
    def test_pattern_history_and_labels_each_block_unique_rows(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as folder:
            root = Path(folder)
            (root / "test-form-used-emails.json").write_text(json.dumps(["test@example.test"]))
            with (root / "synthetic-test-responses.csv").open("w", newline="") as stream:
                writer = csv.writer(stream)
                writer.writerow(["DataType"] + [f"Q{i}" for i in range(22)])
                writer.writerow(["SYNTHETIC TEST ONLY"] + [2]*22)
            rows = [(2, dict.fromkeys(analysis.audit.COLS, "2")),
                    (3, {**dict.fromkeys(analysis.audit.COLS, "3"), "B": " TEST@EXAMPLE.TEST "}),
                    (4, {**dict.fromkeys(analysis.audit.COLS, "4"), "AB": "SYNTHETIC TEST ONLY"}),
                    (5, dict.fromkeys(analysis.audit.COLS, "1"))]
            flags = analysis.synthetic_flags({"B": "Email Address", "AB": "DataType"}, rows, root)
            self.assertEqual(flags[2], ["matches_synthetic_source_pattern"])
            self.assertEqual(flags[3], ["email_in_synthetic_submission_history"])
            self.assertEqual(flags[4], ["explicit_test_data_label"])
            self.assertNotIn(5, flags)

    def test_missing_provenance_files_do_not_silently_disable_screening(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as folder:
            with self.assertRaises(FileNotFoundError):
                analysis.synthetic_flags({}, [], Path(folder))


if __name__ == "__main__":
    unittest.main()
