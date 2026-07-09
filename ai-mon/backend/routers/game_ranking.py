"""game_ranking.py — 미니게임 주간 랭킹 (읽기 전용 집계).

지표: 주간 게임 랭킹 점수 합산(_record_weekly_ranking 로 누적된 game_rewards["weekly_ranking"]).
- GET /game/ranking          : 전 게임 합산 Top N + 내 순위 (홈 게임 탭 요약)
- GET /game/ranking/by-game  : 게임별 Top N + 내 순위 + 지난주 우승자 (전체보기 페이지)
- GET /game/ranking/overall  : top-level 누적 ranking_score(게임+미션+보스 합산, 소비
                               없음) 기준 Top N + 내 순위. 위 두 주간 엔드포인트와는
                               별개 지표이며 서로 영향을 주지 않는다.
더미 없음: 데이터가 없으면 빈 목록 / last_week_winner=null 을 그대로 반환한다.
"""

import time
from typing import Optional

from fastapi import APIRouter, Depends

from routers.utils import (
    get_current_user_optional,
    now_kst,
    iso_week,
    prev_iso_week,
    get_evolution_stage,
    current_week_ranking_score,
    load_users,
)

router = APIRouter()

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


def _weekly_score_map(user: dict, wk: str) -> dict:
    """해당 유저의 지정 ISO 주 게임별 랭킹 점수 맵 {game_id: score}. 방어적으로 정제한다."""
    gr = user.get("game_rewards")
    if not isinstance(gr, dict):
        return {}
    weekly = gr.get("weekly_ranking")
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


def _ranking_weekly_score_map(user: dict, wk: str) -> dict:
    raw = _weekly_score_map(user, wk)
    result = {}
    for game_id, score in raw.items():
        weight = RANKING_WEIGHT.get(game_id, 1.0)
        result[game_id] = int(round(int(score or 0) * weight))
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
        m = _ranking_weekly_score_map(u, prev_wk)
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


@router.get("/ranking/overall")
def game_ranking_overall(limit: int = 3, user_ref: Optional[dict] = Depends(get_current_user_optional)):
    """누적 랭킹 — 유저의 top-level 누적 ranking_score(게임+미션+보스 합산 적립분,
    grant_reward 로 쌓이는 소비 없는 값) 기준 Top N + 내 순위.

    기존 주간 게임 랭킹(/ranking, /ranking/by-game)과는 별개 지표다. 저 둘은 이번 주
    게임 플레이만(game_rewards["weekly_ranking"]) 집계하며 절대 건드리지 않는다.
    coin_balance/gp 로는 정렬하지 않는다 — 오직 누적 ranking_score.
    """
    limit = _clamp_limit(limit)
    user_id = user_ref.get("id") if user_ref else "anon"
    cache_key = f"ranking_overall:{limit}:{user_id}"

    def build():
        entries = []
        for u in load_users():
            if u.get("deleted_at"):
                continue
            score = int(u.get("ranking_score") or 0)
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
        return {"top": top, "me": _me_row(ranked, user_ref)}

    return _cached_ranking(cache_key, build)


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
            total = sum(_ranking_weekly_score_map(u, wk).values())
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
                score = _ranking_weekly_score_map(u, wk).get(gid, 0)
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
