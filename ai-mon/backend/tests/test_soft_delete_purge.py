import json
import os
import sys
from datetime import datetime, timedelta, timezone

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

import routers.utils as U


def _write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def test_purge_soft_deleted_users_removes_only_expired_and_related_rows(tmp_path, monkeypatch):
    users_file = tmp_path / "users.json"
    progress_file = tmp_path / "progress.json"
    wrong_file = tmp_path / "wrong_answers.json"
    attempts_file = tmp_path / "attempts.json"
    refresh_tokens_file = tmp_path / "refresh_tokens.json"

    monkeypatch.setattr(U, "USE_SUPABASE", False)
    monkeypatch.setattr(U, "USERS_FILE", str(users_file))
    monkeypatch.setattr(U, "PROGRESS_FILE", str(progress_file))
    monkeypatch.setattr(U, "WRONG_ANSWERS_FILE", str(wrong_file))
    monkeypatch.setattr(U, "ATTEMPTS_FILE", str(attempts_file))
    monkeypatch.setattr(U, "REFRESH_TOKENS_FILE", str(refresh_tokens_file))

    now = datetime(2026, 7, 1, 12, 0, tzinfo=timezone(timedelta(hours=9)))
    expired = (now - timedelta(days=31)).isoformat()
    recent = (now - timedelta(days=10)).isoformat()

    _write_json(users_file, [
        {"id": "active-1", "username": "active", "deleted_at": None},
        {"id": "old-1", "username": "old", "deleted_at": expired},
        {"id": "recent-1", "username": "recent", "deleted_at": recent},
    ])
    _write_json(progress_file, [
        {"user_id": "old-1", "stage": "1-1"},
        {"user_id": "recent-1", "stage": "1-2"},
    ])
    _write_json(wrong_file, [
        {"user_id": "old-1", "question_id": "q1"},
        {"user_id": "recent-1", "question_id": "q2"},
    ])
    _write_json(attempts_file, [
        {"user_id": "old-1", "question_id": "q1"},
        {"user_id": "recent-1", "question_id": "q2"},
    ])
    _write_json(refresh_tokens_file, [
        {"user_id": "old-1", "token": "t-old"},
        {"user_id": "recent-1", "token": "t-recent"},
    ])

    result = U.purge_soft_deleted_users(retention_days=30, now=now)

    assert result["deleted_count"] == 1
    assert result["deleted_user_ids"] == ["old-1"]

    users = U._load_json_locked(str(users_file), [])
    assert [u["id"] for u in users] == ["active-1", "recent-1"]

    progress = U._load_json_locked(str(progress_file), [])
    wrong = U._load_json_locked(str(wrong_file), [])
    attempts = U._load_json_locked(str(attempts_file), [])
    tokens = U._load_json_locked(str(refresh_tokens_file), [])

    assert [p["user_id"] for p in progress] == ["recent-1"]
    assert [w["user_id"] for w in wrong] == ["recent-1"]
    assert [a["user_id"] for a in attempts] == ["recent-1"]
    assert [t["user_id"] for t in tokens] == ["recent-1"]


def test_purge_soft_deleted_users_dry_run_keeps_data(tmp_path, monkeypatch):
    users_file = tmp_path / "users.json"
    monkeypatch.setattr(U, "USE_SUPABASE", False)
    monkeypatch.setattr(U, "USERS_FILE", str(users_file))

    now = datetime(2026, 7, 1, 12, 0, tzinfo=timezone(timedelta(hours=9)))
    expired = (now - timedelta(days=40)).isoformat()
    _write_json(users_file, [{"id": "old-1", "username": "old", "deleted_at": expired}])

    result = U.purge_soft_deleted_users(retention_days=30, now=now, dry_run=True)

    assert result["deleted_count"] == 1
    users = U._load_json_locked(str(users_file), [])
    assert [u["id"] for u in users] == ["old-1"]


def test_scheduler_uses_30_day_retention(monkeypatch):
    import scheduler as SCH

    captured = {}

    def fake_purge(retention_days):
        captured["retention_days"] = retention_days
        return {"deleted_count": 0, "cutoff": "2026-06-01T00:00:00+09:00"}

    monkeypatch.setattr(SCH, "purge_soft_deleted_users", fake_purge)
    SCH.purge_deleted_accounts()

    assert captured["retention_days"] == 30
