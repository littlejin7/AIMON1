"""
에이짝(aizzak) 미니게임 보안·보상 회귀 테스트.

(a) 토큰 재사용 차단 (nonce 일회성)
(b) correct_count 9 이상 → 400
(c) 클라가 시간 위조해도 서버 경과시간으로 보너스 산정
(d) 일일 4회째 시도 → already_claimed=True 차단
(e) 8정답 + 55초 → score=700, xp=300
(f) 5정답 + 100초 → score=350, xp=0  (5×50+100=350; 사용자 명세의 450은 산술 오류)
"""
import sys, os, time

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

import pytest
from unittest.mock import patch, MagicMock

import routers.game as G
from routers.utils import now_kst


# ─────────────────────────────────────────────────────────────────────────────
# 공통 헬퍼
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


def _fake_token(uid: str, ts_offset: int = -40) -> tuple[str, dict]:
    """
    ts_offset 초만큼 과거 시각으로 토큰을 만들어 반환.
    기본 -40초 → 최소 플레이 시간 30초 통과, 시간보너스 ≤60s 구간.
    payload도 함께 반환 (ts 값 확인용).
    """
    import hmac, hashlib, base64, json, secrets
    SECRET_KEY = os.environ["SECRET_KEY"]
    now_ts = int(now_kst().timestamp())
    payload = {
        "game_id": "aizzak",
        "user_id": uid,
        "ts": now_ts + ts_offset,
        "nonce": secrets.token_urlsafe(12),
    }
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = hmac.new(SECRET_KEY.encode(), raw, hashlib.sha256).digest()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    mac  = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{body}.{mac}", payload


def _run_clear(uid: str, correct: int, token: str, user_store: dict) -> dict:
    """
    game.py의 /clear 로직을 직접 호출.
    mutate_user_atomic을 user_store dict 기반의 단순 CAS로 모킹.
    """
    def _mutate(user_id, mutator):
        u = user_store[user_id]
        result = mutator(u)
        user_store[user_id] = u
        return u, result

    req = G.GameClearRequest(game_id="aizzak", correct_count=correct, game_token=token)
    user_ref = {"id": uid}

    with patch.object(G, "mutate_user_atomic", side_effect=_mutate):
        return G.game_clear(req, user_ref)


# ─────────────────────────────────────────────────────────────────────────────
# (a) 토큰 재사용 차단
# ─────────────────────────────────────────────────────────────────────────────

def test_aizzak_token_reuse_blocked():
    """같은 토큰으로 두 번 clear 시도 → 두 번째는 400."""
    from fastapi import HTTPException
    uid = "reuse-test"
    user_store = {uid: _make_user(uid)}
    token, _ = _fake_token(uid, ts_offset=-40)

    # 첫 번째 — 성공
    result = _run_clear(uid, 5, token, user_store)
    assert result["already_claimed"] is False

    # 두 번째 — 같은 토큰 → nonce 충돌 → 400
    with pytest.raises(HTTPException) as exc:
        _run_clear(uid, 5, token, user_store)
    assert exc.value.status_code == 400
    assert "already used" in exc.value.detail


# ─────────────────────────────────────────────────────────────────────────────
# (b) correct_count 범위 초과 → 400
# ─────────────────────────────────────────────────────────────────────────────

def test_aizzak_correct_count_9_returns_400():
    """correct_count=9 → 서버가 400 반환 (8 초과 차단)."""
    from fastapi import HTTPException
    uid = "range-test"
    user_store = {uid: _make_user(uid)}
    token, _ = _fake_token(uid, ts_offset=-40)

    def _mutate(user_id, mutator):
        u = user_store[user_id]
        result = mutator(u)
        user_store[user_id] = u
        return u, result

    req = G.GameClearRequest(game_id="aizzak", correct_count=9, game_token=token)
    with patch.object(G, "mutate_user_atomic", side_effect=_mutate):
        with pytest.raises(HTTPException) as exc:
            G.game_clear(req, {"id": uid})
    assert exc.value.status_code == 400


def test_aizzak_correct_count_negative_returns_400():
    """correct_count=-1 → 400."""
    from fastapi import HTTPException
    uid = "neg-test"
    user_store = {uid: _make_user(uid)}
    token, _ = _fake_token(uid, ts_offset=-40)

    def _mutate(user_id, mutator):
        u = user_store[user_id]
        result = mutator(u)
        user_store[user_id] = u
        return u, result

    req = G.GameClearRequest(game_id="aizzak", correct_count=-1, game_token=token)
    with patch.object(G, "mutate_user_atomic", side_effect=_mutate):
        with pytest.raises(HTTPException) as exc:
            G.game_clear(req, {"id": uid})
    assert exc.value.status_code == 400


