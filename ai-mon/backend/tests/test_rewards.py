import sys
import os
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Add backend directory to python path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

from main import app
from routers.utils import apply_xp, calc_level, get_current_user

def test_calc_level():
    # Level 1: 0 - 999 XP
    assert calc_level(0) == 1
    assert calc_level(500) == 1
    assert calc_level(999) == 1
    
    # Level 2: 1000 - 2999 XP (needs 1000 XP)
    assert calc_level(1000) == 2
    assert calc_level(2999) == 2
    
    # Level 3: 3000 - 5999 XP (needs 2000 XP)
    assert calc_level(3000) == 3
    assert calc_level(5999) == 3
    
    # Level 30: max level
    # 0+1000+2000+3000+...+29000 = 29*30/2 * 1000 = 435000 XP
    assert calc_level(435000) == 30
    assert calc_level(1000000) == 30

def test_apply_xp_no_auto_evolution():
    """정책 변경: apply_xp 는 더 이상 자동 진화를 하지 않는다.
    XP 를 아무리 쌓아 lv 이 10/20/30 을 넘어도 character 는 변하지 않고
    evolved 는 항상 None 이어야 한다. (진화는 엔드보스 클리어 전용)"""
    user = {
        "id": "test-user-uuid",
        "username": "testuser",
        "xp": 0,
        "lv": 1,
        "character": "slime",
        "titles": []
    }

    # Apply XP (no level up)
    events = apply_xp(user, 500)
    assert user["xp"] == 500
    assert user["lv"] == 1
    assert user["character"] == "slime"
    assert events["level_up"] is False
    assert events["evolved"] is None

    # lv 10 도달: 레벨은 오르지만 진화는 없어야 한다 (과거엔 robot 이 됐음)
    events = apply_xp(user, 44500)  # Total 45000
    assert user["lv"] == 10
    assert user["character"] == "slime"        # 자동 진화 없음
    assert events["level_up"] is True
    assert events["evolved"] is None

    # lv 20 도달: 여전히 진화 없음
    events = apply_xp(user, 145000)  # Total 190000
    assert user["lv"] == 20
    assert user["character"] == "slime"
    assert events["evolved"] is None

    # lv 30 도달: 여전히 진화 없음. lv 기반 aimon_master 칭호만 부여된다.
    events = apply_xp(user, 245000)  # Total 435000
    assert user["lv"] == 30
    assert user["character"] == "slime"
    assert events["evolved"] is None
    assert "aimon_master" in user["titles"]

def test_apply_xp_event_type_no_op_and_no_evolution():
    """event_type 인자를 줘도 (1) 진화가 발생하지 않고 (2) 레벨은 정상 계산되며
    (3) no-op bump_mission 이 예외 없이 통과해야 한다."""
    base = {"id": "u-base", "xp": 0, "lv": 1, "character": "slime", "titles": []}
    ev_base = apply_xp(base, 45000)  # lv10, 진화 없음

    tagged = {"id": "u-tagged", "xp": 0, "lv": 1, "character": "slime", "titles": []}
    ev_tagged = apply_xp(tagged, 45000, event_type="game_clear")

    assert tagged["lv"] == base["lv"] == 10
    assert tagged["character"] == base["character"] == "slime"   # 자동 진화 없음
    assert ev_tagged["evolved"] == ev_base["evolved"] is None
    assert ev_tagged["level_up"] == ev_base["level_up"] is True

    # bump_mission 이 실행되지만 "game_clear" 는 데일리 정의에 없으므로 d_quiz3 진척 없음.
    daily_prog = tagged.get("missions", {}).get("daily", {}).get("progress", {})
    assert daily_prog.get("d_quiz3", 0) == 0  # game_clear ≠ stage_clear → 진척 없음

    # 모든 이벤트 타입 호출이 예외 없이 동작
    for et in ("stage_clear", "miniboss_clear", "boss_clear", "ai_feedback", "login"):
        u = {"id": f"u-{et}", "xp": 0, "lv": 1, "character": "slime", "titles": []}
        apply_xp(u, 100, {}, event_type=et)
        assert u["xp"] == 100


def test_apply_xp_titles():
    user = {
        "id": "test-user-uuid",
        "username": "testuser",
        "xp": 0,
        "lv": 1,
        "character": "slime",
        "streak": 7,
        "titles": []
    }
    
    # When context matches and we call apply_xp
    events = apply_xp(user, 0, {"stage_completed": True})
    
    # Should get first_step and streak_7
    assert "first_step" in user["titles"]
    assert "streak_7" in user["titles"]
    earned_ids = [t["id"] for t in events["newly_earned_titles"]]
    assert "first_step" in earned_ids
    assert "streak_7" in earned_ids

def test_progress_rewards_endpoint():
    mock_user = {
        "id": "test-user-id",
        "username": "testuser",
        "course_level": "beginner",
        "xp": 0,
        "lv": 1,
        "character": "slime",
        "titles": [],
        "awarded_crown_units": []
    }

    mock_progress = [
        {"unit": 1, "stage": "1-1", "is_completed": True},
        {"unit": 1, "stage": "1-2", "is_completed": True},
        {"unit": 1, "stage": "1-3", "is_completed": True},
        {"unit": 1, "stage": "1-4", "is_completed": True},
        {"unit": 1, "stage": "1-5", "is_completed": True},
        {"unit": 1, "stage": "1-6", "is_completed": True},
        {"unit": 1, "stage": "1-7", "is_completed": True},
        {"unit": 1, "stage": "1-boss", "is_completed": False},
    ]

    # progress.py 가 mutate_user_atomic 으로 전환됐으므로
    # mutator 를 mock_user 에 직접 실행하는 방식으로 모킹
    def mock_mutate_user_atomic(user_id, mutator):
        result = mutator(mock_user)
        return mock_user, result

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch('routers.progress.get_progress_by_user', return_value=mock_progress), \
             patch('routers.utils.get_progress_by_user', return_value=mock_progress), \
             patch('routers.progress.save_progress_item'), \
             patch('routers.progress.mutate_user_atomic', side_effect=mock_mutate_user_atomic):

            with TestClient(app) as client:
                res = client.post(
                    "/progress/",
                    headers={"Authorization": "Bearer fake-token"},
                    json={"unit": 1, "stage": "1-boss", "score": 100, "is_completed": True},
                )
                assert res.status_code == 200
                data = res.json()
                assert data["xp_awarded"] == 3000  # Unit boss clear XP is 3000
                assert data["crowns_awarded"] == 1  # Crown for unit completion
    finally:
        del app.dependency_overrides[get_current_user]


