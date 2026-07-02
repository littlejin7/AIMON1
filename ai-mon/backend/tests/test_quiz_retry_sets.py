import os
import sys

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import routers.quiz as Q


def _quiz_pool():
    return [
        {"question_id": "qa1", "stage": "1-1", "quiz_set": "A", "question": "A1"},
        {"question_id": "qa2", "stage": "1-1", "quiz_set": "A", "question": "A2"},
        {"question_id": "qb1", "stage": "1-1", "quiz_set": "B", "question": "B1"},
        {"question_id": "qb2", "stage": "1-1", "quiz_set": "B", "question": "B2"},
    ]


def _ids(rows):
    return [row["question_id"] for row in rows]


def test_quiz_attempt_1_returns_set_a(monkeypatch):
    monkeypatch.setattr(Q, "load_questions_by_category", lambda *args, **kwargs: _quiz_pool())

    res = Q.get_questions(unit=1, stage="1-1", category="quiz", limit=10, attempt=1, user=None)

    assert _ids(res) == ["qa1", "qa2"]


def test_quiz_attempt_2_returns_set_b(monkeypatch):
    monkeypatch.setattr(Q, "load_questions_by_category", lambda *args, **kwargs: _quiz_pool())

    res = Q.get_questions(unit=1, stage="1-1", category="quiz", limit=10, attempt=2, user=None)

    assert _ids(res) == ["qb1", "qb2"]


def test_quiz_attempt_3_returns_shuffled_ab_pool(monkeypatch):
    monkeypatch.setattr(Q, "load_questions_by_category", lambda *args, **kwargs: _quiz_pool())
    monkeypatch.setattr(Q.random, "shuffle", lambda rows: rows.reverse())

    res = Q.get_questions(unit=1, stage="1-1", category="quiz", limit=10, attempt=3, user=None)

    assert _ids(res) == ["qb2", "qb1", "qa2", "qa1"]
