"""게임 어뷰징 방어 회귀 테스트.

방어 레이어 (game.py + mutate_user_atomic):
  L1. HMAC 서명 토큰  — 위조·변조·타인 토큰 사용 불가
  L2. nonce 일회성    — 동일 세션 재생(replay) 차단
  L3. distance 상한   — 10,000 초과 distance XP 위조 차단
  L4. elapsed_floor   — 거리 비례 최소경과시간 (즉시 제출 차단)
  L5. 일일 횟수 캡    — runner 5회/일, aipang 1회/일
  L6. 일일 XP 캡      — runner 2,500 XP/일

모든 캡/가드는 mutate_user_atomic 임계구역 안에서 서버가 강제한다.
클라이언트가 distance 를 위조하거나 토큰을 재사용해도 어느 쪽도 보상을 늘릴 수 없다.
"""
import sys
import os
import json
import base64
import hmac
import hashlib

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

from routers import utils as U
from routers import game as G


# ─── 공통 헬퍼 ───────────────────────────────────────────────────

def _make_token(game_id: str, user_id: str, ts: int, nonce: str, extra: dict | None = None) -> str:
    """game.py 와 동일한 HMAC-SHA256 서명 토큰 생성 (ts 직접 지정 가능)."""
    payload = {"game_id": game_id, "user_id": user_id, "ts": ts, "nonce": nonce}
    if extra:
        payload.update(extra)
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = hmac.new(U.SECRET_KEY.encode(), raw, hashlib.sha256).digest()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    mac = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{body}.{mac}"


def _past(offset: int = 200) -> int:
    """현재시각 - offset 초 (토큰 ts 로 사용)."""
    return int(U.now_kst().timestamp()) - offset


def _read_user(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)[0]


def _decode_token_payload(token: str) -> dict:
    body = token.split(".", 1)[0]
    raw = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
    return json.loads(raw.decode())


def _aicross_token(nonce: str) -> str:
    return _make_token(
        "aicross",
        "u1",
        _past(),
        nonce,
        {"puzzle_id": G.AICROSS_DEFAULT_PUZZLE_ID},
    )


def _aicross_entry_answers(puzzle_id: str | None = None) -> dict:
    puzzle_id = puzzle_id or G.AICROSS_DEFAULT_PUZZLE_ID
    return {
        entry["id"]: entry["answer"].lower()
        for entry in G.AICROSS_PUZZLES[puzzle_id]["entries"]
    }


def _aicross_cell_answers(puzzle_id: str | None = None) -> dict:
    puzzle_id = puzzle_id or G.AICROSS_DEFAULT_PUZZLE_ID
    answers = {}
    for entry in G.AICROSS_PUZZLES[puzzle_id]["entries"]:
        d_row = 1 if entry["direction"] == "down" else 0
        d_col = 1 if entry["direction"] == "across" else 0
        for idx, letter in enumerate(entry["answer"]):
            row = entry["row"] + d_row * idx
            col = entry["col"] + d_col * idx
            answers[f"{row},{col}"] = letter
    return answers


@pytest.fixture
def fresh_user(monkeypatch, tmp_path):
    """실제 데이터 파일을 건드리지 않도록 USERS_FILE 을 임시 경로로 리디렉트."""
    uf = tmp_path / "users.json"
    uf.write_text(
        json.dumps([{
            "id": "u1", "xp": 0, "crowns": 0, "lv": 1,
            "character": "slime", "titles": [], "game_rewards": {},
        }]),
        encoding="utf-8",
    )
    monkeypatch.setattr(U, "USERS_FILE", str(uf))
    monkeypatch.setattr(U, "USE_SUPABASE", False)
    return str(uf)


# ─── L1: 토큰 위조/변조 ──────────────────────────────────────────

def test_tampered_token_rejected(fresh_user):
    """HMAC 서명을 손상시킨 토큰 → 400."""
    token = _make_token("runner", "u1", _past(), "NONCE-TAMPER")
    tampered = token[:-4] + "XXXX"
    req = G.GameClearRequest(game_id="runner", distance=600, game_token=tampered)
    with pytest.raises(HTTPException) as exc:
        G.game_clear(req, {"id": "u1"})
    assert exc.value.status_code == 400


def test_wrong_user_token_rejected(fresh_user):
    """다른 user_id 로 발급된 토큰 사용 → 400 (소유자 불일치)."""
    token = _make_token("runner", "other_user", _past(), "NONCE-WRONG-USER")
    req = G.GameClearRequest(game_id="runner", distance=600, game_token=token)
    with pytest.raises(HTTPException) as exc:
        G.game_clear(req, {"id": "u1"})
    assert exc.value.status_code == 400


