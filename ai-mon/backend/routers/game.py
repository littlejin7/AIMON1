from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import hmac
import hashlib
import base64
import json
import secrets
import time
from routers.utils import (
    get_current_user,
    get_current_user_optional,
    now_kst,
    iso_week,
    prev_iso_week,
    apply_xp,
    SECRET_KEY,
    mutate_user_atomic,
    UserNotFoundError,
    load_users,
)

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
    "aizzak": 30,
    "aicross": 5,
    "aibomb": 15,
}
SUPPORTED_GAME_IDS = frozenset(MIN_PLAY_SECONDS)


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


def _maybe_reset_daily_xp(game_rewards: dict, today_kst: str) -> None:
    """공유 daily_xp 캡을 '오늘의 첫 게임' 시점에 한 번만 0으로 리셋한다.

    daily_xp 는 XP 지급 게임(runner/aizzak/aicross/aibomb)이 공유하는 일일 캡이다.
    SUPPORTED_GAME_IDS(=MIN_PLAY_SECONDS 의 key)의 *_last_date 가 전부 오늘이 아닐 때
    (=오늘 아직 아무 게임도 안 함)에만 리셋한다. 개별 분기가 서로를 부분적으로만 확인하던
    기존 방식(aizzak=runner만, aicross=runner+aizzak, runner=무조건)은 특정 실행 순서에서
    다른 게임의 당일 누적분을 지우던 정합성 버그가 있어 이 헬퍼로 통일한다.
    게임 목록을 SUPPORTED_GAME_IDS 에서 파생시켜, 새 미니게임 추가 시 이 하드코딩된
    리스트에 넣는 걸 잊어 리셋 판단에서 조용히 빠지는 회귀를 원천 차단한다.
    aipang 은 XP 는 안 주지만, 오늘의 첫 게임이 될 수 있으므로 리셋 주체에 포함한다.
    """
    if all(
        game_rewards.get(f"{g}_last_date") != today_kst
        for g in SUPPORTED_GAME_IDS
    ):
        game_rewards["daily_xp"] = 0


# ---------------------------------------------------------------------------
# 주간 랭킹 소스: 주간 게임 XP 누적 (game_rewards["weekly_xp"])
# ---------------------------------------------------------------------------
# 랭킹/지난주 우승자의 단일 진실. game_id → 그 주에 실제 지급된 XP(daily 캡 반영 후)를
# ISO 주별로 누적한다. 게임별 점수 체계(거리/점수/스테이지)가 서로 달라 비교 불가하므로,
# "주간 게임 XP 합산"이라는 단일 비교 지표로 통일한다.
#   game_rewards["weekly_xp"] = { "<ISO주>": { "<game_id>": <누적 XP> } }
# 보관은 이번 주 + 지난주 2주만(자동 prune) — user 레코드 비대화 방지.
def _record_weekly_xp(game_rewards: dict, game_id: str, xp: int) -> None:
    """이번 주 game_id 의 주간 XP 를 누적하고 이번 주/지난주만 남긴다. (in-place)

    xp<=0(무보상·이미 클레임·크라운 전용 aipang)이면 아무 것도 하지 않는다 → 랭킹 크레딧 없음.
    같은 임계구역(mutate_user_atomic)에서 fresh 상태에 대해 호출되므로 동시성 안전.
    """
    if xp <= 0:
        return
    wk = iso_week()
    prev = prev_iso_week()
    weekly = game_rewards.get("weekly_xp")
    if not isinstance(weekly, dict):
        weekly = {}
    # 이번 주 + 지난주만 롤링 보관 (오래된 주는 prune)
    weekly = {w: v for w, v in weekly.items() if w in (wk, prev) and isinstance(v, dict)}
    cur = weekly.get(wk)
    if not isinstance(cur, dict):
        cur = {}
    cur[game_id] = int(cur.get(game_id, 0) or 0) + int(xp)
    weekly[wk] = cur
    game_rewards["weekly_xp"] = weekly


class GameStartRequest(BaseModel):
    game_id: str


class GameClearRequest(BaseModel):
    game_id: str
    distance: Optional[int] = None
    score: Optional[int] = None
    correct_count: Optional[int] = None  # 에이짝 전용: 클라이언트 제출값, 서버에서 범위 검증만
    game_token: str  # B-4: 프론트 배선 완료 후 required 전환


