"""
에이밤(aibomb) 미니게임 보안·보상 회귀 테스트.

(a) /game/start 없이 임의 토큰 없이 clear → 400 (토큰 누락/오류)
(b) 정상 토큰 + correct_count=10 → xp_awarded=100, 재사용 토큰(동일 nonce) → 400(무적립)
(c) correct_count 구간: 10→100, 9→70, 7→50, 6→0
(d) 하루 3판 전부 만점(10)이면 누적 300, 4번째 시도는 already_claimed=True(무적립)
(e) daily_xp 2500 캡 경계 확인
(f) correct_count 범위 밖(-1, 11) → 400

확정 스펙: 한 판 최대 XP 100, 하루 3판 캡=300 (aizzak 미러링이던 300/200/100 은 폐기).
"""
import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

import pytest
from unittest.mock import patch
from fastapi import HTTPException
from pydantic import ValidationError

import routers.game as G
from routers.utils import now_kst


# ─────────────────────────────────────────────────────────────────────────────
# 공통 헬퍼 (test_aizzak_game.py 패턴 재사용)
# ─────────────────────────────────────────────────────────────────────────────

def _make_user(uid: str) -> dict:
    return {
        "id": uid,
        "username": f"u_{uid}",
        "xp": 0,
        "lv": 1,
        "crowns": 0,
        "game_rewards": {},
        "token_version": 1,
    }


def _fake_token(uid: str, ts_offset: int = -20) -> str:
    """ts_offset 초만큼 과거 시각으로 aibomb 토큰 생성. 기본 -20초 → MIN_PLAY_SECONDS(15) 통과."""
    import hmac, hashlib, base64, json, secrets
    SECRET_KEY = os.environ["SECRET_KEY"]
    now_ts = int(now_kst().timestamp())
    payload = {
        "game_id": "aibomb",
        "user_id": uid,
        "ts": now_ts + ts_offset,
        "nonce": secrets.token_urlsafe(12),
    }
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = hmac.new(SECRET_KEY.encode(), raw, hashlib.sha256).digest()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    mac = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{body}.{mac}"


def _run_clear(uid: str, correct, token: str, user_store: dict) -> dict:
    """game.py 의 /clear 로직 직접 호출. mutate_user_atomic 을 dict 기반 CAS로 모킹."""
    def _mutate(user_id, mutator):
        u = user_store[user_id]
        result = mutator(u)
        user_store[user_id] = u
        return u, result

    req = G.GameClearRequest(game_id="aibomb", correct_count=correct, game_token=token)
    with patch.object(G, "mutate_user_atomic", side_effect=_mutate):
        return G.game_clear(req, {"id": uid})


# ─────────────────────────────────────────────────────────────────────────────
# (a) /game/start 없이 clear 시도 → 토큰 오류/누락으로 차단
# ─────────────────────────────────────────────────────────────────────────────

def test_aibomb_clear_without_token_rejected_by_model():
    """game_token 필드 자체가 없으면 pydantic 검증에서 막힌다."""
    with pytest.raises(ValidationError):
        G.GameClearRequest(game_id="aibomb", correct_count=10)


def test_aibomb_clear_with_bogus_token_rejected():
    """/game/start 를 거치지 않은 위조/조작 토큰 → 400."""
    uid = "no-start-test"
    user_store = {uid: _make_user(uid)}
    req = G.GameClearRequest(game_id="aibomb", correct_count=10, game_token="not-a-real-token")

    def _mutate(user_id, mutator):
        u = user_store[user_id]
        result = mutator(u)
        user_store[user_id] = u
        return u, result

    with patch.object(G, "mutate_user_atomic", side_effect=_mutate):
        with pytest.raises(HTTPException) as exc:
            G.game_clear(req, {"id": uid})
    assert exc.value.status_code == 400


def test_aibomb_game_start_issues_valid_token():
    """/game/start(aibomb) 는 정상적으로 서명 토큰을 발급한다 (SUPPORTED_GAME_IDS 포함 확인)."""
    res = G.game_start(G.GameStartRequest(game_id="aibomb"), {"id": "u1"})
    assert isinstance(res["game_token"], str)
    assert "." in res["game_token"]


