import os
import json
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

USERS_FILE = os.path.join(os.path.dirname(__file__), "data/users.json")
PROGRESS_FILE = os.path.join(os.path.dirname(__file__), "data/progress.json")
WRONG_ANSWERS_FILE = os.path.join(os.path.dirname(__file__), "data/wrong_answers.json")

def reset_db():
    if not os.path.exists("data"):
        os.makedirs("data")
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump([], f)
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump([], f)
    with open(WRONG_ANSWERS_FILE, "w", encoding="utf-8") as f:
        json.dump([], f)

def read_users():
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def write_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2)

def test_all():
    print("--- 테스트 시작 ---")
    reset_db()

    # 1. 신규 유저 초기값 확인
    res = client.post("/auth/register", json={
        "username": "testuser",
        "password": "testpassword",
        "nickname": "TestUser"
    })
    if res.status_code != 201:
        print("Register failed", res.text)
        return
    token = res.json()["access_token"]
    
    users = read_users()
    u = users[0]
    
    print(f"1. 신규 유저 초기값 확인: ", end="")
    if u.get("titles") == [] and u.get("ai_feedback_count") == 0 and u.get("streak") == 0 and u.get("last_login") == "":
        print("✅")
    else:
        print("❌")

    headers = {"Authorization": f"Bearer {token}"}

    # 2. 🌱 첫 발걸음
    res = client.post("/progress/", headers=headers, json={
        "unit": 1,
        "stage": "1-1",
        "score": 100,
        "is_completed": True
    })
    data = res.json()
    newly_earned = [t["id"] for t in data.get("newly_earned_titles", [])]
    
    print(f"2. 첫 발걸음 지급 확인: ", end="")
    if "first_step" in newly_earned:
        print("✅", end=" ")
    else:
        print("❌", end=" ")
        
    res2 = client.post("/progress/", headers=headers, json={
        "unit": 1,
        "stage": "1-1",
        "score": 100,
        "is_completed": True
    })
    data2 = res2.json()
    newly_earned2 = [t["id"] for t in data2.get("newly_earned_titles", [])]
    if "first_step" not in newly_earned2:
        print("(중복 지급 방지 ✅)")
    else:
        print("(중복 지급 방지 ❌)")


    # 3. 🔥 연속학습자
    users = read_users()
    users[0]["streak"] = 7
    users[0]["last_login"] = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    write_users(users)

    client.post("/auth/login", json={
        "username": "testuser",
        "password": "testpassword"
    })
    users = read_users()
    print(f"3. 연속학습자 스트릭 갱신 확인: ", end="")
    if users[0]["streak"] == 8:
        print("✅", end=" ")
    else:
        print("❌", end=" ")

    res = client.post("/progress/", headers=headers, json={
        "unit": 1,
        "stage": "1-2",
        "score": 100,
        "is_completed": True
    })
    data = res.json()
    newly_earned = [t["id"] for t in data.get("newly_earned_titles", [])]
    if "streak_7" in newly_earned:
        print("(칭호 지급 ✅)")
    else:
        print("(칭호 지급 ❌)")


    # 4. ⚔️ 보스슬레이어
    res = client.post("/boss/start?unit=1", headers=headers)
    boss_q = res.json()
    q_id = boss_q.get("question_id", boss_q.get("id"))
    
    res = client.post("/boss/answer", headers=headers, json={
        "question_id": q_id,
        "user_answer": str(boss_q.get("answer")), 
        "boss_hp": 150,
        "my_hp": 1000
    })
    data = res.json()
    newly_earned = [t["id"] for t in data.get("newly_earned_titles", [])]
    print(f"4. 보스슬레이어 지급 확인: ", end="")
    if "boss_slayer" in newly_earned:
        print("✅")
    else:
        print(f"❌ (titles: {newly_earned})")


    # 5. 🧠 AI 탐구자
    users = read_users()
    users[0]["ai_feedback_count"] = 9
    write_users(users)

    # 10번째 피드백 요청 (mocking Claude is not needed if the route handles failure gracefully, but we just want the counter to increment)
    res = client.post("/quiz/ai-feedback", headers=headers, json={
        "question": "Q",
        "correct_answer": "A",
        "user_answer": "B"
    })
    users = read_users()
    titles = users[0].get("titles", [])
    print(f"5. AI 탐구자 지급 확인: ", end="")
    if users[0]["ai_feedback_count"] == 10 and "ai_explorer" in titles:
        print("✅")
    else:
        print(f"❌ (count: {users[0].get('ai_feedback_count')}, titles: {titles})")


    # 6. 👑 유닛 마스터
    print(f"6. 유닛 마스터 지급 확인: ", end="")
    for i in range(1, 8):
        res = client.post("/progress/", headers=headers, json={
            "unit": 1,
            "stage": f"1-{i}",
            "score": 100,
            "is_completed": True
        })
        data = res.json()
        newly_earned = [t["id"] for t in data.get("newly_earned_titles", [])]
        if i == 7:
            if "unit_master" in newly_earned:
                print("✅")
            else:
                print(f"❌ (titles: {newly_earned})")

if __name__ == '__main__':
    test_all()
