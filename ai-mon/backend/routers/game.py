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
    
    if req.game_id == "aipang":
        # Check aipang limits
        awarded_game_crowns = user_ref.get("awarded_game_crowns", {})
        if not isinstance(awarded_game_crowns, dict):
            awarded_game_crowns = {}
            
        if awarded_game_crowns.get("aipang") == today:
            # According to requirements, maybe just return 0 crowns instead of error, 
            # but raising an error or returning 0 are both fine.
            # Returning 0 might be better so frontend doesn't crash if they play again.
            pass
        else:
            awarded_game_crowns["aipang"] = today
            user_ref["awarded_game_crowns"] = awarded_game_crowns
            crowns_awarded = 1
            user_ref["crowns"] = user_ref.get("crowns", 0) + crowns_awarded
            
    elif req.game_id == "runner":
        score = req.score or 0
        if score < 1000:
            xp_awarded = 200
        elif score < 3000:
            xp_awarded = 350
        else:
            xp_awarded = 500
            
        # Limit to 5 times per day
        runner_plays = user_ref.get("runner_plays", {})
        if not isinstance(runner_plays, dict):
            runner_plays = {}
            
        played_today = runner_plays.get(today, 0)
        if played_today >= 5:
            xp_awarded = 0
        else:
            runner_plays[today] = played_today + 1
            user_ref["runner_plays"] = runner_plays
            user_ref["xp"] = user_ref.get("xp", 0) + xp_awarded
    else:
        raise HTTPException(status_code=400, detail="Invalid game_id")
        
    save_users(users)
    
    return {
        "crowns_awarded": crowns_awarded,
        "xp_awarded": xp_awarded,
        "total_crowns": user_ref.get("crowns", 0),
        "total_xp": user_ref.get("xp", 0)
    }