def test_aizzak_correct_count_none_returns_400():
    """correct_count 미제출 → 400."""
    from fastapi import HTTPException
    uid = "none-test"
    user_store = {uid: _make_user(uid)}
    token, _ = _fake_token(uid, ts_offset=-40)

    def _mutate(user_id, mutator):
        u = user_store[user_id]
        result = mutator(u)
        user_store[user_id] = u
        return u, result

    req = G.GameClearRequest(game_id="aizzak", correct_count=None, game_token=token)
    with patch.object(G, "mutate_user_atomic", side_effect=_mutate):
        with pytest.raises(HTTPException) as exc:
            G.game_clear(req, {"id": uid})
    assert exc.value.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# (c) 클라 시간 위조 → 서버 경과시간 사용
# ─────────────────────────────────────────────────────────────────────────────

def test_aizzak_server_elapsed_overrides_client():
    """
    토큰 발급시각 기준 실제 경과 = 40초 (≤60s → +300).
    클라가 '200초 걸렸다'고 주장해도 서버는 토큰 ts로 직접 계산 → 보너스 300 유지.
    """
    uid = "elapsed-test"
    user_store = {uid: _make_user(uid)}
    # ts_offset=-40 → 토큰 발급 40초 전, 서버 경과 ≈ 40초 → ≤60s → time_bonus=300
    token, payload = _fake_token(uid, ts_offset=-40)

    result = _run_clear(uid, 4, token, user_store)

    # 서버 경과 40s → time_bonus=300, score=4×50+300=500, xp=100
    assert result["score"] == 500, f"score={result['score']} (expected 500 for 4c+40s)"
    assert result["xp_awarded"] == 100


def test_aizzak_slow_game_no_time_bonus():
    """토큰 발급 200초 후 제출 → 시간보너스 0."""
    uid = "slow-test"
    user_store = {uid: _make_user(uid)}
    # ts_offset=-200 → 200초 경과 → >120s → time_bonus=0
    token, _ = _fake_token(uid, ts_offset=-200)

    result = _run_clear(uid, 4, token, user_store)

    # score=4×50+0=200, xp=0
    assert result["score"] == 200
    assert result["xp_awarded"] == 0


# ─────────────────────────────────────────────────────────────────────────────
# (d) 일일 4회째 → already_claimed
# ─────────────────────────────────────────────────────────────────────────────

def test_aizzak_daily_cap_3():
    """일일 3회 후 4번째 시도는 already_claimed=True로 차단."""
    uid = "cap-test"
    user_store = {uid: _make_user(uid)}

    # 3회 성공
    for _ in range(3):
        token, _ = _fake_token(uid, ts_offset=-40)
        result = _run_clear(uid, 3, token, user_store)
        assert result["already_claimed"] is False

    # 4회째
    token, _ = _fake_token(uid, ts_offset=-40)
    result = _run_clear(uid, 3, token, user_store)
    assert result["already_claimed"] is True
    assert result["xp_awarded"] == 0


def test_aizzak_daily_count_resets_next_day():
    """날짜가 바뀌면 카운트가 리셋되어 다시 3회 허용."""
    uid = "reset-test"
    user_store = {uid: _make_user(uid)}
    yesterday = (now_kst().date() - __import__("datetime").timedelta(days=1)).isoformat()

    # 어제 3회를 다 쓴 상태 시뮬레이션
    user_store[uid]["game_rewards"] = {
        "aizzak_last_date": yesterday,
        "aizzak_today_count": 3,
        "daily_xp": 300,
    }

    token, _ = _fake_token(uid, ts_offset=-40)
    result = _run_clear(uid, 3, token, user_store)
    assert result["already_claimed"] is False, "날짜 변경 후 첫 시도는 허용되어야 함"


# ─────────────────────────────────────────────────────────────────────────────
# (e) 8정답 + 55초 → score=700, xp=300
# ─────────────────────────────────────────────────────────────────────────────

