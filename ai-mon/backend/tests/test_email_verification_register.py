import hashlib
import json
import os
import sys
from datetime import timedelta

from fastapi import FastAPI
from starlette.testclient import TestClient

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

import routers.auth as AUTH
import routers.utils as U
from routers.utils import limiter


def _make_app():
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(AUTH.router, prefix="/auth")
    return app


def _payload(email="verified@example.com"):
    return {
        "username": "verifieduser",
        "password": "Password1!",
        "nickname": "VerifiedNick",
        "email": email,
        "course_level": "beginner",
    }


def _client(tmp_path, monkeypatch):
    monkeypatch.setenv("EMAIL_ENABLED", "true")
    monkeypatch.setenv("EMAIL_CODE_TTL_SECONDS", "300")
    monkeypatch.setenv("EMAIL_RESEND_COOLDOWN_SECONDS", "60")
    monkeypatch.setattr(U, "USERS_FILE", str(tmp_path / "users.json"))
    monkeypatch.setattr(U, "REFRESH_TOKENS_FILE", str(tmp_path / "refresh_tokens.json"))
    monkeypatch.setattr(U, "EMAIL_VERIFICATION_CODES_FILE", str(tmp_path / "email_verification_codes.json"))
    monkeypatch.setattr(U, "USE_SUPABASE", False)
    monkeypatch.setattr(limiter, "enabled", False)
    monkeypatch.setattr(AUTH, "hash_password", lambda pw: hashlib.sha256(pw.encode()).hexdigest())
    return TestClient(_make_app(), raise_server_exceptions=False)


def test_send_code_success_and_stores_hash(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    sent = []
    monkeypatch.setattr(AUTH, "send_verification_email", lambda email, code: sent.append((email, code)) or True)

    res = client.post("/auth/email/send-code", json={"email": "User@Example.com", "purpose": "register"})

    assert res.status_code == 200, res.text
    assert res.json()["ok"] is True
    assert sent and sent[0][0] == "user@example.com"
    assert sent[0][1].isdigit() and len(sent[0][1]) == 6

    data = json.loads((tmp_path / "email_verification_codes.json").read_text(encoding="utf-8"))
    record = data["user@example.com:register"]
    assert record["code_hash"] != sent[0][1]
    assert len(record["code_hash"]) == 64
    assert record["attempts"] == 0
    assert record["verified"] is False


def test_send_code_rejects_bad_email(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    res = client.post("/auth/email/send-code", json={"email": "bad-email", "purpose": "register"})

    assert res.status_code == 400


def test_send_code_cooldown(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    monkeypatch.setattr(AUTH, "send_verification_email", lambda email, code: True)

    first = client.post("/auth/email/send-code", json={"email": "cool@example.com", "purpose": "register"})
    second = client.post("/auth/email/send-code", json={"email": "cool@example.com", "purpose": "register"})

    assert first.status_code == 200
    assert second.status_code == 429


def test_verify_code_success(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    sent = []
    monkeypatch.setattr(AUTH, "send_verification_email", lambda email, code: sent.append(code) or True)

    client.post("/auth/email/send-code", json={"email": "verify@example.com", "purpose": "register"})
    res = client.post("/auth/email/verify-code", json={
        "email": "verify@example.com",
        "code": sent[0],
        "purpose": "register",
    })

    assert res.status_code == 200, res.text
    data = json.loads((tmp_path / "email_verification_codes.json").read_text(encoding="utf-8"))
    assert data["verify@example.com:register"]["verified"] is True


def test_verify_code_wrong_code_fails(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    monkeypatch.setattr(AUTH, "send_verification_email", lambda email, code: True)
    client.post("/auth/email/send-code", json={"email": "wrong@example.com", "purpose": "register"})

    res = client.post("/auth/email/verify-code", json={
        "email": "wrong@example.com",
        "code": "000000",
        "purpose": "register",
    })

    assert res.status_code == 400


def test_verify_code_expired_fails(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    sent = []
    monkeypatch.setattr(AUTH, "send_verification_email", lambda email, code: sent.append(code) or True)
    client.post("/auth/email/send-code", json={"email": "expired@example.com", "purpose": "register"})

    expires = AUTH._parse_datetime(U.load_email_verification_codes()["expired@example.com:register"]["expires_at"])
    monkeypatch.setattr(AUTH, "now_kst", lambda: expires + timedelta(seconds=1))
    res = client.post("/auth/email/verify-code", json={
        "email": "expired@example.com",
        "code": sent[0],
        "purpose": "register",
    })

    assert res.status_code == 400


def test_register_requires_verified_email(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    res = client.post("/auth/register", json=_payload("notverified@example.com"))

    assert res.status_code == 400


def test_register_succeeds_after_email_verification(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    sent = []
    monkeypatch.setattr(AUTH, "send_verification_email", lambda email, code: sent.append(code) or True)
    client.post("/auth/email/send-code", json={"email": "verified@example.com", "purpose": "register"})
    client.post("/auth/email/verify-code", json={
        "email": "verified@example.com",
        "code": sent[0],
        "purpose": "register",
    })

    res = client.post("/auth/register", json=_payload())

    assert res.status_code == 201, res.text
    assert res.json()["user"]["email"] == "verified@example.com"


def test_send_code_fails_when_resend_key_missing_in_production(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.setenv("EMAIL_FROM", "AI-Mon <noreply@ai-mon.app>")
    monkeypatch.setenv("EMAIL_PROVIDER", "resend")

    res = client.post("/auth/email/send-code", json={"email": "missing@example.com", "purpose": "register"})

    assert res.status_code == 500
