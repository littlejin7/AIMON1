import logging
from functools import lru_cache
from fastapi import APIRouter, HTTPException, Header, Query, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from services.claude_service import ask_claude, stream_claude
from typing import Optional
import json, os, random, uuid
from datetime import datetime
from routers.utils import (
    get_wrong_answers_by_user,
    save_wrong_answer_item,
    get_progress_by_user,
    limiter,
    now_kst,
    get_current_user_optional,
    apply_xp,
    mutate_user_atomic,
)

logger = logging.getLogger("uvicorn.error")

router = APIRouter()


def _bump_ai_feedback(user_id: str) -> None:
    """ai_feedback_count++ 와 w_ai5(ai_feedback) 미션 진척을 원자 경로로 기록.

    스트리밍/비스트리밍 양쪽이 동일 호출 → 발생원 일원화(M-3).
    apply_xp(event_type="ai_feedback") 가 _ensure_period 로 missions 를 변형하므로
    delta-merge 경로가 아닌 mutate_user_atomic 필수(M-1).
    AI 성공 시에만 호출(실패한 호출은 미션/칭호에 반영하지 않음).
    """
    def mutator(u: dict):
        u["ai_feedback_count"] = u.get("ai_feedback_count", 0) + 1
        apply_xp(u, 0, {}, event_type="ai_feedback")
        return None

    try:
        mutate_user_atomic(user_id, mutator)
    except Exception:
        logger.exception("ai_feedback bump failed for user %s", user_id)

QUESTIONS_FILE = os.path.join(os.path.dirname(__file__), "../data/questions.json")
LESSONS_DIR    = os.path.join(os.path.dirname(__file__), "../data/lessons")  # 브리핑 슬라이드 폴더
UNITS_FILE     = os.path.join(os.path.dirname(__file__), "../data/lessons.json")  # 유닛 목록


# 클라로 절대 내보내면 안 되는 민감 필드(정답·해설·힌트·피드백).
# 채점은 전부 서버(grade_objective / AI / code-submit)가 하므로 클라엔 정답이 불필요.
_SENSITIVE_QUESTION_FIELDS = ("answer", "feedback", "hint", "explanation")


def serialize_question(q: dict) -> dict:
    """클라 응답용 문제 직렬화 — 민감 필드 제거(F 방어).

    렌더에 필요한 choices/options/code/type/quiz_set 등은 모두 유지(denylist 방식).
    quiz·miniboss·unitboss·endboss 의 모든 '문제 서빙' 응답이 이 헬퍼를 거쳐야 한다.
    """
    if not isinstance(q, dict):
        return q
    return {k: v for k, v in q.items() if k not in _SENSITIVE_QUESTION_FIELDS}


@lru_cache(maxsize=128)
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


@lru_cache(maxsize=128)
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


def _read_units_file(path: str) -> list:
    """유닛 목록 JSON 파일 1개를 읽어 list로 반환.

    파일이 깨졌거나(JSONDecodeError) 읽기 실패 시 통째로 죽지 않도록 방어한다.
    단, 조용히 빈 목록으로 넘기지 않고 에러 로그를 남긴 뒤 예외를 다시 올린다.
    호출부(load_units)가 폴백 여부를 판단한다.
    """
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        logger.exception("유닛 목록 파일 로드 실패: %s", path)
        raise


@lru_cache(maxsize=128)
def load_units(course_level: str = None):
    """유닛 목록: course_level별 파일 우선, 없으면 lessons.json(beginner) 폴백.

    레벨별 파일이 깨졌으면 에러를 로그로 남기고 기본 lessons.json 으로 폴백한다.
    기본 파일까지 깨졌으면 에러를 로그로 남기고 예외를 올린다(조용한 빈 목록 금지).
    """
    # 레벨별 파일 우선 (예: lessons_intermediate.json)
    if course_level and course_level != "beginner":
        base_dir = os.path.dirname(UNITS_FILE)
        level_file = os.path.join(base_dir, f"lessons_{course_level}.json")
        if os.path.exists(level_file):
            try:
                return _read_units_file(level_file)
            except (json.JSONDecodeError, OSError):
                # 레벨별 파일이 깨진 경우 기본 lessons.json 으로 폴백
                logger.warning(
                    "레벨별 유닛 파일(%s)이 깨져 기본 lessons.json 으로 폴백합니다.",
                    level_file,
                )
    # 폴백: 기본 lessons.json
    if not os.path.exists(UNITS_FILE):
        logger.error("기본 유닛 목록 파일이 존재하지 않습니다: %s", UNITS_FILE)
        return []
    return _read_units_file(UNITS_FILE)


