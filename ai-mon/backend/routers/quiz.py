from fastapi import APIRouter, HTTPException, Header, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.claude_service import ask_claude, stream_claude
import json, os, random, uuid
from datetime import datetime
from routers.utils import verify_token, load_wrong_answers, save_wrong_answers, limiter

router = APIRouter()

QUESTIONS_FILE = os.path.join(os.path.dirname(__file__), "../data/questions.json")
LESSONS_DIR    = os.path.join(os.path.dirname(__file__), "../data/lessons")  # 브리핑 슬라이드 폴더
UNITS_FILE     = os.path.join(os.path.dirname(__file__), "../data/lessons.json")  # 유닛 목록


def load_questions_by_category(category: str, course_level: str = None, unit: int = None):
    base = os.path.join(os.path.dirname(__file__), f"../data/{category}")
    result = []

    # 시도할 레벨 목록: 요청 레벨 우선, 없으면 beginner 폴백
    if course_level:
        levels_to_try = [course_level]
        if course_level != "beginner":
            levels_to_try.append("beginner")  # 폴백
    else:
        levels_to_try = ["beginner", "intermediate", "advanced"]

    tried_paths = set()

    for level in levels_to_try:
        if category == "endboss":
            fpath = os.path.join(base, f"{level}.json")
            if fpath in tried_paths or not os.path.exists(fpath):
                continue
            tried_paths.add(fpath)
            import re as _re
            with open(fpath, "r", encoding="utf-8") as f:
                raw = f.read()
            # JS 스타일 주석 제거 (beginner.json 등에 주석 포함 가능)
            raw = _re.sub(r"/\*.*?\*/", "", raw, flags=_re.DOTALL)
            raw = _re.sub(r"(?<!:)//[^\n]*", "", raw)
            data = json.loads(raw)
            qs = data if isinstance(data, list) else data.get("questions", [])
            result.extend(qs)
            break  # endboss는 첫 번째 존재하는 레벨만 사용
        else:
            folder = os.path.join(base, level)
            if not os.path.exists(folder):
                continue  # 다음 레벨(폴백)로 이동

            files = [f"unit_{unit}.json"] if unit else sorted(os.listdir(folder))
            loaded_any = False
            for fname in files:
                fpath = os.path.join(folder, fname)
                if fpath in tried_paths:
                    continue
                if os.path.exists(fpath) and fname.endswith(".json"):
                    tried_paths.add(fpath)
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    qs = data if isinstance(data, list) else data.get("questions", [])
                    result.extend(qs)
                    loaded_any = True

            if loaded_any:
                break  # 데이터 찾았으면 폴백 불필요

    return result


def load_lessons(course_level: str = None, unit: int = None):
    base = os.path.join(os.path.dirname(__file__), "../data/lessons")
    result = []

    if course_level:
        levels_to_try = [course_level]
        if course_level != "beginner":
            levels_to_try.append("beginner")
    else:
        levels_to_try = ["beginner", "intermediate", "advanced"]

    for level in levels_to_try:
        folder = os.path.join(base, level)
        if not os.path.exists(folder):
            continue

        files = [f"unit_{unit}.json"] if unit else sorted(os.listdir(folder))
        loaded_any = False
        for fname in files:
            fpath = os.path.join(folder, fname)
            if os.path.exists(fpath) and fname.endswith(".json"):
                with open(fpath, "r", encoding="utf-8") as f:
                    result.extend(json.load(f))
                loaded_any = True

        if loaded_any:
            break  # 데이터 찾았으면 폴백 불필요

    return result


