import sys
import os
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

# Add backend directory to python path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

from main import app
from routers import utils as U

client = TestClient(app)

# 10문항 전체 정답 예시 (이 경우 100점, 레벨: advanced)
ALL_CORRECT_ANSWERS = [
    {"questionId": "lt1", "selectedAnswer": 1},  # syntax (answer: 1)
    {"questionId": "lt2", "selectedAnswer": 1},  # syntax (answer: 1)
    {"questionId": "lt3", "selectedAnswer": 1},  # structure (answer: 1)
    {"questionId": "lt4", "selectedAnswer": 1},  # structure (answer: 1)
    {"questionId": "lt5", "selectedAnswer": 1},  # syntax (answer: 1)
    {"questionId": "lt6", "selectedAnswer": 1},  # syntax (answer: 1)
    {"questionId": "lt7", "selectedAnswer": 2},  # control (answer: 2)
    {"questionId": "lt8", "selectedAnswer": 1},  # control (answer: 1)
    {"questionId": "lt9", "selectedAnswer": 1},  # control (answer: 1)
    {"questionId": "lt10", "selectedAnswer": 1}, # control (answer: 1)
]

# 일부 오답 예시 (초급 2개만 맞춤, 레벨: beginner)
SOME_WRONG_ANSWERS = [
    {"questionId": "lt1", "selectedAnswer": 1},  # syntax (O)
    {"questionId": "lt2", "selectedAnswer": 1},  # syntax (O)
    {"questionId": "lt3", "selectedAnswer": 2},  # structure (X)
    {"questionId": "lt4", "selectedAnswer": 2},  # structure (X)
    {"questionId": "lt5", "selectedAnswer": 2},  # syntax (X)
    {"questionId": "lt6", "selectedAnswer": 2},  # syntax (X)
    {"questionId": "lt7", "selectedAnswer": 1},  # control (X)
    {"questionId": "lt8", "selectedAnswer": 2},  # control (X)
    {"questionId": "lt9", "selectedAnswer": 2},  # control (X)
    {"questionId": "lt10", "selectedAnswer": 2}, # control (X)
]

# 중급 레벨 도달 예시 (초급 3/4 [O], 중급 2/3 [O], 고급 1/3 [X] -> intermediate)
INTERMEDIATE_ANSWERS = [
    {"questionId": "lt1", "selectedAnswer": 1},  # syntax (O)
    {"questionId": "lt2", "selectedAnswer": 1},  # syntax (O)
    {"questionId": "lt3", "selectedAnswer": 1},  # structure (O)
    {"questionId": "lt4", "selectedAnswer": 2},  # structure (X)
    {"questionId": "lt5", "selectedAnswer": 1},  # syntax (O)
    {"questionId": "lt6", "selectedAnswer": 1},  # syntax (O)
    {"questionId": "lt7", "selectedAnswer": 1},  # control (X)
    {"questionId": "lt8", "selectedAnswer": 2},  # control (X)
    {"questionId": "lt9", "selectedAnswer": 2},  # control (X)
    {"questionId": "lt10", "selectedAnswer": 2}, # control (X)
]


def test_submit_level_test_guest():
    """로그인하지 않은 게스트 사용자의 레벨 테스트 제출"""
    # 1. 100점 (Advanced) 테스트
    response = client.post("/auth/level-test/submit", json={"answers": ALL_CORRECT_ANSWERS})
    assert response.status_code == 200
    data = response.json()
    assert data["levelKey"] == "advanced"
    assert data["totalCorrect"] == 10
    assert data["score"] == 100
    assert data["categoryPercentages"]["syntax"] == 100
    assert data["categoryPercentages"]["structure"] == 100
    assert data["categoryPercentages"]["control"] == 100
    assert data["user"] is None

    # 2. Beginner 레벨 테스트
    response = client.post("/auth/level-test/submit", json={"answers": SOME_WRONG_ANSWERS})
    assert response.status_code == 200
    data = response.json()
    assert data["levelKey"] == "beginner"
    assert data["totalCorrect"] == 2
    assert data["score"] == 20
    assert data["categoryPercentages"]["syntax"] == 50  # syntax 4개 중 2개 맞춤
    assert data["categoryPercentages"]["structure"] == 0
    assert data["categoryPercentages"]["control"] == 0

    # 3. Intermediate 레벨 테스트
    response = client.post("/auth/level-test/submit", json={"answers": INTERMEDIATE_ANSWERS})
    assert response.status_code == 200
    data = response.json()
    assert data["levelKey"] == "intermediate"
    # 초급: lt1, lt2, lt3 (3개 맞춤)
    # 중급: lt5, lt6 (2개 맞춤)
    # 고급: 다 틀림 (0개 맞춤)
    # syntax(기본문법): lt1(O), lt2(O), lt5(O), lt6(O) -> 4개 중 4개 (100%)
    # structure(자료구조): lt3(O), lt4(X) -> 2개 중 1개 (50%)
    # control(논리제어): lt7(X), lt8(X), lt9(X), lt10(X) -> 4개 중 0개 (0%)
    assert data["categoryPercentages"]["syntax"] == 100
    assert data["categoryPercentages"]["structure"] == 50
    assert data["categoryPercentages"]["control"] == 0


def test_submit_level_test_logged_in():
    """로그인한 사용자의 레벨 테스트 제출 및 유저 정보 업데이트 검증"""
    mock_user = {
        "id": "mock-user-123",
        "username": "tester",
        "course_level": "beginner",
        "is_level_tested": False,
        "role": "student",
        "nickname": "Tester",
        "email": "test@test.com",
        "xp": 100,
        "lv": 2
    }

    # app.dependency_overrides를 사용하여 get_current_user_optional이 mock_user를 반환하게 만듦
    app.dependency_overrides[U.get_current_user_optional] = lambda: mock_user

    # mutate_user_atomic mocking
    def mock_mutate_user_atomic(user_id, mutator):
        assert user_id == mock_user["id"]
        mutator(mock_user)
        return mock_user

    with patch("routers.auth.mutate_user_atomic", side_effect=mock_mutate_user_atomic):
        response = client.post("/auth/level-test/submit", json={"answers": ALL_CORRECT_ANSWERS})
        assert response.status_code == 200
        data = response.json()
        
        # 결과값 검증
        assert data["levelKey"] == "advanced"
        assert data["totalCorrect"] == 10
        assert data["user"] is not None
        assert data["user"]["course_level"] == "advanced"
        assert data["user"]["is_level_tested"] is True

    # 의존성 주입 재설정 초기화
    app.dependency_overrides.clear()
