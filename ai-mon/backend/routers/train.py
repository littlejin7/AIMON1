from fastapi import APIRouter, HTTPException, Header
import json, os, random

router = APIRouter()

QUESTIONS_FILE = os.path.join(os.path.dirname(__file__), "../data/questions.json")

def load_questions():
    if not os.path.exists(QUESTIONS_FILE):
        return []
    with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@router.get("/review")
def get_train_review(limit: int = 3, course_level: str = "beginner", authorization: str = Header(None)):
    """
    유저의 오답 노트를 기반으로 복습 문제를 제공합니다.
    (현재 MVP 단계에서는 사용자의 레벨에 맞는 무작위 문제를 제공하도록 임시 구현)
    """
    questions = load_questions()
    
    # 필터링: 레벨에 맞는 문제 중 객관식(multiple_choice)만 일단 훈련장에 제공
    filtered = [q for q in questions if q.get("course_level") == course_level and q.get("quiz_category") == "multiple_choice"]
    
    if not filtered:
        # Fallback
        filtered = [q for q in questions if q.get("quiz_category") == "multiple_choice"]

    if len(filtered) > limit:
        selected = random.sample(filtered, limit)
    else:
        selected = filtered

    return selected