def test_wrong_game_token_rejected(fresh_user):
    """aipang 용 토큰을 runner 에 사용 → 400 (game_id 불일치)."""
    token = _make_token("aipang", "u1", _past(), "NONCE-WRONG-GAME")
    req = G.GameClearRequest(game_id="runner", distance=600, game_token=token)
    with pytest.raises(HTTPException) as exc:
        G.game_clear(req, {"id": "u1"})
    assert exc.value.status_code == 400


def test_invalid_game_id_rejected(fresh_user):
    """존재하지 않는 game_id → 400."""
    token = _make_token("hack", "u1", _past(), "NONCE-HACK")
    req = G.GameClearRequest(game_id="hack", distance=600, game_token=token)
    with pytest.raises(HTTPException) as exc:
        G.game_clear(req, {"id": "u1"})
    assert exc.value.status_code == 400


def test_game_start_returns_game_token_for_aicross(fresh_user):
    """aicross /game/start response includes a signed game_token."""
    res = G.game_start(G.GameStartRequest(game_id="aicross"), {"id": "u1"})
    assert isinstance(res["game_token"], str)
    assert "." in res["game_token"]


def test_aicross_start_returns_public_puzzle_payload(fresh_user):
    """aicross /game/start returns the renderable puzzle payload."""
    res = G.game_start(G.GameStartRequest(game_id="aicross"), {"id": "u1"})

    assert res["game_id"] == "aicross"
    assert isinstance(res["game_token"], str)
    puzzle = res["puzzle"]
    assert puzzle["puzzle_id"]
    assert puzzle["grid"]
    assert puzzle["entries"]
    assert puzzle["max_score"] == 100
    assert _decode_token_payload(res["game_token"])["puzzle_id"] == puzzle["puzzle_id"]


def test_aicross_start_payload_does_not_expose_answers(fresh_user):
    """The public aicross puzzle must not include answer-bearing fields."""
    res = G.game_start(G.GameStartRequest(game_id="aicross"), {"id": "u1"})
    puzzle = res["puzzle"]
    serialized = json.dumps(puzzle, sort_keys=True).lower()

    forbidden = ["answer", "word", "letter", "solution", "correct_word", "correctanswer"]
    for key in forbidden:
        assert key not in serialized

    for entry in puzzle["entries"]:
        assert "answer" not in entry
        assert "word" not in entry
        assert "letter" not in entry


def test_game_clear_requires_game_token():
    """/game/clear request model rejects missing game_token."""
    with pytest.raises(ValidationError):
        G.GameClearRequest(game_id="runner", distance=100)


# ─── L2: 토큰 만료·재생 ──────────────────────────────────────────

def test_expired_token_rejected(fresh_user):
    """TOKEN_TTL_SECONDS 초과 토큰 → 400 (만료)."""
    ancient = int(U.now_kst().timestamp()) - G.TOKEN_TTL_SECONDS - 1
    token = _make_token("runner", "u1", ancient, "NONCE-EXPIRED")
    req = G.GameClearRequest(game_id="runner", distance=100, game_token=token)
    with pytest.raises(HTTPException) as exc:
        G.game_clear(req, {"id": "u1"})
    assert exc.value.status_code == 400


def test_token_sequential_replay_rejected(fresh_user):
    """동일 토큰 순차 2회 사용 → 2회째 nonce 거부(already used)."""
    token = _make_token("runner", "u1", _past(), "NONCE-REPLAY")
    req = G.GameClearRequest(game_id="runner", distance=600, game_token=token)
    G.game_clear(req, {"id": "u1"})          # 1회 성공
    with pytest.raises(HTTPException) as exc:
        G.game_clear(req, {"id": "u1"})      # 2회째 → 거부
    assert exc.value.status_code == 400
    assert "already used" in exc.value.detail


def test_aicross_entry_answers_are_server_scored_and_ranked(fresh_user):
    """Entry-level answers are scored by the server and recorded in weekly_xp."""
    puzzle_id = G.AICROSS_DEFAULT_PUZZLE_ID
    req = G.GameClearRequest(
        game_id="aicross",
        game_token=_aicross_token("NONCE-AC-ENTRY"),
        puzzle_id=puzzle_id,
        score=0,
        answers=_aicross_entry_answers(puzzle_id),
    )

    res = G.game_clear(req, {"id": "u1"})

    assert res["puzzle_id"] == puzzle_id
    assert res["correct"] == res["total"]
    assert res["score"] == 100
    assert res["xp_awarded"] == 200

    user = _read_user(fresh_user)
    assert user["xp"] == 200
    assert user["game_rewards"]["weekly_xp"][G.iso_week()]["aicross"] == 200