# ─────────────────────────────────────────────────────────────────────────────
# (b) 정상 클리어 + 토큰 재사용 차단
# ─────────────────────────────────────────────────────────────────────────────

def test_aibomb_clear_10_grants_xp100_once():
    """correct_count=10 → xp_awarded=100. 동일 토큰(nonce) 재사용 2회째는 400."""
    uid = "reuse-test"
    user_store = {uid: _make_user(uid)}
    token = _fake_token(uid, ts_offset=-20)

    result = _run_clear(uid, 10, token, user_store)
    assert result["already_claimed"] is False
    assert result["xp_awarded"] == 100

    with pytest.raises(HTTPException) as exc:
        _run_clear(uid, 10, token, user_store)
    assert exc.value.status_code == 400
    assert "already used" in exc.value.detail

    # 재사용 시도로는 추가 지급이 없어야 함
    assert user_store[uid]["xp"] == 100


# ─────────────────────────────────────────────────────────────────────────────
# (c) correct_count 구간별 XP: 10→100, 9→70, 7→50, 6→0
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("cleared,expected_xp", [
    (10, 100),
    (9, 70),
    (7, 50),
    (6, 0),
    (0, 0),
])
def test_aibomb_xp_bracket(cleared, expected_xp):
    uid = f"bracket-{cleared}"
    user_store = {uid: _make_user(uid)}
    token = _fake_token(uid, ts_offset=-20)

    result = _run_clear(uid, cleared, token, user_store)
    assert result["xp_awarded"] == expected_xp, (
        f"cleared={cleared}: expected {expected_xp}, got {result['xp_awarded']}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# (d) 하루 3판 만점 → 누적 900, 4번째 시도는 already_claimed
# ─────────────────────────────────────────────────────────────────────────────

def test_aibomb_daily_cap_3_accumulates_300():
    """만점(100xp) 3회 → 누적 300. 4회째는 already_claimed=True, 추가 지급 없음."""
    uid = "cap-test"
    user_store = {uid: _make_user(uid)}

    total_xp = 0
    for i in range(3):
        token = _fake_token(uid, ts_offset=-20)
        result = _run_clear(uid, 10, token, user_store)
        assert result["already_claimed"] is False, f"play {i+1} 에서 미리 캡 도달"
        total_xp += result["xp_awarded"]

    assert total_xp == 300
    assert user_store[uid]["xp"] == 300
    assert user_store[uid]["game_rewards"]["aibomb_today_count"] == 3

    token4 = _fake_token(uid, ts_offset=-20)
    result4 = _run_clear(uid, 10, token4, user_store)
    assert result4["already_claimed"] is True
    assert result4["xp_awarded"] == 0
    assert user_store[uid]["xp"] == 300  # 변화 없음


def test_aibomb_daily_count_resets_next_day():
    """날짜가 바뀌면 aibomb_today_count 가 리셋되어 다시 3회 허용."""
    uid = "reset-test"
    user_store = {uid: _make_user(uid)}
    yesterday = (now_kst().date() - __import__("datetime").timedelta(days=1)).isoformat()

    user_store[uid]["game_rewards"] = {
        "aibomb_last_date": yesterday,
        "aibomb_today_count": 3,
        "daily_xp": 300,
    }

    token = _fake_token(uid, ts_offset=-20)
    result = _run_clear(uid, 10, token, user_store)
    assert result["already_claimed"] is False, "날짜 변경 후 첫 시도는 허용되어야 함"
    assert result["xp_awarded"] == 100


# ─────────────────────────────────────────────────────────────────────────────
# (e) 글로벌 daily_xp 2500 캡 경계
# ─────────────────────────────────────────────────────────────────────────────

def test_aibomb_daily_xp_global_cap():
    """오늘 이미 2450 XP 소비 상태에서 만점(100xp) 시도 → 잔여 50만 지급."""
    uid = "xp-cap-test"
    user_store = {uid: _make_user(uid)}
    today = now_kst().date().isoformat()
    user_store[uid]["game_rewards"] = {
        "daily_xp": 2450,
        "aibomb_last_date": today,     # 오늘로 표시 → daily_xp 리셋 트리거 방지
        "aibomb_today_count": 0,       # 아직 오늘 aibomb 0회 → 캡(3회) 통과
    }

    token = _fake_token(uid, ts_offset=-20)
    result = _run_clear(uid, 10, token, user_store)

    assert result["xp_awarded"] == 50, f"xp_cap 적용 실패: {result['xp_awarded']}"
    assert user_store[uid]["game_rewards"]["daily_xp"] == 2500


def test_aibomb_daily_xp_cap_already_exhausted():
    """오늘 이미 2500 XP 다 쓴 상태 → 추가 지급 0 (캡 완전 소진)."""
    uid = "xp-cap-full"
    user_store = {uid: _make_user(uid)}
    today = now_kst().date().isoformat()
    user_store[uid]["game_rewards"] = {
        "daily_xp": 2500,
        "aibomb_last_date": today,
        "aibomb_today_count": 0,
    }

    token = _fake_token(uid, ts_offset=-20)
    result = _run_clear(uid, 10, token, user_store)

    assert result["xp_awarded"] == 0
    assert user_store[uid]["game_rewards"]["daily_xp"] == 2500


# ─────────────────────────────────────────────────────────────────────────────
# (f) correct_count 범위 밖 → 400
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("bad_value", [-1, 11])
def test_aibomb_correct_count_out_of_range_returns_400(bad_value):
    uid = f"range-test-{bad_value}"
    user_store = {uid: _make_user(uid)}
    token = _fake_token(uid, ts_offset=-20)

    def _mutate(user_id, mutator):
        u = user_store[user_id]
        result = mutator(u)
        user_store[user_id] = u
        return u, result

    req = G.GameClearRequest(game_id="aibomb", correct_count=bad_value, game_token=token)
    with patch.object(G, "mutate_user_atomic", side_effect=_mutate):
        with pytest.raises(HTTPException) as exc:
            G.game_clear(req, {"id": uid})
    assert exc.value.status_code == 400


def test_aibomb_correct_count_none_returns_400():
    uid = "none-test"
    user_store = {uid: _make_user(uid)}
    token = _fake_token(uid, ts_offset=-20)

    def _mutate(user_id, mutator):
        u = user_store[user_id]
        result = mutator(u)
        user_store[user_id] = u
        return u, result

    req = G.GameClearRequest(game_id="aibomb", correct_count=None, game_token=token)
    with patch.object(G, "mutate_user_atomic", side_effect=_mutate):
        with pytest.raises(HTTPException) as exc:
            G.game_clear(req, {"id": uid})
    assert exc.value.status_code == 400


def test_aibomb_minimum_playtime_blocks_fast_submit():
    """15초 미만 경과 시 '너무 빠른 플레이' 차단."""
    uid = "fast-test"
    user_store = {uid: _make_user(uid)}
    # ts_offset=-5 → 5초 경과 → 최소 15초 미달
    token = _fake_token(uid, ts_offset=-5)

    def _mutate(user_id, mutator):
        u = user_store[user_id]
        result = mutator(u)
        user_store[user_id] = u
        return u, result

    req = G.GameClearRequest(game_id="aibomb", correct_count=10, game_token=token)
    with patch.object(G, "mutate_user_atomic", side_effect=_mutate):
        with pytest.raises(HTTPException) as exc:
            G.game_clear(req, {"id": uid})
    assert exc.value.status_code == 400
    assert "too fast" in exc.value.detail


# ─────────────────────────────────────────────────────────────────────────────
# [헬퍼 리팩터 회귀] daily_xp 공유 캡 리셋 통일 영향 검증
# ─────────────────────────────────────────────────────────────────────────────

def test_cross_game_aicross_then_aizzak_daily_xp_not_reset():
    """
    오늘 aicross 를 먼저 플레이해 daily_xp 를 채운 뒤, 같은 날 aizzak 을 처음 플레이해도
    _maybe_reset_daily_xp 가 daily_xp 를 0으로 되돌리지 않아야 한다
    (리팩터 전: aizzak 분기가 runner_last_date 만 확인했다면 aicross_last_date 를 못 보고
    오리셋할 수 있었던 잠재 버그 — 이제는 5게임 전부 체크하므로 재현되지 않아야 함).
    """
    uid = "cross-game-test"
    user_store = {uid: _make_user(uid)}
    today = now_kst().date().isoformat()

    # aicross 를 오늘 플레이해서 daily_xp=200 을 쌓아둔 상태로 시뮬레이션
    user_store[uid]["game_rewards"] = {
        "aicross_last_date": today,
        "aicross_today_count": 1,
        "daily_xp": 200,
    }

    # aizzak 첫 플레이 (aizzak_last_date 가 아직 없어 "날짜 바뀜" 분기를 탐)
    import routers.game as G2

    def _mutate(user_id, mutator):
        u = user_store[user_id]
        result = mutator(u)
        user_store[user_id] = u
        return u, result

    import hmac, hashlib, base64, json, secrets
    SECRET_KEY = os.environ["SECRET_KEY"]
    now_ts = int(now_kst().timestamp())
    payload = {"game_id": "aizzak", "user_id": uid, "ts": now_ts - 40, "nonce": secrets.token_urlsafe(12)}
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = hmac.new(SECRET_KEY.encode(), raw, hashlib.sha256).digest()
    token = (
        base64.urlsafe_b64encode(raw).decode().rstrip("=")
        + "."
        + base64.urlsafe_b64encode(sig).decode().rstrip("=")
    )

    req = G2.GameClearRequest(game_id="aizzak", correct_count=8, game_token=token)
    with patch.object(G2, "mutate_user_atomic", side_effect=_mutate):
        result = G2.game_clear(req, {"id": uid})

    # aizzak: 8정답+40s(≤60s→+300)=700점→xp=300. daily_xp 오리셋됐다면 200+300=500 이 아니라
    # 리셋되어 0+300=300 이 됐을 것. 리셋 안 됐어야 하므로 200+300=500 이어야 한다.
    assert result["xp_awarded"] == 300
    assert user_store[uid]["game_rewards"]["daily_xp"] == 500, (
        f"daily_xp 가 잘못 리셋됨: {user_store[uid]['game_rewards']['daily_xp']} "
        "(oicross 적립분 200이 aizzak 첫 플레이로 사라지면 안 됨)"
    )


def test_cross_game_all_four_then_runner_no_reset():
    """aipang/aizzak/aicross/aibomb 를 오늘 이미 플레이했으면 runner 첫 플레이에서도 daily_xp 유지."""
    uid = "cross-all-test"
    user_store = {uid: _make_user(uid)}
    today = now_kst().date().isoformat()

    user_store[uid]["game_rewards"] = {
        "aipang_last_date": today,
        "aizzak_last_date": today,
        "aicross_last_date": today,
        "aibomb_last_date": today,
        "daily_xp": 2000,
    }

    token = G_make_runner_token(uid, ts_offset=-300)

    def _mutate(user_id, mutator):
        u = user_store[user_id]
        result = mutator(u)
        user_store[user_id] = u
        return u, result

    req = G.GameClearRequest(game_id="runner", distance=9999, game_token=token)
    with patch.object(G, "mutate_user_atomic", side_effect=_mutate):
        result = G.game_clear(req, {"id": uid})

    # runner: distance=9999 → xp=500. daily_xp 는 2000 유지된 채였어야 하므로
    # 2000+500=2500 (캡 경계, 전액 지급).
    assert result["xp_awarded"] == 500
    assert user_store[uid]["game_rewards"]["daily_xp"] == 2500


def G_make_runner_token(uid: str, ts_offset: int) -> str:
    import hmac, hashlib, base64, json, secrets
    SECRET_KEY = os.environ["SECRET_KEY"]
    now_ts = int(now_kst().timestamp())
    payload = {"game_id": "runner", "user_id": uid, "ts": now_ts + ts_offset, "nonce": secrets.token_urlsafe(12)}
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = hmac.new(SECRET_KEY.encode(), raw, hashlib.sha256).digest()
    return (
        base64.urlsafe_b64encode(raw).decode().rstrip("=")
        + "."
        + base64.urlsafe_b64encode(sig).decode().rstrip("=")
    )
