"""비밀번호 재설정 플로우 보안 회귀 테스트.

방어 레이어:
  L1. IP 기반 rate limit (5/hour) — 브루트포스·이메일 폭탄 1차 방어
  L2. 이메일 단위 발송 스로틀 (5/day, 3분 쿨다운)
  L3. 토큰 SHA-256 해시 저장 — DB 유출 시 raw 토큰 노출 차단
  L4. hmac.compare_digest 타이밍 안전 비교
  L5. 실패 5회 누적 시 토큰 무효화
  L6. 30분 만료
  L7. user enumeration 방지 (미존재 이메일 동일 응답)
"""
import sys
import os
import json
import re
import hashlib
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from routers import utils as U
from routers import auth as A
from starlette.requests import Request as StarletteRequest


# ─── 공통 헬퍼 ────────────────────────────────────────────────────

def _fake_request(ip: str = "127.0.0.1"):
    return StarletteRequest({
        "type": "http", "method": "POST", "path": "/auth/forgot-password",
        "headers": [], "query_string": b"", "client": (ip, 9999),
    })


def _read_tokens(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _read_users(path: str) -> list:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _h(raw: str) -> str:
    """raw 토큰의 SHA-256 hex digest."""
    return hashlib.sha256(raw.encode()).hexdigest()


@pytest.fixture
def env(monkeypatch, tmp_path):
    """users.json · reset_tokens.json 을 임시 경로로 리디렉트.
    이메일 발송은 mock 으로 대체(실제 발송 없음).

    hash_password 는 SHA-256 으로 모킹 — bcrypt 버전 호환 문제(bcrypt.__about__ 없음)로
    인해 테스트 환경에서 bcrypt 가 깨져 있음. 프로덕션 bcrypt 동작은 변경 없음.
    """
    # SHA-256 기반 password helper (테스트 전용 — bcrypt 환경 의존성 제거)
    def _sha256_hash(pw: str) -> str:
        return hashlib.sha256(pw.encode()).hexdigest()

    monkeypatch.setattr(A, "hash_password", _sha256_hash)

    uf = tmp_path / "users.json"
    uf.write_text(
        json.dumps([{
            "id": "u1", "username": "testuser",
            "password": _sha256_hash("oldpass"),   # SHA-256 레거시 포맷
            "email": "user@example.com", "xp": 0, "crowns": 0, "lv": 1,
            "character": "slime", "titles": [], "game_rewards": {},
        }]),
        encoding="utf-8",
    )
    rf = tmp_path / "reset_tokens.json"
    rf.write_text("{}", encoding="utf-8")

    monkeypatch.setattr(U, "USERS_FILE", str(uf))
    monkeypatch.setattr(U, "RESET_TOKENS_FILE", str(rf))
    monkeypatch.setattr(U, "USE_SUPABASE", False)
    monkeypatch.setattr(U.limiter, "enabled", False)   # rate limit 우회 (기능 테스트)

    # 이메일 발송 mock — 실제 SMTP 호출 없이 sent[] 에 기록
    sent = []
    def _mock_send(to_email, subject, html_content):
        sent.append({"to": to_email, "subject": subject, "body": html_content})

    import services.email_service as ES
    monkeypatch.setattr(ES, "send_email", _mock_send)

    return {
        "users": str(uf),
        "tokens": str(rf),
        "sent": sent,
        "request": _fake_request(),
    }


# ─── L7: user enumeration 방지 ───────────────────────────────────

def test_forgot_password_unknown_email_same_response(env):
    """존재하지 않는 이메일에도 200·동일 body 응답 (계정 존재 여부 노출 금지)."""
    req = A.ForgotPasswordRequest(email="nobody@example.com")
    r = A.forgot_password(req, env["request"])
    assert r["ok"] is True
    # 토큰 파일에 아무것도 쓰이지 않아야 함
    assert _read_tokens(env["tokens"]) == {}


# ─── L3: 토큰 해시 저장 ──────────────────────────────────────────

def test_forgot_password_stores_hash_not_plaintext(env):
    """reset_tokens 에 raw 토큰이 아닌 SHA-256 hex digest 가 저장되어야 한다."""
    req = A.ForgotPasswordRequest(email="user@example.com")
    A.forgot_password(req, env["request"])

    tokens = _read_tokens(env["tokens"])
    assert "user@example.com" in tokens
    stored = tokens["user@example.com"]["token"]

    # SHA-256 hex digest: 정확히 64자, 16진수 문자만
    assert len(stored) == 64, f"토큰 해시 길이 오류: {len(stored)}"
    assert all(c in "0123456789abcdef" for c in stored), "평문 토큰이 저장됨"

    # 이메일 본문에서 monospace div 안의 raw 토큰 추출
    body = env["sent"][0]["body"]
    m = re.search(r'monospace;">([\w\-]+)</div>', body)
    assert m is not None, f"이메일 본문에 raw 토큰이 없음: {body!r}"
    raw_in_email = m.group(1)

    # raw 토큰 != 저장 해시, raw 토큰의 SHA-256 == 저장 해시
    assert raw_in_email != stored, "raw 토큰이 해시 그대로 저장됨(평문 저장 버그)"
    assert _h(raw_in_email) == stored, "이메일 raw 토큰과 DB 해시 불일치"


def test_forgot_password_ttl_is_30_minutes(env):
    """토큰 만료시각이 now + 30분 내외여야 한다."""
    req = A.ForgotPasswordRequest(email="user@example.com")
    before = U.now_kst()
    A.forgot_password(req, env["request"])
    after = U.now_kst()

    tokens = _read_tokens(env["tokens"])
    expires_str = tokens["user@example.com"]["expires_at"]
    expires = datetime.fromisoformat(expires_str)

    delta_min = (expires - before).total_seconds() / 60
    delta_max = (expires - after).total_seconds() / 60

    assert 29 <= delta_min <= 31, f"만료 시간 오류: {delta_min:.1f}분"
    assert delta_max >= 0, "토큰이 이미 만료됨"


# ─── 정상 재설정 플로우 ───────────────────────────────────────────

def _issue_token(env) -> str:
    """forgot_password 를 호출하고 이메일 monospace div 안의 raw 토큰을 반환."""
    req = A.ForgotPasswordRequest(email="user@example.com")
    A.forgot_password(req, env["request"])
    body = env["sent"][-1]["body"]
    # HTML 템플릿: <div style="...monospace;">{raw_token}</div>
    m = re.search(r'monospace;">([\w\-]+)</div>', body)
    if m:
        return m.group(1)
    raise RuntimeError(f"이메일 본문에서 토큰을 찾을 수 없음: {body!r}")


def test_reset_password_valid_flow(env):
    """올바른 토큰으로 비밀번호 재설정 → 200, 새 비밀번호로 로그인 가능, 토큰 삭제."""
    raw = _issue_token(env)

    req = A.ResetPasswordRequest(email="user@example.com", token=raw, new_password="NewPass123!")
    r = A.reset_password(req, env["request"])
    assert r["ok"] is True

    # 토큰 사용 후 삭제 확인
    assert _read_tokens(env["tokens"]) == {}

    # 새 비밀번호로 로그인 가능
    user = U.get_user_by_email("user@example.com")
    assert A.verify_password("NewPass123!", user["password"])
    assert not A.verify_password("oldpass", user["password"])


# ─── L4+L5: 잘못된 토큰 / 소진 ──────────────────────────────────

def test_reset_password_wrong_token_rejected(env):
    """잘못된 토큰 → 400, failed_attempts 증가."""
    _issue_token(env)

    req = A.ResetPasswordRequest(email="user@example.com", token="WRONG_TOKEN", new_password="x")
    with pytest.raises(HTTPException) as exc:
        A.reset_password(req, env["request"])
    assert exc.value.status_code == 400

    # failed_attempts 가 1 로 기록됨
    tokens = _read_tokens(env["tokens"])
    assert tokens["user@example.com"]["failed_attempts"] == 1


def test_reset_password_5_failures_invalidates_token(env):
    """잘못된 토큰 5회 → 토큰 완전 무효화, 6회째는 이미 없는 토큰 에러."""
    _issue_token(env)

    for i in range(4):
        with pytest.raises(HTTPException) as exc:
            A.reset_password(
                A.ResetPasswordRequest(email="user@example.com", token="BAD", new_password="x"),
                env["request"],
            )
        assert exc.value.status_code == 400
        tokens = _read_tokens(env["tokens"])
        assert tokens["user@example.com"]["failed_attempts"] == i + 1

    # 5회째: 토큰 무효화 메시지
    with pytest.raises(HTTPException) as exc:
        A.reset_password(
            A.ResetPasswordRequest(email="user@example.com", token="BAD", new_password="x"),
            env["request"],
        )
    assert exc.value.status_code == 400
    assert "초과" in exc.value.detail

    # 토큰 레코드 삭제 확인
    assert _read_tokens(env["tokens"]) == {}

    # 정상 토큰으로도 이제 불가 (레코드 없음)
    with pytest.raises(HTTPException) as exc:
        A.reset_password(
            A.ResetPasswordRequest(email="user@example.com", token="ANY", new_password="x"),
            env["request"],
        )
    assert exc.value.status_code == 400


def test_reset_password_expired_token_rejected(env, monkeypatch):
    """만료된 토큰 → 400, 토큰 레코드 즉시 삭제."""
    _issue_token(env)

    # now_kst 를 만료 이후 시각으로 패치
    tokens = _read_tokens(env["tokens"])
    expires = datetime.fromisoformat(tokens["user@example.com"]["expires_at"])
    future = expires + timedelta(minutes=1)
    monkeypatch.setattr(U, "now_kst", lambda: future)
    monkeypatch.setattr(A, "now_kst", lambda: future)

    # 토큰 값은 아무거나 (만료 체크가 먼저)
    with pytest.raises(HTTPException) as exc:
        A.reset_password(
            A.ResetPasswordRequest(email="user@example.com", token="ANYTOKEN", new_password="x"),
            env["request"],
        )
    assert exc.value.status_code == 400
    # 만료 토큰은 즉시 삭제
    assert _read_tokens(env["tokens"]) == {}


def test_reset_password_nonexistent_email_rejected(env):
    """존재하지 않는 이메일 → 400."""
    req = A.ResetPasswordRequest(email="nobody@example.com", token="ANY", new_password="x")
    with pytest.raises(HTTPException) as exc:
        A.reset_password(req, env["request"])
    assert exc.value.status_code == 400


# ─── L2: 이메일 단위 발송 스로틀 ────────────────────────────────

def _clear_cooldown(tokens_path: str, email: str):
    """reset_tokens 에서 last_sent 를 과거로 리셋해 3분 쿨다운을 우회한다."""
    with open(tokens_path, encoding="utf-8") as f:
        data = json.load(f)
    if email in data:
        data[email]["last_sent"] = "2000-01-01T00:00:00+09:00"
    with open(tokens_path, "w", encoding="utf-8") as f:
        json.dump(data, f)


def test_forgot_password_per_email_daily_cap(env):
    """같은 이메일 5회 후 6회째 → 발송 없이 동일 응답(이메일 폭탄 차단).
    각 호출 사이에 cooldown 을 수동으로 초기화(3분 쿨다운과 독립 검증)."""
    req = A.ForgotPasswordRequest(email="user@example.com")
    for _ in range(5):
        _clear_cooldown(env["tokens"], "user@example.com")
        A.forgot_password(req, env["request"])
    assert len(env["sent"]) == 5

    # 6회째: 일일 캡(5) 도달 → 쿨다운 초기화해도 발송 안 됨
    _clear_cooldown(env["tokens"], "user@example.com")
    A.forgot_password(req, env["request"])
    assert len(env["sent"]) == 5, "일일 캡 초과 후에도 이메일 발송됨"


def test_forgot_password_3min_cooldown(env, monkeypatch):
    """3분 쿨다운: 1회 발송 직후 재요청 → 발송 없이 동일 응답."""
    req = A.ForgotPasswordRequest(email="user@example.com")
    A.forgot_password(req, env["request"])
    assert len(env["sent"]) == 1

    # 직후 재요청 (타임스탬프 변경 없음 → 쿨다운 중)
    A.forgot_password(req, env["request"])
    assert len(env["sent"]) == 1, "쿨다운 중 이메일 재발송됨"


# ─── L1: rate limit 429 ──────────────────────────────────────────

def test_rate_limit_forgot_password_429():
    """IP 5/hour 한도 초과 시 429 (TestClient + 실제 HTTP 레이어 경유)."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    import tempfile, json as _json

    # 이 테스트 전용 앱 — 별도 limiter 인스턴스로 격리
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    test_limiter = Limiter(key_func=get_remote_address, default_limits=[])

    app = FastAPI()
    app.state.limiter = test_limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    router_copy = A.router  # 이미 import 된 라우터 재사용

    # 별도 임시 파일 준비
    with tempfile.TemporaryDirectory() as td:
        uf = os.path.join(td, "users.json")
        rf = os.path.join(td, "reset_tokens.json")
        with open(uf, "w") as f:
            _json.dump([{
                "id": "rl1", "username": "rluser", "password": "",
                "email": "rl@example.com", "xp": 0, "crowns": 0, "lv": 1,
                "character": "slime", "titles": [], "game_rewards": {},
            }], f)
        with open(rf, "w") as f:
            f.write("{}")

        # 모듈 패치 (pytest monkeypatch 없으므로 직접)
        orig_uf = U.USERS_FILE
        orig_rf = U.RESET_TOKENS_FILE
        orig_limiter_enabled = U.limiter.enabled
        try:
            U.USERS_FILE = uf
            U.RESET_TOKENS_FILE = rf
            U.limiter.enabled = False  # 기존 모듈 limiter 비활성화

            # test_limiter 로 라우터의 forgot_password 를 "1/minute" 로 직접 제한 테스트
            # → 실제 SlowAPI 데코레이터(5/hour)를 그대로 검증하려면 limiter.enabled=True 필요
            # 여기서는 limiter.enabled=True 후 5회 소진 시나리오로 검증
            U.limiter.enabled = True

            # email_service mock
            import services.email_service as ES
            orig_send = ES.send_email
            ES.send_email = lambda *a, **k: None

            try:
                app.include_router(A.router, prefix="/auth")
                client = TestClient(app, raise_server_exceptions=False)

                statuses = []
                for _ in range(7):     # 5/hour → 6번째부터 429
                    r = client.post("/auth/forgot-password", json={"email": "rl@example.com"})
                    statuses.append(r.status_code)

                # 처음 5회는 200, 이후는 429
                assert statuses[:5] == [200] * 5, f"first 5: {statuses[:5]}"
                assert 429 in statuses[5:], f"rate limit 429 not triggered: {statuses}"
            finally:
                ES.send_email = orig_send
        finally:
            U.USERS_FILE = orig_uf
            U.RESET_TOKENS_FILE = orig_rf
            U.limiter.enabled = orig_limiter_enabled


def test_rate_limit_reset_password_429():
    """reset-password IP 5/hour 초과 시 429."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    import tempfile, json as _json, hashlib as _hl
    from datetime import datetime, timedelta, timezone

    app = FastAPI()
    app.state.limiter = U.limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    with tempfile.TemporaryDirectory() as td:
        uf = os.path.join(td, "users.json")
        rf = os.path.join(td, "reset_tokens.json")
        with open(uf, "w") as f:
            _json.dump([{
                "id": "rp1", "username": "rpuser", "password": "",
                "email": "rp@example.com", "xp": 0, "crowns": 0, "lv": 1,
                "character": "slime", "titles": [], "game_rewards": {},
            }], f)
        # 유효한 토큰 레코드 준비 (실패 전 5회까지는 통과)
        raw = "validtoken12345678901234567890123"
        token_hash = _hl.sha256(raw.encode()).hexdigest()
        exp = (datetime.now(timezone(timedelta(hours=9))) + timedelta(hours=1)).isoformat()
        with open(rf, "w", encoding="utf-8") as f:
            _json.dump({"rp@example.com": {
                "token": token_hash, "expires_at": exp,
                "failed_attempts": 0, "send_date": None,
                "send_count_today": 0, "last_sent": None,
            }}, f)

        orig_uf, orig_rf = U.USERS_FILE, U.RESET_TOKENS_FILE
        orig_enabled = U.limiter.enabled
        try:
            U.USERS_FILE = uf
            U.RESET_TOKENS_FILE = rf
            U.limiter.enabled = True

            app.include_router(A.router, prefix="/auth")
            client = TestClient(app, raise_server_exceptions=False)

            statuses = []
            for _ in range(7):
                r = client.post("/auth/reset-password", json={
                    "email": "rp@example.com",
                    "token": "WRONG_TOKEN_TO_FORCE_400",
                    "new_password": "newpass",
                })
                statuses.append(r.status_code)

            # 처음 5회: 400 (잘못된 토큰) or 429 — 5/hour 소진 후 429
            assert 429 in statuses, f"rate limit 429 미발생: {statuses}"
        finally:
            U.USERS_FILE = orig_uf
            U.RESET_TOKENS_FILE = orig_rf
            U.limiter.enabled = orig_enabled
