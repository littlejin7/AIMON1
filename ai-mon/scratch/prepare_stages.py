import json
import uuid
from datetime import datetime

PROGRESS_FILE = 'c:/AIMON1/ai-mon/backend/data/progress.json'
with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
    progress = json.load(f)

user_id = "c1c8e838-3645-48f3-8a6a-073952085b61" # tester_beg

# Add stages 1-2 to 1-7 for tester_beg
for s in range(2, 8):
    stage_str = f"1-{s}"
    # check if already exists
    exists = any(p['user_id'] == user_id and p['unit'] == 1 and p['stage'] == stage_str for p in progress)
    if not exists:
        progress.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "unit": 1,
            "stage": stage_str,
            "score": 100,
            "is_completed": True,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        })

with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
    json.dump(progress, f, ensure_ascii=False, indent=2)

print("Progress prepared for tester_beg!")