@router.post("/start")
def game_start(req: GameStartRequest, user_ref: dict = Depends(get_current_user)):
    if req.game_id not in SUPPORTED_GAME_IDS:
        raise HTTPException(status_code=400, detail="Invalid game_id")
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
        submitted_score_result = max(0, min(int(req.score or 0), 100))
        token_payload = _verify_game_token(
            req.game_token, "aicross", user_id, MIN_PLAY_SECONDS["aicross"]
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid game_id")

    def mutator(user: dict) -> dict:
        """영속 상태에서 새로 읽은 user 기준으로 nonce 소비·캡·보상을 원자 처리."""
        crowns_awarded = 0
        xp_awarded = 0
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
                apply_xp(user, xp_awarded, event_type="game_clear")

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
                apply_xp(user, xp_awarded, event_type="game_clear")

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
                apply_xp(user, xp_awarded, event_type="game_clear")

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
                apply_xp(user, xp_awarded, event_type="game_clear")

        # 주간 랭킹 소스 누적 (실제 지급된 XP 기준, 캡 반영 후). xp_awarded<=0 이면 no-op.
        _record_weekly_xp(game_rewards, req.game_id, xp_awarded)

        user["game_rewards"] = game_rewards
        # 파생 카운터(boss_cleared/completed_stages) strip 은 mutate_user_atomic 코어가
        # 일괄 처리(SSOT). 여기서 따로 pop 하지 않는다.

        return {
            "crowns_awarded": crowns_awarded,
            "xp_awarded": xp_awarded,
            "score": score_result,
            "total_crowns": user.get("crowns", 0),
            "total_xp": user.get("xp", 0),
            "already_claimed": already_claimed,
        }

    try:
        _, result = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")
    return result


# ---------------------------------------------------------------------------
# 미니게임 주간 랭킹 (읽기 전용 집계)
# ---------------------------------------------------------------------------
# 지표: 주간 게임 XP 합산(_record_weekly_xp 로 누적된 game_rewards["weekly_xp"]).
# - GET /game/ranking          : 전 게임 합산 Top N + 내 순위 (홈 게임 탭 요약)
# - GET /game/ranking/by-game  : 게임별 Top N + 내 순위 + 지난주 우승자 (전체보기 페이지)
# 더미 없음: 데이터가 없으면 빈 목록 / last_week_winner=null 을 그대로 반환한다.

# 랭킹에 노출할 XP 지급 게임. 에이팡(aipang)은 크라운 전용(XP 0)이라 점수 랭킹에서 제외.
RANKED_GAMES = (
    ("runner", "에이런"),
    ("aizzak", "에이짝"),
    ("aicross", "AI 크로스워드"),
    ("aibomb", "에이밤"),
)
_GAME_TITLES = dict(RANKED_GAMES)
RANKING_WEIGHT = {
    "runner": 1.0,
    "aizzak": 1.0,
    "aicross": 1.0,
    "aibomb": 1.0,
}

_RANKING_CACHE_TTL = 30
_ranking_cache = {}


def _cached_ranking(cache_key: str, builder):
    now = time.monotonic()
    entry = _ranking_cache.get(cache_key)
    if entry and now - entry[0] < _RANKING_CACHE_TTL:
        return entry[1]

    result = builder()
    _ranking_cache[cache_key] = (now, result)
    return result


def _weekly_xp_map(user: dict, wk: str) -> dict:
    """해당 유저의 지정 ISO 주 게임별 XP 맵 {game_id: xp}. 방어적으로 정제한다."""
    gr = user.get("game_rewards")
    if not isinstance(gr, dict):
        return {}
    weekly = gr.get("weekly_xp")
    if not isinstance(weekly, dict):
        return {}
    wkmap = weekly.get(wk)
    if not isinstance(wkmap, dict):
        return {}
    out = {}
    for gid, v in wkmap.items():
        if gid in _GAME_TITLES and isinstance(v, (int, float)) and v > 0:
            out[gid] = int(v)
    return out


def _ranking_weekly_xp_map(user: dict, wk: str) -> dict:
    raw = _weekly_xp_map(user, wk)
    result = {}
    for game_id, xp in raw.items():
        weight = RANKING_WEIGHT.get(game_id, 1.0)
        result[game_id] = int(round(int(xp or 0) * weight))
    return result


def _display_nickname(user: dict) -> str:
    return (user.get("nickname") or user.get("username") or "익명").strip() or "익명"


def _rank_entries(entries: list) -> list:
    """점수 desc 정렬 후 동점자 동순위(competition ranking: 1,2,2,4)를 부여한다."""
    ordered = sorted(entries, key=lambda e: (-e["score"], e["nickname"]))
    rank = 0
    prev_score = None
    for i, e in enumerate(ordered):
        if e["score"] != prev_score:
            rank = i + 1
            prev_score = e["score"]
        e["rank"] = rank
    return ordered


def _clamp_limit(limit) -> int:
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = 3
    return max(1, min(limit, 50))


def _me_row(ranked: list, user_ref: Optional[dict]):
    """로그인 유저의 순위 행. 이번 주 기록이 없으면 rank='-', score=0."""
    if not user_ref:
        return None
    mine = next((e for e in ranked if e["user_id"] == user_ref["id"]), None)
    if mine:
        return {"rank": mine["rank"], "character": mine["character"], "score": mine["score"]}
    return {"rank": "-", "character": user_ref.get("character") or "slime", "score": 0}


def _compute_last_week_winner(users: list, prev_wk: str) -> Optional[dict]:
    """지난주 게임 XP 합산 1위. 데이터 없으면 None (더미 없음).

    게임명(game_title)은 그 유저가 지난주 XP 를 가장 많이 얻은 게임으로 표기한다.
    """
    best = None  # (total, nickname, user, per_game_map)
    for u in users:
        m = _ranking_weekly_xp_map(u, prev_wk)
        total = sum(m.values())
        if total <= 0:
            continue
        nick = _display_nickname(u)
        if best is None or total > best[0] or (total == best[0] and nick < best[1]):
            best = (total, nick, u, m)
    if best is None:
        return None
    total, nick, u, m = best
    top_gid = max(m, key=lambda g: m[g]) if m else None
    return {
        "nickname": nick,
        "character": u.get("character") or "slime",
        "score": total,
        "game_title": _GAME_TITLES.get(top_gid),
    }


@router.get("/ranking")
def game_ranking(limit: int = 3, user_ref: Optional[dict] = Depends(get_current_user_optional)):
    """통합 '이번 주 미니게임 랭킹' — 주간 게임 XP 합산 Top N + 내 순위."""
    limit = _clamp_limit(limit)
    wk = iso_week()
    user_id = user_ref.get("id") if user_ref else "anon"
    cache_key = f"ranking:{wk}:{limit}:{user_id}"

    def build():
        entries = []
        for u in load_users():
            if u.get("deleted_at"):
                continue
            total = sum(_ranking_weekly_xp_map(u, wk).values())
            if total <= 0:
                continue
            entries.append({
                "user_id": u.get("id"),
                "nickname": _display_nickname(u),
                "character": u.get("character") or "slime",
                "score": total,
            })
        ranked = _rank_entries(entries)
        top = [
            {"rank": e["rank"], "nickname": e["nickname"], "character": e["character"], "score": e["score"]}
            for e in ranked[:limit]
        ]
        return {"top": top, "me": _me_row(ranked, user_ref)}

    return _cached_ranking(cache_key, build)


@router.get("/ranking/by-game")
def game_ranking_by_game(limit: int = 3, user_ref: Optional[dict] = Depends(get_current_user_optional)):
    """게임별 주간 XP Top N + 내 순위 + 지난주 우승자 배너 데이터."""
    limit = _clamp_limit(limit)
    wk = iso_week()
    prev_wk = prev_iso_week()
    user_id = user_ref.get("id") if user_ref else "anon"
    cache_key = f"ranking_by_game:{wk}:{prev_wk}:{limit}:{user_id}"

    def build():
        users = [u for u in load_users() if not u.get("deleted_at")]

        games = []
        for gid, title in RANKED_GAMES:
            entries = []
            for u in users:
                score = _ranking_weekly_xp_map(u, wk).get(gid, 0)
                if score <= 0:
                    continue
                entries.append({
                    "user_id": u.get("id"),
                    "nickname": _display_nickname(u),
                    "character": u.get("character") or "slime",
                    "score": score,
                })
            ranked = _rank_entries(entries)
            top = [
                {"rank": e["rank"], "nickname": e["nickname"], "character": e["character"], "score": e["score"]}
                for e in ranked[:limit]
            ]
            games.append({
                "game_id": gid,
                "title": title,
                "top": top,
                "me": _me_row(ranked, user_ref),
            })

        return {
            "games": games,
            "last_week_winner": _compute_last_week_winner(users, prev_wk),
        }

    return _cached_ranking(cache_key, build)
