from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from jose import jwt, JWTError
from services.claude_service import ask_claude_json
import json, os, uuid
from datetime import datetime

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

QUESTIONS_FILE     = os.path.join(os.path.dirname(__file__), "../data/questions.json")
WRONG_ANSWERS_FILE = os.path.join(os.path.dirname(__file__), "../data/wrong_answers.json")
USERS_FILE = os.path.join(os.path.dirname(__file__), "../data/users.json")

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
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")


def load_wrong_answers():
    if not os.path.exists(WRONG_ANSWERS_FILE):
        return []
    with open(WRONG_ANSWERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_wrong_answers(data):
    with open(WRONG_ANSWERS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_questions():
    if not os.path.exists(QUESTIONS_FILE):
        return []
    with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        if isinstance(data, dict) and "questions" in data:
            return data["questions"]
        return data


class BossAnswerRequest(BaseModel):
    question_id: str
    user_answer: str
    is_code_question: bool = False


@router.get("/info")
def get_boss_info(unit: int = 1, authorization: str = Header(...)):
    user_id = verify_token(authorization)
    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    # 날짜 체크해서 무료 횟수 리셋
    today = datetime.utcnow().strftime("%Y-%m-%d")
    if user.get("last_free_attempt_date") != today:
        user["daily_free_attempts"] = 2
        user["last_free_attempt_date"] = today
        save_users(users)
        
    # 보스 메타데이터 (고정값으로 MVP 구현)
    return {
        "boss_name": f"코드몬 Unit {unit} 보스",
        "xp_reward": 2000,
        "hints_allowed": 2,
        "crown_cost_from_attempt": 1,
        "free_attempts_per_day": user.get("daily_free_attempts", 2),
        "crowns": user.get("crowns", 5)
    }

@router.post("/start")
def start_boss_battle(unit: int = 1, authorization: str = Header(...)):
    user_id = verify_token(authorization)
    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    
    # 왕관/무료 횟수 차감
    today = datetime.utcnow().strftime("%Y-%m-%d")
    if user.get("last_free_attempt_date") != today:
        user["daily_free_attempts"] = 2
        user["last_free_attempt_date"] = today
        
    if user.get("daily_free_attempts", 0) > 0:
        user["daily_free_attempts"] -= 1
    else:
        if user.get("crowns", 0) <= 0:
            raise HTTPException(status_code=400, detail="왕관이 부족합니다.")
        user["crowns"] -= 1
        
    save_users(users)

    questions = load_questions()
    boss_qs = [
        q for q in questions
        if (q.get("is_boss") or q.get("type") == "boss" or str(q.get("question_id", "")).lower().startswith("boss_"))
        and q.get("course_level") == user.get("course_level", "beginner")
        and q.get("unit") == unit
    ]
    if not boss_qs:
        raise HTTPException(status_code=404, detail="보스 문제가 없습니다.")
    import random
    return random.choice(boss_qs)


@router.post("/answer")
async def submit_boss_answer(req: BossAnswerRequest, authorization: str = Header(...)):
    user_id = verify_token(authorization)
    questions = load_questions()
    # 우리 스키마는 "question_id" 필드 사용 ("id" 필드 없음)
    question = next(
        (q for q in questions if q.get("question_id") == req.question_id or q.get("id") == req.question_id),
        None,
    )
    if not question:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    course_level = user.get("course_level", "beginner") if user else "beginner"
    
    level_instruction = "비유와 일상 예시를 들어 왜 틀렸는지 친절하게 설명해주세요."
    if course_level == "intermediate":
        level_instruction = "핵심 개념과 코드 예시를 포함해 왜 틀렸는지 분석해주세요."
    elif course_level == "advanced":
        level_instruction = "원리와 엣지 케이스까지 깊이 있게 틀린 이유를 설명해주세요."

    # AI 채점 요청
    prompt = f"""
당신은 파이썬을 가르치는 친절한 AI 튜터 '에이몬'입니다.
다음 코딩 문제에 대한 사용자의 답변을 채점하고 피드백해주세요.
틀렸을 경우, {level_instruction}

[중요 지시사항]
- 사용자의 답변이 예시 정답의 기호(예: A, B, C, D)만 입력했거나 내용이 일치한다면 반드시 "is_correct": true 로 채점하세요.
- JSON 응답 외에 어떠한 부가 설명 텍스트도 출력하지 마세요. 오직 JSON만 출력해야 합니다.

문제: {question['question']}
예시 정답: {question.get('answer', '없음')}
사용자 답변: {req.user_answer}

채점 결과를 JSON으로 반환하세요:
{{
  "is_correct": true/false,
  "score": 0~100,
  "feedback": "에이몬 튜터로서의 친절한 피드백 (한국어, 2-3문장)",
  "hint": "틀렸을 경우 정답에 도달할 수 있는 핵심 힌트 (맞았으면 빈 문자열)"
}}
"""
    ai_result = await ask_claude_json(prompt)

    # 오답 기록
    # 오답 기록
    if not ai_result.get("is_correct", False):
        wrong_answers = load_wrong_answers()
        wrong_answers.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "question_id": req.question_id,
            "user_answer": req.user_answer,
            "feedback": ai_result.get("feedback", ""),
            "timestamp": datetime.utcnow().isoformat(),
        })
        save_wrong_answers(wrong_answers)
    else:
        # 정답 시 진행도 저장 (boss 스테이지 클리어)
        from routers.progress import load_progress, save_progress
        progress = load_progress()
        existing = next((p for p in progress if p["user_id"] == user_id and p["unit"] == question.get("unit") and p["stage"] == question.get("stage")), None)
        
        award_xp = False
        if existing:
            if not existing.get("is_completed", False):
                award_xp = True
            existing["score"] = max(existing.get("score", 0), ai_result.get("score", 100))
            existing["is_completed"] = True
            existing["updated_at"] = datetime.utcnow().isoformat()
        else:
            award_xp = True
            progress.append({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "unit": question.get("unit", 1),
                "stage": question.get("stage", "1-boss"),
                "score": ai_result.get("score", 100),
                "is_completed": True,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            })
        save_progress(progress)
        
        # XP 및 보스 클리어 카운트 (진화 조건) 추가
        if award_xp:
            users = load_users()
            for u in users:
                if u["id"] == user_id:
                    u["xp"] = u.get("xp", 0) + 2000
                    u["completed_units"] = u.get("completed_units", 0) + 1
                    # 진화 로직: 1유닛 클리어시 다음 형태? 
                    # 기획안: Unit 3/6/8 클리어 시 진화. 여기서는 단순 카운트로 체크.
                    if u["completed_units"] >= 3 and u.get("character") == "default":
                        u["character"] = "robot"
                    break
            save_users(users)
            ai_result["xp_awarded"] = 2000
        else:
            ai_result["xp_awarded"] = 0

    return ai_result
