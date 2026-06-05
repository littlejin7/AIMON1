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


@router.get("/question")
def get_boss_question(authorization: str = Header(...)):
    verify_token(authorization)
    questions = load_questions()
    # type=="boss" 이거나 is_boss==True 이거나 question_id가 "boss_"로 시작하는 문제
    boss_qs = [
        q for q in questions
        if q.get("is_boss")
        or q.get("type") == "boss"
        or str(q.get("question_id", "")).lower().startswith("boss_")
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

    # AI 채점 요청
    prompt = f"""
다음 코딩 문제에 대한 사용자의 답변을 채점해주세요.

문제: {question['question']}
예시 정답: {question.get('answer', '없음')}
사용자 답변: {req.user_answer}

채점 결과를 JSON으로 반환하세요:
{{
  "is_correct": true/false,
  "score": 0~100,
  "feedback": "피드백 내용 (한국어, 2-3문장)",
  "hint": "틀렸을 경우 힌트 (맞았으면 빈 문자열)"
}}
"""
    ai_result = await ask_claude_json(prompt)

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

    return ai_result
