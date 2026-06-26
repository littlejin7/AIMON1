"""GET /version 엔드포인트 회귀 테스트.

보장해야 할 동작:
  V1. 응답 형태: {"version": <non-empty string>}
  V2. GIT_COMMIT_SHA 환경변수가 있으면 그 값이 우선 사용됨
  V3. 환경변수가 없어도 함수가 예외 없이 문자열을 반환함 (git 없는 환경 포함)
"""
import sys
import os
import importlib

import pytest

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")


# ── V1 + V2: _detect_version이 env var를 우선 사용함 ─────────────────
def test_detect_version_prefers_env_var(monkeypatch):
    monkeypatch.setenv("GIT_COMMIT_SHA", "abc1234")
    import main as M
    assert M._detect_version() == "abc1234"


# ── V3: env var 없어도 문자열 반환 (git 없는 환경 포함) ──────────────
def test_detect_version_fallback_no_env(monkeypatch):
    monkeypatch.delenv("GIT_COMMIT_SHA", raising=False)
    import main as M
    v = M._detect_version()
    assert isinstance(v, str)
    assert len(v) > 0


# ── V1: get_version 엔드포인트가 올바른 형태로 반환함 ────────────────
def test_get_version_endpoint_shape(monkeypatch):
    import main as M
    monkeypatch.setattr(M, "_SERVER_VERSION", "test-sha-99")
    result = M.get_version()
    assert result == {"version": "test-sha-99"}


# ── git 실행 실패 시 "dev" 폴백 ───────────────────────────────────────
def test_detect_version_falls_back_to_dev_when_git_fails(monkeypatch):
    monkeypatch.delenv("GIT_COMMIT_SHA", raising=False)
    import subprocess
    import main as M
    monkeypatch.setattr(subprocess, "check_output", lambda *a, **kw: (_ for _ in ()).throw(FileNotFoundError("git not found")))
    v = M._detect_version()
    assert v == "dev"