# ── 진입 게이트 헬퍼 ────────────────────────────────────────────
# quiz.py와 boss.py가 동일한 기준을 사용하도록 한 곳에서 정의한다.

def assert_stage_access(user: dict, unit: int, stage: str, course_level: str) -> None:
    """스테이지 진입/완료 가능 여부 검증. 불가 시 HTTP 403 raise.

    순서: 레벨 테스트 완료 → 유닛 해금 → 이전 스테이지 완료.
    quiz.py·progress.py·miniboss.py가 동일 함수를 공유한다.
    """
    if not user.get("is_level_tested"):
        raise HTTPException(status_code=403, detail="레벨 테스트를 먼저 완료해주세요.")

    max_unlocked = user.get("max_unlocked_unit", 1)
    max_unit = (
        max_unlocked.get(course_level, 1)
        if isinstance(max_unlocked, dict)
        else int(max_unlocked)
    )
    if unit > max_unit:
        raise HTTPException(status_code=403, detail="해당 유닛이 잠겨 있습니다. 이전 유닛 보스를 클리어하세요.")

    try:
        stage_num = int(stage.split("-")[-1])
    except (ValueError, AttributeError):
        stage_num = 1

    if stage_num > 1:
        prev_stage = f"{unit}-{stage_num - 1}"
        progress = get_progress_by_user(user["id"], course_level)
        if not any(
            p.get("unit") == unit
            and p.get("stage") == prev_stage
            and p.get("is_completed")
            for p in progress
        ):
            raise HTTPException(
                status_code=403,
                detail=f"이전 스테이지({prev_stage})를 먼저 완료해주세요.",
            )


def assert_boss_access(user: dict, unit: int, course_level: str) -> None:
    """유닛 보스 진입 가능 여부 검증. 불가 시 HTTP 403 raise.

    순서: 레벨 테스트 완료 → 유닛 해금 → 선행 스테이지 완료 (이미 깬 보스는 면제).
    이미 보스를 클리어한 유저(unitboss_cleared_units에 키 존재)는 재진입 시
    스테이지 진행도 체크를 건너뛴다. is_level_tested 검증은 항상 유지.
    """
    if not user.get("is_level_tested"):
        raise HTTPException(status_code=403, detail="레벨 테스트를 먼저 완료해주세요.")

    max_unlocked = user.get("max_unlocked_unit", 1)
    max_unit = (
        max_unlocked.get(course_level, 1)
        if isinstance(max_unlocked, dict)
        else int(max_unlocked)
    )
    if unit > max_unit:
        raise HTTPException(status_code=403, detail="해당 유닛이 잠겨 있습니다.")

    # 이미 클리어한 보스는 재진입 허용 — 선행 스테이지 progress 체크 면제.
    # 저장 포맷: boss.py의 unit_key = f"{course_level}-{unit_val}" 과 동일.
    unit_key = f"{course_level}-{unit}"
    already_cleared = unit_key in (user.get("unitboss_cleared_units") or [])
    if already_cleared:
        return

    units = load_units(course_level)
    unit_info = next((u for u in units if u.get("unit_id") == unit), None)
    total_stages = unit_info.get("stages", 0) if unit_info else 0

    if total_stages > 0:
        progress = get_progress_by_user(user["id"], course_level)
        done = sum(
            1
            for p in progress
            if p.get("unit") == unit
            and p.get("stage", "").startswith(f"{unit}-")
            and p.get("stage") != f"{unit}-boss"
            and p.get("is_completed")
        )
        if done < total_stages:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"유닛 {unit}의 모든 스테이지를 완료해야 보스에 도전할 수 있습니다."
                    f" ({done}/{total_stages})"
                ),
            )


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
    user: Optional[dict] = Depends(get_current_user_optional),
):
    # 스테이지 진입 게이트: quiz 문제 요청 시 유닛·스테이지가 지정된 경우에만 검사.
    # Unit 1 / Stage 1-1 은 비로그인 선체험 공개 구간 → 인증 없이 허용.
    if category == "quiz" and unit is not None and stage is not None:
        is_public = unit == 1 and stage == "1-1"
        if user:
            assert_stage_access(user, unit, stage, course_level or "beginner")
        elif not is_public:
            raise HTTPException(status_code=401, detail="로그인이 필요합니다.")

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

        if not pool:  # quiz_set이 없어 빈 경우 폴백
            pool = list(quiz_questions)
            random.shuffle(pool)

        quiz_pool = pool[:limit]

        return [serialize_question(q) for q in quiz_pool]  # 정답·해설 제거(F)

    # quiz가 아닌 다른 카테고리는 기존 방식대로 셔플 후 반환
    random.shuffle(quiz_questions)
    return [serialize_question(q) for q in quiz_questions[:limit]]  # 정답·해설 제거(F)


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
    return serialize_question(q)  # 정답·해설 제거(F)


