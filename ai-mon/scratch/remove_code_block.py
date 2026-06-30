import json

filepath = r"c:\AIMON\AIMON1\ai-mon\backend\data\quiz\advanced\unit_2.json"

with open(filepath, "r", encoding="utf-8") as f:
    data = json.load(f)

if "questions" in data and isinstance(data["questions"], list):
    for q in data["questions"]:
        if "code_block" in q:
            del q["code_block"]

with open(filepath, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Removed 'code_block' from unit_2.json successfully.")
