import json
from pathlib import Path
import sys

# Import the validator script to run the exact regression checks on quiz/beginner/unit_2.json
sys.path.append(r"c:\AIMON\AIMON1\ai-mon\backend\scripts")
try:
    import validate_question_data as val
except ImportError as e:
    print(f"Error importing validator: {e}")
    sys.exit(1)

issues = []
# Load unit meta
unit_meta = val.load_unit_meta(issues)

# Validate the specific file
filepath = Path(r"c:\AIMON\AIMON1\ai-mon\backend\data\quiz\beginner\unit_2.json")
data = val.load_json(filepath, issues)
expected_unit = val.parse_unit_from_path(filepath)
questions = val.question_items(data, filepath, issues)

for idx, q in enumerate(questions):
    val.validate_question(
        category="quiz",
        level="beginner",
        expected_unit=expected_unit,
        path=filepath,
        idx=idx,
        question=q,
        unit_meta=unit_meta,
        issues=issues
    )

print("=== VALIDATION ISSUES DETECTED FOR quiz/beginner/unit_2.json ===")
if not issues:
    print("None! The file is 100% valid according to the validator.")
else:
    for iss in issues:
        print(iss.format())