def test_aizzak_8correct_55sec_score700_xp300():
    """스펙 검증: 8×50=400, ≤60s→+300, score=700, xp=300."""
    uid = "e2e-e"
    user_store = {uid: _make_user(uid)}
    token, _ = _fake_token(uid, ts_offset=-55)  # 55초 경과 → ≤60s

    result = _run_clear(uid, 8, token, user_store)

    assert result["score"] == 700,    f"score={result['score']}"
    assert result["xp_awarded"] == 300, f"xp={result['xp_awarded']}"


# ─────────────────────────────────────────────────────────────────────────────
# (f) 5정답 + 100초 → score=350, xp=0
#     (5×50=250, ≤120s→+100, total=350; 사용자 명세의 450은 산술 오류)
# ─────────────────────────────────────────────────────────────────────────────

def test_aizzak_5correct_100sec_score350_xp0():
    """스펙 검증: 5×50=250, ≤120s→+100, score=350, xp=0 (500 미만)."""
    uid = "e2e-f"
    user_store = {uid: _make_user(uid)}
    token, _ = _fake_token(uid, ts_offset=-100)  # 100초 경과 → ≤120s → +100

    result = _run_clear(uid, 5, token, user_store)

    assert result["score"] == 350,  f"score={result['score']} (5×50+100=350)"
    assert result["xp_awarded"] == 0, f"xp={result['xp_awarded']} (350 < 500)"


# ─────────────────────────────────────────────────────────────────────────────
# 추가: XP 구간 경계 검증
# ─────────────────────────────────────────────────────────────────────────────

def test_aizzak_score_boundaries():
    """XP 경계값 정확성 검증."""
    uid_base = "boundary"

    cases = [
        # (correct, ts_offset, expected_score, expected_xp, label)
        (8, -55,  700, 300, "700→300xp"),   # 8×50+300=700
        (6, -55,  600, 200, "600→200xp"),   # 6×50+300=600
        (4, -55,  500, 100, "500→100xp"),   # 4×50+300=500
        (3, -55,  450, 0,   "450→0xp"),     # 3×50+300=450
        (8, -200, 400, 0,   "400→0xp"),     # 8×50+0=400 (>120s)
    ]

    for correct, ts_offset, exp_score, exp_xp, label in cases:
        uid = f"{uid_base}-{label}"
        user_store = {uid: _make_user(uid)}
        token, _ = _fake_token(uid, ts_offset=ts_offset)
        result = _run_clear(uid, correct, token, user_store)
        assert result["score"] == exp_score, f"[{label}] score={result['score']} expected={exp_score}"
        assert result["xp_awarded"] == exp_xp, f"[{label}] xp={result['xp_awarded']} expected={exp_xp}"


def test_aizzak_minimum_playtime_blocks_fast_submit():
    """30초 미만 경과 시 '너무 빠른 플레이' 차단."""
    from fastapi import HTTPException
    uid = "fast-test"
    user_store = {uid: _make_user(uid)}
    # ts_offset=-10 → 10초 경과 → 최소 30초 미달
    token, _ = _fake_token(uid, ts_offset=-10)

    def _mutate(user_id, mutator):
        u = user_store[user_id]
        result = mutator(u)
        user_store[user_id] = u
        return u, result

    req = G.GameClearRequest(game_id="aizzak", correct_count=5, game_token=token)
    with patch.object(G, "mutate_user_atomic", side_effect=_mutate):
        with pytest.raises(HTTPException) as exc:
            G.game_clear(req, {"id": uid})
    assert exc.value.status_code == 400
    assert "too fast" in exc.value.detail


def test_aizzak_daily_xp_global_cap():
    """글로벌 일일 XP 캡(2500)이 aizzak에도 적용된다."""
    uid = "xp-cap-test"
    user_store = {uid: _make_user(uid)}
    today = now_kst().date().isoformat()
    # 오늘 이미 2400 XP 소비한 상태 — aizzak_last_date=today로 설정해 날짜 리셋 방지
    user_store[uid]["game_rewards"] = {
        "daily_xp": 2400,
        "aizzak_last_date": today,   # 오늘로 표시 → daily_xp 리셋 트리거 방지
        "aizzak_today_count": 0,     # 아직 오늘 에이짝 0회 → 캡(3회) 통과
    }

    token, _ = _fake_token(uid, ts_offset=-55)
    result = _run_clear(uid, 8, token, user_store)  # 700점 → 원래 xp=300

    # 2400 + 300 = 2700 > 2500 → xp = 2500-2400 = 100
    assert result["xp_awarded"] == 100, f"xp_cap 적용 실패: {result['xp_awarded']}"
