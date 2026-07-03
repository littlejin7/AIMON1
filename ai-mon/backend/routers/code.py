from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from services.claude_service import ask_claude_json, ask_claude
import os, uuid
from datetime import datetime
from typing import Optional
from routers.utils import (
    get_current_user,
    save_user,
    get_progress_by_user,
    save_progress_item,
    limiter,
    now_kst,
    apply_xp,
)

router = APIRouter()

CODE_CLEAR_XP = 200

_QUESTION_INDEX = {}


def _levels_to_try(course_level: str | None) -> list[str]:
    levels = []
    if course_level:
        levels.append(course_level)
    for level in ("beginner", "intermediate", "advanced"):
        if level not in levels:
            levels.append(level)
    return levels


def _categories_to_try(question_id: str) -> tuple[str, ...]:
    qid = question_id or ""
    if qid.startswith(("miniboss_", "mb_")):
        return ("miniboss", "quiz", "unitboss", "endboss")
    return ("quiz", "miniboss", "unitboss", "endboss")


def find_question(
    question_id: str,
    *,
    course_level: str | None = None,
    unit: int | None = None,
    stage: str | None = None,
) -> Optional[dict]:
    from routers.quiz import load_questions_by_category

    for category in _categories_to_try(question_id):
        for level in _levels_to_try(course_level):
            for q in load_questions_by_category(category, course_level=level, unit=unit):
                q_id = q.get("question_id") or q.get("id")
                if q_id == question_id:
                    return q

    global _QUESTION_INDEX
    if not _QUESTION_INDEX:
        index = {}
        for category in ("quiz", "unitboss", "miniboss", "endboss"):
            for level in ("beginner", "intermediate", "advanced"):
                for q in load_questions_by_category(category, course_level=level, unit=unit):
                    q_id = q.get("question_id") or q.get("id")
                    if q_id and q_id not in index:
                        index[q_id] = q
        _QUESTION_INDEX = index
    return _QUESTION_INDEX.get(question_id)


def _normalize_output(text: str | None) -> str:
    normalized = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    return "\n".join(line.rstrip() for line in normalized.split("\n")).rstrip("\n")


def _deterministic_grade_from_expected_output(question: dict, output: str, error: str) -> Optional[dict]:
    if question.get("type") != "code_input":
        return None
    expected_output = question.get("expected_output")
    if not expected_output or error:
        return None
    if _normalize_output(output) != _normalize_output(expected_output):
        return None

    feedback = question.get("feedback")
    correct_feedback = feedback.get("correct", "") if isinstance(feedback, dict) else ""
    return {
        "is_correct": True,
        "score": 100,
        "feedback": correct_feedback or "Correct.",
        "hint": "",
        "grading_failed": False,
    }


class SubmitRequest(BaseModel):
    question_id:  str
    code:         str = Field(..., max_length=4000)
    output:       str = Field("", max_length=4000)
    error:        str = Field("", max_length=4000)
    unit:         int = 1
    stage:        str = ""
    course_level: str = ""
    # award=True: 정규 코드퀘 경로 — AI 관대 채점 + 200 XP + (unit,stage) 진행도 저장.
    # award=False: 채점 전용 — is_correct/score/feedback 만 반환하고 XP·진행도·user 저장을
    #              일절 하지 않는다. (Train 연습/복습, Stage-미니보스: 보상은 각 시스템이 소유)
    award:        bool = True

class HintRequest(BaseModel):
    question_id:  str
    code:         str = Field(..., max_length=4000)
    course_level: str = "beginner"


