from fastapi import APIRouter, HTTPException, Header, Query
from jose import jwt, JWTError
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
        return json.load(f)


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
    lesson_id: str = Query(None),
    stage: int = Query(None),
    limit: int = Query(10),
):
    questions = load_questions()
    if lesson_id:
        questions = [q for q in questions if q.get("lesson_id") == lesson_id]
    if stage is not None:
        questions = [q for q in questions if q.get("stage") == stage]
    random.shuffle(questions)
    return questions[:limit]


@router.get("/questions/{question_id}")
def get_question(question_id: str):
    questions = load_questions()
    q = next((q for q in questions if q["id"] == question_id), None)
    if not q:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")
    return q
