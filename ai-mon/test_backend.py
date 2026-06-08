import os
import sys
import json
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

print("Starting tests...")

# 1. lessons.json
resp = client.get("/quiz/units")
data = resp.json()
if len(data) == 8 and all(k in data[0] for k in ["unit_id", "title", "stages", "icon", "difficulty"]):
    ids = [u["unit_id"] for u in data]
    if sorted(ids) == list(range(1, 9)):
        print("✅ 1. lessons.json — 유닛 목록 정상 반환")
    else:
        print(f"❌ 1. lessons.json — unit_id missing: {ids}")
else:
    print(f"❌ 1. lessons.json — invalid format or count: {len(data)}")

# 2. 레슨 네비게이션
r2 = client.get("/quiz/units/1")
if r2.status_code == 200:
    if r2.json()["stages"] == 7:
        r2_q = client.get("/quiz/questions?unit=1&stage=1-1&course_level=beginner&limit=20&attempt=1")
        qs = r2_q.json()
        if len(qs) <= 10 and all(q.get("quiz_set") == "A" and q.get("stage") == "1-1" for q in qs):
            print("✅ 2. 레슨 네비게이션 — 오늘 학습 시작하기")
        else:
            print(f"❌ 2. 레슨 네비게이션 — questions fail: len={len(qs)}, sample={qs[:1] if qs else []}")
    else:
        print(f"❌ 2. 레슨 네비게이션 — stages is {r2.json().get('stages')} not 7")
else:
    print(f"❌ 2. 레슨 네비게이션 — 404 error")

# 3. 레벨 폴백 questions
r3 = client.get("/quiz/questions?unit=1&stage=1-1&course_level=intermediate&limit=20&attempt=1")
r3_a = client.get("/quiz/questions?unit=1&stage=1-1&course_level=advanced&limit=20&attempt=1")
if r3.status_code == 200 and len(r3.json()) > 0 and r3_a.status_code == 200 and len(r3_a.json()) > 0:
    print("✅ 3. 레벨 폴백 — intermediate 유저 문제 로드")
else:
    print(f"❌ 3. 레벨 폴백 — fail: int={len(r3.json()) if r3.status_code==200 else r3.status_code}, adv={len(r3_a.json()) if r3_a.status_code==200 else r3_a.status_code}")

# 4. 레벨 폴백 lessons
r4 = client.get("/quiz/lessons/1-1-intermediate")
if r4.status_code == 200:
    lesson_id = r4.json().get("lesson_id")
    if lesson_id == "1-1-beginner":
        print("✅ 4. 레벨 폴백 — 브리핑 슬라이드")
    else:
        print(f"❌ 4. 레벨 폴백 — fail: status={r4.status_code}, lesson_id={lesson_id}")
else:
    print(f"❌ 4. 레벨 폴백 — fail: status={r4.status_code}")

# 5. 회원가입 아이디 중복 확인
r5_1 = client.get("/auth/check-id?username=존재하지않는아이디123")
with open('backend/data/users.json', encoding='utf-8') as f:
    users = json.load(f)
existing_username = users[0]["username"]
r5_2 = client.get(f"/auth/check-id?username={existing_username}")
if r5_1.status_code == 200 and r5_1.json() == {"ok": True}:
    if r5_2.status_code == 400 and "이미 존재하는 아이디입니다" in r5_2.json().get("detail", ""):
        print("✅ 5. 회원가입 — 중복 아이디 확인 API")
    else:
        print(f"❌ 5. 회원가입 — existing id fail: {r5_2.status_code} {r5_2.text}")
else:
    print(f"❌ 5. 회원가입 — new id fail: {r5_1.status_code} {r5_1.text}")

# 6. 회원가입 신규유저
import time
import random
new_id = f"test_{int(time.time())}_{random.randint(0,100)}"
r6 = client.post("/auth/register", json={"username": new_id, "password": "123", "nickname": "test"})
if r6.status_code in [200, 201]:
    u = r6.json()
    user_data = u.get("user", {})
    if "titles" in user_data and "ai_feedback_count" in user_data and "streak" in user_data and "last_login" in user_data:
        print("✅ 6. 회원가입 — 신규 유저 초기 필드")
    else:
        print(f"❌ 6. 회원가입 — missing fields: {user_data}")
else:
    print(f"❌ 6. 회원가입 — error: {r6.status_code} {r6.text}")

token = u["access_token"]

# 7. 칭호 - 첫 발걸음
r7 = client.post("/progress/", headers={"Authorization": f"Bearer {token}"}, json={"unit": 1, "stage": "1-1", "is_completed": True, "score": 100})
if r7.status_code == 200:
    res = r7.json()
    newly = [t["id"] for t in res.get("newly_earned_titles", [])]
    if "first_step" in newly:
        r7_2 = client.post("/progress/", headers={"Authorization": f"Bearer {token}"}, json={"unit": 1, "stage": "1-1", "is_completed": True, "score": 100})
        newly_2 = [t["id"] for t in r7_2.json().get("newly_earned_titles", [])]
        if "first_step" not in newly_2:
            print("✅ 7. 칭호 — 🌱 첫 발걸음")
        else:
            print(f"❌ 7. 칭호 - duplicated: {newly_2}")
    else:
        print(f"❌ 7. 칭호 - first_step not found: {newly}")
else:
    print(f"❌ 7. 칭호 - error: {r7.status_code} {r7.text}")

# 8. 칭호 - 보스 슬레이어
with patch("services.claude_service.ask_claude") as mock_ask:
    # return an object that can be json.loads since boss.py does `json.loads(text)`
    # wait, ask_claude returns dict. boss.py does: `result = await ask_claude(...)` and expects dict.
    mock_ask.return_value = {'is_clear': True, 'score': 100, 'feedback': 'Good'}
    r8 = client.post("/boss/answer", headers={"Authorization": f"Bearer {token}"}, json={"unit": 1, "stage": "1-8", "user_answer": "print('hello')", "question_id": "b1"})
    if r8.status_code == 200:
        res = r8.json()
        newly = [t["id"] for t in res.get("newly_earned_titles", [])]
        if "boss_slayer" in newly:
            print("✅ 8. 칭호 — ⚔️ 보스슬레이어")
        else:
            print(f"❌ 8. 칭호 - boss_slayer not found: {newly}")
    else:
        print(f"❌ 8. 칭호 - error: {r8.status_code} {r8.text}")

# 9. 칭호 - AI 탐구자
with open('backend/data/users.json', 'r', encoding='utf-8') as f:
    users = json.load(f)
for user in users:
    if user["username"] == new_id:
        user["ai_feedback_count"] = 9
        break
with open('backend/data/users.json', 'w', encoding='utf-8') as f:
    json.dump(users, f, ensure_ascii=False, indent=2)

with patch("services.claude_service.ask_claude") as mock_ask2:
    mock_ask2.return_value = {"success": True, "feedback": "Good job"}
    r9 = client.post("/quiz/ai-feedback", headers={"Authorization": f"Bearer {token}"}, json={"question": "a", "correct_answer": "a", "user_answer": "a", "level": "beginner"})
    if r9.status_code == 200:
        with open('backend/data/users.json', 'r', encoding='utf-8') as f:
            users2 = json.load(f)
        for user in users2:
            if user["username"] == new_id:
                if "ai_explorer" in user.get("titles", []):
                    print("✅ 9. 칭호 — 🧠 AI 탐구자")
                else:
                    print(f"❌ 9. 칭호 - ai_explorer not found in DB")
                break
    else:
        print(f"❌ 9. 칭호 - error: {r9.status_code} {r9.text}")

