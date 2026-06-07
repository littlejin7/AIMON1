from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from jose import jwt, JWTError
from services.claude_service import ask_claude
import json, os, random

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

QUESTIONS_FILE = os.path.join(os.path.dirname(__file__), "../data/questions.json")
LESSONS_DIR    = os.path.join(os.path.dirname(__file__), "../data/lessons")  # 브리핑 슬라이드 폴더
UNITS_FILE     = os.path.join(os.path.dirname(__file__), "../data/lessons.json")  # 유닛 목록


def load_questions_by_category(category: str, course_level: str = None, unit: int = None):
    base = os.path.join(os.path.dirname(__file__), f"../data/{category}")
    result = []
    levels = [course_level] if course_level else ["beginner", "intermediate", "advanced"]
    for level in levels:
        if category == "finalboss":
            fpath = os.path.join(base, f"{level}.json")
            if os.path.exists(fpath):
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    result.extend(data.get("questions", []))
        else:
            folder = os.path.join(base, level)
            if not os.path.exists(folder):
                continue
            files = [f"unit_{unit}.json"] if unit else sorted(os.listdir(folder))
            for fname in files:
                fpath = os.path.join(folder, fname)
                if os.path.exists(fpath) and fname.endswith(".json"):
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        result.extend(data.get("questions", []))
    return result


def load_lessons(course_level: str = None, unit: int = None):
    base = os.path.join(os.path.dirname(__file__), "../data/lessons")
    result = []
    levels = [course_level] if course_level else ["beginner", "intermediate", "advanced"]
    for level in levels:
        folder = os.path.join(base, level)
        if not os.path.exists(folder):
            continue
        files = [f"unit_{unit}.json"] if unit else sorted(os.listdir(folder))
        for fname in files:
            fpath = os.path.join(folder, fname)
            if os.path.exists(fpath) and fname.endswith(".json"):
                with open(fpath, "r", encoding="utf-8") as f:
                    result.extend(json.load(f))
    return result


def load_units():
    """유닛 목록: lessons.json 로드."""
    if not os.path.exists(UNITS_FILE):
        return []
    with open(UNITS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def verify_token(authorization: str) -> str:
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")


# ── 유닛 목록 (lessons.json) ────────────────────────────────────

@router.get("/units")
def get_units():
    """유닛 목록 조회 (lessons.json 기반)."""
    return load_units()


@router.get("/units/{unit_id}")
def get_unit(unit_id: int):
    """특정 유닛 조회."""
    units = load_units()
    unit = next((u for u in units if u.get("unit_id") == unit_id), None)
    if not unit:
        raise HTTPException(status_code=404, detail="유닛을 찾을 수 없습니다.")
    return unit


# ── 브리핑 슬라이드 (lessons/ 폴더) ─────────────────────────────

@router.get("/lessons")
def get_lessons(course_level: str = Query(None), unit: int = Query(None)):
    """전체 브리핑 슬라이드 목록."""
    return load_lessons(course_level, unit)


@router.get("/lessons/{lesson_id}")
def get_lesson(lesson_id: str, course_level: str = Query(None)):
    """브리핑 슬라이드 조회. lesson_id 예: '1-1-beginner'"""
    lessons = load_lessons(course_level)
    lesson = next(
        (l for l in lessons if l.get("lesson_id") == lesson_id),
        None,
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="레슨을 찾을 수 없습니다.")
    return lesson


@router.get("/questions")
def get_questions(
    unit: int = Query(None),
    stage: str = Query(None),
    course_level: str = Query(None),
    category: str = Query("quiz"),
    limit: int = Query(10),
    attempt: int = Query(1),
):
    questions = load_questions_by_category(category, course_level, unit)
    if stage is not None:
        questions = [q for q in questions if q.get("stage") == stage]
    random.shuffle(questions)
    
    if category == "quiz":
        # attempt에 따라 Set 구분
        if attempt == 1:
            pool = [q for q in questions if q.get("quiz_set") == "A"]
        elif attempt == 2:
            pool = [q for q in questions if q.get("quiz_set") == "B"]
        else:
            # 3회차 이상: A + B 섞어서 랜덤
            pool = questions
            random.shuffle(pool)
        return pool[:limit]
    
    return questions[:limit]


@router.get("/questions/{question_id}")
def get_question(question_id: str):
    # This might need to search all categories if category is unknown.
    # For now, we search 'quiz' and 'miniboss'.
    questions = load_questions_by_category("quiz") + load_questions_by_category("miniboss") + load_questions_by_category("unitboss") + load_questions_by_category("finalboss")
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
    Claude 실패/타임아웃 시 is_ai_fallback=True와 함께 200 반환 (프론트 crash 방지).
    """
    prompt = (
        f"[문제]\n{req.question}\n\n"
        f"[정답]\n{req.correct_answer}\n\n"
        f"[학생 답변]\n{req.user_answer}\n\n"
        "학생이 왜 틀렸는지, 그리고 올바른 개념을 이해할 수 있도록 설명해주세요."
    )
    result = await ask_claude(prompt, level=req.level)
    if result["success"]:
        return {"feedback": result["feedback"], "is_ai_fallback": False}
    # Claude 실패 → 프론트의 questions.json fallback을 쓰도록 빈 feedback 반환
    return {"feedback": "", "is_ai_fallback": True}

