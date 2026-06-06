import json, os, random
from fastapi import APIRouter, Header
router = APIRouter()

QUESTIONS_FILE = os.path.join(os.path.dirname(__file__), "../data/questions.json")
WRONG_FILE = os.path.join(os.path.dirname(__file__), "../data/wrong_answers.json")
USERS_FILE = os.path.join(os.path.dirname(__file__), "../data/users.json")

def load_questions():
    if not os.path.exists(QUESTIONS_FILE): return []
    with open(QUESTIONS_FILE, encoding="utf-8") as f:
        d = json.load(f)
        return d["questions"] if isinstance(d, dict) else d

def load_wrong_answers():
    if not os.path.exists(WRONG_FILE): return []
    with open(WRONG_FILE, encoding="utf-8") as f:
        return json.load(f)

def load_users():
    if not os.path.exists(USERS_FILE): return []
    with open(USERS_FILE, encoding="utf-8") as f:
        return json.load(f)

@router.get("/review")
def get_train_review(
    unit: int = 1,
    course_level: str = "beginner",
    limit: int = 15,
    authorization: str = Header(None)
):
    questions = load_questions()
    wrong_answers = load_wrong_answers()

    # 유저 ID 추출 (JWT 토큰 파싱)
    user_id = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        users = load_users()
        for u in users:
            # 토큰 기반 유저 매칭 (기존 auth 방식 그대로 활용)
            if u.get("token") == token or u.get("id") == token:
                user_id = u.get("id")
                break

    # 해당 유닛 스테이지 퀴즈 + 미니보스 문제 풀
    unit_pool = [
        q for q in questions
        if q.get("unit") == unit
        and q.get("course_level") == course_level
        and q.get("quiz_category") in ["stage_quiz", "miniboss"]
    ]

    # 오답 문제 우선 선별
    priority_ids = set()
    if user_id:
        for entry in wrong_answers:
            if entry.get("user_id") == user_id:
                for wa in entry.get("wrong_answers", []):
                    if not wa.get("reviewed", False):
                        priority_ids.add(wa.get("question_id"))

    priority_qs = [q for q in unit_pool if q.get("question_id") in priority_ids]
    normal_qs = [q for q in unit_pool if q.get("question_id") not in priority_ids]

    # 오답 우선 + 나머지 랜덤으로 15개 채우기
    random.shuffle(normal_qs)
    result = priority_qs + normal_qs
    return result[:limit]
