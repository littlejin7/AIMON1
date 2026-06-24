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

def test_apply_xp_evolution():
    # Setup test user
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
    
    # Apply XP to reach level 10 (needs 1*1000 + 2*1000 + ... + 9*1000 = 45000 XP)
    # Let's add 45000 XP
    events = apply_xp(user, 44500)  # Total 45000
    assert user["lv"] == 10
    assert user["character"] == "robot"
    assert events["level_up"] is True
    assert events["evolved"] == "robot"
    
    # Apply XP to reach level 20 (needs 20*19/2 * 1000 = 190000 XP)
    # Let's add 145000 XP
    events = apply_xp(user, 145000) # Total 190000
    assert user["lv"] == 20
    assert user["character"] == "speech_bubble"
    assert events["level_up"] is True
    assert events["evolved"] == "speech_bubble"
    
    # Apply XP to reach level 30 (435000 XP)
    # Let's add 245000 XP
    events = apply_xp(user, 245000) # Total 435000
    assert user["lv"] == 30
    assert user["character"] == "final_ghost"
    assert events["level_up"] is True
    assert events["evolved"] == "final_ghost"
    
    # Check aimon_master title awarded at lv 30
    assert "aimon_master" in user["titles"]

def test_apply_xp_event_type_no_op_and_evolution_unchanged():
    """청크 1: event_type 인자를 줘도 (1) 진화/레벨 결과가 이전과 동일하고
    (2) no-op bump_mission 이 예외 없이 통과해야 한다."""
    # event_type 없이 진화시킨 기준 유저
    base = {"id": "u-base", "xp": 0, "lv": 1, "character": "slime", "titles": []}
    ev_base = apply_xp(base, 45000)  # lv10 → robot

    # event_type 을 넘긴 유저: 동일 입력이면 동일 결과여야 함
    tagged = {"id": "u-tagged", "xp": 0, "lv": 1, "character": "slime", "titles": []}
    ev_tagged = apply_xp(tagged, 45000, event_type="game_clear")

    assert tagged["lv"] == base["lv"] == 10
    assert tagged["character"] == base["character"] == "robot"
    assert ev_tagged["evolved"] == ev_base["evolved"] == "robot"
    assert ev_tagged["level_up"] == ev_base["level_up"] is True

    # no-op bump_mission 은 미션 정의가 없으므로 user.missions 를 만들지 않는다(예외도 없음).
    assert "missions" not in tagged

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
        {"unit": 1, "stage": "1-boss", "is_completed": False}
    ]
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch('routers.progress.get_progress_by_user', return_value=mock_progress), \
             patch('routers.utils.get_progress_by_user', return_value=mock_progress), \
             patch('routers.progress.save_progress_item'), \
             patch('routers.progress.save_user') as mock_save:
             
             with TestClient(app) as client:
                 res = client.post(
                     "/progress/",
                     headers={"Authorization": "Bearer fake-token"},
                     json={"unit": 1, "stage": "1-boss", "score": 100, "is_completed": True}
                 )
                 assert res.status_code == 200
                 data = res.json()
                 assert data["xp_awarded"] == 3000 # Unit boss clear XP is 3000
                 assert data["crowns_awarded"] == 1 # Crown for unit completion
                 assert mock_save.called
    finally:
        del app.dependency_overrides[get_current_user]


