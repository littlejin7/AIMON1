import os
import sys
import random

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import routers.boss as B
import routers.utils as U


_QUESTIONS = [
    {"question_id": "boss_q1", "question": "Q1", "answer": "A", "type": "multiple_choice"},
    {"question_id": "boss_q2", "question": "Q2", "answer": "B", "type": "multiple_choice"},
]


def _seed_user(tmp_path, monkeypatch):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    user = {
        "id": "user-1",
        "username": "boss-user",
        "nickname": "BossUser",
        "email": "boss@example.com",
        "course_level": "beginner",
        "is_level_tested": True,
        "daily_free_attempts": 2,
        "last_free_attempt_date": "",
        "crowns": 5,
        "seen_questions": {"unitboss_seen_1": ["boss_q1"]},
    }
    U.save_users([user])
    return user


def test_unitboss_retry_can_select_previously_seen_question(tmp_path, monkeypatch):
    user = _seed_user(tmp_path, monkeypatch)
    monkeypatch.setattr(B, "assert_boss_access", lambda *args, **kwargs: None)
    monkeypatch.setattr(B, "load_questions_by_category", lambda *args, **kwargs: _QUESTIONS)
    monkeypatch.setattr(random, "choice", lambda pool: pool[0])

    res = B.start_boss_battle(unit="1", user=user)

    assert res["question"]["question_id"] == "boss_q1"


def test_unitboss_next_avoids_duplicate_inside_same_session(tmp_path, monkeypatch):
    user = _seed_user(tmp_path, monkeypatch)
    monkeypatch.setattr(B, "assert_boss_access", lambda *args, **kwargs: None)
    monkeypatch.setattr(B, "load_questions_by_category", lambda *args, **kwargs: _QUESTIONS)
    monkeypatch.setattr(random, "choice", lambda pool: pool[0])

    started = B.start_boss_battle(unit="1", user=user)
    next_q = B.get_next_question(unit="1", battle_token=started["battle_token"], user=user)

    assert started["question"]["question_id"] == "boss_q1"
    assert next_q["question_id"] == "boss_q2"


def test_unitboss_legacy_next_avoids_duplicate_after_start(tmp_path, monkeypatch):
    user = _seed_user(tmp_path, monkeypatch)
    monkeypatch.setattr(B, "assert_boss_access", lambda *args, **kwargs: None)
    monkeypatch.setattr(B, "load_questions_by_category", lambda *args, **kwargs: _QUESTIONS)
    monkeypatch.setattr(random, "choice", lambda pool: pool[0])

    started = B.start_boss_battle(unit="1", user=user)
    next_q = B.get_next_question(unit="1", user=user)

    assert started["question"]["question_id"] == "boss_q1"
    assert next_q["question_id"] == "boss_q2"


def test_unitboss_legacy_next_reopens_pool_after_exhaustion(tmp_path, monkeypatch):
    user = _seed_user(tmp_path, monkeypatch)
    monkeypatch.setattr(B, "assert_boss_access", lambda *args, **kwargs: None)
    monkeypatch.setattr(B, "load_questions_by_category", lambda *args, **kwargs: _QUESTIONS)
    monkeypatch.setattr(random, "choice", lambda pool: pool[0])

    started = B.start_boss_battle(unit="1", user=user)
    second = B.get_next_question(unit="1", user=user)
    third = B.get_next_question(unit="1", user=user)

    assert started["question"]["question_id"] == "boss_q1"
    assert second["question_id"] == "boss_q2"
    assert third["question_id"] == "boss_q1"
