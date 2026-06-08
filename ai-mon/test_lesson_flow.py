import os
import sys
import json
import time
import random

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

print("Starting lesson flow tests...")

# 1. 회원가입 -> 토큰 발급
new_id = f"test_{int(time.time())}_{random.randint(0,100)}"
r1 = client.post("/auth/register", json={"username": new_id, "password": "123", "nickname": "test"})
if r1.status_code in [200, 201]:
    res_data = r1.json()
    token = res_data.get("access_token")
    user_obj = res_data.get("user", {})
    course_level = user_obj.get("course_level")
    
    if token and course_level == "beginner":
        print("✅ 1. 회원가입 → 토큰 발급")
    else:
        print(f"❌ 1. 회원가입 → 토큰 발급 fail: token={bool(token)}, course_level={course_level}")
else:
    print(f"❌ 1. 회원가입 → 토큰 발급 error: {r1.status_code} {r1.text}")
    sys.exit(1)

# 2. 유닛 목록 로드
r2 = client.get("/quiz/units")
if r2.status_code == 200:
    data2 = r2.json()
    if isinstance(data2, list) and len(data2) == 8:
        print("✅ 2. 유닛 목록 로드")
    else:
        print(f"❌ 2. 유닛 목록 로드 fail: len={len(data2)}")
else:
    print(f"❌ 2. 유닛 목록 로드 error: {r2.status_code}")

# 3. 특정 유닛 조회
r3 = client.get("/quiz/units/1")
if r3.status_code == 200:
    data3 = r3.json()
    if data3.get("unit_id") == 1 and data3.get("stages") == 7:
        print("✅ 3. 특정 유닛 조회")
    else:
        print(f"❌ 3. 특정 유닛 조회 fail: {data3}")
else:
    print(f"❌ 3. 특정 유닛 조회 error: {r3.status_code}")

# 4. 진행 상황 조회
r4 = client.get("/progress/", headers={"Authorization": f"Bearer {token}"})
if r4.status_code == 200:
    data4 = r4.json()
    if isinstance(data4, list) and len(data4) == 0:
        print("✅ 4. 진행 상황 조회")
    else:
        print(f"❌ 4. 진행 상황 조회 fail: {data4}")
else:
    print(f"❌ 4. 진행 상황 조회 error: {r4.status_code} {r4.text}")

# 5. 브리핑 슬라이드 로드
r5 = client.get("/quiz/lessons/1-1-beginner")
if r5.status_code == 200:
    data5 = r5.json()
    if isinstance(data5.get("slides"), list) and len(data5["slides"]) > 0:
        print("✅ 5. 브리핑 슬라이드 로드")
    else:
        print(f"❌ 5. 브리핑 슬라이드 로드 fail: slides empty or missing")
else:
    print(f"❌ 5. 브리핑 슬라이드 로드 error: {r5.status_code}")

# 6. 스테이지 문제 로드
r6 = client.get("/quiz/questions?unit=1&stage=1-1&course_level=beginner&limit=20&attempt=1")
if r6.status_code == 200:
    data6 = r6.json()
    if isinstance(data6, list) and len(data6) > 0 and all(q.get("quiz_set") == "A" for q in data6):
        print("✅ 6. 스테이지 문제 로드")
    else:
        print(f"❌ 6. 스테이지 문제 로드 fail: len={len(data6)}, quiz_sets={[q.get('quiz_set') for q in data6]}")
else:
    print(f"❌ 6. 스테이지 문제 로드 error: {r6.status_code}")

# 7. 진행 저장
r7 = client.post("/progress/", headers={"Authorization": f"Bearer {token}"}, json={"unit": 1, "stage": "1-1", "is_completed": True, "score": 100})
if r7.status_code == 200:
    data7 = r7.json()
    if "xp_awarded" in data7 and "newly_earned_titles" in data7:
        print("✅ 7. 진행 저장")
    else:
        print(f"❌ 7. 진행 저장 fail: {data7}")
else:
    print(f"❌ 7. 진행 저장 error: {r7.status_code} {r7.text}")

# 8. 진행 저장 후 유닛 잠금 해제 확인
r8 = client.get("/progress/", headers={"Authorization": f"Bearer {token}"})
if r8.status_code == 200:
    data8 = r8.json()
    if any(p.get("stage") == "1-1" and p.get("is_completed") == True for p in data8):
        print("✅ 8. 진행 저장 후 유닛 잠금 해제 확인")
    else:
        print(f"❌ 8. 진행 저장 후 유닛 잠금 해제 확인 fail: {data8}")
else:
    print(f"❌ 8. 진행 저장 후 유닛 잠금 해제 확인 error: {r8.status_code} {r8.text}")

