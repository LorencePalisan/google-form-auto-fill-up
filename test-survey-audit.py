import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("survey_audit", Path(__file__).with_name("audit-survey.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def response(value):
    return dict.fromkeys(module.COLS, value)


class AuditTests(unittest.TestCase):
    def test_all_duplicate_occurrences_flagged_even_without_pilot_match(self):
        rows, _ = module.audit([(2, response("4")), (3, response("4"))], [(2, response("1"))])
        self.assertTrue(all(r[2] == ["repeated_final_pattern"] for r in rows))

    def test_pilot_match_ignores_order_and_identity_fields(self):
        cells = response("3")
        cells["B"] = "different@example.test"
        rows, _ = module.audit([(7, cells)], [(2, response("1")), (3, response("3"))])
        self.assertEqual(rows[0][2], ["matches_pilot_pattern"])

    def test_single_item_difference_and_missing_answer(self):
        changed = response("3")
        changed["AA"] = "4"
        incomplete = response("3")
        incomplete["AA"] = ""
        rows, _ = module.audit([(2, changed), (3, incomplete)], [(2, response("3"))])
        self.assertEqual(rows[0][2], [])
        self.assertEqual(rows[1][2], ["incomplete_scored_answers"])


if __name__ == "__main__":
    unittest.main()