@router.post("/submit")
# 코드 채점 전용 한도. 보스 답안 채점(30/minute;100/day)과 동일 기준.
# Train(최대 15문항)·미니보스 한 세션의 연속 제출+재시도가 분당 10회를 넘길 수 있어 상향.
@limiter.limit("30/minute;100/day")
async def submit_code(request: Request, req: SubmitRequest, user: dict = Depends(get_current_user)):
    user_id = user["id"]
    course_level = req.course_level or user.get("course_level", "beginner")

    question = find_question(
        req.question_id,
        course_level=course_level,
        unit=req.unit,
        stage=req.stage,
    )
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    result = _deterministic_grade_from_expected_output(question, req.output, req.error)

    level_instruction_map = {
        "beginner": (
            "- 초보자 수준에 맞춰 비유와 일상 예시(예: 리스트 = 서랍장, 변수 = 상자)를 들어 친절하게 설명하고 추상적인 용어는 피하세요.\n"
            "- 단순 오타나 사소한 문법 오류보다는 로직의 큰 틀이 맞으면 정답 처리하되, 설명 시 단순 오타/누락을 가볍게 짚어주며 오답 소거식으로 올바른 답을 유도하세요."
        ),
        "intermediate": (
            "- 리스트 컴프리헨션, 딕셔너리 등 파이썬스러운(Pythonic) 코드 작성 및 함수 모듈화에 가산점을 주세요.\n"
            "- 파이썬의 표준(Pythonic) 코드 규칙 및 핵심 자료구조 용어를 명확히 사용하여 설명하고, 짤막한 핵심 코드 흐름 중심의 원리 설명과 오답 원인을 포함하세요."
        ),
        "advanced": (
            "- 알고리즘 효율성, 예외 처리, 비동기/고급 패턴 사용 여부를 엄격하게 채점하세요. (score 70점 이상 시 정답 인정)\n"
            "- 비동기(async/await), 데코레이터, 메모리 참조 등 파이썬 심화 메커니즘을 중심으로 깊이 있게 설명하고, 엣지 케이스 및 예외 처리 방어 코드 검토, 최적화 및 확장성 있는 설계적 리팩터링 방향을 제시하세요."
        ),
    }
    level_instruction = level_instruction_map.get(course_level, level_instruction_map["beginner"])

    error_section = f"\n[실행 에러]\n{req.error}" if req.error else ""
    output_section = f"\n[사용자 코드 실행 결과]\n{req.output or '(출력 없음)'}" if req.output or req.error else ""

    correct_ans = question.get('answer', '없음')
    prompt = f"""당신은 파이썬을 가르치는 전문 AI 튜터 '에이몬'입니다.
사용자의 코드를 분석하여 채점하고 피드백을 제공해주세요.

[레벨별 채점/피드백 지침: {course_level.upper()}]
{level_instruction}

[중요 지시사항]
- 코드가 문제의 핵심 요구사항을 충족하면 is_correct: true로 채점하세요.
- 실행 결과 텍스트가 예시 정답과 완전히 일치하지 않더라도 로직이 올바르면 정답으로 인정하세요.
- 오답(is_correct: false)일 시 "feedback" 필드의 내용은 반드시 아래의 '피드백 3문장 형식 규칙'을 엄격하게 준수하여 작성해야 합니다.
- 정답(is_correct: true)일 시 "feedback" 필드의 내용은 칭찬 및 해설을 담은 1~2문장의 격려말로 채우세요.
- 오직 JSON 형식으로만 응답해야 하며, 그 외 어떠한 텍스트나 마크다운 기호도 포함하지 마세요.

[피드백 3문장 형식 규칙 (오답일 때 "feedback" 필드에 적용)]
- 첫 번째 문장: 아쉽지만 정답은 "{correct_ans}"입니다. (따옴표 안에 정답 예시 코드를 정확히 기입할 것. 이 첫 번째 문장은 글자 수 제한이 없습니다.)
- 두 번째 문장: 왜 오답인지 핵심 개념 설명 (레벨별 기준 반영, **공백 포함 최대 30자 이내**로 극도로 짧게 요약하여 핵심 단어 위주로 작성하세요.)
- 세 번째 문장: 다시 풀 때 볼 기준 (레벨별 기준 반영, **공백 포함 최대 30자 이내**로 극도로 짧게 요약하여 핵심 단어 위주로 작성하세요.)

[문제 정보]
문제 설명: {question.get('question', '')}
예시 정답 코드: {correct_ans}

[사용자 제출 코드]
{req.code}
{output_section}{error_section}

채점 결과를 다음 JSON 형식에 맞춰 반환하세요:
{{
  "is_correct": true/false,
  "score": 0~100,
  "feedback": "3문장 규칙을 준수한 한국어 피드백",
  "hint": "틀렸을 때 힌트, 맞으면 빈 문자열"
}}"""

    if result is None:
        result = await ask_claude_json(prompt)

    # AI 채점 실패 시: HP·XP·진행도 미변경, 재시도 안내 응답 (D-1 버그 방지)
    if result.get("grading_failed"):
        result["xp_awarded"]    = 0
        result["lv"]            = user.get("lv", 1)
        result["grading_failed"] = True
        return result

    is_correct = result.get("is_correct", False)

    xp_awarded = 0
    # award=False 경로(Train·미니보스)는 채점 결과만 반환한다.
    # apply_xp / save_progress_item / save_user 를 절대 타지 않아 200 XP·진행도 행이 써지지 않는다.
    if req.award and is_correct:
        progress = get_progress_by_user(user_id, course_level)
        existing = next(
            (p for p in progress
             if p["unit"] == req.unit
             and p["stage"] == req.stage),
            None,
        )
        award_xp = False
        if existing:
            if not existing.get("is_completed", False):
                award_xp = True
            existing["score"]        = max(existing.get("score", 0), result.get("score", 100))
            existing["is_completed"] = True
            existing["updated_at"]   = now_kst().isoformat()
            save_progress_item(existing)
        else:
            award_xp = True
            item = {
                "id":           str(uuid.uuid4()),
                "user_id":      user_id,
                "unit":         req.unit,
                "stage":        req.stage,
                "score":        result.get("score", 100),
                "is_completed": True,
                "course_level": course_level,
                "created_at":   now_kst().isoformat(),
                "updated_at":   now_kst().isoformat(),
            }
            save_progress_item(item)

        if award_xp:
            apply_xp(user, CODE_CLEAR_XP)
            xp_awarded = CODE_CLEAR_XP
            save_user(user)

    result["xp_awarded"] = xp_awarded
    result["lv"]         = user.get("lv", 1)
    return result


@router.post("/hint")
@limiter.limit("10/minute")
async def get_code_hint(request: Request, req: HintRequest, user: dict = Depends(get_current_user)):

    question = find_question(req.question_id, course_level=req.course_level)
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
    events = apply_xp(user, 0, {})
    newly_earned = events["newly_earned_titles"]
    save_user(user)

    return {
        "hint":           result.get("feedback", ""),
        "is_ai_fallback": not result.get("success", False),
        "newly_earned_titles": newly_earned
    }
