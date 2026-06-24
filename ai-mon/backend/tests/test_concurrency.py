"""C-1 동시성 회귀 테스트.

mutate_user_atomic 표준 원자 쓰기 경로가 게임 보상의 check-then-act(nonce 소비·
일일 캡)를 저장과 같은 임계구역에서 평가하는지 검증한다. (JSON 모드)

- 동일 토큰 동시 /game/clear 2회 → 정확히 1회만 지급(나머지는 nonce 거부)
- 서로 다른 토큰 2개(정상 2판) → 둘 다 지급, 카운터 원자적
"""
import sys
import os
import json
import threading
import base64
import hmac
import hashlib

import pytest

# Add backend directory to python path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

# 앱 모듈 import 전에 필수 환경변수 보장 (utils 가 기동 시 SECRET_KEY 를 강제함)
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from fastapi import HTTPException
from routers import utils as U
from routers import game as G


def _make_token(game_id: str, user_id: str, ts: int, nonce: str) -> str:
    """game.py 와 동일한 형식의 HMAC 서명 토큰 생성 (테스트용, ts 조작 가능)."""
    payload = {"game_id": game_id, "user_id": user_id, "ts": ts, "nonce": nonce}
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = hmac.new(U.SECRET_KEY.encode(), raw, hashlib.sha256).digest()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    mac = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{body}.{mac}"


def _read_user(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)[0]


@pytest.fixture
def temp_user(monkeypatch, tmp_path):
    """실제 데이터 파일을 건드리지 않도록 USERS_FILE 을 임시 파일로 리디렉트.
    다른 테스트 모듈이 먼저 utils 를 import 해 USE_SUPABASE=True 로 고정될 수 있으므로
    명시적으로 False 패치.
    """
    users_file = tmp_path / "users.json"
    users_file.write_text(
        json.dumps([{
            "id": "u1", "xp": 0, "crowns": 0, "lv": 1,
            "character": "slime", "titles": [], "game_rewards": {},
        }]),
        encoding="utf-8",
    )
    monkeypatch.setattr(U, "USERS_FILE", str(users_file))
    monkeypatch.setattr(U, "USE_SUPABASE", False)
    return str(users_file)


def test_same_token_concurrent_clear_grants_once(temp_user):
    """동일 토큰 동시 /game/clear 2회 → 1회만 지급, 나머지는 nonce 거부."""
    past = int(U.now_kst().timestamp()) - 100  # 최소 경과시간(elapsed floor) 통과
    token = _make_token("runner", "u1", past, "NONCE-SAME")

    results, errors = [], []

    def call():
        req = G.GameClearRequest(game_id="runner", distance=600, game_token=token)
        try:
            results.append(G.game_clear(req, {"id": "u1"}))
        except HTTPException as e:
            errors.append(e.detail)

    t1 = threading.Thread(target=call)
    t2 = threading.Thread(target=call)
    t1.start(); t2.start(); t1.join(); t2.join()

    # 정확히 한 번만 보상, 다른 한 번은 nonce 이미 사용 거부
    assert len(results) == 1, f"expected 1 reward, got {results}"
    assert results[0]["xp_awarded"] == 350
    assert len(errors) == 1 and "already used" in errors[0]

    # 영속 상태에 이중 가산 없음
    u = _read_user(temp_user)
    assert u["xp"] == 350
    assert u["game_rewards"]["runner_today_count"] == 1


def test_two_distinct_tokens_both_grant(temp_user):
    """서로 다른 토큰 2개(정상 2판) → 둘 다 지급, 카운터 원자적."""
    past = int(U.now_kst().timestamp()) - 100
    ta = _make_token("runner", "u1", past, "NONCE-A")
    tb = _make_token("runner", "u1", past, "NONCE-B")

    results, errors = [], []

    def call(tk):
        req = G.GameClearRequest(game_id="runner", distance=600, game_token=tk)
        try:
            results.append(G.game_clear(req, {"id": "u1"}))
        except HTTPException as e:
            errors.append(e.detail)

    t1 = threading.Thread(target=call, args=(ta,))
    t2 = threading.Thread(target=call, args=(tb,))
    t1.start(); t2.start(); t1.join(); t2.join()

    # 서로 다른 세션이므로 둘 다 지급
    assert len(results) == 2 and errors == [], f"results={results} errors={errors}"
    u = _read_user(temp_user)
    assert u["xp"] == 700
    assert u["game_rewards"]["runner_today_count"] == 2
