import json
import os
import sys
import io
from fastapi.testclient import TestClient
from main import app
from jose import jwt

sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')
client = TestClient(app)

SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
WRONG_FILE = r'c:\AIMON1\ai-mon\backend\data\wrong_answers.json'

test_user_id = "test-wrong-user"
token = jwt.encode({"sub": test_user_id}, SECRET_KEY, algorithm=ALGORITHM)
headers = {"Authorization": f"Bearer {token}"}

# Add wrong answers for test user
with open(WRONG_FILE, "r", encoding="utf-8") as f:
    wrong_data = json.load(f)

# Clear existing test user wrong data
wrong_data = [w for w in wrong_data if w.get("user_id") != test_user_id]

wrong_data.append({
    "user_id": test_user_id,
    "wrong_answers": [
        {"question_id": "cc_beg_mc_1_1_001", "reviewed": False},
        {"question_id": "cc_beg_mc_1_1_002", "reviewed": False}
    ]
})

with open(WRONG_FILE, "w", encoding="utf-8") as f:
    json.dump(wrong_data, f, ensure_ascii=False, indent=2)

res = client.get("/train/review?unit=1&limit=15&course_level=beginner", headers=headers)
data = res.json()

print(f"Total questions returned: {len(data)}")
if len(data) > 0:
    first_two_ids = [q.get("question_id") for q in data[:2]]
    print(f"First two question IDs: {first_two_ids}")
    if "cc_beg_mc_1_1_001" in first_two_ids and "cc_beg_mc_1_1_002" in first_two_ids:
        print("SUCCESS: Wrong answers prioritized")
    else:
        print("FAIL: Wrong answers not at the front")

# Clean up
wrong_data = [w for w in wrong_data if w.get("user_id") != test_user_id]
with open(WRONG_FILE, "w", encoding="utf-8") as f:
    json.dump(wrong_data, f, ensure_ascii=False, indent=2)
