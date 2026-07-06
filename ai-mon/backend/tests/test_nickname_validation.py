import os
import sys

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")
os.environ.setdefault("EMAIL_ENABLED", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

from fastapi import FastAPI
from starlette.testclient import TestClient

import routers.auth as AUTH
import routers.user as USER
import routers.utils as U
from routers.utils import limiter


def _make_app():
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(AUTH.router, prefix="/auth")
    app.include_router(USER.router, prefix="/user")
    return app


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _payload(username: str, nickname: str, email: str) -> dict:
    return {
        "username": username,
        "password": "Password1!",
        "nickname": nickname,
        "email": email,
        "course_level": "beginner",
    }


def _register(client, username: str, nickname: str, email: str):
    res = client.post("/auth/register", json=_payload(username, nickname, email))
    assert res.status_code == 201, res.text
    return res.json()


def _client(tmp_path, monkeypatch):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "REFRESH_TOKENS_FILE", str(tmp_path / "refresh_tokens.json"))
    monkeypatch.setenv("EMAIL_ENABLED", "false")
    monkeypatch.setattr(limiter, "enabled", False)
    return TestClient(_make_app(), raise_server_exceptions=False)


def test_register_blocks_active_duplicate_nickname(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    _register(client, "user1", "SameNick", "user1@example.com")

    res = client.post("/auth/register", json=_payload("user2", "  samenick  ", "user2@example.com"))

    assert res.status_code == 400
    assert res.json()["detail"] == "이미 사용 중인 닉네임입니다."


def test_check_nickname_reports_available_and_duplicate(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    _register(client, "user1", "SameNick", "user1@example.com")

    available = client.get("/auth/check-nickname", params={"nickname": "FreshNick"})
    duplicate = client.get("/auth/check-nickname", params={"nickname": "  samenick  "})

    assert available.status_code == 200
    assert available.json() == {"ok": True}
    assert duplicate.status_code == 400
    assert duplicate.json()["detail"] == "이미 사용 중인 닉네임입니다."


def test_register_blocks_active_duplicate_email(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    _register(client, "user1", "Nick1", "same@example.com")

    res = client.post("/auth/register", json=_payload("user2", "Nick2", "same@example.com"))

    assert res.status_code == 400
    assert res.json()["detail"] == "이미 사용 중인 이메일입니다."


def test_register_uses_username_when_nickname_is_blank(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    body = _register(client, "blanknick", "   ", "blank@example.com")

    assert body["user"]["nickname"] == "blanknick"


def test_update_me_allows_own_nickname_and_blocks_other_user(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    first = _register(client, "user1", "Nick1", "user1@example.com")
    second = _register(client, "user2", "Nick2", "user2@example.com")

    own = client.patch("/user/me", headers=_auth(first["access_token"]), json={"nickname": " Nick1 "})
    assert own.status_code == 200
    assert own.json()["nickname"] == "Nick1"

    duplicate = client.patch("/user/me", headers=_auth(second["access_token"]), json={"nickname": "nick1"})
    assert duplicate.status_code == 400
    assert duplicate.json()["detail"] == "이미 사용 중인 닉네임입니다."


def test_social_nickname_collision_gets_fallback(tmp_path, monkeypatch):
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    U.save_users([
        {
            "id": "u1",
            "username": "existing",
            "nickname": "SocialNick",
            "email": "existing@example.com",
        }
    ])

    nickname = AUTH._unique_social_nickname("SocialNick", "kakao_123")

    assert nickname == "SocialNick_1"


def test_register_rechecks_nickname_before_save(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    calls = {"count": 0}

    def fake_get_user_by_nickname(nickname, exclude_user_id=None):
        calls["count"] += 1
        if calls["count"] >= 2:
            return {"id": "other", "nickname": nickname}
        return None

    monkeypatch.setattr(AUTH, "get_user_by_nickname", fake_get_user_by_nickname)

    res = client.post("/auth/register", json=_payload("raceuser", "RaceNick", "race@example.com"))

    assert res.status_code == 400
    assert res.json()["detail"] == "이미 사용 중인 닉네임입니다."
    assert U.load_users() == []


def test_update_me_rechecks_nickname_before_save(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    registered = _register(client, "user1", "Nick1", "user1@example.com")
    calls = {"count": 0}

    def fake_get_user_by_nickname(nickname, exclude_user_id=None):
        calls["count"] += 1
        if calls["count"] >= 2:
            return {"id": "other", "nickname": nickname}
        return None

    monkeypatch.setattr(USER, "get_user_by_nickname", fake_get_user_by_nickname)

    res = client.patch(
        "/user/me",
        headers=_auth(registered["access_token"]),
        json={"nickname": "RaceNick"},
    )

    assert res.status_code == 400
    assert res.json()["detail"] == "이미 사용 중인 닉네임입니다."
    assert U.load_users()[0]["nickname"] == "Nick1"


def test_social_nickname_is_refreshed_before_save(monkeypatch):
    calls = {"count": 0}

    def fake_get_user_by_nickname(nickname, exclude_user_id=None):
        calls["count"] += 1
        if calls["count"] == 1:
            return None
        if nickname == "SocialNick":
            return {"id": "other", "nickname": nickname}
        return None

    monkeypatch.setattr(AUTH, "get_user_by_nickname", fake_get_user_by_nickname)

    nickname = AUTH._unique_social_nickname("SocialNick", "kakao_123")
    user = {"nickname": nickname}
    AUTH._refresh_social_nickname_for_save(user, "kakao_123")

    assert nickname == "SocialNick"
    assert user["nickname"] == "SocialNick_1"
