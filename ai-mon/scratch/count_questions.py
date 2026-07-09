import os
import json
from collections import defaultdict

data_dir = r"c:\AIMON\AIMON1\ai-mon\backend\data"

# Dictionary to store counts: {category: {unit: {type: count}}}
stats = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))

for root, dirs, files in os.walk(data_dir):
    for file in files:
        if file.endswith('.json') and not file.endswith('.lock'):
            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                
                # Check if it has a list of questions
                questions = []
                if isinstance(content, dict) and "questions" in content:
                    questions = content["questions"]
                elif isinstance(content, list):
                    questions = content
                
                for q in questions:
                    if not isinstance(q, dict):
                        continue
                    
                    unit = q.get("unit")
                    q_type = q.get("type") or q.get("quiz_type")
                    
                    # Try to deduce category from directory name
                    category = os.path.basename(root)
                    if not category or category == "data":
                        category = "general"
                        
                    if unit is not None and q_type is not None:
                        # Normalize unit to string for key comparison
                        stats[category][str(unit)][q_type] += 1
            except Exception as e:
                pass

# Print the results in a structured format
print("Category | Unit | Type | Count")
print("-" * 50)
for cat, units in sorted(stats.items()):
    for unit, types in sorted(units.items(), key=lambda x: (int(x[0]) if x[0].isdigit() else 999, x[0])):
        for q_type, count in sorted(types.items()):
            print(f"{cat:15} | {unit:4} | {q_type:20} | {count}")
