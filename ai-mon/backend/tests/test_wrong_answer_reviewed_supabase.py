"""mark_wrong_answer_reviewed 의 Supabase 조건부 UPDATE 경로 단위 테스트.

user_id + question_id + reviewed=false 조건이 매치되는 행이 있을 때만 True 를
반환(=미션을 올려야 함)하고, 실제로 그 행만 reviewed=True 로 갱신한다.
"""
import os
import sys
from types import SimpleNamespace

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

import routers.utils as U
from routers.storage import mark_wrong_answer_reviewed


class _FakeWrongAnswersTable:
    def __init__(self, rows):
        self.rows = rows
        self._mode = None
        self._payload = None
        self._eqs = {}

    def update(self, obj):
        self._mode = "update"
        self._payload = obj
        return self

    def eq(self, col, val):
        self._eqs[col] = val
        return self

    def execute(self):
        matched = [r for r in self.rows if all(r.get(k) == v for k, v in self._eqs.items())]
        if self._mode == "update":
            for r in matched:
                r.update(self._payload)
        return SimpleNamespace(data=matched)


class _FakeWrongAnswersClient:
    def __init__(self, rows):
        self.rows = rows

    def table(self, name):
        assert name == "wrong_answers"
        return _FakeWrongAnswersTable(self.rows)


def test_supabase_transitions_matching_row_and_returns_true(monkeypatch):
    rows = [{"user_id": "u1", "question_id": "q1", "reviewed": False}]
    monkeypatch.setattr(U, "USE_SUPABASE", True)
    monkeypatch.setattr(U, "supabase", _FakeWrongAnswersClient(rows))

    assert mark_wrong_answer_reviewed("u1", "q1") is True
    assert rows[0]["reviewed"] is True


def test_supabase_already_reviewed_returns_false_and_stays_unchanged(monkeypatch):
    rows = [{"user_id": "u1", "question_id": "q1", "reviewed": True}]
    monkeypatch.setattr(U, "USE_SUPABASE", True)
    monkeypatch.setattr(U, "supabase", _FakeWrongAnswersClient(rows))

    assert mark_wrong_answer_reviewed("u1", "q1") is False
    assert rows[0]["reviewed"] is True


def test_supabase_other_user_row_is_not_matched_or_touched(monkeypatch):
    rows = [{"user_id": "u2", "question_id": "q1", "reviewed": False}]
    monkeypatch.setattr(U, "USE_SUPABASE", True)
    monkeypatch.setattr(U, "supabase", _FakeWrongAnswersClient(rows))

    assert mark_wrong_answer_reviewed("u1", "q1") is False
    assert rows[0]["reviewed"] is False   # u2 소유 행은 손대지 않음


def test_supabase_nonexistent_question_id_returns_false(monkeypatch):
    rows = [{"user_id": "u1", "question_id": "q1", "reviewed": False}]
    monkeypatch.setattr(U, "USE_SUPABASE", True)
    monkeypatch.setattr(U, "supabase", _FakeWrongAnswersClient(rows))

    assert mark_wrong_answer_reviewed("u1", "q-missing") is False
    assert rows[0]["reviewed"] is False
