"""
B-6: 소셜 로그인 외부 호출 에러 처리 회귀 테스트.

3 공급자(Google / Naver / Kakao) × 3 시나리오:
  (a) timeout → 502
  (b) 비2xx(503) → 502
  (c) 공급자 error 필드(400) → 400
"""
import sys, os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from starlette.testclient import TestClient

import routers.auth as A
from routers.utils import limiter


# ────────────────────────────────────────────────────────────────────────────
# App / client fixture
# ────────────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def app():
    _app = FastAPI()
    _app.state.limiter = limiter
    _app.include_router(A.router, prefix="/auth")
    return _app


@pytest.fixture(scope="module")
def client(app):
    return TestClient(app, raise_server_exceptions=False)


# ────────────────────────────────────────────────────────────────────────────
# Mock helpers
# ────────────────────────────────────────────────────────────────────────────
def _mock_response(status_code: int, json_data: dict):
    """httpx.Response 처럼 동작하는 mock 객체를 반환한다."""
    res = MagicMock()
    res.status_code = status_code
    res.is_success = (200 <= status_code < 300)
    res.json.return_value = json_data
    return res


def _patch_httpx_post(mock_response):
    """AsyncClient.post 가 mock_response 를 반환하도록 AsyncClient 를 패치한다."""
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.get = AsyncMock(return_value=_mock_response(200, {"email": "u@x.com", "name": "U"}))

    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_client)
    mock_cm.__aexit__ = AsyncMock(return_value=False)
    return patch.object(httpx, "AsyncClient", return_value=mock_cm)


def _patch_httpx_post_timeout():
    """AsyncClient.post 가 TimeoutException 을 발생시키도록 패치한다."""
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))

    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_client)
    mock_cm.__aexit__ = AsyncMock(return_value=False)
    return patch.object(httpx, "AsyncClient", return_value=mock_cm)


# 환경변수 패치 (API key 없어도 설정 분기를 넘기기 위해)
_ENV = {
    "GOOGLE_CLIENT_ID": "gid",
    "GOOGLE_CLIENT_SECRET": "gsec",
    "NAVER_CLIENT_ID": "nid",
    "NAVER_CLIENT_SECRET": "nsec",
    "KAKAO_CLIENT_ID": "kid",
}

SOCIAL_PAYLOADS = {
    "google": {"code": "c", "redirect_uri": "http://localhost"},
    "naver":  {"code": "c", "redirect_uri": "http://localhost", "state": "s"},
    "kakao":  {"code": "c", "redirect_uri": "http://localhost"},
}

PROVIDER_ERRORS = {
    "google": {"error": "invalid_grant", "error_description": "Code expired"},
    "naver":  {"error": "invalid_request", "error_description": "Bad code"},
    "kakao":  {"error": "KOE320",          "error_description": "Invalid code"},
}


def _patch_httpx_post_parse_error():
    """AsyncClient.post 가 성공(200)으로 돌아오지만 .json() 이 ValueError 를 던지도록 패치."""
    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_res.is_success = True
    mock_res.json.side_effect = ValueError("Unexpected token in JSON")

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_res)

    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_client)
    mock_cm.__aexit__ = AsyncMock(return_value=False)
    return patch.object(httpx, "AsyncClient", return_value=mock_cm)


# ────────────────────────────────────────────────────────────────────────────
# (a) timeout → 502
# ────────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("provider", ["google", "naver", "kakao"])
def test_token_exchange_timeout_returns_502(client, provider, monkeypatch):
    """토큰 교환 단계에서 timeout 이 발생하면 503이 아닌 502를 반환해야 한다."""
    for k, v in _ENV.items():
        monkeypatch.setenv(k, v)

    with _patch_httpx_post_timeout():
        res = client.post(
            f"/auth/social/{provider}",
            json=SOCIAL_PAYLOADS[provider],
        )

    assert res.status_code == 502, (
        f"[{provider}] timeout → expected 502, got {res.status_code}: {res.text}"
    )
    assert "일시 오류" in res.json().get("detail", "")


# ────────────────────────────────────────────────────────────────────────────
# (b) 비2xx (503) → 502
# ────────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("provider", ["google", "naver", "kakao"])
def test_token_exchange_non2xx_returns_502(client, provider, monkeypatch):
    """토큰 교환 단계에서 503 응답이 오면 502를 반환해야 한다."""
    for k, v in _ENV.items():
        monkeypatch.setenv(k, v)

    mock_503 = _mock_response(503, {"message": "Service Unavailable"})
    with _patch_httpx_post(mock_503):
        res = client.post(
            f"/auth/social/{provider}",
            json=SOCIAL_PAYLOADS[provider],
        )

    assert res.status_code == 502, (
        f"[{provider}] 503 → expected 502, got {res.status_code}: {res.text}"
    )
    assert "일시 오류" in res.json().get("detail", "")


# ────────────────────────────────────────────────────────────────────────────
# (c) 공급자 error 필드 → 400 (회귀)
# ────────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("provider", ["google", "naver", "kakao"])
def test_provider_error_field_returns_400(client, provider, monkeypatch):
    """공급자가 JSON body 에 error 필드를 반환하면 400을 반환해야 한다."""
    for k, v in _ENV.items():
        monkeypatch.setenv(k, v)

    mock_400 = _mock_response(400, PROVIDER_ERRORS[provider])
    with _patch_httpx_post(mock_400):
        res = client.post(
            f"/auth/social/{provider}",
            json=SOCIAL_PAYLOADS[provider],
        )

    assert res.status_code == 400, (
        f"[{provider}] provider error → expected 400, got {res.status_code}: {res.text}"
    )


# ────────────────────────────────────────────────────────────────────────────
# (d) 내부 파싱 오류(예상 못 한 예외) → 500, 502 아님
# ────────────────────────────────────────────────────────────────────────────
def test_internal_parse_error_returns_500_not_502(client, monkeypatch):
    """응답 JSON 파싱 실패(예: 비-JSON 본문) 는 내부 오류이므로 502 가 아닌 500 이어야 한다.

    except Exception → raise (re-raise) 패턴 검증:
    광범위한 except Exception → 502 가 제거됐을 때만 500 이 노출된다.
    """
    for k, v in _ENV.items():
        monkeypatch.setenv(k, v)

    with _patch_httpx_post_parse_error():
        res = client.post("/auth/social/google", json=SOCIAL_PAYLOADS["google"])

    assert res.status_code == 500, (
        f"parse error → expected 500 (not 502), got {res.status_code}: {res.text}"
    )
