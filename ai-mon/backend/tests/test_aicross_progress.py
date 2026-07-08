"""AICross(에이칸) B-2 서버 진행도/보상 정책 회귀 테스트.

대상: GET /game/aicross/progress, POST /game/aicross/start, POST /game/aicross/clear
(routers/game.py 의 AICROSS_SETS 계열 — 레거시 AICROSS_PUZZLES/game_id=aicross 분기와는
별개 데이터·별개 helper. 레거시 회귀는 test_game_abuse.py 등 기존 파일이 계속 담당한다.)

정책 요약:
  - completed_sets 는 잠금이 아니다. 완료 세트도 재풀이/재보상 대상이다.
  - 하루 3판 제한은 "보상" 제한이다. aicross_today_count 는 플레이 횟수가 아니라
    reward_amount > 0 으로 실제 지급된 판 수 — 3판 초과/저득점 실패는 증가시키지 않는다.
  - clear_count(100점 클리어 누적) 는 1=신규완료(300), 2~3=복습 고보상(200),
    4+=반복복습(100). 80~99점은 100, <80점은 0.
  - aicross_today_count/aicross_last_date/daily_xp 는 레거시 game_id=aicross 경로와
    같은 필드를 공유한다(파밍 방지). 이 테스트는 신규 라우트만 호출하지만 필드명은
    레거시와 동일하게 검증한다.
"""
import sys
import os
import json
import base64
import hmac
import hashlib

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_path)

os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-characters-long-xx")
os.environ.setdefault("USE_SUPABASE", "false")

import pytest
from fastapi import HTTPException

from routers import utils as U
from routers import game as G


# ─────────────────────────────────────────────────────────────────────────────
# 공통 헬퍼
# ─────────────────────────────────────────────────────────────────────────────

def _make_aicross_token(user_id: str, set_index: int, ts: int = None, nonce: str = "NONCE") -> str:
    """game.py 의 _make_game_token 과 동일한 HMAC-SHA256 서명 토큰(ts 직접 지정 가능)."""
    ts = ts if ts is not None else int(U.now_kst().timestamp()) - 20
    payload = {
        "game_id": "aicross",
        "user_id": user_id,
        "set_index": set_index,
        "ts": ts,
        "nonce": nonce,
    }
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = hmac.new(U.SECRET_KEY.encode(), raw, hashlib.sha256).digest()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    mac = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{body}.{mac}"


def _decode_token_payload(token: str) -> dict:
    body = token.split(".", 1)[0]
    raw = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
    return json.loads(raw.decode())


def _make_legacy_aicross_token(user_id: str, puzzle_id: str, ts: int = None, nonce: str = "NONCE") -> str:
    """레거시 game_id=aicross 토큰(payload 에 set_index 대신 puzzle_id)을 과거 ts 로 발급."""
    ts = ts if ts is not None else int(U.now_kst().timestamp()) - 20
    payload = {"game_id": "aicross", "user_id": user_id, "puzzle_id": puzzle_id, "ts": ts, "nonce": nonce}
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = hmac.new(U.SECRET_KEY.encode(), raw, hashlib.sha256).digest()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    mac = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{body}.{mac}"


def _answers_for(set_index: int, wrong: int = 0) -> dict:
    """정답 dict. wrong>0 이면 앞쪽 wrong개 entry 를 오답으로 만든다(80~99/실패 재현용)."""
    entries = G.AICROSS_SETS[set_index]["entries"]
    return {
        entry["id"]: ("ZZZZZZ" if i < wrong else entry["answer"])
        for i, entry in enumerate(entries)
    }


@pytest.fixture
def fresh_user(monkeypatch, tmp_path):
    """실제 users.json 을 건드리지 않도록 USERS_FILE 을 임시 경로로 리디렉트."""
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


def _progress(uid: str = "u1") -> dict:
    """progress/start 는 mutate_user_atomic 을 쓰지 않고 전달받은 user dict 를 그대로
    읽으므로, 실제 요청 흐름(get_current_user 가 매 요청 fresh read)과 맞추기 위해
    호출 직전 파일에서 새로 읽어온다.
    """
    return G.game_aicross_progress(U.get_user_by_id(uid))


def _start(uid: str = "u1", set_index=None) -> dict:
    return G.game_aicross_start(G.AicrossStartRequest(set_index=set_index), U.get_user_by_id(uid))


def _clear(uid: str, set_index: int, answers: dict, nonce: str, ts: int = None) -> dict:
    token = _make_aicross_token(uid, set_index, ts=ts, nonce=nonce)
    req = G.AicrossClearRequest(game_token=token, set_index=set_index, answers=answers)
    return G.game_aicross_clear(req, {"id": uid})