def test_aicross_client_score_is_ignored_for_wrong_answers(fresh_user):
    """A submitted score=100 must not override server-side wrong-answer scoring."""
    puzzle_id = G.AICROSS_DEFAULT_PUZZLE_ID
    req = G.GameClearRequest(
        game_id="aicross",
        game_token=_aicross_token("NONCE-AC-SCORE-FORGE"),
        puzzle_id=puzzle_id,
        score=100,
        answers={"A1": "wrong"},
    )

    res = G.game_clear(req, {"id": "u1"})

    assert res["score"] == 0
    assert res["correct"] == 0
    assert res["xp_awarded"] == 0
    assert _read_user(fresh_user)["xp"] == 0


def test_aicross_cell_answers_are_supported(fresh_user):
    """Cell-level answers are reconstructed by coordinates and scored by the server."""
    puzzle_id = G.AICROSS_DEFAULT_PUZZLE_ID
    req = G.GameClearRequest(
        game_id="aicross",
        game_token=_aicross_token("NONCE-AC-CELL"),
        puzzle_id=puzzle_id,
        answers=_aicross_cell_answers(puzzle_id),
    )

    res = G.game_clear(req, {"id": "u1"})

    assert res["correct"] == res["total"]
    assert res["score"] == 100
    assert res["xp_awarded"] == 200


def test_aicross_nonce_reuse_does_not_double_award_xp(fresh_user):
    """A replayed aicross game_token is rejected before a second XP grant."""
    puzzle_id = G.AICROSS_DEFAULT_PUZZLE_ID
    req = G.GameClearRequest(
        game_id="aicross",
        game_token=_aicross_token("NONCE-AC-REPLAY-SCORED"),
        puzzle_id=puzzle_id,
        answers=_aicross_entry_answers(puzzle_id),
    )

    first = G.game_clear(req, {"id": "u1"})
    assert first["xp_awarded"] == 200

    with pytest.raises(HTTPException) as exc:
        G.game_clear(req, {"id": "u1"})

    assert exc.value.status_code == 400
    assert "already used" in exc.value.detail
    assert _read_user(fresh_user)["xp"] == 200


def test_aicross_puzzle_id_mismatch_rejected(fresh_user):
    """The submitted puzzle_id must match the puzzle_id embedded in the token."""
    req = G.GameClearRequest(
        game_id="aicross",
        game_token=_aicross_token("NONCE-AC-PUZZLE-MISMATCH"),
        puzzle_id="fake_puzzle",
        answers=_aicross_entry_answers(),
    )

    with pytest.raises(HTTPException) as exc:
        G.game_clear(req, {"id": "u1"})

    assert exc.value.status_code == 400
    assert _read_user(fresh_user)["xp"] == 0


def test_aipang_token_replay_no_double_grant(fresh_user):
    """aipang 동일 토큰 2회: 2회째는 already_claimed=True(왕관 미지급).
    aipang 은 daily 캡이 nonce 검사보다 먼저 평가되어 already_claimed 200 을 반환한다.
    400 이 아니어도 왕관 중복 지급이 없음이 핵심 보장이다."""
    token = _make_token("aipang", "u1", _past(), "NONCE-AP-REPLAY")
    req = G.GameClearRequest(game_id="aipang", game_token=token)
    r1 = G.game_clear(req, {"id": "u1"})
    assert r1["crowns_awarded"] == 1

    r2 = G.game_clear(req, {"id": "u1"})    # 동일 토큰 2회째
    assert r2["already_claimed"] is True
    assert r2["crowns_awarded"] == 0         # 중복 지급 없음

    u = _read_user(fresh_user)
    assert u["crowns"] == 1


# ─── L3: distance 상한 ───────────────────────────────────────────

def test_distance_over_cap_rejected(fresh_user):
    """distance=99999 → 400 (서버 상한 10,000 초과)."""
    token = _make_token("runner", "u1", _past(), "NONCE-99999")
    req = G.GameClearRequest(game_id="runner", distance=99999, game_token=token)
    with pytest.raises(HTTPException) as exc:
        G.game_clear(req, {"id": "u1"})
    assert exc.value.status_code == 400


