from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from routers.utils import get_current_user, load_users, save_users

router = APIRouter()

class GameClearRequest(BaseModel):
    game_id: str
    distance: Optional[int] = None
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
        
    # KST 기준 날짜 구하기 (UTC + 9)
    kst_now = datetime.utcnow() + timedelta(hours=9)
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
    user_ref.pop("runner_plays", None)
    
    if legacy_crowns and isinstance(legacy_crowns, dict):
        aipang_date = legacy_crowns.get("aipang")
        if aipang_date:
            game_rewards["aipang_last_date"] = aipang_date
            
    # 2단계: 이전 game_rewards["aipang"]["last_reward_date"] 형태 마이그레이션
    if "aipang" in game_rewards and isinstance(game_rewards["aipang"], dict):
        old_aipang = game_rewards.pop("aipang", {})
        old_date = old_aipang.get("last_reward_date")
        if old_date:
            game_rewards["aipang_last_date"] = old_date
            
    # 필요하지 않은 runner 객체 정보 정리
    game_rewards.pop("runner", None)
    
    # 게임 종류에 따른 보상 처리
    if req.game_id == "aipang":
        if game_rewards.get("aipang_last_date") == today_kst:
            already_claimed = True
        else:
            game_rewards["aipang_last_date"] = today_kst
            crowns_awarded = 1
            user_ref["crowns"] = user_ref.get("crowns", 0) + crowns_awarded
            
    elif req.game_id == "runner":
        # distance가 주어지지 않은 경우 score나 0을 fallback으로 활용
        distance_val = req.distance if req.distance is not None else (req.score or 0)
        
        if distance_val < 500:
            xp_awarded = 200
        elif distance_val <= 1000:
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
        "total_xp": user_ref.get("xp", 0),
        "already_claimed": already_claimed
    }
