from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from routers.utils import get_current_user, save_user, now_kst

router = APIRouter()

class GameClearRequest(BaseModel):
    game_id: str
    distance: Optional[int] = None
    score: Optional[int] = None

@router.post("/clear")
def game_clear(req: GameClearRequest, authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    user_ref = get_current_user(authorization)
        
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
            distance_val = req.distance if req.distance is not None else (req.score or 0)
            
            # 클라이언트 조작 방지: distance 상한 검증
            if distance_val > 10000:
                raise HTTPException(status_code=400, detail="Abnormal gameplay detected (distance too high)")
                
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
            user_ref["xp"] = user_ref.get("xp", 0) + xp_awarded
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
