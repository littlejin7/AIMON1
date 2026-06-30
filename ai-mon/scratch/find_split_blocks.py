import os
import json

data_dir = r"c:\AIMON\AIMON1\ai-mon\backend\data"
issues = []

for root, dirs, files in os.walk(data_dir):
    for file in files:
        if file.endswith(".json") and not file.endswith("_lock"):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = json.load(f)
                    
                questions_list = []
                if isinstance(content, list):
                    questions_list = content
                elif isinstance(content, dict):
                    if "questions" in content:
                        questions_list = content["questions"]
                    else:
                        questions_list = [content]
                
                for idx, item in enumerate(questions_list):
                    if not isinstance(item, dict):
                        continue
                    question_text = item.get("question", "")
                    if not isinstance(question_text, str):
                        continue
                    
                    fence_count = question_text.count("```")
                    if fence_count >= 4:
                        issues.append({
                            "file": os.path.relpath(filepath, data_dir),
                            "question_id": item.get("question_id", f"index_{idx}"),
                            "fence_count": fence_count,
                            "text": question_text
                        })
            except Exception as e:
                pass

with open(r"c:\AIMON\AIMON1\ai-mon\scratch\split_blocks_results.json", "w", encoding="utf-8") as f:
    json.dump(issues, f, ensure_ascii=False, indent=2)
print("Done")