# ── AI 피드백 엔드포인트 ──────────────────────────────────────

class AiFeedbackRequest(BaseModel):
    question_id: str = ""
    question: str          # 문제 텍스트
    # correct_answer 는 더 이상 클라가 신뢰 입력으로 보내지 않는다(F: 정답이 클라에 없음).
    # 서버가 question_id 로 원본 정답을 조회한다. 하위호환 위해 필드는 남기되 무시.
    correct_answer: str = ""
    user_answer: str = Field(..., max_length=4000)      # 유저 답
    level: str = "beginner"  # beginner | intermediate | advanced


def _resolve_answer(question_id: str, course_level: str = None) -> str:
    """question_id 로 원본 정답을 서버에서 조회 (AI 피드백 프롬프트용).

    클라가 정답을 모르므로(F) 서버가 직접 찾는다. 못 찾으면 빈 문자열.
    """
    if not question_id:
        return ""
    for category in ("quiz", "miniboss", "unitboss", "endboss"):
        try:
            pool = load_questions_by_category(category, course_level=course_level)
        except Exception:
            continue
        for q in pool:
            if q.get("question_id") == question_id or q.get("id") == question_id:
                return str(q.get("answer", "") or "")
    return ""


def _make_ai_feedback_prompt(question: str, correct_answer: str, user_answer: str, level: str) -> str:
    level = level or "beginner"
    if level == "beginner":
        level_instruction = (
            "- 일상적인 비유(예: 리스트 = 서랍장, 변수 = 상자)와 친근한 어조를 적용하고, 추상적이거나 복잡한 컴퓨터 과학 용어는 피하세요.\n"
            "- 단순 오타나 세미콜론/콜론 등의 단순 누락에 대해 직관적으로 짚어주고, 쉬운 오답 소거 방식으로 올바른 답을 유도하세요."
        )
    elif level == "intermediate":
        level_instruction = (
            "- 파이썬의 표준(Pythonic) 코드 규칙 및 핵심 자료구조 용어를 명확히 사용하여 설명하세요.\n"
            "- 사용한 자료구조나 내장 함수의 활용 여부를 짚고, 짤막한 코드 흐름을 들어 원리를 설명하세요."
        )
    else:  # advanced
        level_instruction = (
            "- 비동기(async/await), 데코레이터, 메모리 참조 등 파이썬 심화 메커니즘을 중심으로 깊이 있게 설명하세요.\n"
            "- 엣지 케이스 및 예외 처리 방어 코드 검토, 최적화 및 확장성 있는 설계적 리팩터링 방향을 제시하세요."
        )

    return f"""당신은 파이썬을 가르치는 친근한 전문 AI 튜터 '에이몬'입니다.
학생의 오답에 대해 다음의 세 문장 규칙을 엄격하게 준수하여 한국어로 피드백을 작성해 주세요.

[중요 피드백 형식 규칙 (정확히 3문장만 작성해야 함)]
- 첫 번째 문장: 아쉽지만 정답은 "{correct_answer}"입니다. (반드시 이 형식으로 시작하고, 따옴표 안에 정확한 정답 값을 기입해야 함)
- 두 번째 문장: 왜 오답인지 핵심 개념 설명 (아래 레벨별 기준 반영)
- 세 번째 문장: 다시 풀 때 볼 기준 (아래 레벨별 기준 반영)

[레벨별 평가/설명 기준: {level.upper()}]
{level_instruction}

[문제 정보]
문제: {question}
정답: {correct_answer}

[학생 답변]
{user_answer}

추가적인 설명이나 머리말, 꼬리말, 마크다운 코드블록(` ``` `) 등은 절대 붙이지 마세요. 오직 피드백 3문장만 출력하세요."""


