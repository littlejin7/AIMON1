import json
with open('c:/AIMON/AIMON1/ai-mon/backend/data/endboss/advanced.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for q in data:
    if q.get('type') == 'code_multi_input':
        ans = q.get('answer', [])
        choices = q.get('choices', [])
        print(f"Q: {q['question_id']}, ans: {len(ans)}, choices: {len(choices)}")
