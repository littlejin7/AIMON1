"""
test_account_delete.py
소프트 삭제 + 재가입 전체 플로우 회귀 테스트 (USE_SUPABASE=false / JSON 경로)

커버 시나리오:
(1)  DELETE /user/me — 인증 없음 → 401/422
(2)  DELETE /user/me — 정상 삭제 → 204, body 없음
(3)  삭제 후 access token 재사용 → 401
(4)  삭제 후 refresh token 재사용 → 401
(5)  삭제된 계정으로 로그인 → 401 generic 메시지
(6)  check-id — 삭제된 username → 사용 가능 (200 ok)
(7)  check-email — 삭제된 email → 사용 가능 (200 ok)
(8)  재가입 — 같은 username 으로 201, 새 user_id
(9)  재가입 후 과거 progress 없음 (xp/lv/completed_stages = 0/1/0)
(10) 활성 계정 username 중복 → 400 여전히 차단
(11a) 2차 DELETE (동일 토큰) → 401/403, 5xx 아님
(11b) 핸들러 직접 — UserNotFoundError 무해 흡수, 토큰은 정리됨
(12) ASGI transport 스모크 — 204 응답에 body 없음 (uvicorn/h11 회귀 방지)
"""
import sys, os
import pytest
import anyio
import httpx

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from fastapi import FastAPI
from starlette.testclient import TestClient
import routers.auth as AUTH
import routers.user as USER
import routers.utils as U
from routers.utils import limiter, UserNotFoundError


def _make_app():
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(AUTH.router, prefix="/auth")
    app.include_router(USER.router, prefix="/user")
    return app


@pytest.fixture()
def ctx(tmp_path, monkeypatch):
    """격리된 tmp 파일 스토리지 + 레이트리밋 우회 + TestClient."""
    monkeypatch.setattr(U, "USERS_FILE",          str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "REFRESH_TOKENS_FILE", str(tmp_path / "refresh_tokens.json"))
    # limiter.enabled=False: 미들웨어·데코레이터 래퍼 양쪽 모두 rate limit 코드 건너뜀
    # (_check_request_limit 패치는 view_rate_limit 미설정 → AttributeError 500 유발)
    monkeypatch.setattr(limiter, "enabled", False)
    return TestClient(_make_app(), raise_server_exceptions=False)


_PAYLOAD = {
    "username": "deluser",
    "password": "Password1!",
    "nickname": "테스터",
    "email":    "del@test.com",
}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _register(client, payload=None):
    res = client.post("/auth/register", json=payload or _PAYLOAD)
    assert res.status_code == 201, f"register failed: {res.text}"
    d = res.json()
    return d["access_token"], d["refresh_token"], d["user"]["id"]


# ─────────────────────────────────────────────────────────────────────────────
# (1) 인증 없음
# ─────────────────────────────────────────────────────────────────────────────

def test_delete_no_auth_header(ctx):
    """Authorization 헤더 없음 → 422 (required header) 또는 401."""
    res = ctx.delete("/user/me")
    assert res.status_code in (401, 422)


def test_delete_invalid_token(ctx):
    """쓰레기 토큰 → 401."""
    res = ctx.delete("/user/me", headers={"Authorization": "Bearer bogus.token.here"})
    assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# (2) 정상 삭제 → 204
# ─────────────────────────────────────────────────────────────────────────────

def test_delete_me_returns_204(ctx):
    token, _, _ = _register(ctx)
    res = ctx.delete("/user/me", headers=_auth(token))
    assert res.status_code == 204
    assert res.content == b""


# ─────────────────────────────────────────────────────────────────────────────
# (3) 삭제 후 access token 재사용 → 401
# ─────────────────────────────────────────────────────────────────────────────

def test_access_token_blocked_after_delete(ctx):
    token, _, _ = _register(ctx)
    ctx.delete("/user/me", headers=_auth(token))
    res = ctx.get("/user/me", headers=_auth(token))
    assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# (4) 삭제 후 refresh token 재사용 → 401
# ─────────────────────────────────────────────────────────────────────────────

def test_refresh_token_blocked_after_delete(ctx):
    token, refresh, _ = _register(ctx)
    ctx.delete("/user/me", headers=_auth(token))
    res = ctx.post("/auth/refresh", json={"refresh_token": refresh})
    assert res.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# (5) 삭제 계정 로그인 → 401 generic 메시지
# ─────────────────────────────────────────────────────────────────────────────

def test_login_deleted_account_401_generic(ctx):
    token, _, _ = _register(ctx)
    ctx.delete("/user/me", headers=_auth(token))
    res = ctx.post("/auth/login", json={
        "username": _PAYLOAD["username"],
        "password": _PAYLOAD["password"],
    })
    assert res.status_code == 401
    assert res.json()["detail"] == "아이디 또는 비밀번호가 올바르지 않습니다."


# ─────────────────────────────────────────────────────────────────────────────
# (6) check-id — 삭제된 username → 사용 가능
# ─────────────────────────────────────────────────────────────────────────────

