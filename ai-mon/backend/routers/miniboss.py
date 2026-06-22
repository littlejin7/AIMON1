"""
미니보스 (Miniboss) 라우터
스테이지 내 미니보스 배틀 처리

엔드포인트:
  GET  /boss/miniboss/info      스테이지 미니보스 정보
  POST /boss/miniboss/start     배틀 시작 (해당 stage 문제 반환)
  POST /boss/miniboss/answer    답안 제출 → HP 계산
  POST /boss/miniboss/clear     클리어 처리 (XP + 진행도, 중복 방지)
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import json, os, random, uuid
from datetime import datetime
from typing import Optional

from routers.utils import (
    calc_level,
    get_user_by_id,
    save_user,
    get_progress_by_user,
    save_progress_item,
    verify_token,
)

router = APIRouter()

MINIBOSS_DIR  = os.path.join(os.path.dirname(__file__), "../data/miniboss")

# ── HP 설정 ───────────────────────────────────────────────────────────────────
BOSS_HP_INIT  = 500   # 정답 5번이면 클리어
MY_HP_INIT    = 900   # 오답 3번이면 실패
BOSS_HP_DELTA = 100   # 정답 시 보스 HP 감소
MY_HP_DELTA   = 300   # 오답 시 내 HP 감소

# ── 보상 ─────────────────────────────────────────────────────────────────────
CLEAR_XP = 500



# ── 유틸 ──────────────────────────────────────────────────────────────────────

def load_miniboss_questions(course_level: str, unit: int) -> list:
    """data/miniboss/{course_level}/unit_{unit}.json 로드."""
    path = os.path.join(MINIBOSS_DIR, course_level, f"unit_{unit}.json")
    if not os.path.exists(path):
        # 폴백: beginner
        if course_level != "beginner":
            path = os.path.join(MINIBOSS_DIR, "beginner", f"unit_{unit}.json")
        if not os.path.exists(path):
            return []
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # beginner: {"questions": [...]} / intermediate·advanced: [...]
    return data if isinstance(data, list) else data.get("questions", [])

def direct_grade(user_answer: str, correct_answer: str) -> bool:
    """선택형 문제 직접 채점."""
    ua = user_answer.strip()
    ca = str(correct_answer).strip()
    if ua == ca:
        return True
    # 알파벳만 입력 (예: "A" vs "A. Bye")
    if len(ua) == 1 and ca.upper().startswith(ua.upper() + "."):
        return True
    # 전체 선택지 입력 (예: "A. Bye" vs "A")
    if len(ca) == 1 and ua.upper().startswith(ca.upper() + "."):
        return True
    return False


# ── Pydantic 모델 ─────────────────────────────────────────────────────────────

class AnswerRequest(BaseModel):
    question_id: str
    user_answer:  str
    my_hp:        int = MY_HP_INIT
    boss_hp:      int = BOSS_HP_INIT
    unit:         int = 1
    stage:        str = ""

class ClearRequest(BaseModel):
    unit:  int
    stage: str


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get("/info")
def miniboss_info(unit: int = 1, stage: str = "1-1", authorization: str = Header(...)):
    """미니보스 정보 반환 (HP 설정, 이미 클리어 여부)."""
    user_id = verify_token(authorization)
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    cleared = user.get("miniboss_cleared_stages", [])
    stage_key = stage if "-" in str(stage) else f"{unit}-{stage}"

    return {
        "boss_hp_init":    BOSS_HP_INIT,
        "my_hp_init":      MY_HP_INIT,
        "boss_hp_delta":   BOSS_HP_DELTA,
        "my_hp_delta":     MY_HP_DELTA,
        "xp_reward":       CLEAR_XP,
        "already_cleared": stage_key in cleared,
    }


@router.post("/start")
def miniboss_start(unit: int = 1, stage: str = "1-1", authorization: str = Header(...)):
    """
    미니보스 배틀 시작.
    - 해당 stage 문제 10개를 seen 관리하며 순서대로 반환
    - 모두 소진 시 리셋 후 재출제
    """
    user_id = verify_token(authorization)
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    course_level = user.get("course_level", "beginner")
    all_qs = load_miniboss_questions(course_level, unit)
    stage_qs = [q for q in all_qs if q.get("stage") == stage]

    if not stage_qs:
        raise HTTPException(status_code=404, detail=f"Unit {unit} / Stage {stage} 미니보스 문제가 없습니다.")

    # seen 관리 (stage별 독립)
    if "seen_questions" not in user or user["seen_questions"] is None:
        user["seen_questions"] = {}
    seen_questions = user["seen_questions"]
    miniboss_seen = seen_questions.setdefault("miniboss", {})
    stage_seen = miniboss_seen.get(stage, [])

    unseen = [q for q in stage_qs if q["question_id"] not in stage_seen]
    if not unseen:
        stage_seen = []
        unseen = stage_qs

    # 배틀 시작마다 seen 리셋 (매 배틀 새 문제 순서)
    random.shuffle(unseen)
    chosen = unseen[:5]  # 최대 5문제
    miniboss_seen[stage] = [q["question_id"] for q in chosen]
    seen_questions["miniboss"] = miniboss_seen
    user["seen_questions"] = seen_questions
    save_user(user)

    return {
        "unit":      unit,
        "stage":     stage,
        "questions": chosen,
        "my_hp":     MY_HP_INIT,
        "boss_hp":   BOSS_HP_INIT,
    }


@router.post("/answer")
def miniboss_answer(req: AnswerRequest, authorization: str = Header(...)):
    """
    답안 제출 → HP 계산.
    - 정답: boss_hp -= BOSS_HP_DELTA
    - 오답: my_hp  -= MY_HP_DELTA
    - boss_hp <= 0 → is_clear = True
    - my_hp  <= 0 → is_fail  = True
    """
    user_id = verify_token(authorization)
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    course_level = user.get("course_level", "beginner")
    all_qs = load_miniboss_questions(course_level, req.unit)
    question = next((q for q in all_qs if q.get("question_id") == req.question_id), None)
    if not question:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    is_correct = direct_grade(req.user_answer, question.get("answer", ""))
    fb_key  = "correct" if is_correct else "wrong"
    feedback = question.get("feedback", {}).get(fb_key, "")

    safe_boss_hp = max(0, min(req.boss_hp, BOSS_HP_INIT))
    safe_my_hp   = max(0, min(req.my_hp, MY_HP_INIT))

    if is_correct:
        new_boss_hp = safe_boss_hp - BOSS_HP_DELTA
        new_my_hp   = safe_my_hp
    else:
        new_boss_hp = safe_boss_hp
        new_my_hp   = safe_my_hp - MY_HP_DELTA

    is_clear = new_boss_hp <= 0
    is_fail  = new_my_hp <= 0

    return {
        "is_correct": is_correct,
        "feedback":   feedback,
        "hint":       "" if is_correct else question.get("hint", ""),
        "my_hp":      new_my_hp,
        "boss_hp":    new_boss_hp,
        "is_clear":   is_clear,
        "is_fail":    is_fail,
    }


@router.post("/clear")
def miniboss_clear(req: ClearRequest, authorization: str = Header(...)):
    """
    클리어 처리 (중복 방지).
    - XP 500 지급 (최초 1회)
    - miniboss_cleared_stages 기록
    - 진행도 저장
    """
    user_id = verify_token(authorization)
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    stage_key = req.stage if "-" in str(req.stage) else f"{req.unit}-{req.stage}"
    cleared   = user.get("miniboss_cleared_stages", [])
    already_cleared = stage_key in cleared

    xp_awarded = 0
    if not already_cleared:
        user["xp"] = user.get("xp", 0) + CLEAR_XP
        xp_awarded = CLEAR_XP

        # 레벨 재계산 + 캐릭터 진화 체크
        user["lv"] = max(calc_level(user["xp"]), user.get("lv", 1))
        lv = user["lv"]
        if lv >= 10 and user.get("character") == "slime":
            user["character"] = "robot"
        elif lv >= 20 and user.get("character") == "robot":
            user["character"] = "speech_bubble"
        elif lv >= 30 and user.get("character") == "speech_bubble":
            user["character"] = "final_ghost"

        cleared.append(stage_key)
        user["miniboss_cleared_stages"] = cleared
        user["completed_stages"] = user.get("completed_stages", 0) + 1
        save_user(user)

        # 진행도 저장
        course_level = user.get("course_level", "beginner")
        progress = get_progress_by_user(user_id, course_level)
        existing = next(
            (p for p in progress if p["unit"] == req.unit and p["stage"] == req.stage),
            None,
        )
        target_item = None
        if existing:
            existing["is_completed"] = True
            existing["updated_at"]   = datetime.utcnow().isoformat()
            target_item = existing
        else:
            target_item = {
                "id":           str(uuid.uuid4()),
                "user_id":      user_id,
                "unit":         req.unit,
                "stage":        req.stage,
                "score":        100,
                "is_completed": True,
                "course_level": course_level,
                "created_at":   datetime.utcnow().isoformat(),
                "updated_at":   datetime.utcnow().isoformat(),
            }
        save_progress_item(target_item)

    return {
        "already_cleared":  already_cleared,
        "xp_awarded":       xp_awarded,
         "lv":               user.get("lv", 1),
        "cleared_stages":   user.get("miniboss_cleared_stages", []),
    }