# ─────────────────────────────────────────────────────────────────────────────
# 1. progress — 신규 유저 기본값
# ─────────────────────────────────────────────────────────────────────────────

def test_new_user_progress_defaults(fresh_user):
    res = _progress()
    assert res["completed_sets"] == []
    assert res["next_set_index"] == 0
    assert res["total_sets"] == len(G.AICROSS_SETS)
    assert res["today_reward_count"] == 0
    assert res["today_reward_limit"] == 3
    assert res["today_reward_remaining"] == 3


# ─────────────────────────────────────────────────────────────────────────────
# 2~3. start — 토큰에 set_index 결속 + 정답 미노출
# ─────────────────────────────────────────────────────────────────────────────

def test_start_token_binds_set_index(fresh_user):
    res = _start(set_index=3)
    payload = _decode_token_payload(res["game_token"])
    assert payload["set_index"] == 3
    assert payload["game_id"] == "aicross"
    assert payload["user_id"] == "u1"
    assert res["set_index"] == 3


def test_start_response_has_no_answer_field(fresh_user):
    res = _start(set_index=2)
    body = json.dumps(res)
    assert "answer" not in body
    for entry in res["puzzle"]["entries"]:
        assert set(entry.keys()) == {"id", "direction", "row", "col", "length", "clue", "easyClue"}


def test_start_without_set_index_uses_next_set_index(fresh_user):
    res = _start()
    assert res["set_index"] == 0


def test_start_out_of_range_set_index_400(fresh_user):
    with pytest.raises(HTTPException) as exc:
        _start(set_index=9999)
    assert exc.value.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# 4~5. clear — 토큰/범위 검증
# ─────────────────────────────────────────────────────────────────────────────

def test_clear_token_set_index_mismatch_400(fresh_user):
    """토큰은 set_index=3 으로 발급됐는데 요청은 set_index=4 로 보내는 경우."""
    token = _make_aicross_token("u1", 3, nonce="NONCE-MISMATCH")
    req = G.AicrossClearRequest(game_token=token, set_index=4, answers=_answers_for(4))
    with pytest.raises(HTTPException) as exc:
        G.game_aicross_clear(req, {"id": "u1"})
    assert exc.value.status_code == 400


def test_clear_out_of_range_set_index_400(fresh_user):
    token = _make_aicross_token("u1", 0, nonce="NONCE-RANGE")
    # token 자체는 0번 세트로 발급했지만, 요청 set_index 를 범위 밖으로 보내면
    # pydantic 모델은 통과하되 서버가 400 을 반환해야 한다.
    req = G.AicrossClearRequest(game_token=token, set_index=99999, answers={})
    with pytest.raises(HTTPException) as exc:
        G.game_aicross_clear(req, {"id": "u1"})
    assert exc.value.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# 6~7. 100점 첫 완료
# ─────────────────────────────────────────────────────────────────────────────

def test_first_completion_100_saves_completed_sets(fresh_user):
    res = _clear("u1", 0, _answers_for(0), nonce="N1")
    assert res["score"] == 100
    assert res["completed_sets"] == [0]
    assert res["is_first_completion"] is True
    assert res["set_clear_count"] == 1


