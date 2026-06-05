from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from jose import jwt, JWTError
from services.claude_service import ask_claude
import json, os, random

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

QUESTIONS_FILE = os.path.join(os.path.dirname(__file__), "../data/questions.json")
LESSONS_FILE   = os.path.join(os.path.dirname(__file__), "../data/lessons.json")


def load_questions():
    if not os.path.exists(QUESTIONS_FILE):
        return []
    with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        if isinstance(data, dict) and "questions" in data:
            return data["questions"]
        return data


def load_lessons():
    if not os.path.exists(LESSONS_FILE):
        return []
    with open(LESSONS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def verify_token(authorization: str) -> str:
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")


@router.get("/lessons")
def get_lessons():
    return load_lessons()


@router.get("/lessons/{lesson_id}")
def get_lesson(lesson_id: str):
    lessons = load_lessons()
    lesson = next((l for l in lessons if l["id"] == lesson_id), None)
    if not lesson:
        raise HTTPException(status_code=404, detail="레슨을 찾을 수 없습니다.")
    return lesson


@router.get("/questions")
def get_questions(
    unit: int = Query(None),
    stage: str = Query(None),
    limit: int = Query(10),
):
    questions = load_questions()
    if unit is not None:
        questions = [q for q in questions if q.get("unit") == unit]
    if stage is not None:
        questions = [q for q in questions if q.get("stage") == stage]
    random.shuffle(questions)
    return questions[:limit]


@router.get("/questions/{question_id}")
def get_question(question_id: str):
    questions = load_questions()
    # 새 스키마는 "question_id" 키 사용
    q = next(
        (q for q in questions if q.get("question_id") == question_id or q.get("id") == question_id),
        None,
    )
    if not q:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")
    return q


# ── AI 피드백 엔드포인트 ──────────────────────────────────────

class AiFeedbackRequest(BaseModel):
    question: str          # 문제 텍스트
    correct_answer: str    # 정답
    user_answer: str       # 유저 답
    level: str = "beginner"  # beginner | intermediate | advanced


@router.post("/ai-feedback")
async def get_ai_feedback(req: AiFeedbackRequest):
    """
    오답 제출 시 Claude API를 호출해 레벨별 맞춤 피드백을 반환합니다.
    프론트엔드 QuizCard / Boss 오답 화면에서 호출합니다.
    """
    prompt = (
        f"[문제]\n{req.question}\n\n"
        f"[정답]\n{req.correct_answer}\n\n"
        f"[학생 답변]\n{req.user_answer}\n\n"
        "학생이 왜 틀렸는지, 그리고 올바른 개념을 이해할 수 있도록 설명해주세요."
    )
    result = await ask_claude(prompt, level=req.level)
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result["feedback"])
    return {"feedback": result["feedback"]}