@router.post("/ai-feedback")
@limiter.limit("5/minute;100/day")
async def get_ai_feedback(request: Request, req: AiFeedbackRequest, user: Optional[dict] = Depends(get_current_user_optional)):
    """
    오답 제출 시 Claude API를 호출해 레벨별 맞춤 피드백을 반환합니다.
    Claude 실패/타임아웃 시 is_ai_fallback=True와 함께 200 반환 (프론트 crash 방지).
    """
    user_id = user["id"] if user else None

    wrong_answers = get_wrong_answers_by_user(user_id) if user_id else []
    if req.question_id:
        for entry in wrong_answers:
            if entry.get("question_id") == req.question_id and entry.get("user_answer") == req.user_answer:
                cached_feedback = entry.get("ai_explanation") or entry.get("feedback")
                if cached_feedback:
                    return {"feedback": cached_feedback, "is_ai_fallback": False, "cached": True}

    correct_answer = _resolve_answer(req.question_id, req.level)  # 서버 조회(F)
    prompt = _make_ai_feedback_prompt(req.question, correct_answer, req.user_answer, req.level)
    result = await ask_claude(prompt, level=req.level)

    if result["success"]:
        feedback = result["feedback"]

        # AI 성공 시에만 ai_feedback 카운트/미션 진척 기록 (스트리밍과 동일 경로)
        if user_id:
            _bump_ai_feedback(user_id)

        new_wa = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "question_id": req.question_id,
            "user_answer": req.user_answer,
            "feedback": feedback,
            "ai_explanation": feedback,
            "timestamp": now_kst().isoformat(),
            "reviewed": False
        }
        save_wrong_answer_item(new_wa)
        
        return {"feedback": feedback, "is_ai_fallback": False}
    return {"feedback": "", "is_ai_fallback": True}


@router.post("/ai-feedback/stream")
async def get_ai_feedback_stream(req: AiFeedbackRequest, user: Optional[dict] = Depends(get_current_user_optional)):
    """
    SSE 스트리밍 피드백. 청크마다 data: {"text": "..."} 형식으로 전송.
    완료 시 data: [DONE] 전송.
    """
    user_id = user["id"] if user else None

    wrong_answers = get_wrong_answers_by_user(user_id) if user_id else []
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

    correct_answer = _resolve_answer(req.question_id, req.level)  # 서버 조회(F)
    prompt = _make_ai_feedback_prompt(req.question, correct_answer, req.user_answer, req.level)

    async def event_generator():
        full_text = ""
        try:
            async for chunk in stream_claude(prompt, req.level):
                full_text += chunk
                yield f"data: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
                
            if full_text:
                new_wa = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "question_id": req.question_id,
                    "user_answer": req.user_answer,
                    "feedback": full_text,
                    "ai_explanation": full_text,
                    "timestamp": now_kst().isoformat(),
                    "reviewed": False
                }
                save_wrong_answer_item(new_wa)

                # 스트리밍도 ai_feedback 진척 기록 (M-3 일원화) — 성공(full_text) 시에만
                if user_id:
                    _bump_ai_feedback(user_id)

        except Exception as e:
            logger.exception("ai-feedback stream error for user %s", user_id)
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
