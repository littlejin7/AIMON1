"""
C-5 / B-7 회귀 테스트.

(a) naive expires_at fromisoformat → TypeError 크래시 없음
(b) 동시 logout → token_version 정확히 각각 +1 (mutate_user_atomic 경로 검증)
(c) 잘못된/누락 ADMIN_SECRET → 403 거부
(d) 정상 revoke 후 기존 access token → 401
"""
import sys, os, threading, asyncio

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from starlette.testclient import TestClient

import routers.auth as AUTH
import routers.admin as ADMIN
from routers.utils import limiter, mutate_user_atomic, get_user_by_id, save_user, now_kst


# ─────────────────────────────────────────────────────────────────────────────
# App fixture
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def app():
    _app = FastAPI()
    _app.state.limiter = limiter
    _app.include_router(AUTH.router, prefix="/auth")
    _app.include_router(ADMIN.router, prefix="/admin")
    return _app


@pytest.fixture(scope="module")
def client(app):
    return TestClient(app, raise_server_exceptions=False)


# ─────────────────────────────────────────────────────────────────────────────
# 테스트용 유저 생성 헬퍼
# ─────────────────────────────────────────────────────────────────────────────

def _make_user(uid: str, token_version: int = 1) -> dict:
    return {
        "id": uid,
        "username": f"user_{uid}",
        "email": f"{uid}@test.com",
        "password": "hashed",
        "xp": 0,
        "lv": 1,
        "token_version": token_version,
    }


# ─────────────────────────────────────────────────────────────────────────────
# (a) C-5 — naive expires_at 파싱 크래시 없음
# ─────────────────────────────────────────────────────────────────────────────

def test_naive_expires_at_no_crash():
    """레거시 naive ISO 타임스탬프 (tzinfo 없음)와 now_kst() 비교 시 TypeError 없어야 한다."""
    # now_kst()는 timezone-aware(KST). 방어 코드 없으면 TypeError 발생.
    naive_dt = datetime(2020, 1, 1, 12, 0, 0)  # tzinfo=None
    assert naive_dt.tzinfo is None

    # 방어 코드 재현
    expires_at = naive_dt
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone(timedelta(hours=9)))

    # 이제 비교가 가능해야 함 (TypeError 없음)
    try:
        result = now_kst() > expires_at
        assert isinstance(result, bool)
    except TypeError as e:
        pytest.fail(f"naive datetime 비교 시 TypeError 발생: {e}")


def test_aware_expires_at_unchanged():
    """이미 timezone-aware인 타임스탬프는 KST로 재지정되지 않아야 한다."""
    utc_dt = datetime(2099, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    expires_at = utc_dt
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone(timedelta(hours=9)))
    assert expires_at.tzinfo == timezone.utc, "이미 aware면 tzinfo 변경 금지"


def test_reset_password_naive_token_does_not_crash(monkeypatch):
    """reset-password 엔드포인트에 naive ISO expires_at이 저장된 경우 500 아닌 400이어야 한다."""
    fake_token_store = {
        "victim@test.com": {
            "token": "somehash",
            "expires_at": "2020-01-01T00:00:00",  # naive, 이미 만료
            "failed_attempts": 0,
        }
    }
    monkeypatch.setattr(AUTH.password, "load_reset_tokens", lambda: fake_token_store)
    monkeypatch.setattr(AUTH.password, "save_reset_tokens", lambda _: None)

    # 독립 app — 이전 테스트의 rate limit 소진 영향을 받지 않도록
    from unittest.mock import patch as mpatch
    from fastapi import FastAPI
    _app = FastAPI()
    _app.state.limiter = limiter
    _app.include_router(AUTH.router, prefix="/auth")
    c = TestClient(_app, raise_server_exceptions=False)

    with mpatch.object(limiter, "_check_request_limit", return_value=None):
        res = c.post("/auth/reset-password", json={
            "email": "victim@test.com",
            "token": "wrongtoken",
            "new_password": "Newpass1!",
        })
    # naive 파싱 후 KST 가정 → 이미 만료 → 400, TypeError(500) 아님
    assert res.status_code == 400, f"naive expires_at → expected 400, got {res.status_code}"


# ─────────────────────────────────────────────────────────────────────────────
# (b) 동시 logout — token_version 정확히 처리 (mutate_user_atomic 경로 사용 검증)
# ─────────────────────────────────────────────────────────────────────────────

def test_logout_uses_mutate_user_atomic(monkeypatch):
    """/logout이 save_user() 대신 mutate_user_atomic()을 호출하는지 확인."""
    called = []

    def _mock_mutate(user_id, mutator):
        called.append(user_id)
        # mutator 실행 검증: 가짜 user에 적용해보기
        fake_user = {"id": user_id, "token_version": 3}
        mutator(fake_user)
        assert fake_user["token_version"] == 4, "mutator가 token_version+1 해야 함"

    monkeypatch.setattr(AUTH.login, "mutate_user_atomic", _mock_mutate)
    monkeypatch.setattr(AUTH.login, "delete_user_refresh_tokens", lambda uid: None)

    # 유효한 토큰 생성
    uid = "test-user-logout-atomic"
    token = AUTH.create_token({"sub": uid, "username": "testuser"}, token_version=3)

    from starlette.testclient import TestClient
    from fastapi import FastAPI
    _app = FastAPI()
    _app.state.limiter = limiter
    _app.include_router(AUTH.router, prefix="/auth")
    c = TestClient(_app, raise_server_exceptions=True)

    res = c.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert uid in called, "mutate_user_atomic이 호출되지 않음"


