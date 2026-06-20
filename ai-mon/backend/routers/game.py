from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from datetime import date
from routers.utils import get_current_user, load_users, save_users

router = APIRouter()

class GameClearRequest(BaseModel):
    game_id: str
    score: Optional[int] = None

@router.post("/clear")
def game_clear(req: GameClearRequest, authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    user = get_current_user(authorization)
    users = load_users()
    
    # Find user in the list
    for u in users:
        if u["id"] == user["id"]:
            user_ref = u
            break
    else:
        raise HTTPException(status_code=404, detail="User not found")
        
    today = date.today().isoformat()
    crowns_awarded = 0
    xp_awarded = 0
    
    # game_rewards 딕셔너리 초기화
    game_rewards = user_ref.get("game_rewards", {})
    if not isinstance(game_rewards, dict):
        game_rewards = {}
        
    # [하위 호환성] 기존 레거시 필드 마이그레이션 및 삭제
    legacy_crowns = user_ref.pop("awarded_game_crowns", None)
    legacy_plays = user_ref.pop("runner_plays", None)
    
    if legacy_crowns and isinstance(legacy_crowns, dict):
        aipang_date = legacy_crowns.get("aipang")
        if aipang_date:
            game_rewards["aipang"] = {"last_reward_date": aipang_date}
            
    if legacy_plays and isinstance(legacy_plays, dict):
        game_rewards["runner"] = {"plays": legacy_plays}
    
    # 게임 종류에 따른 보상 처리
    if req.game_id == "aipang":
        aipang_rewards = game_rewards.get("aipang", {})
        if not isinstance(aipang_rewards, dict):
            aipang_rewards = {}
            
        if aipang_rewards.get("last_reward_date") == today:
            pass
        else:
            aipang_rewards["last_reward_date"] = today
            game_rewards["aipang"] = aipang_rewards
            crowns_awarded = 1
            user_ref["crowns"] = user_ref.get("crowns", 0) + crowns_awarded
            
    elif req.game_id == "runner":
        runner_rewards = game_rewards.get("runner", {})
        if not isinstance(runner_rewards, dict):
            runner_rewards = {}
            
        plays = runner_rewards.get("plays", {})
        if not isinstance(plays, dict):
            plays = {}
            
        played_today = plays.get(today, 0)
        if played_today >= 5:
            xp_awarded = 0
        else:
            plays[today] = played_today + 1
            runner_rewards["plays"] = plays
            game_rewards["runner"] = runner_rewards
            
            score = req.score or 0
            if score < 1000:
                xp_awarded = 200
            elif score < 3000:
                xp_awarded = 350
            else:
                xp_awarded = 500
            user_ref["xp"] = user_ref.get("xp", 0) + xp_awarded
    else:
        raise HTTPException(status_code=400, detail="Invalid game_id")
        
    user_ref["game_rewards"] = game_rewards
        
    save_users(users)
    
    return {
        "crowns_awarded": crowns_awarded,
        "xp_awarded": xp_awarded,
        "total_crowns": user_ref.get("crowns", 0),
        "total_xp": user_ref.get("xp", 0)
    }