def test_first_completion_100_reward_300(fresh_user):
    res = _clear("u1", 0, _answers_for(0), nonce="N1")
    assert res["reward"]["coin_delta"] == 300
    assert res["reward"]["ranking_score_delta"] == 300
    assert res["already_claimed"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 8~10. 복습 보상 구간 (clear_count 2~3 → 200, 4+ → 100)
# ─────────────────────────────────────────────────────────────────────────────

def test_review_round_1_reward_200(fresh_user):
    _clear("u1", 0, _answers_for(0), nonce="N1")  # clear_count 1 (첫 완료)
    res = _clear("u1", 0, _answers_for(0), nonce="N2")  # clear_count 2
    assert res["set_clear_count"] == 2
    assert res["reward"]["coin_delta"] == 200
    assert res["is_first_completion"] is False


def test_review_round_2_reward_200(fresh_user):
    _clear("u1", 0, _answers_for(0), nonce="N1")
    _clear("u1", 0, _answers_for(0), nonce="N2")
    res = _clear("u1", 0, _answers_for(0), nonce="N3")  # clear_count 3
    assert res["set_clear_count"] == 3
    assert res["reward"]["coin_delta"] == 200


def test_review_round_3_plus_reward_100(fresh_user):
    _clear("u1", 0, _answers_for(0), nonce="N1")
    _clear("u1", 0, _answers_for(0), nonce="N2")
    _clear("u1", 0, _answers_for(0), nonce="N3")
    res = _clear("u1", 0, _answers_for(0), nonce="N4")  # clear_count 4 — 하루 4판째라 캡 초과지만
    # 오늘 보상 3판 캡을 넘겨 reward=0 이 되므로, 캡 영향을 배제하려면 날짜를 분리해야 한다.
    # 여기서는 clear_count 임계값 자체(>=4 → 100)만 별도로 검증한다(아래 test 참고).
    assert res["set_clear_count"] == 4


def _force_new_reward_day(uid: str = "u1") -> None:
    """다음 clear 호출이 '새로운 날'로 인식되도록 aicross_last_date 를 과거로 되돌린다.
    (aicross_today_count 리셋용. completed_sets/best_scores/clear_counts 는 영구 누적이라
    건드리지 않는다.) now_kst() 자체를 monkeypatch 하면 토큰 ts 검증(발급/만료)까지
    같이 틀어지므로, 저장된 날짜 필드만 직접 되돌리는 편이 더 안전하고 단순하다.
    """
    path = U.USERS_FILE
    with open(path, encoding="utf-8") as f:
        users = json.load(f)
    for u in users:
        if u["id"] == uid:
            u.setdefault("game_rewards", {})["aicross_last_date"] = "2000-01-01"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(users, f)


def test_review_round_3_plus_reward_100_without_daily_cap(fresh_user):
    """하루 3판 캡과 clear_count 임계값을 분리해서, clear_count>=4 구간의 보상이
    정확히 100인지 검증한다. 매 호출 전 aicross_last_date 를 과거로 되돌려 daily cap 을
    우회하고 clear_count 누적만 관찰한다.
    """
    results = []
    for i in range(4):
        _force_new_reward_day()
        results.append(_clear("u1", 0, _answers_for(0), nonce=f"CAP-N{i}"))
    # clear_count 1..4, reward 300/200/200/100
    assert [r["set_clear_count"] for r in results] == [1, 2, 3, 4]
    assert [r["reward"]["coin_delta"] for r in results] == [300, 200, 200, 100]


# ─────────────────────────────────────────────────────────────────────────────
# 11~13. 80~99점 / 80점 미만
# ─────────────────────────────────────────────────────────────────────────────

def test_partial_score_80_99_best_score_only(fresh_user):
    res = _clear("u1", 1, _answers_for(1, wrong=1), nonce="N1")
    assert 80 <= res["score"] < 100
    assert res["completed_sets"] == []
    assert res["set_clear_count"] == 0


def test_partial_score_80_99_reward_100(fresh_user):
    res = _clear("u1", 1, _answers_for(1, wrong=1), nonce="N1")
    assert res["reward"]["coin_delta"] == 100


def test_below_80_reward_0(fresh_user):
    res = _clear("u1", 2, _answers_for(2, wrong=5), nonce="N1")
    assert res["score"] < 80
    assert res["reward"]["coin_delta"] == 0
    assert res["completed_sets"] == []
    assert res["already_claimed"] is False  # 캡 초과가 아니라 단순 저득점 실패


# ─────────────────────────────────────────────────────────────────────────────
# 14~15. 중복 방지 / clear_count 는 100점일 때만 증가
# ─────────────────────────────────────────────────────────────────────────────

def test_completed_sets_no_duplicate_on_repeat_100(fresh_user):
    _clear("u1", 0, _answers_for(0), nonce="N1")
    res = _clear("u1", 0, _answers_for(0), nonce="N2")
    assert res["completed_sets"] == [0]  # 중복 없음


def test_clear_count_increments_only_on_100(fresh_user):
    _clear("u1", 0, _answers_for(0), nonce="N1")  # 100점 → clear_count 1
    res_partial = _clear("u1", 0, _answers_for(0, wrong=1), nonce="N2")  # 80~99점
    assert res_partial["set_clear_count"] == 1  # 증가 안 함
    res_100_again = _clear("u1", 0, _answers_for(0), nonce="N3")  # 다시 100점
    assert res_100_again["set_clear_count"] == 2


# ─────────────────────────────────────────────────────────────────────────────
# 16~20. 하루 3판 보상 제한 / aicross_today_count 증가 조건
# ─────────────────────────────────────────────────────────────────────────────

def test_today_count_increases_only_when_reward_positive(fresh_user):
    r1 = _clear("u1", 0, _answers_for(0), nonce="N1")  # 100점 → reward 300 → count 1
    assert r1["today_reward_count"] == 1
    r2 = _clear("u1", 1, _answers_for(1, wrong=5), nonce="N2")  # <80점 → reward 0 → count 그대로
    assert r2["today_reward_count"] == 1


def test_daily_reward_limit_of_3(fresh_user):
    _clear("u1", 0, _answers_for(0), nonce="N1")
    _clear("u1", 0, _answers_for(0), nonce="N2")
    r3 = _clear("u1", 0, _answers_for(0), nonce="N3")
    assert r3["today_reward_count"] == 3
    assert r3["today_reward_remaining"] == 0


def test_over_limit_still_returns_score(fresh_user):
    for i in range(3):
        _clear("u1", 0, _answers_for(0), nonce=f"N{i}")
    res = _clear("u1", 0, _answers_for(0), nonce="N-OVER")
    assert res["score"] == 100
    assert res["correct"] == res["total"]


def test_over_limit_reward_zero_already_claimed(fresh_user):
    for i in range(3):
        _clear("u1", 0, _answers_for(0), nonce=f"N{i}")
    res = _clear("u1", 0, _answers_for(0), nonce="N-OVER")
    assert res["reward"]["coin_delta"] == 0
    assert res["reward"]["gp_delta"] == 0
    assert res["reward"]["ranking_score_delta"] == 0
    assert res["already_claimed"] is True
    assert res["today_reward_count"] == 3  # 캡을 넘지 않음(더 증가 안 함)


def test_over_limit_100_still_saves_completed_and_clear_count(fresh_user):
    for i in range(3):
        _clear("u1", 0, _answers_for(0), nonce=f"N{i}")
    res = _clear("u1", 0, _answers_for(0), nonce="N-OVER")
    assert res["completed_sets"] == [0]
    assert res["set_clear_count"] == 4  # 보상은 없지만 진행도는 계속 누적


# ─────────────────────────────────────────────────────────────────────────────
# 21. 주간 랭킹 — 실제 지급된 ranking_score_delta 만 반영
# ─────────────────────────────────────────────────────────────────────────────

def test_weekly_ranking_reflects_only_granted_amount(fresh_user):
    _clear("u1", 5, _answers_for(5), nonce="N1")  # 100점 첫 완료 → 300 지급
    user = U.get_user_by_id("u1")
    wk = G.iso_week()
    assert user["game_rewards"]["weekly_ranking"][wk]["aicross"] == 300


def test_weekly_ranking_not_incremented_when_reward_zero(fresh_user):
    for i in range(3):
        _clear("u1", 0, _answers_for(0), nonce=f"N{i}")  # 300+200+200 = 700
    _clear("u1", 0, _answers_for(0), nonce="N-OVER")  # 캡 초과, reward 0 → 랭킹 반영 없음
    user = U.get_user_by_id("u1")
    wk = G.iso_week()
    assert user["game_rewards"]["weekly_ranking"][wk]["aicross"] == 700


# ─────────────────────────────────────────────────────────────────────────────
# 22. nonce 재사용 차단
# ─────────────────────────────────────────────────────────────────────────────

def test_nonce_reuse_rejected(fresh_user):
    token = _make_aicross_token("u1", 0, nonce="FIXED-NONCE")
    req = G.AicrossClearRequest(game_token=token, set_index=0, answers=_answers_for(0))
    G.game_aicross_clear(req, {"id": "u1"})
    with pytest.raises(HTTPException) as exc:
        G.game_aicross_clear(req, {"id": "u1"})
    assert exc.value.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# 23. 기존 /game/start, /game/clear 회귀 없음 (경량 스모크 — 본 회귀는 test_game_abuse.py 등)
# ─────────────────────────────────────────────────────────────────────────────

def test_legacy_generic_start_and_clear_untouched(fresh_user):
    """레거시 game_id=aicross 경로(별개 AICROSS_PUZZLES)가 신규 라우트 추가로
    깨지지 않았는지 경량 확인. 전체 회귀는 test_game_abuse.py 가 담당한다.
    """
    start_res = G.game_start(G.GameStartRequest(game_id="aicross"), {"id": "u1"})
    assert "game_token" in start_res
    assert "puzzle" in start_res
    assert "answer" not in json.dumps(start_res["puzzle"])

    puzzle_id = _decode_token_payload(start_res["game_token"])["puzzle_id"]
    answers = {
        entry["id"]: entry["answer"]
        for entry in G.AICROSS_PUZZLES[puzzle_id]["entries"]
    }
    # 레거시 최소 경과시간(5초) 요구를 충족하도록 과거 ts 로 별도 토큰을 발급한다
    # (start 직후 즉시 clear 하면 "too fast" 400 이 되는 건 레거시의 정상 방어 동작).
    legacy_token = _make_legacy_aicross_token("u1", puzzle_id, nonce="LEGACY-N1")

    clear_req = G.GameClearRequest(
        game_id="aicross",
        game_token=legacy_token,
        puzzle_id=puzzle_id,
        answers=answers,
    )
    clear_res = G.game_clear(clear_req, {"id": "u1"})
    assert clear_res["score"] == 100