def test_distance_at_cap_accepted(fresh_user):
    """distance=10000 (상한 경계값) → 정상 수락, XP=500."""
    # distance=10000 → elapsed_floor = max(5, 10000//60) = 166 초
    token = _make_token("runner", "u1", _past(300), "NONCE-ATCAP")
    req = G.GameClearRequest(game_id="runner", distance=10000, game_token=token)
    r = G.game_clear(req, {"id": "u1"})
    assert r["xp_awarded"] == 500
    assert r["already_claimed"] is False


def test_distance_99999_repeated_abuse(fresh_user):
    """distance=99999 반복 5회 → 전부 400, XP=0 유지 (핵심 어뷰징 시나리오)."""
    for i in range(5):
        token = _make_token("runner", "u1", _past(), f"NONCE-ABUSE-{i}")
        req = G.GameClearRequest(game_id="runner", distance=99999, game_token=token)
        with pytest.raises(HTTPException) as exc:
            G.game_clear(req, {"id": "u1"})
        assert exc.value.status_code == 400

    u = _read_user(fresh_user)
    assert u["xp"] == 0, f"어뷰징 시도에서 XP 획득됨: {u['xp']}"
    assert u.get("game_rewards", {}).get("runner_today_count", 0) == 0


# ─── L4: elapsed_floor ───────────────────────────────────────────

def test_too_fast_high_distance_rejected(fresh_user):
    """distance=10000 인데 elapsed 시간이 floor(166초) 미만 → 400 (즉시 제출 차단)."""
    # ts = 60초 전 → age=60 < floor=166 → 거부
    token = _make_token("runner", "u1", _past(60), "NONCE-TOFAST")
    req = G.GameClearRequest(game_id="runner", distance=10000, game_token=token)
    with pytest.raises(HTTPException) as exc:
        G.game_clear(req, {"id": "u1"})
    assert exc.value.status_code == 400
    assert "too fast" in exc.value.detail


def test_min_distance_fast_submission_ok(fresh_user):
    """distance=60 → elapsed_floor=max(5,1)=5초. elapsed=200 → 정상 수락."""
    token = _make_token("runner", "u1", _past(200), "NONCE-MINFLOOR")
    req = G.GameClearRequest(game_id="runner", distance=60, game_token=token)
    r = G.game_clear(req, {"id": "u1"})
    assert r["xp_awarded"] == 200       # distance < 500 → 200 XP
    assert r["already_claimed"] is False


# ─── L5: 일일 횟수 캡 ────────────────────────────────────────────

def test_runner_daily_count_cap_5(fresh_user):
    """runner 5회 성공 후 6회째 → already_claimed=True, XP 추가 없음."""
    for i in range(5):
        token = _make_token("runner", "u1", _past(), f"NONCE-CNT-{i}")
        req = G.GameClearRequest(game_id="runner", distance=300, game_token=token)
        r = G.game_clear(req, {"id": "u1"})
        assert r["already_claimed"] is False, f"play {i+1} 에서 미리 캡 도달"

    token6 = _make_token("runner", "u1", _past(), "NONCE-CNT-5TH")
    r6 = G.game_clear(
        G.GameClearRequest(game_id="runner", distance=300, game_token=token6),
        {"id": "u1"},
    )
    assert r6["already_claimed"] is True
    assert r6["xp_awarded"] == 0

    u = _read_user(fresh_user)
    assert u["game_rewards"]["runner_today_count"] == 5


def test_aipang_daily_crown_cap_1(fresh_user):
    """aipang 하루 2회 → 2회째 already_claimed=True, 왕관 총 1개."""
    t1 = _make_token("aipang", "u1", _past(), "NONCE-AP-1ST")
    r1 = G.game_clear(G.GameClearRequest(game_id="aipang", game_token=t1), {"id": "u1"})
    assert r1["crowns_awarded"] == 1

    t2 = _make_token("aipang", "u1", _past(), "NONCE-AP-2ND")
    r2 = G.game_clear(G.GameClearRequest(game_id="aipang", game_token=t2), {"id": "u1"})
    assert r2["already_claimed"] is True
    assert r2["crowns_awarded"] == 0

    u = _read_user(fresh_user)
    assert u["crowns"] == 1


def test_aicross_start_clear_success(fresh_user):
    """aicross can clear with a valid token and receives XP by score."""
    token = _make_token("aicross", "u1", _past(), "NONCE-AC-1")
    req = G.GameClearRequest(game_id="aicross", score=100, game_token=token)
    res = G.game_clear(req, {"id": "u1"})

    assert res["score"] == 100
    assert res["xp_awarded"] == 200
    assert res["already_claimed"] is False


