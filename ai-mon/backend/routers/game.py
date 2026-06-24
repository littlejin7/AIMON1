from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import hmac
import hashlib
import base64
import json
import secrets
from routers.utils import get_current_user, save_user, now_kst, apply_xp, SECRET_KEY

router = APIRouter()

# ---------------------------------------------------------------------------
# 게임 세션 토큰 (B-4 어뷰징 방어)
# ---------------------------------------------------------------------------
# /game/start 에서 HMAC 서명 토큰을 발급하고, /game/clear 에서 검증한다.
# 보상을 "실제 플레이 세션"에 묶어 무노동 수령 / distance 위조 / 리플레이를 차단.
# 현재 단계: game_token 은 optional (프론트 미연동). 청크 4에서 required 전환 예정.

TOKEN_TTL_SECONDS = 600  # 발급 후 10분 내 clear 만 유효

# 게임별 최소 플레이 시간(초). 즉시 제출(무플레이) 차단용.
MIN_PLAY_SECONDS = {
    "runner": 5,
    "aipang": 5,
}


def _make_game_token(game_id: str, user_id: str) -> str:
    """game_id/user_id/발급시각/nonce 를 담아 HMAC-SHA256 서명한 토큰을 만든다."""
    payload = {
        "game_id": game_id,
        "user_id": user_id,
        "ts": int(now_kst().timestamp()),
        "nonce": secrets.token_urlsafe(12),
    }
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = hmac.new(SECRET_KEY.encode(), raw, hashlib.sha256).digest()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    mac = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{body}.{mac}"


def _verify_game_token(token: str, game_id: str, user_id: str, elapsed_floor: int):
    """토큰 서명/소유자/만료/최소경과시간을 검증하고 payload(dict)를 반환. 실패 시 400."""
    try:
        body, mac = token.split(".", 1)
        raw = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
        expected = hmac.new(SECRET_KEY.encode(), raw, hashlib.sha256).digest()
        got = base64.urlsafe_b64decode(mac + "=" * (-len(mac) % 4))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid game token")

    if not hmac.compare_digest(expected, got):
        raise HTTPException(status_code=400, detail="Invalid game token signature")

    payload = json.loads(raw.decode())
    if payload.get("game_id") != game_id or payload.get("user_id") != user_id:
        raise HTTPException(status_code=400, detail="Game token mismatch")

    now_ts = int(now_kst().timestamp())
    age = now_ts - int(payload.get("ts", 0))
    if age < 0 or age > TOKEN_TTL_SECONDS:
        raise HTTPException(status_code=400, detail="Game token expired")
    if age < elapsed_floor:
        raise HTTPException(status_code=400, detail="Abnormal gameplay detected (too fast)")

    return payload


def _consume_nonce(game_rewards: dict, payload: dict):
    """nonce 일회성 보장. 사용한 nonce 를 만료시각과 함께 보관하고 만료분은 prune."""
    now_ts = int(now_kst().timestamp())
    used = game_rewards.get("used_tokens")
    if not isinstance(used, dict):
        used = {}
    # 만료된 nonce 정리 (user 객체 비대화 방지)
    used = {n: exp for n, exp in used.items() if isinstance(exp, int) and exp > now_ts}

    nonce = payload.get("nonce")
    if nonce in used:
        raise HTTPException(status_code=400, detail="Game token already used")
    used[nonce] = int(payload.get("ts", now_ts)) + TOKEN_TTL_SECONDS
    game_rewards["used_tokens"] = used


class GameStartRequest(BaseModel):
    game_id: str


class GameClearRequest(BaseModel):
    game_id: str
    distance: Optional[int] = None
    score: Optional[int] = None
    game_token: Optional[str] = None


@router.post("/start")
def game_start(req: GameStartRequest, user_ref: dict = Depends(get_current_user)):
    if req.game_id not in ("aipang", "runner"):
        raise HTTPException(status_code=400, detail="Invalid game_id")
    token = _make_game_token(req.game_id, user_ref["id"])
    return {"game_token": token}


@router.post("/clear")
def game_clear(req: GameClearRequest, user_ref: dict = Depends(get_current_user)):

    # KST 기준 날짜 구하기 (UTC + 9)
    kst_now = now_kst()
    today_kst = kst_now.date().isoformat()

    crowns_awarded = 0
    xp_awarded = 0
    already_claimed = False

    # game_rewards 딕셔너리 초기화
    game_rewards = user_ref.get("game_rewards", {})
    if not isinstance(game_rewards, dict):
        game_rewards = {}

    # [하위 호환성 및 마이그레이션]
    # 1단계: 레거시 필드 (awarded_game_crowns, runner_plays) 이관
    legacy_crowns = user_ref.pop("awarded_game_crowns", None)
    legacy_plays = user_ref.pop("runner_plays", None)

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

    # 게임 종류에 따른 보상 처리
    if req.game_id == "aipang":
        if game_rewards.get("aipang_last_date") == today_kst:
            already_claimed = True
        else:
            # 세션 토큰이 있으면 검증 (optional — 청크 4에서 required 전환)
            if req.game_token:
                payload = _verify_game_token(
                    req.game_token, "aipang", user_ref["id"], MIN_PLAY_SECONDS["aipang"]
                )
                _consume_nonce(game_rewards, payload)
            game_rewards["aipang_last_date"] = today_kst
            crowns_awarded = 1
            user_ref["crowns"] = user_ref.get("crowns", 0) + crowns_awarded

    elif req.game_id == "runner":
        runner_last = game_rewards.get("runner_last_date")
        runner_count = game_rewards.get("runner_today_count", 0)

        # 날짜가 바뀌었으면 카운트 초기화
        if runner_last != today_kst:
            runner_count = 0
            runner_last = today_kst
            game_rewards["daily_xp"] = 0

        if runner_count >= 5:
            already_claimed = True
        else:
            # 클라이언트 조작 방지: 음수 floor + 상한 검증
            distance_val = req.distance if req.distance is not None else (req.score or 0)
            distance_val = max(0, distance_val)
            if distance_val > 10000:
                raise HTTPException(status_code=400, detail="Abnormal gameplay detected (distance too high)")

            # 세션 토큰이 있으면 검증 (optional — 청크 4에서 required 전환)
            # 최소 경과시간을 distance 에 비례시켜 "높은 distance 즉시 제출" 위조를 차단
            if req.game_token:
                elapsed_floor = max(MIN_PLAY_SECONDS["runner"], distance_val // 60)
                payload = _verify_game_token(
                    req.game_token, "runner", user_ref["id"], elapsed_floor
                )
                _consume_nonce(game_rewards, payload)

            runner_count += 1
            game_rewards["runner_today_count"] = runner_count
            game_rewards["runner_last_date"] = today_kst

            if distance_val < 500:
                xp_awarded = 200
            elif distance_val <= 1000:
                xp_awarded = 350
            else:
                xp_awarded = 500

            # 일일 게임 XP 캡 확인 (최대 2500)
            daily_xp = game_rewards.get("daily_xp", 0)
            if daily_xp + xp_awarded > 2500:
                xp_awarded = max(0, 2500 - daily_xp)

            game_rewards["daily_xp"] = daily_xp + xp_awarded
            apply_xp(user_ref, xp_awarded)
    else:
        raise HTTPException(status_code=400, detail="Invalid game_id")

    user_ref["game_rewards"] = game_rewards

    save_user(user_ref)

    return {
        "crowns_awarded": crowns_awarded,
        "xp_awarded": xp_awarded,
        "total_crowns": user_ref.get("crowns", 0),
        "total_xp": user_ref.get("xp", 0),
        "already_claimed": already_claimed
    }