def load_units(course_level: str = None):
    """유닛 목록: course_level별 파일 우선, 없으면 lessons.json(beginner) 폴백."""
    # 레벨별 파일 우선 (예: lessons_intermediate.json)
    if course_level and course_level != "beginner":
        base_dir = os.path.dirname(UNITS_FILE)
        level_file = os.path.join(base_dir, f"lessons_{course_level}.json")
        if os.path.exists(level_file):
            with open(level_file, "r", encoding="utf-8") as f:
                return json.load(f)
    # 폴백: 기본 lessons.json
    if not os.path.exists(UNITS_FILE):
        return []
    with open(UNITS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


# ── 유닛 목록 (lessons.json) ────────────────────────────────────

@router.get("/units")
def get_units(course_level: str = Query(None)):
    """유닛 목록 조회 (course_level별)."""
    return load_units(course_level)


@router.get("/units/{unit_id}")
def get_unit(unit_id: int, course_level: str = Query(None)):
    """특정 유닛 조회 (course_level별)."""
    units = load_units(course_level)
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
    lessons = load_lessons(course_level)
    lesson = next(
        (l for l in lessons if l.get("lesson_id") == lesson_id),
        None,
    )
    # intermediate 버전 없으면 beginner로 폴백
    if not lesson and course_level and course_level != "beginner":
        fallback_id = lesson_id.rsplit(f"-{course_level}", 1)[0] + "-beginner"
        beginner_lessons = load_lessons("beginner")
        lesson = next(
            (l for l in beginner_lessons if l.get("lesson_id") == fallback_id),
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
    quiz_questions = load_questions_by_category(category, course_level, unit)
    if stage:
        quiz_questions = [q for q in quiz_questions if q.get("stage") == stage]

    if category == "quiz":
        # attempt별 quiz_set 필터 (quiz 문제에만 적용)
        if attempt == 1:
            pool = [q for q in quiz_questions if q.get("quiz_set") == "A"]
        elif attempt == 2:
            pool = [q for q in quiz_questions if q.get("quiz_set") == "B"]
        else:
            pool = list(quiz_questions)
            random.shuffle(pool)
            
        if not pool: # quiz_set이 없어 빈 경우 폴백
            pool = list(quiz_questions)
            random.shuffle(pool)
            
        quiz_pool = pool[:limit]

        return quiz_pool

    # quiz가 아닌 다른 카테고리는 기존 방식대로 셔플 후 반환
    random.shuffle(quiz_questions)
    return quiz_questions[:limit]


@router.get("/questions/{question_id}")
def get_question(question_id: str):
    # This might need to search all categories if category is unknown.
    # For now, we search 'quiz' and 'miniboss'.
    questions = load_questions_by_category("quiz") + load_questions_by_category("miniboss") + load_questions_by_category("unitboss") + load_questions_by_category("endboss")
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
    question_id: str = ""
    question: str          # 문제 텍스트
    correct_answer: str    # 정답
    user_answer: str       # 유저 답
    level: str = "beginner"  # beginner | intermediate | advanced


@router.post("/ai-feedback")
@limiter.limit("5/minute;100/day")
async def get_ai_feedback(request: Request, req: AiFeedbackRequest, authorization: str = Header(None)):
    """
    오답 제출 시 Claude API를 호출해 레벨별 맞춤 피드백을 반환합니다.
    Claude 실패/타임아웃 시 is_ai_fallback=True와 함께 200 반환 (프론트 crash 방지).
    """
    wrong_answers = load_wrong_answers()
    if req.question_id:
        for entry in wrong_answers:
            if entry.get("question_id") == req.question_id and entry.get("user_answer") == req.user_answer:
                cached_feedback = entry.get("ai_explanation") or entry.get("feedback")
                if cached_feedback:
                    return {"feedback": cached_feedback, "is_ai_fallback": False, "cached": True}

    prompt = (
        f"[문제]\n{req.question}\n\n"
        f"[정답]\n{req.correct_answer}\n\n"
        f"[학생 답변]\n{req.user_answer}\n\n"
        "학생이 왜 틀렸는지, 그리고 올바른 개념을 이해할 수 있도록 설명해주세요."
    )
    result = await ask_claude(prompt, level=req.level)

    if authorization:
        try:
            import os
            from jose import jwt
            from routers.user import load_users, save_users
            from routers.titles import TITLE_DEFINITIONS

            SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
            ALGORITHM = os.getenv("ALGORITHM", "HS256")

            token = authorization.replace("Bearer ", "")
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            users = load_users()
            for u in users:
                if u.get("id") == user_id:
                    u["ai_feedback_count"] = u.get("ai_feedback_count", 0) + 1
                    earned = set(u.get("titles", []))
                    if u["ai_feedback_count"] >= 10 and "ai_explorer" not in earned:
                        earned.add("ai_explorer")
                    u["titles"] = list(earned)
                    break
            save_users(users)
        except Exception:
            pass

    if result["success"]:
        feedback = result["feedback"]
        
        # Save to wrong_answers.json
        user_id = None
        if authorization:
            try:
                from jose import jwt
                SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
                ALGORITHM = os.getenv("ALGORITHM", "HS256")
                token = authorization.replace("Bearer ", "")
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                user_id = payload.get("sub")
            except Exception:
                pass
                
        wrong_answers.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "question_id": req.question_id,
            "user_answer": req.user_answer,
            "feedback": feedback,
            "ai_explanation": feedback,
            "timestamp": datetime.utcnow().isoformat(),
            "reviewed": False
        })
        save_wrong_answers(wrong_answers)
        
        return {"feedback": feedback, "is_ai_fallback": False}
    return {"feedback": "", "is_ai_fallback": True}


@router.post("/ai-feedback/stream")
async def get_ai_feedback_stream(req: AiFeedbackRequest, authorization: str = Header(None)):
    """
    SSE 스트리밍 피드백. 청크마다 data: {"text": "..."} 형식으로 전송.
    완료 시 data: [DONE] 전송.
    """
    wrong_answers = load_wrong_answers()
    if req.question_id:
        for entry in wrong_answers:
            if entry.get("question_id") == req.question_id and entry.get("user_answer") == req.user_answer:
                cached_feedback = entry.get("ai_explanation") or entry.get("feedback")
                if cached_feedback:
                    async def cached_generator():
                        yield f"data: {json.dumps({'text': cached_feedback}, ensure_ascii=False)}\n\n"
                        yield "data: [DONE]\n\n"
                    return StreamingResponse(
                        cached_generator(),
                        media_type="text/event-stream",
                        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
                    )

    prompt = (
        f"[문제]\n{req.question}\n\n"
        f"[정답]\n{req.correct_answer}\n\n"
        f"[학생 답변]\n{req.user_answer}\n\n"
        "학생이 왜 틀렸는지, 그리고 올바른 개념을 이해할 수 있도록 설명해주세요."
    )

    async def event_generator():
        full_text = ""
        try:
            async for chunk in stream_claude(prompt, req.level):
                full_text += chunk
                yield f"data: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
                
            if full_text:
                user_id = None
                if authorization:
                    try:
                        from jose import jwt
                        SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
                        ALGORITHM = os.getenv("ALGORITHM", "HS256")
                        token = authorization.replace("Bearer ", "")
                        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                        user_id = payload.get("sub")
                    except Exception:
                        pass
                
                wa = load_wrong_answers()
                wa.append({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "question_id": req.question_id,
                    "user_answer": req.user_answer,
                    "feedback": full_text,
                    "ai_explanation": full_text,
                    "timestamp": datetime.utcnow().isoformat(),
                    "reviewed": False
                })
                save_wrong_answers(wa)
                
        except Exception as e:
            yield f"data: {json.dumps({'text': f'[오류: {str(e)}]'}, ensure_ascii=False)}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
