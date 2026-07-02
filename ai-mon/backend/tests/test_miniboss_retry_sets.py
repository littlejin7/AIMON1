import os
import sys

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import routers.miniboss as M


def _set_pool():
    return [
        {"question_id": "ma1", "stage": "1-1", "quiz_set": "A", "question": "A1", "answer": "A"},
        {"question_id": "ma2", "stage": "1-1", "quiz_set": "A", "question": "A2", "answer": "A"},
        {"question_id": "mb1", "stage": "1-1", "quiz_set": "B", "question": "B1", "answer": "B"},
        {"question_id": "mb2", "stage": "1-1", "quiz_set": "B", "question": "B2", "answer": "B"},
    ]


def _missing_set_pool():
    return [
        {"question_id": "m1", "stage": "1-1", "question": "M1", "answer": "A"},
        {"question_id": "m2", "stage": "1-1", "question": "M2", "answer": "B"},
    ]


def _user():
    return {
        "id": "u1",
        "course_level": "beginner",
        "seen_questions": {},
        "battle_sessions": {},
    }


def _install_mutator(monkeypatch, user):
    def fake_mutate_user_atomic(user_id, mutator):
        assert user_id == user["id"]
        return user, mutator(user)

    monkeypatch.setattr(M, "mutate_user_atomic", fake_mutate_user_atomic)


def _ids(res):
    return [q["question_id"] for q in res["questions"]]


def test_miniboss_attempt_1_filters_set_a_when_available(monkeypatch):
    user = _user()
    _install_mutator(monkeypatch, user)
    monkeypatch.setattr(M, "load_miniboss_questions", lambda *args, **kwargs: _set_pool())

    res = M.miniboss_start(unit=1, stage="1-1", attempt=1, user=user)

    assert set(_ids(res)) == {"ma1", "ma2"}


def test_miniboss_attempt_2_filters_set_b_when_available(monkeypatch):
    user = _user()
    _install_mutator(monkeypatch, user)
    monkeypatch.setattr(M, "load_miniboss_questions", lambda *args, **kwargs: _set_pool())

    res = M.miniboss_start(unit=1, stage="1-1", attempt=2, user=user)

    assert set(_ids(res)) == {"mb1", "mb2"}


def test_miniboss_attempt_3_uses_shuffled_ab_pool_when_available(monkeypatch):
    user = _user()
    _install_mutator(monkeypatch, user)
    monkeypatch.setattr(M, "load_miniboss_questions", lambda *args, **kwargs: _set_pool())
    monkeypatch.setattr(M.random, "shuffle", lambda rows: rows.reverse())

    res = M.miniboss_start(unit=1, stage="1-1", attempt=3, user=user)

    assert _ids(res) == ["ma1", "ma2", "mb1", "mb2"]


def test_miniboss_missing_quiz_set_falls_back_to_existing_pool(monkeypatch):
    user = _user()
    _install_mutator(monkeypatch, user)
    monkeypatch.setattr(M, "load_miniboss_questions", lambda *args, **kwargs: _missing_set_pool())

    res = M.miniboss_start(unit=1, stage="1-1", attempt=2, user=user)

    assert set(_ids(res)) == {"m1", "m2"}
