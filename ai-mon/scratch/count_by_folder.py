import os
import json
from collections import defaultdict

data_dir = r"c:\AIMON\AIMON1\ai-mon\backend\data"

# stats: {folder_path: {type: count}}
stats = defaultdict(lambda: defaultdict(int))

for root, dirs, files in os.walk(data_dir):
    for file in files:
        if file.endswith('.json') and not file.endswith('.lock') and 'backup' not in root:
            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                
                questions = content["questions"] if isinstance(content, dict) and "questions" in content else content
                if not isinstance(questions, list):
                    continue
                    
                rel_path = os.path.relpath(root, data_dir)
                for q in questions:
                    if isinstance(q, dict):
                        q_type = q.get("type") or q.get("quiz_type")
                        if q_type:
                            stats[rel_path][q_type] += 1
            except Exception as e:
                pass

print("Relative Folder Path | Type | Count")
print("-" * 60)
for folder, types in sorted(stats.items()):
    for q_type, count in sorted(types.items()):
        print(f"{folder:30} | {q_type:20} | {count}")
