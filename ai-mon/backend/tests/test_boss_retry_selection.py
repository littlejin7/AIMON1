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


def _seed_user(tmp_path, monkeypatch, seen_questions=None):
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
        # 기본값은 이 테스트들의 관심사(세션/legacy_key 로직)와 무관한 잡음 데이터.
        # "unitboss_seen_1" 은 실제 구(pre-migration) 키 포맷이므로 여기서 쓰면 안 됨.
        "seen_questions": seen_questions if seen_questions is not None else {"irrelevant_noise_key": ["boss_q1"]},
    }
    U.save_users([user])
    return user


def test_unitboss_retry_prefers_unseen_question(tmp_path, monkeypatch):
    # 이전 재도전에서 boss_q1 이 이미 출제됨 → 재도전 시 안 본 boss_q2 를 우선 출제해야 한다.
    user = _seed_user(tmp_path, monkeypatch, seen_questions={B._legacy_served_key(1): ["boss_q1"]})
    monkeypatch.setattr(B, "assert_boss_access", lambda *args, **kwargs: None)
    monkeypatch.setattr(B, "load_questions_by_category", lambda *args, **kwargs: _QUESTIONS)
    monkeypatch.setattr(random, "choice", lambda pool: pool[0])

    res = B.start_boss_battle(unit="1", user=user)

    assert res["question"]["question_id"] == "boss_q2"


def test_unitboss_retry_reopens_pool_when_history_exhausted(tmp_path, monkeypatch):
    # 풀(2문제)이 전부 이력에 있으면 재오픈되어 다시 전체 풀에서 뽑는다.
    user = _seed_user(tmp_path, monkeypatch, seen_questions={B._legacy_served_key(1): ["boss_q1", "boss_q2"]})
    monkeypatch.setattr(B, "assert_boss_access", lambda *args, **kwargs: None)
    monkeypatch.setattr(B, "load_questions_by_category", lambda *args, **kwargs: _QUESTIONS)
    monkeypatch.setattr(random, "choice", lambda pool: pool[0])

    res = B.start_boss_battle(unit="1", user=user)

    assert res["question"]["question_id"] == "boss_q1"


def test_unitboss_nine_retries_of_ten_pool_never_repeat(tmp_path, monkeypatch):
    # 10문제 유닛에서 재도전 9번까지는 이전에 나온 문제와 겹치지 않아야 한다.
    pool = [
        {"question_id": f"boss_q{i}", "question": f"Q{i}", "answer": "A", "type": "multiple_choice"}
        for i in range(1, 11)
    ]
    user = _seed_user(tmp_path, monkeypatch, seen_questions={})
    user["crowns"] = 20
    U.save_users([user])
    monkeypatch.setattr(B, "assert_boss_access", lambda *args, **kwargs: None)
    monkeypatch.setattr(B, "load_questions_by_category", lambda *args, **kwargs: pool)
    monkeypatch.setattr(random, "choice", lambda p: p[0])

    served = []
    for _ in range(9):
        res = B.start_boss_battle(unit="1", user=user)
        served.append(res["question"]["question_id"])

    assert len(served) == len(set(served))


def test_unitboss_retry_honors_pre_migration_seen_history(tmp_path, monkeypatch):
    # 마이그레이션 이전 구키(unitboss_seen_N)에만 이력이 있는 유저(운영 백업 시나리오)도
    # 그 이력을 반영해 안 본 문제를 우선 출제해야 한다 (B안: 이력 보존).
    user = _seed_user(tmp_path, monkeypatch, seen_questions={B._pre_migration_seen_key(1): ["boss_q1"]})
    monkeypatch.setattr(B, "assert_boss_access", lambda *args, **kwargs: None)
    monkeypatch.setattr(B, "load_questions_by_category", lambda *args, **kwargs: _QUESTIONS)
    monkeypatch.setattr(random, "choice", lambda pool: pool[0])

    res = B.start_boss_battle(unit="1", user=user)

    assert res["question"]["question_id"] == "boss_q2"


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
