"""데일리/위클리 미션 API.

GET  /missions        오늘의 데일리 + 이번주 위클리 목록 + 내 진척/수령 상태
POST /missions/claim  {mission_id} → 완료 검증 후 보상 지급 (멱등성 보장)

[필수] POST /missions/claim 은 반드시 mutate_user_atomic 를 통해 저장한다.
claimed 배열 append 가 last-writer-wins 로 중복 수령되지 않게 하기 위함. (C-1)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from routers.utils import (
    get_current_user,
    mutate_user_atomic,
    UserNotFoundError,
    grant_reward,
    get_evolution_stage,
    current_week_ranking_score,
)
from routers.missions_core import find_def, DAILY_DEFS, WEEKLY_DEFS, _ensure_period

router = APIRouter()


@router.get("/")
def get_missions(user: dict = Depends(get_current_user)):
    from routers.utils import today_kst, iso_week
    today = today_kst()
    week = iso_week()
    m = _ensure_period(user, today, week)  # in-memory only, 저장 없음
    d = m["daily"]
    w = m["weekly"]

    daily_out = []
    for defn in DAILY_DEFS:
        mid = defn["mission_id"]
        daily_out.append({
            "mission_id": mid,
            "title": defn["title"],
            "goal": defn["goal"],
            "progress": d.get("progress", {}).get(mid, 0),
            "claimed": mid in d.get("claimed", []),
            "reward": defn["reward"],
            "auto_claim": defn.get("auto_claim", False),
        })

    weekly_out = []
    for defn in WEEKLY_DEFS:
        mid = defn["mission_id"]
        weekly_out.append({
            "mission_id": mid,
            "title": defn["title"],
            "goal": defn["goal"],
            "progress": w.get("progress", {}).get(mid, 0),
            "claimed": mid in w.get("claimed", []),
            "reward": defn["reward"],
            "auto_claim": defn.get("auto_claim", False),
        })

    return {"daily": daily_out, "weekly": weekly_out}


class ClaimRequest(BaseModel):
    mission_id: str


@router.post("/claim")
def claim_mission(req: ClaimRequest, user_ref: dict = Depends(get_current_user)):
    defn = find_def(req.mission_id)
    if defn is None:
        raise HTTPException(status_code=404, detail="Mission not found")

    # 모든 미션 수동 수령 가능

    user_id = user_ref["id"]
    mission_id = req.mission_id

    def mutator(user: dict) -> dict:
        from routers.utils import today_kst as _today, iso_week as _week
        today = _today()
        week = _week()
        m = _ensure_period(user, today, week)
        period_key = "weekly" if mission_id.startswith("w_") else "daily"
        p = m[period_key]

        # 멱등성: 이미 수령했으면 조용히 already_claimed 반환
        if mission_id in p.get("claimed", []):
            return {"already_claimed": True, "xp": 0, "crowns": 0}

        # 진척 미달 → 거부
        if p.get("progress", {}).get(mission_id, 0) < defn["goal"]:
            raise ValueError("Mission not completed yet")

        # 보상 지급
        p.setdefault("claimed", []).append(mission_id)
        reward = defn.get("reward", {})
        xp = reward.get("xp", 0)
        crowns = reward.get("crowns", 0)
        reward_delta = {"coin_delta": 0, "gp_delta": 0, "ranking_score_delta": 0}

        if xp:
            # 미션 보상은 coin 만 지급 — 경쟁 랭킹(ranking_score)·gp 에는 반영하지 않는다.
            # event_type 없음 → bump_mission 재진입 없음.
            rr = grant_reward(user, coin_delta=xp)
            reward_delta = {"coin_delta": rr["coin_delta"], "gp_delta": rr["gp_delta"],
                            "ranking_score_delta": rr["ranking_score_delta"]}
        if crowns:
            user["crowns"] = user.get("crowns", 0) + crowns

        return {"already_claimed": False, "xp": xp, "crowns": crowns, "reward": reward_delta}

    try:
        user, result = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "mission_id": mission_id,
        "already_claimed": result["already_claimed"],
        # xp_awarded 는 하위호환 표기(=coin 보상 단위). 신규 소비자는 reward.* 를 쓴다.
        "xp_awarded": result["xp"],
        "crowns_awarded": result["crowns"],
        "total_xp": user.get("xp", 0),
        "total_crowns": user.get("crowns", 0),
        "reward": result.get("reward", {"coin_delta": 0, "gp_delta": 0, "ranking_score_delta": 0}),
        "user_state": {
            "coin_balance": user.get("coin_balance", 0),
            "gp": user.get("gp", 0),
            "lv": user.get("lv", 1),
            "evolution_stage": get_evolution_stage(user),
            "ranking_score": user.get("ranking_score", 0),
            "weekly_ranking_score": current_week_ranking_score(user),
            "crowns": user.get("crowns", 0),
        },
    }
