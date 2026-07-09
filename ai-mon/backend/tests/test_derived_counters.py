"""파생 카운터 SSOT 회귀 테스트 (boss_cleared / completed_stages).

SSOT=progress. 두 카운터는 serialize_user 에서만 파생 계산하고 user 레코드에는
절대 영속화하지 않는다. mutate_user_atomic 코어가 write 직전 strip 하므로:
  - JSON 모드: 레거시 stale 키가 있어도 저장 시 제거된다.
  - 보스클리어/게임보상 동시 쓰기에서 어느 핸들러가 키를 끼워도 영속 안 됨(드리프트 차단).
  - Supabase 모드: update 페이로드에서 빠져 'column not found' 500 을 방지한다.
"""
import sys
import os
import json
import types
import threading
import base64
import hmac
import hashlib

import pytest

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from fastapi import HTTPException
from routers import utils as U
from routers import game as G


def _make_token(game_id: str, user_id: str, ts: int, nonce: str) -> str:
    payload = {"game_id": game_id, "user_id": user_id, "ts": ts, "nonce": nonce}
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = hmac.new(U.SECRET_KEY.encode(), raw, hashlib.sha256).digest()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    mac = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{body}.{mac}"


def _read_user(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)[0]


# ─────────────────────── 1. JSON: 레거시 stale 키 strip ───────────────────────

def test_json_write_strips_stale_derived_keys(tmp_path, monkeypatch):
    """users.json 에 레거시 boss_cleared/completed_stages 가 남아 있어도
    mutate_user_atomic write 후엔 제거된다(영속 stale ↔ 파생 계산 드리프트 차단)."""
    users_file = tmp_path / "users.json"
    users_file.write_text(
        json.dumps([{
            "id": "u1", "xp": 0, "crowns": 0, "lv": 1,
            "character": "slime", "titles": [], "game_rewards": {},
            "boss_cleared": 99, "completed_stages": 99,   # 레거시 stale 값
        }]),
        encoding="utf-8",
    )
    monkeypatch.setattr(U, "USERS_FILE", str(users_file))
    monkeypatch.setattr(U, "USE_SUPABASE", False)

    def mutator(u):
        u["xp"] = u.get("xp", 0) + 10
        return None

    U.mutate_user_atomic("u1", mutator)

    saved = _read_user(str(users_file))
    assert "boss_cleared" not in saved, "파생 카운터가 영속화됨(drift 원천)"
    assert "completed_stages" not in saved
    assert saved["xp"] == 10


# ──────────────── 2. 보스클리어 + 게임보상 동시 → 파생 드리프트 없음 ────────────────

@pytest.fixture
def temp_user(monkeypatch, tmp_path):
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


def test_concurrent_boss_and_game_no_derived_drift(temp_user):
    """보스클리어(과거 버그처럼 boss_cleared +1 시도) 와 게임보상(/game/clear) 동시 실행.
    어느 경로도 파생 카운터를 영속화하지 않아야 하고, 두 보상은 모두 반영돼야 한다."""
    past = int(U.now_kst().timestamp()) - 100
    token = _make_token("runner", "u1", past, "NONCE-DRIFT")

    def boss_like():
        # 레거시 버그 재현: 핸들러가 직접 boss_cleared/completed_stages 를 가산해도
        # 코어 strip 으로 영속화되지 않아야 한다.
        def mut(u):
            u["boss_cleared"] = u.get("boss_cleared", 0) + 1
            u["completed_stages"] = u.get("completed_stages", 0) + 1
            u["xp"] = u.get("xp", 0) + 3000
            return None
        U.mutate_user_atomic("u1", mut)

    def game_like():
        req = G.GameClearRequest(game_id="runner", distance=600, game_token=token)
        try:
            G.game_clear(req, {"id": "u1"})
        except HTTPException:
            pass

    t1 = threading.Thread(target=boss_like)
    t2 = threading.Thread(target=game_like)
    t1.start(); t2.start(); t1.join(); t2.join()

    saved = _read_user(temp_user)
    # 파생 카운터는 어느 경로로 써도 영속 안 됨
    assert "boss_cleared" not in saved
    assert "completed_stages" not in saved
    # 두 보상 모두 원자적으로 반영돼야 한다. 게임 보상은 더 이상 xp 가 아니라
    # coin/ranking 으로 지급된다(grant_reward 이관). runner distance=600(<1000) →
    # 보상 단위 200. slime(진화<3)이라 gp 는 게이트로 0.
    assert saved["xp"] == 3000, f"boss xp drift: {saved.get('xp')}"
    assert saved.get("coin_balance") == 200, f"game coin drift: {saved.get('coin_balance')}"
    assert saved.get("ranking_score") == 200, f"game ranking drift: {saved.get('ranking_score')}"
    assert saved["game_rewards"]["runner_today_count"] == 1


# ──────────────── 3. Supabase: stale 키가 update 페이로드에서 빠짐(500 방지) ────────────────

def test_supabase_write_strips_derived_keys(monkeypatch):
    """fresh-read user 에 boss_cleared/completed_stages 가 끼어 있어도 update 페이로드에서
    제거된다. (users 테이블엔 두 컬럼이 없어 그대로 보내면 'column not found' 500)"""
    captured = {}

    store = {
        "id": "u1", "xp": 0, "version": 0,
        "boss_cleared": 99, "completed_stages": 99,   # 끼어든 파생 키
    }

    class FakeQuery:
        def __init__(self):
            self._update = None

        def select(self, *a, **k):
            return self

        def update(self, obj):
            self._update = obj
            captured["update"] = obj
            return self

        def eq(self, *a, **k):
            return self

        def execute(self):
            if self._update is not None:
                return types.SimpleNamespace(data=[{"id": "u1"}])  # 1행 갱신 성공
            return types.SimpleNamespace(data=[dict(store)])        # fresh read (복사본)

    class FakeSB:
        def table(self, name):
            return FakeQuery()

    monkeypatch.setattr(U, "USE_SUPABASE", True)
    monkeypatch.setattr(U, "supabase", FakeSB())

    def mut(u):
        u["xp"] = u.get("xp", 0) + 10
        return None

    U.mutate_user_atomic("u1", mut)

    upd = captured["update"]
    assert "boss_cleared" not in upd, "파생 키가 update 페이로드에 포함됨 → 500 위험"
    assert "completed_stages" not in upd
    assert upd["xp"] == 10
    assert upd["version"] == 1
