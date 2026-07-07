"""Phase 2 Part E Verification Tests: Attendance and Streak Coin Rewards"""
import os
import sys
from datetime import datetime, timedelta

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import routers.auth as A

def _today_yesterday():
    today = A.now_kst().strftime("%Y-%m-%d")
    yesterday = (A.now_kst() - A.timedelta(days=1)).strftime("%Y-%m-%d")
    return today, yesterday

def test_daily_attendance_coin_granted_first_time():
    """새로운 유저 첫 로그인 시 1000 코인 지급 확인"""
    today, _ = _today_yesterday()
    user = {
        "id": "new-user-1",
        "last_login": "",
        "coin_balance": 0,
        "streak": 0,
        "xp": 500,
        "gp": 0,
        "ranking_score": 0,
        "lv": 2,
        "earned_streak_milestones": [],
        "missions": {}
    }
    
    updated, streak_reward, attendance_reward = A.update_login_streak(user)
    
    assert updated["last_login"] == today
    assert updated["coin_balance"] == A.DAILY_ATTENDANCE_COIN
    assert attendance_reward["coin_delta"] == A.DAILY_ATTENDANCE_COIN
    assert streak_reward is None
    
    # gp, ranking_score, lv, xp 불변 확인
    assert updated["gp"] == 0
    assert updated["ranking_score"] == 0
    assert updated["lv"] == 2
    assert updated["xp"] == 500

def test_daily_attendance_no_double_grant():
    """당일 중복 로그인 시 보상 미지급 검증"""
    today, _ = _today_yesterday()
    user = {
        "id": "new-user-1",
        "last_login": today,
        "coin_balance": 1000,
        "streak": 1,
        "xp": 500,
        "gp": 0,
        "ranking_score": 0,
        "lv": 2,
        "earned_streak_milestones": [],
        "missions": {}
    }
    
    updated, streak_reward, attendance_reward = A.update_login_streak(user)
    
    assert updated["coin_balance"] == 1000  # 변동 없음
    assert attendance_reward is None
    assert streak_reward is None

def test_daily_attendance_next_day_grant():
    """다음 날 재접속 시 일일 출석 코인 지급 및 스트릭 1 증가 검증"""
    today, yesterday = _today_yesterday()
    user = {
        "id": "new-user-1",
        "last_login": yesterday,
        "coin_balance": 1000,
        "streak": 1,
        "xp": 500,
        "gp": 0,
        "ranking_score": 0,
        "lv": 2,
        "earned_streak_milestones": [],
        "missions": {}
    }
    
    updated, streak_reward, attendance_reward = A.update_login_streak(user)
    
    assert updated["last_login"] == today
    assert updated["streak"] == 2
    assert updated["coin_balance"] == 1000 + A.DAILY_ATTENDANCE_COIN
    assert attendance_reward["coin_delta"] == A.DAILY_ATTENDANCE_COIN
    assert streak_reward is None

def test_streak_milestone_3_days_grant_coin_no_xp():
    """3일 스트릭 달성 시 코인 지급(XP는 미지급, 0 설정) 확인"""
    today, yesterday = _today_yesterday()
    user = {
        "id": "new-user-1",
        "last_login": yesterday,
        "coin_balance": 2000,
        "streak": 2,
        "xp": 500,
        "crowns": 0,
        "gp": 0,
        "ranking_score": 0,
        "lv": 2,
        "earned_streak_milestones": [],
        "missions": {}
    }
    
    updated, streak_reward, attendance_reward = A.update_login_streak(user)
    
    assert updated["streak"] == 3
    # 출석(1000) + 3일 스트릭(500) = 1500 코인 추가 지급
    assert updated["coin_balance"] == 2000 + A.DAILY_ATTENDANCE_COIN + A.STREAK_3_COIN
    # XP는 추가되지 않음
    assert updated["xp"] == 500
    assert updated["crowns"] == 0
    assert 3 in updated["earned_streak_milestones"]
    
    assert streak_reward == {"days": 3, "xp": 0, "coin": A.STREAK_3_COIN, "crowns": 0}
    assert attendance_reward["coin_delta"] == A.DAILY_ATTENDANCE_COIN

def test_streak_milestone_7_days_grant_coin_and_crown():
    """7일 스트릭 달성 시 코인 + 왕관 지급 (XP는 미지급) 확인"""
    today, yesterday = _today_yesterday()
    user = {
        "id": "new-user-1",
        "last_login": yesterday,
        "coin_balance": 6000,
        "streak": 6,
        "xp": 500,
        "crowns": 2,
        "gp": 0,
        "ranking_score": 0,
        "lv": 2,
        "earned_streak_milestones": [3],
        "missions": {}
    }
    
    updated, streak_reward, attendance_reward = A.update_login_streak(user)
    
    assert updated["streak"] == 7
    # 출석(1000) + 7일 스트릭(2000) = 3000 코인 지급
    assert updated["coin_balance"] == 6000 + A.DAILY_ATTENDANCE_COIN + A.STREAK_7_COIN
    # 왕관 1개 추가 지급
    assert updated["crowns"] == 3
    assert updated["xp"] == 500
    assert 7 in updated["earned_streak_milestones"]
    
    assert streak_reward == {"days": 7, "xp": 0, "coin": A.STREAK_7_COIN, "crowns": 1}

def test_auth_response_formatting():
    """_issue_auth_response에서 unified reward 및 user_state 스펙 준수 여부 검증"""
    user = {
        "id": "u1",
        "username": "tester",
        "nickname": "Tester",
        "coin_balance": 1000,
        "xp": 500,
        "lv": 2,
        "streak": 1,
        "last_login": "2026-07-07",
    }
    
    attendance_reward = {"coin_delta": 1000, "gp_delta": 0, "ranking_score_delta": 0}
    streak_reward = {"days": 3, "xp": 0, "coin": 500, "crowns": 0}
    
    res = A._issue_auth_response(
        user,
        streak_reward=streak_reward,
        attendance_reward=attendance_reward
    )
    
    assert "user_state" in res
    assert "reward" in res
    # 1000(출석) + 500(스트릭) = 1500
    assert res["reward"]["coin_delta"] == 1500
    assert res["reward"]["gp_delta"] == 0
    assert res["reward"]["ranking_score_delta"] == 0
    assert res["streak_reward"] == streak_reward
