"""game.py — 통합 /start, /clear 엔드포인트 + 챌린지.

공통 헬퍼는 game_common.py, AICross 전용은 game_aicross.py,
랭킹은 game_ranking.py 에 분리되어 있다.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import random

from routers.utils import (
    get_current_user,
    now_kst,
    grant_reward,
    get_evolution_stage,
    current_week_ranking_score,
    mutate_user_atomic,
    UserNotFoundError,
)
from routers.game_common import (
    SUPPORTED_GAME_IDS,
    MIN_PLAY_SECONDS,
    _make_game_token,
    _verify_game_token,
    _consume_nonce,
    _maybe_reset_daily_xp,
    _record_weekly_ranking,
)
from routers.game_aicross import (
    AICROSS_PUZZLES,
    AICROSS_DEFAULT_PUZZLE_ID,
    _aicross_public_puzzle,
    _score_aicross_answers,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic 모델
# ---------------------------------------------------------------------------

class GameStartRequest(BaseModel):
    game_id: str


class GameClearRequest(BaseModel):
    game_id: str
    distance: Optional[int] = None
    score: Optional[int] = None
    puzzle_id: Optional[str] = None
    answers: Optional[dict] = None
    correct_count: Optional[int] = None  # 에이짝 전용: 클라이언트 제출값, 서버에서 범위 검증만
    game_token: str  # B-4: 프론트 배선 완료 후 required 전환


# ---------------------------------------------------------------------------
# 챌린지
# ---------------------------------------------------------------------------

CHALLENGE_BONUS_CROWNS = 5
CHALLENGE_TARGETS = {
    "aipang": 1,
    "aizzak": 3,
    "runner": 5,
    "aibomb": 3,
    "aicross": 3,
}


def _challenge_progress(game_rewards: dict, today_kst: str) -> dict:
    """오늘의 챌린지 완료/수령 상태를 game_rewards 기준으로 계산한다."""
    if not isinstance(game_rewards, dict):
        game_rewards = {}

    counts = {
        "aipang": 1 if game_rewards.get("aipang_last_date") == today_kst else 0,
        "aizzak": int(game_rewards.get("aizzak_today_count", 0) or 0)
        if game_rewards.get("aizzak_last_date") == today_kst else 0,
        "runner": int(game_rewards.get("runner_today_count", 0) or 0)
        if game_rewards.get("runner_last_date") == today_kst else 0,
        "aibomb": int(game_rewards.get("aibomb_today_count", 0) or 0)
        if game_rewards.get("aibomb_last_date") == today_kst else 0,
        "aicross": int(game_rewards.get("aicross_today_count", 0) or 0)
        if game_rewards.get("aicross_last_date") == today_kst else 0,
    }
    progress = {
        game_id: min(counts.get(game_id, 0), target)
        for game_id, target in CHALLENGE_TARGETS.items()
    }
    total_done = sum(progress.values())
    total_target = sum(CHALLENGE_TARGETS.values())
    return {
        "progress": progress,
        "total_done": total_done,
        "total_target": total_target,
        "is_complete": total_done >= total_target,
        "claimed": game_rewards.get("challenge_bonus_date") == today_kst,
        "reward_crowns": CHALLENGE_BONUS_CROWNS,
    }


@router.get("/challenge/status")
def game_challenge_status(user_ref: dict = Depends(get_current_user)):
    today_kst = now_kst().date().isoformat()
    game_rewards = user_ref.get("game_rewards")
    return _challenge_progress(game_rewards, today_kst)


@router.post("/challenge/claim")
def game_challenge_claim(user_ref: dict = Depends(get_current_user)):
    user_id = user_ref["id"]
    today_kst = now_kst().date().isoformat()

    def mutator(user: dict) -> dict:
        game_rewards = user.get("game_rewards")
        if not isinstance(game_rewards, dict):
            game_rewards = {}

        status = _challenge_progress(game_rewards, today_kst)
        if not status["is_complete"]:
            raise HTTPException(status_code=400, detail="오늘의 챌린지를 아직 모두 완료하지 않았습니다.")
        if status["claimed"]:
            raise HTTPException(status_code=400, detail="오늘의 챌린지 보너스를 이미 수령했습니다.")

        game_rewards["challenge_bonus_date"] = today_kst
        user["game_rewards"] = game_rewards
        user["crowns"] = int(user.get("crowns", 0) or 0) + CHALLENGE_BONUS_CROWNS
        status["claimed"] = True
        status["crowns"] = user["crowns"]
        return status

    try:
        user, result = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    result["user_state"] = {
        "coin_balance": user.get("coin_balance", 0),
        "gp": user.get("gp", 0),
        "lv": user.get("lv", 1),
        "evolution_stage": get_evolution_stage(user),
        "ranking_score": user.get("ranking_score", 0),
        "weekly_ranking_score": current_week_ranking_score(user),
        "crowns": user.get("crowns", 0),
    }
    return result


# ---------------------------------------------------------------------------
# /start, /clear (통합 분기)
# ---------------------------------------------------------------------------

@router.post("/start")
def game_start(req: GameStartRequest, user_ref: dict = Depends(get_current_user)):
    if req.game_id not in SUPPORTED_GAME_IDS:
        raise HTTPException(status_code=400, detail="Invalid game_id")
    if req.game_id == "aicross":
        puzzle_ids = [k for k in AICROSS_PUZZLES.keys() if k != "basic_001"]
        if not puzzle_ids:
            puzzle_ids = list(AICROSS_PUZZLES.keys())
        puzzle_id = random.choice(puzzle_ids) if puzzle_ids else AICROSS_DEFAULT_PUZZLE_ID
        token = _make_game_token(req.game_id, user_ref["id"], {"puzzle_id": puzzle_id})
        return {
            "game_token": token,
            "game_id": "aicross",
            "puzzle": _aicross_public_puzzle(puzzle_id),
        }
    token = _make_game_token(req.game_id, user_ref["id"])
    return {"game_token": token}


@router.post("/clear")
def game_clear(req: GameClearRequest, user_ref: dict = Depends(get_current_user)):
    user_id = user_ref["id"]

    # KST 기준 날짜 구하기 (UTC + 9)
    today_kst = now_kst().date().isoformat()

    # --- 상태 무관(stateless) 토큰 검증은 원자 경계 밖에서 미리 수행 ---
    # 서명·소유자·만료·최소경과시간 검증은 user 영속 상태와 무관하므로 락 밖에서 OK.
    # nonce '소비'(일회성)는 영속 상태 기준이어야 하므로 아래 mutator 안에서 수행.
    distance_val = None
    submitted_score_result = 0
    aizzak_correct = None
    aizzak_elapsed = None
    aibomb_cleared = None
    aicross_score_detail = None
    if req.game_id == "aipang":
        token_payload = _verify_game_token(
            req.game_token, "aipang", user_id, MIN_PLAY_SECONDS["aipang"]
        )
    elif req.game_id == "runner":
        # 클라이언트 조작 방지: 음수 floor + 상한 검증
        distance_val = max(0, req.distance if req.distance is not None else (req.score or 0))
        if distance_val > 10000:
            raise HTTPException(status_code=400, detail="Abnormal gameplay detected (distance too high)")
        # 최소 경과시간을 distance 에 비례시켜 "높은 distance 즉시 제출" 위조를 차단
        elapsed_floor = max(MIN_PLAY_SECONDS["runner"], distance_val // 60)
        token_payload = _verify_game_token(
            req.game_token, "runner", user_id, elapsed_floor
        )
    elif req.game_id == "aizzak":
        # correct_count 범위 검증 (클라 점수·시간·XP 입력은 무시, 서버가 직접 산출)
        if req.correct_count is None or not (0 <= req.correct_count <= 8):
            raise HTTPException(status_code=400, detail="correct_count는 0~8 범위여야 합니다.")
        token_payload = _verify_game_token(
            req.game_token, "aizzak", user_id, MIN_PLAY_SECONDS["aizzak"]
        )
        # 경과시간: 클라 제출값 불신 — 토큰 발급시각(ts) 기준 서버가 직접 계산
        aizzak_elapsed = int(now_kst().timestamp()) - int(token_payload["ts"])
        aizzak_correct = req.correct_count
    elif req.game_id == "aibomb":
        # correct_count(=클리어 스테이지 수) 범위 검증. 클라 점수·시간·XP 입력은 무시,
        # 서버가 correct_count 로만 XP 산출.
        if req.correct_count is None or not (0 <= req.correct_count <= 10):
            raise HTTPException(status_code=400, detail="correct_count는 0~10 범위여야 합니다.")
        token_payload = _verify_game_token(
            req.game_token, "aibomb", user_id, MIN_PLAY_SECONDS["aibomb"]
        )
        aibomb_cleared = req.correct_count
    elif req.game_id == "aicross":
        token_payload = _verify_game_token(
            req.game_token, "aicross", user_id, MIN_PLAY_SECONDS["aicross"]
        )
        token_puzzle_id = token_payload.get("puzzle_id")
        puzzle_id = req.puzzle_id or token_puzzle_id
        if token_puzzle_id and req.puzzle_id and req.puzzle_id != token_puzzle_id:
            raise HTTPException(status_code=400, detail="Aicross puzzle mismatch")
        if puzzle_id:
            aicross_score_detail = _score_aicross_answers(puzzle_id, req.answers)
            submitted_score_result = aicross_score_detail["score"]
        else:
            submitted_score_result = max(0, min(int(req.score or 0), 100))
            aicross_score_detail = {
                "puzzle_id": None,
                "correct": None,
                "total": None,
                "score": submitted_score_result,
                "legacy_score_only": True,
            }
    else:
        raise HTTPException(status_code=400, detail="Invalid game_id")

    def mutator(user: dict) -> dict:
        """영속 상태에서 새로 읽은 user 기준으로 nonce 소비·캡·보상을 원자 처리."""
        crowns_awarded = 0
        xp_awarded = 0            # 캡 반영 후 '보상 단위'(coin=ranking=gp 후보 동일값)
        coin_awarded = 0
        gp_awarded = 0            # gp_gate 통과(3차 진화>=3) 시에만 실제 지급
        ranking_awarded = 0
        score_result = submitted_score_result
        already_claimed = False

        # game_rewards 딕셔너리 초기화
        game_rewards = user.get("game_rewards", {})
        if not isinstance(game_rewards, dict):
            game_rewards = {}

        # [하위 호환성 및 마이그레이션]
        # 1단계: 레거시 필드 (awarded_game_crowns, runner_plays) 이관
        legacy_crowns = user.pop("awarded_game_crowns", None)
        legacy_plays = user.pop("runner_plays", None)

        if legacy_crowns and isinstance(legacy_crowns, dict):
            aipang_date = legacy_crowns.get("aipang")
            if aipang_date:
                game_rewards["aipang_last_date"] = aipang_date

        if legacy_plays and isinstance(legacy_plays, dict):
            sorted_dates = sorted(legacy_plays.keys())
            if sorted_dates:
                last_date = sorted_dates[-1]
                game_rewards["runner_last_date"] = last_date
                game_rewards["runner_today_count"] = legacy_plays[last_date]

        # 2단계: 이전 game_rewards["aipang"]["last_reward_date"] 및 game_rewards["runner"]["plays"] 형태 마이그레이션
        if "aipang" in game_rewards and isinstance(game_rewards["aipang"], dict):
            old_aipang = game_rewards.pop("aipang", {})
            old_date = old_aipang.get("last_reward_date")
            if old_date:
                game_rewards["aipang_last_date"] = old_date

        if "runner" in game_rewards and isinstance(game_rewards["runner"], dict):
            old_runner = game_rewards.pop("runner", {})
            old_plays = old_runner.get("plays", {})
            if isinstance(old_plays, dict):
                sorted_dates = sorted(old_plays.keys())
                if sorted_dates:
                    last_date = sorted_dates[-1]
                    game_rewards["runner_last_date"] = last_date
                    game_rewards["runner_today_count"] = old_plays[last_date]

        # ── 게임 종류에 따른 보상 처리 ──────────────────────────────────────────
        if req.game_id == "aizzak":
            aizzak_last  = game_rewards.get("aizzak_last_date")
            aizzak_count = game_rewards.get("aizzak_today_count", 0)

            if aizzak_last != today_kst:
                aizzak_count = 0
                # daily_xp 공유 캡: 오늘의 첫 게임일 때만 리셋 (헬퍼로 통일)
                _maybe_reset_daily_xp(game_rewards, today_kst)

            if aizzak_count >= 3:
                already_claimed = True
            else:
                # nonce 소비: 보상 지급과 같은 임계구역 → 동시 동일토큰 이중통과 차단
                _consume_nonce(game_rewards, token_payload)
                aizzak_count += 1
                game_rewards["aizzak_today_count"] = aizzak_count
                game_rewards["aizzak_last_date"]   = today_kst

                # 점수 산출 — 서버가 직접 계산, 클라 입력값 불신
                if aizzak_elapsed <= 60:
                    time_bonus = 300
                elif aizzak_elapsed <= 90:
                    time_bonus = 200
                elif aizzak_elapsed <= 120:
                    time_bonus = 100
                else:
                    time_bonus = 0
                score_result = aizzak_correct * 50 + time_bonus

                # XP 산출
                if score_result >= 700:
                    xp_awarded = 300
                elif score_result >= 600:
                    xp_awarded = 200
                else:
                    xp_awarded = 100


                # 글로벌 일일 게임 XP 캡 (2500)
                daily_xp = game_rewards.get("daily_xp", 0)
                if daily_xp + xp_awarded > 2500:
                    xp_awarded = max(0, 2500 - daily_xp)
                game_rewards["daily_xp"] = daily_xp + xp_awarded
                _r = grant_reward(user, coin_delta=xp_awarded,
                                  ranking_score_delta=xp_awarded,
                                  gp_delta=xp_awarded, event_type="game_clear")
                coin_awarded, gp_awarded, ranking_awarded = (
                    _r["coin_delta"], _r["gp_delta"], _r["ranking_score_delta"])

        elif req.game_id == "aipang":
            if game_rewards.get("aipang_last_date") == today_kst:
                already_claimed = True
            else:
                # nonce 소비를 보상 지급과 같은 임계구역에서 수행 → 동시 동일토큰 이중통과 차단
                _consume_nonce(game_rewards, token_payload)
                # 공유 daily_xp 캡: aipang(크라운 전용)이 오늘의 첫 게임이면 여기서 리셋해야
                # 이후 XP 게임이 전날 잔여 캡에 막히지 않는다.
                _maybe_reset_daily_xp(game_rewards, today_kst)
                game_rewards["aipang_last_date"] = today_kst
                crowns_awarded = 1
                user["crowns"] = user.get("crowns", 0) + crowns_awarded

        elif req.game_id == "aicross":
            aicross_last = game_rewards.get("aicross_last_date")
            aicross_count = game_rewards.get("aicross_today_count", 0)

            if aicross_last != today_kst:
                aicross_count = 0
                _maybe_reset_daily_xp(game_rewards, today_kst)

            if aicross_count >= 3:
                already_claimed = True
            else:
                _consume_nonce(game_rewards, token_payload)
                aicross_count += 1
                game_rewards["aicross_today_count"] = aicross_count
                game_rewards["aicross_last_date"] = today_kst

                if score_result >= 100:
                    xp_awarded = 200
                elif score_result >= 80:
                    xp_awarded = 150
                elif score_result > 0:
                    xp_awarded = 100

                daily_xp = game_rewards.get("daily_xp", 0)
                if daily_xp + xp_awarded > 2500:
                    xp_awarded = max(0, 2500 - daily_xp)

                game_rewards["daily_xp"] = daily_xp + xp_awarded
                _r = grant_reward(user, coin_delta=xp_awarded,
                                  ranking_score_delta=xp_awarded,
                                  gp_delta=xp_awarded, event_type="game_clear")
                coin_awarded, gp_awarded, ranking_awarded = (
                    _r["coin_delta"], _r["gp_delta"], _r["ranking_score_delta"])

        elif req.game_id == "aibomb":
            aibomb_last  = game_rewards.get("aibomb_last_date")
            aibomb_count = game_rewards.get("aibomb_today_count", 0)

            if aibomb_last != today_kst:
                aibomb_count = 0
                _maybe_reset_daily_xp(game_rewards, today_kst)

            if aibomb_count >= 3:
                already_claimed = True
            else:
                # nonce 소비: 보상 지급과 같은 임계구역 → 동시 동일토큰 이중통과 차단
                _consume_nonce(game_rewards, token_payload)
                aibomb_count += 1
                game_rewards["aibomb_today_count"] = aibomb_count
                game_rewards["aibomb_last_date"]   = today_kst

                # XP 산출 — 서버가 correct_count(클리어 스테이지 수)로만 산출
                # 확정 스펙: 한 판 최대 100, 하루 3판(캡)=300
                if aibomb_cleared >= 10:
                    xp_awarded = 100
                elif aibomb_cleared >= 9:
                    xp_awarded = 70
                elif aibomb_cleared >= 7:
                    xp_awarded = 50
                else:
                    xp_awarded = 0

                # 글로벌 일일 게임 XP 캡 (2500)
                daily_xp = game_rewards.get("daily_xp", 0)
                if daily_xp + xp_awarded > 2500:
                    xp_awarded = max(0, 2500 - daily_xp)
                game_rewards["daily_xp"] = daily_xp + xp_awarded
                _r = grant_reward(user, coin_delta=xp_awarded,
                                  ranking_score_delta=xp_awarded,
                                  gp_delta=xp_awarded, event_type="game_clear")
                coin_awarded, gp_awarded, ranking_awarded = (
                    _r["coin_delta"], _r["gp_delta"], _r["ranking_score_delta"])

        else:  # runner
            runner_last = game_rewards.get("runner_last_date")
            runner_count = game_rewards.get("runner_today_count", 0)

            # 날짜가 바뀌었으면 카운트 초기화
            if runner_last != today_kst:
                runner_count = 0
                _maybe_reset_daily_xp(game_rewards, today_kst)

            if runner_count >= 5:
                already_claimed = True
            else:
                # nonce 소비를 보상 지급과 같은 임계구역에서 수행
                _consume_nonce(game_rewards, token_payload)
                runner_count += 1
                game_rewards["runner_today_count"] = runner_count
                game_rewards["runner_last_date"] = today_kst

                if distance_val < 1000:
                    xp_awarded = 200
                elif distance_val <= 3000:
                    xp_awarded = 350
                else:
                    xp_awarded = 500

                # 일일 게임 XP 캡 확인 (최대 2500) — fresh 상태 기준이라 캡도 원자적
                daily_xp = game_rewards.get("daily_xp", 0)
                if daily_xp + xp_awarded > 2500:
                    xp_awarded = max(0, 2500 - daily_xp)

                game_rewards["daily_xp"] = daily_xp + xp_awarded
                _r = grant_reward(user, coin_delta=xp_awarded,
                                  ranking_score_delta=xp_awarded,
                                  gp_delta=xp_awarded, event_type="game_clear")
                coin_awarded, gp_awarded, ranking_awarded = (
                    _r["coin_delta"], _r["gp_delta"], _r["ranking_score_delta"])

        # 주간 랭킹 소스 누적 (실제 지급된 ranking_score 기준, 캡 반영 후). <=0 이면 no-op.
        _record_weekly_ranking(game_rewards, req.game_id, ranking_awarded)

        user["game_rewards"] = game_rewards
        # 파생 카운터(boss_cleared/completed_stages) strip 은 mutate_user_atomic 코어가
        # 일괄 처리(SSOT). 여기서 따로 pop 하지 않는다.

        result = {
            "crowns_awarded": crowns_awarded,
            # xp_awarded 는 하위호환 표기(=보상 단위). 신규 소비자는 reward.* 를 쓴다.
            "xp_awarded": xp_awarded,
            "score": score_result,
            "already_claimed": already_claimed,
            "reward": {
                "coin_delta": coin_awarded,
                "gp_delta": gp_awarded,
                "ranking_score_delta": ranking_awarded,
            },
            "user_state": {
                "coin_balance": user.get("coin_balance", 0),
                "gp": user.get("gp", 0),
                "lv": user.get("lv", 1),
                "evolution_stage": get_evolution_stage(user),
                "ranking_score": user.get("ranking_score", 0),
                "weekly_ranking_score": current_week_ranking_score(user),
                "crowns": user.get("crowns", 0),
            },
            # 레거시 표시 필드 유지(프론트 전환 전 하위호환)
            "total_crowns": user.get("crowns", 0),
            "total_xp": user.get("xp", 0),
        }
        if req.game_id == "aicross" and aicross_score_detail:
            result.update({
                "puzzle_id": aicross_score_detail["puzzle_id"],
                "correct": aicross_score_detail["correct"],
                "total": aicross_score_detail["total"],
            })
        return result

    try:
        _, result = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")
    return result