def test_check_id_available_after_delete(ctx):
    token, _, _ = _register(ctx)
    ctx.delete("/user/me", headers=_auth(token))
    res = ctx.get(f"/auth/check-id?username={_PAYLOAD['username']}")
    assert res.status_code == 200
    assert res.json()["ok"] is True


# ─────────────────────────────────────────────────────────────────────────────
# (7) check-email — 삭제된 email → 사용 가능
# ─────────────────────────────────────────────────────────────────────────────

def test_check_email_available_after_delete(ctx):
    token, _, _ = _register(ctx)
    ctx.delete("/user/me", headers=_auth(token))
    res = ctx.get(f"/auth/check-email?email={_PAYLOAD['email']}")
    assert res.status_code == 200
    assert res.json()["ok"] is True


# ─────────────────────────────────────────────────────────────────────────────
# (8) 재가입 — 같은 username 으로 201, 새 user_id
# ─────────────────────────────────────────────────────────────────────────────

def test_reregister_same_username_new_uid(ctx):
    token, _, old_uid = _register(ctx)
    ctx.delete("/user/me", headers=_auth(token))

    res = ctx.post("/auth/register", json=_PAYLOAD)
    assert res.status_code == 201, res.text
    new_uid = res.json()["user"]["id"]
    assert new_uid != old_uid, "재가입 시 새 user_id 여야 한다"


# ─────────────────────────────────────────────────────────────────────────────
# (9) 재가입 후 과거 progress 없음
# ─────────────────────────────────────────────────────────────────────────────

def test_reregister_no_inherited_progress(ctx):
    token, _, _ = _register(ctx)
    ctx.delete("/user/me", headers=_auth(token))

    user = ctx.post("/auth/register", json=_PAYLOAD).json()["user"]
    assert user["xp"] == 0
    assert user["lv"] == 1
    assert user["completed_stages"] == 0


# ─────────────────────────────────────────────────────────────────────────────
# (10) 활성 계정 username 중복 → 400 여전히 차단
# ─────────────────────────────────────────────────────────────────────────────

def test_active_username_duplicate_still_blocked(ctx):
    _register(ctx)  # 첫 번째 활성 계정
    res = ctx.post("/auth/register", json=_PAYLOAD)
    assert res.status_code == 400
    assert "이미 존재하는 아이디" in res.json()["detail"]


# ─────────────────────────────────────────────────────────────────────────────
# (11a) 2차 DELETE (동일 토큰) → 401, 5xx 아님
# ─────────────────────────────────────────────────────────────────────────────

def test_second_delete_not_5xx(ctx):
    """첫 삭제 후 같은 토큰으로 재호출 → 4xx (인증 거부), 서버 에러 없음."""
    token, _, _ = _register(ctx)
    ctx.delete("/user/me", headers=_auth(token))          # 1차
    res = ctx.delete("/user/me", headers=_auth(token))    # 2차
    assert res.status_code < 500
    assert res.status_code in (401, 403, 404)


# ─────────────────────────────────────────────────────────────────────────────
# (11b) 핸들러 직접 — UserNotFoundError 무해 흡수
# ─────────────────────────────────────────────────────────────────────────────

def test_handler_absorbs_usernotfounderror(monkeypatch):
    """mutate_user_atomic 이 UserNotFoundError 를 올려도 204 완료, 토큰은 정리됨."""
    tokens_deleted = []

    monkeypatch.setattr(
        USER, "mutate_user_atomic",
        lambda uid, fn: (_ for _ in ()).throw(UserNotFoundError(uid)),
    )
    monkeypatch.setattr(
        USER, "delete_user_refresh_tokens",
        lambda uid: tokens_deleted.append(uid),
    )

    from fastapi.responses import Response as FastAPIResponse
    result = USER.delete_me(user={"id": "ghost-uid", "username": "ghost"})
    assert isinstance(result, FastAPIResponse)   # 예외 없음, Response 반환
    assert result.status_code == 204
    assert tokens_deleted == ["ghost-uid"]       # 토큰 정리는 항상 실행


# ─────────────────────────────────────────────────────────────────────────────
# (12) ASGI transport 스모크 — 204 body 없음 (uvicorn/h11 회귀 방지)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_delete_me_no_body_asgi(tmp_path, monkeypatch):
    """httpx ASGITransport 으로 204 응답에 body 가 없음을 검증.

    TestClient(raise_server_exceptions=False) 는 h11 계층을 거치지 않아
    FastAPI 가 None → 'null' 바디를 내보내도 잡지 못한다. ASGITransport 는
    실제 ASGI 응답 이터레이터를 그대로 소비하므로 body 유무가 드러난다.
    """
    monkeypatch.setattr(U, "USERS_FILE",          str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "REFRESH_TOKENS_FILE", str(tmp_path / "refresh_tokens.json"))
    monkeypatch.setattr(limiter, "enabled", False)

    app = _make_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post("/auth/register", json=_PAYLOAD)
        assert r.status_code == 201, r.text
        token = r.json()["access_token"]

        r = await client.delete("/user/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 204
        assert r.content == b"", f"204 응답에 body 가 있음: {r.content!r}"
        assert int(r.headers.get("content-length", "0")) == 0