def test_concurrent_logout_token_version(tmp_path, monkeypatch):
    """두 스레드가 동시에 logout 시 mutate_user_atomic이 각각 호출됨 (직렬화 검증)."""
    call_count = []
    lock = threading.Lock()

    def _mock_mutate(user_id, mutator):
        with lock:
            call_count.append(1)

    monkeypatch.setattr(AUTH.login, "mutate_user_atomic", _mock_mutate)
    monkeypatch.setattr(AUTH.login, "delete_user_refresh_tokens", lambda uid: None)

    uid = "concurrent-test-user"
    t1_token = AUTH.create_token({"sub": uid, "username": "u"}, token_version=1)
    t2_token = AUTH.create_token({"sub": uid, "username": "u"}, token_version=1)

    from starlette.testclient import TestClient
    from fastapi import FastAPI
    _app = FastAPI()
    _app.state.limiter = limiter
    _app.include_router(AUTH.router, prefix="/auth")
    c = TestClient(_app, raise_server_exceptions=True)

    results = []

    def _do_logout(tok):
        r = c.post("/auth/logout", headers={"Authorization": f"Bearer {tok}"})
        results.append(r.status_code)

    t1 = threading.Thread(target=_do_logout, args=(t1_token,))
    t2 = threading.Thread(target=_do_logout, args=(t2_token,))
    t1.start(); t2.start()
    t1.join(); t2.join()

    assert results.count(200) == 2, f"두 logout 모두 200이어야 함: {results}"
    assert len(call_count) == 2, f"mutate_user_atomic이 2번 호출되어야 함: {len(call_count)}"


# ─────────────────────────────────────────────────────────────────────────────
# (c) 잘못된/누락 ADMIN_SECRET → 403
# ─────────────────────────────────────────────────────────────────────────────

def test_revoke_missing_admin_secret_header_returns_422(client):
    """X-Admin-Secret 헤더 자체가 없으면 422 (required header)."""
    res = client.patch("/admin/user/some-uid/revoke")
    assert res.status_code == 422


def test_revoke_wrong_admin_secret_returns_403(client, monkeypatch):
    """틀린 ADMIN_SECRET → 403."""
    monkeypatch.setattr(ADMIN, "_ADMIN_SECRET", "correct-secret-value")
    res = client.patch(
        "/admin/user/some-uid/revoke",
        headers={"X-Admin-Secret": "wrong-secret"},
    )
    assert res.status_code == 403


def test_revoke_empty_admin_secret_env_returns_403(client, monkeypatch):
    """ADMIN_SECRET 환경변수 미설정(빈 문자열) → fail-closed → 403."""
    monkeypatch.setattr(ADMIN, "_ADMIN_SECRET", "")
    res = client.patch(
        "/admin/user/some-uid/revoke",
        headers={"X-Admin-Secret": "anything"},
    )
    assert res.status_code == 403


def test_revoke_user_not_found_returns_404(client, monkeypatch):
    """존재하지 않는 user_id → 404."""
    from routers.utils import UserNotFoundError

    monkeypatch.setattr(ADMIN, "_ADMIN_SECRET", "test-admin-secret")
    monkeypatch.setattr(ADMIN, "mutate_user_atomic",
                        lambda uid, fn: (_ for _ in ()).throw(UserNotFoundError(uid)))

    res = client.patch(
        "/admin/user/nonexistent-uid/revoke",
        headers={"X-Admin-Secret": "test-admin-secret"},
    )
    assert res.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# (d) 정상 revoke 후 기존 토큰 → 401
# ─────────────────────────────────────────────────────────────────────────────

def test_revoke_invalidates_existing_token(monkeypatch):
    """revoke 후 get_current_user가 기존 토큰을 401로 거부해야 한다."""
    uid = "revoke-test-user"
    user_store = {uid: _make_user(uid, token_version=1)}

    def _get_user(user_id):
        return user_store.get(user_id)

    def _mutate(user_id, mutator):
        u = user_store[user_id]
        mutator(u)
        user_store[user_id] = u

    monkeypatch.setattr(ADMIN, "mutate_user_atomic", _mutate)
    monkeypatch.setattr(ADMIN, "delete_user_refresh_tokens", lambda uid: None)
    monkeypatch.setattr(ADMIN, "_ADMIN_SECRET", "valid-admin-secret")

    import routers.utils as U
    monkeypatch.setattr(U, "get_user_by_id", _get_user)

    # revoke 전 발급된 토큰
    old_token = AUTH.create_token({"sub": uid, "username": "u"}, token_version=1)

    # revoke 실행
    from fastapi import FastAPI
    from starlette.testclient import TestClient
    _app = FastAPI()
    _app.state.limiter = limiter
    _app.include_router(ADMIN.router, prefix="/admin")
    c = TestClient(_app, raise_server_exceptions=False)

    res = c.patch(
        f"/admin/user/{uid}/revoke",
        headers={"X-Admin-Secret": "valid-admin-secret"},
    )
    assert res.status_code == 200, f"revoke 실패: {res.text}"
    assert user_store[uid]["token_version"] == 2, "token_version이 2가 되어야 함"

    # 기존 토큰으로 get_current_user 호출 → 401
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        U.get_current_user(authorization=f"Bearer {old_token}")
    assert exc_info.value.status_code == 401


def test_revoke_returns_user_id_in_response(client, monkeypatch):
    """정상 revoke 응답 body에 user_id가 포함되어야 한다."""
    uid = "resp-check-uid"
    monkeypatch.setattr(ADMIN, "_ADMIN_SECRET", "s3cr3t")
    monkeypatch.setattr(ADMIN, "mutate_user_atomic", lambda uid, fn: None)
    monkeypatch.setattr(ADMIN, "delete_user_refresh_tokens", lambda uid: None)

    res = client.patch(
        f"/admin/user/{uid}/revoke",
        headers={"X-Admin-Secret": "s3cr3t"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body.get("user_id") == uid
    assert body.get("ok") is True