def test_aicross_token_reuse_blocked(fresh_user):
    """aicross rejects the same token on the second clear attempt."""
    token = _make_token("aicross", "u1", _past(), "NONCE-AC-REPLAY")
    req = G.GameClearRequest(game_id="aicross", score=100, game_token=token)

    G.game_clear(req, {"id": "u1"})
    with pytest.raises(HTTPException) as exc:
        G.game_clear(req, {"id": "u1"})

    assert exc.value.status_code == 400
    assert "already used" in exc.value.detail


# ─── L6: 일일 XP 캡 ──────────────────────────────────────────────

def test_runner_daily_xp_cap_2500(fresh_user):
    """5회 max distance(10,000) 플레이 → XP 합계 ≤ 2,500 (일일 캡 강제)."""
    total_xp = 0
    for i in range(5):
        # distance=10000 → elapsed_floor=166 → _past(300) 사용
        token = _make_token("runner", "u1", _past(300), f"NONCE-XC-{i}")
        req = G.GameClearRequest(game_id="runner", distance=10000, game_token=token)
        r = G.game_clear(req, {"id": "u1"})
        total_xp += r["xp_awarded"]

    u = _read_user(fresh_user)
    assert u["xp"] <= 2500, f"일일 XP 캡 초과: {u['xp']}"
    assert total_xp <= 2500, f"보상 합계 캡 초과: {total_xp}"


def test_daily_xp_cap_cuts_last_grant(fresh_user):
    """4회 500 XP(=2,000) 후 5회째 500 XP 시도 → 남은 500 XP 그대로 허용,
    6회째 시도는 count cap 에 의해 already_claimed."""
    for i in range(4):
        token = _make_token("runner", "u1", _past(300), f"NONCE-CUT-{i}")
        r = G.game_clear(
            G.GameClearRequest(game_id="runner", distance=10000, game_token=token),
            {"id": "u1"},
        )
        assert r["xp_awarded"] == 500

    # 5회째: daily_xp=2000, xp_awarded=500 → 2000+500=2500 (≤ 캡) → 전액 지급
    token5 = _make_token("runner", "u1", _past(300), "NONCE-CUT-4")
    r5 = G.game_clear(
        G.GameClearRequest(game_id="runner", distance=10000, game_token=token5),
        {"id": "u1"},
    )
    assert r5["xp_awarded"] == 500

    u = _read_user(fresh_user)
    assert u["xp"] == 2500
    assert u["game_rewards"]["daily_xp"] == 2500


# ─── L3+L5 복합: 상한 내 최대 distance 반복 ──────────────────────

def test_max_valid_distance_5plays_hits_cap(fresh_user):
    """distance=9999(허용 상한 내, XP=500): 5회 정상 지급 후 6회째 count 캡."""
    for i in range(5):
        token = _make_token("runner", "u1", _past(300), f"NONCE-MV-{i}")
        r = G.game_clear(
            G.GameClearRequest(game_id="runner", distance=9999, game_token=token),
            {"id": "u1"},
        )
        assert r["xp_awarded"] == 500
        assert r["already_claimed"] is False

    u = _read_user(fresh_user)
    assert u["xp"] == 2500

    token6 = _make_token("runner", "u1", _past(300), "NONCE-MV-5TH")
    r6 = G.game_clear(
        G.GameClearRequest(game_id="runner", distance=9999, game_token=token6),
        {"id": "u1"},
    )
    assert r6["already_claimed"] is True
    assert _read_user(fresh_user)["xp"] == 2500


# ─── XP 구간 경계 ─────────────────────────────────────────────────

@pytest.mark.parametrize("distance,expected_xp", [
    (0, 200),
    (499, 200),
    (500, 350),
    (1000, 350),
    (1001, 500),
    (9999, 500),
    (10000, 500),
])
def test_xp_bracket(fresh_user, distance, expected_xp):
    """distance 구간별 XP 지급 금액이 서버 기준과 일치한다."""
    elapsed = max(300, (distance // 60) + 10)   # elapsed_floor 여유 있게 확보
    token = _make_token("runner", "u1", _past(elapsed), f"NONCE-BRK-{distance}")
    r = G.game_clear(
        G.GameClearRequest(game_id="runner", distance=distance, game_token=token),
        {"id": "u1"},
    )
    assert r["xp_awarded"] == expected_xp, (
        f"distance={distance}: expected {expected_xp}, got {r['xp_awarded']}"
    )
