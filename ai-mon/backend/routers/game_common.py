"""game_common.py — 게임 모듈 공통 상수·헬퍼.

game.py, game_aicross.py, game_ranking.py 세 곳에서 import 하여 사용한다.
이 파일은 routers.utils 외에 다른 game_* 모듈을 import 하지 않는다.
"""

import hmac
import hashlib
import base64
import json
import secrets
from typing import Optional

from fastapi import HTTPException

from routers.utils import (
    get_current_user,
    get_current_user_optional,
    now_kst,
    iso_week,
    prev_iso_week,
    grant_reward,
    get_evolution_stage,
    current_week_ranking_score,
    SECRET_KEY,
    mutate_user_atomic,
    UserNotFoundError,
    load_users,
)

# ---------------------------------------------------------------------------
# 게임 세션 토큰 (B-4 어뷰징 방어)
# ---------------------------------------------------------------------------
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


def _make_game_token(game_id: str, user_id: str, extra_payload: Optional[dict] = None) -> str:
    """game_id/user_id/발급시각/nonce 를 담아 HMAC-SHA256 서명한 토큰을 만든다."""
    payload = {
        "game_id": game_id,
        "user_id": user_id,
        "ts": int(now_kst().timestamp()),
        "nonce": secrets.token_urlsafe(12),
    }
    if extra_payload:
        payload.update(extra_payload)
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
# 주간 랭킹 소스: 주간 게임 랭킹 점수 누적 (game_rewards["weekly_ranking"])
# ---------------------------------------------------------------------------
# 랭킹/지난주 우승자의 단일 진실. game_id → 그 주에 실제 지급된 ranking_score(daily 캡
# 반영 후)를 ISO 주별로 누적한다. 게임별 점수 체계(거리/점수/스테이지)가 서로 달라
# 비교 불가하므로, "주간 게임 랭킹 점수 합산"이라는 단일 비교 지표로 통일한다.
#   game_rewards["weekly_ranking"] = { "<ISO주>": { "<game_id>": <누적 ranking_score> } }
# (XP 소스에서 ranking_score 소스로 교체. 리더보드는 coin/gp 가 아니라 이 값으로 정렬한다.)
# 보관은 이번 주 + 지난주 2주만(자동 prune) — user 레코드 비대화 방지.
def _record_weekly_ranking(game_rewards: dict, game_id: str, score: int) -> None:
    """이번 주 game_id 의 주간 랭킹 점수를 누적하고 이번 주/지난주만 남긴다. (in-place)

    score<=0(무보상·이미 클레임·크라운 전용 aipang)이면 아무 것도 하지 않는다 → 랭킹 크레딧 없음.
    같은 임계구역(mutate_user_atomic)에서 fresh 상태에 대해 호출되므로 동시성 안전.
    """
    if score <= 0:
        return
    wk = iso_week()
    prev = prev_iso_week()
    weekly = game_rewards.get("weekly_ranking")
    if not isinstance(weekly, dict):
        weekly = {}
    # 이번 주 + 지난주만 롤링 보관 (오래된 주는 prune)
    weekly = {w: v for w, v in weekly.items() if w in (wk, prev) and isinstance(v, dict)}
    cur = weekly.get(wk)
    if not isinstance(cur, dict):
        cur = {}
    cur[game_id] = int(cur.get(game_id, 0) or 0) + int(score)
    weekly[wk] = cur
    game_rewards["weekly_ranking"] = weekly
