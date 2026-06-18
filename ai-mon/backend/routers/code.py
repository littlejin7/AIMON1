from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from jose import jwt, JWTError
from services.claude_service import ask_claude_json, ask_claude
import json, os, uuid
from datetime import datetime
from typing import Optional

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
ALGORITHM  = os.getenv("ALGORITHM", "HS256")

USERS_FILE = os.path.join(os.path.dirname(__file__), "../data/users.json")

CODE_CLEAR_XP = 200


def load_users():
    if not os.path.exists(USERS_FILE):
        return []
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def verify_token(authorization: str) -> str:
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def find_question(question_id: str) -> Optional[dict]:
    from routers.quiz import load_questions_by_category
    for category in ("quiz", "unitboss", "miniboss", "endboss"):
        for q in load_questions_by_category(category):
            if q.get("question_id") == question_id or q.get("id") == question_id:
                return q
    return None

from routers.utils import calc_level


class SubmitRequest(BaseModel):
    question_id:  str
    code:         str
    output:       str = ""
    error:        str = ""
    unit:         int = 1
    stage:        str = ""
    course_level: str = "beginner"

class HintRequest(BaseModel):
    question_id:  str
    code:         str
    course_level: str = "beginner"


@router.post("/submit")
async def submit_code(req: SubmitRequest, authorization: str = Header(...)):
    user_id = verify_token(authorization)
    users   = load_users()
    user    = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    question = find_question(req.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    course_level = user.get("course_level", req.course_level)

    level_instruction = {
        "beginner":     "비유와 일상 예시를 들어 왜 틀렸는지 친절하게 설명해주세요.",
        "intermediate": "핵심 개념과 코드 예시를 포함해 왜 틀렸는지 분석해주세요.",
        "advanced":     "원리와 엣지 케이스까지 깊이 있게 틀린 이유를 설명해주세요.",
    }.get(course_level, "비유와 일상 예시를 들어 왜 틀렸는지 친절하게 설명해주세요.")

    error_section = f"\n실행 에러: {req.error}" if req.error else ""

    prompt = f"""당신은 파이썬을 가르치는 친절한 AI 튜터 '에이몬'입니다.
다음 코딩 문제에 대한 사용자의 코드를 채점하고 피드백해주세요.
틀렸을 경우, {level_instruction}

[중요 지시사항]
- JSON 응답 외에 어떠한 부가 설명 텍스트도 출력하지 마세요. 오직 JSON만 출력해야 합니다.
- 코드가 문제의 요구사항을 충족하면 is_correct: true로 채점하세요.
- 실행 결과가 예시 정답과 완전히 일치하지 않더라도 로직이 올바르면 정답으로 인정하세요.

문제: {question.get('question', '')}
예시 정답 코드: {question.get('answer', '없음')}
사용자 코드:
{req.code}
사용자 코드 실행 결과: {req.output or '(출력 없음)'}{error_section}

채점 결과를 JSON으로 반환하세요:
{{"is_correct": true/false, "score": 0~100, "feedback": "에이몬 튜터 피드백 (한국어, 2-3문장)", "hint": "틀렸을 때 힌트, 맞으면 빈 문자열"}}"""

    result = await ask_claude_json(prompt)
    is_correct = result.get("is_correct", False)

    xp_awarded = 0
    if is_correct:
        from routers.progress import load_progress, save_progress
        progress = load_progress()
        existing = next(
            (p for p in progress
             if p["user_id"] == user_id
             and p["unit"] == req.unit
             and p["stage"] == req.stage),
            None,
        )
        award_xp = False
        if existing:
            if not existing.get("is_completed", False):
                award_xp = True
            existing["score"]        = max(existing.get("score", 0), result.get("score", 100))
            existing["is_completed"] = True
            existing["updated_at"]   = datetime.utcnow().isoformat()
        else:
            award_xp = True
            progress.append({
                "id":           str(uuid.uuid4()),
                "user_id":      user_id,
                "unit":         req.unit,
                "stage":        req.stage,
                "score":        result.get("score", 100),
                "is_completed": True,
                "course_level": course_level,
                "created_at":   datetime.utcnow().isoformat(),
                "updated_at":   datetime.utcnow().isoformat(),
            })
        save_progress(progress)

        if award_xp:
            users2 = load_users()
            for u in users2:
                if u["id"] == user_id:
                    u["xp"]  = u.get("xp", 0) + CODE_CLEAR_XP
                    u["lv"]  = max(calc_level(u["xp"]), u.get("lv", 1))
                    xp_awarded = CODE_CLEAR_XP
                    break
            save_users(users2)
            user = next((u for u in users2 if u["id"] == user_id), user)

    result["xp_awarded"] = xp_awarded
    result["lv"]         = user.get("lv", 1)
    return result


@router.post("/hint")
async def get_code_hint(req: HintRequest, authorization: str = Header(...)):
    user_id = verify_token(authorization)
    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    question = find_question(req.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    level_instruction = {
        "beginner":     "아주 쉬운 말로, 코드를 직접 알려주지 말고 방향만 알려주세요.",
        "intermediate": "핵심 개념을 짚어주되 코드는 직접 주지 마세요.",
        "advanced":     "접근 방식과 고려할 엣지 케이스만 짚어주세요.",
    }.get(req.course_level, "아주 쉬운 말로, 방향만 알려주세요.")

    prompt = (
        f"[문제]\n{question.get('question', '')}\n\n"
        f"[현재 코드]\n{req.code or '(아직 코드 없음)'}\n\n"
        f"힌트를 주세요. {level_instruction}\n"
        "힌트는 2문장 이내로, 한국어로 작성해주세요."
    )
    result = await ask_claude(prompt, level=req.course_level)

    # Increment AI feedback count & award titles
    user["ai_feedback_count"] = user.get("ai_feedback_count", 0) + 1
    from routers.titles import check_and_award_titles
    newly_earned = check_and_award_titles(user, {})
    save_users(users)

    return {
        "hint":           result.get("feedback", ""),
        "is_ai_fallback": not result.get("success", False),
        "newly_earned_titles": newly_earned
    }
