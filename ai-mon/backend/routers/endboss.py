"""
엔드보스 (Endboss) 라우터
기획서: ENDBOSS_DESIGN.md

엔드포인트:
  GET  /boss/endboss/info      해금 여부 + 왕관 수 조회
  POST /boss/endboss/start     배틀 시작 (왕관 3개 차감, Phase 1 문제 5개 반환)
  POST /boss/endboss/answer    답안 제출 → HP 계산 / 페이즈 전환 / Phase 3 카운트
  POST /boss/endboss/clear     클리어 처리 (XP + 왕관 + 진화 + 칭호, 중복 방지)
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from services.claude_service import ask_claude_json
import json, os, random, uuid
from typing import Optional

from routers.utils import (
    save_user,
    limiter,
    get_current_user,
    apply_xp,
    mutate_user_atomic,
    save_attempt_item,
    now_kst,
    UserNotFoundError,
)
from routers.quiz import serialize_question

router = APIRouter()

ENDBOSS_DIR    = os.path.join(os.path.dirname(__file__), "../data/endboss")

# ── 재도전 비용 ──────────────────────────────────────────────────────────────
RETRY_CROWN_COST = 3

# ── HP 설정 (Phase 1~2 전용) ──────────────────────────────────────────────────
BOSS_HP_INIT   = 1800
MY_HP_INIT     = 1200
BOSS_HP_DELTA  = 200   # 정답 시 보스 HP 감소
MY_HP_DELTA    = 400   # 오답 시 내 HP 감소

# ── Phase 3 최대 시도 횟수 ────────────────────────────────────────────────────
PHASE3_MAX_TRIES = 3

# ── 보상 ─────────────────────────────────────────────────────────────────────
CLEAR_XP      = 15000
CLEAR_CROWNS  = 15

CLEAR_TITLES = {
    "beginner":     ("rookie_coder",  "코드 ROOKIE"),
    "intermediate": ("ace_coder",     "ACE 코더"),
    "advanced":     ("ai_master",     "AI 마스터"),
}

CLEAR_CHARACTER = {
    "beginner":     "robot",
    "intermediate": "speech_bubble",
    "advanced":     "final_ghost",
}

# ── 레벨별 Phase 문제 유형 ────────────────────────────────────────────────────
PHASE_TYPES = {
    "beginner": {
        1: ["output_select", "multiple_choice"],
        2: ["error_find"],
        3: ["fill_in_blank"],
    },
    "intermediate": {
        1: ["output_select", "fill_in_blank"],
        2: ["error_find"],
        3: ["code_input"],
    },
    "advanced": {
        1: ["fill_in_blank", "error_find"],
        2: ["code_input"],
        3: ["code_input"],
    },
}


# ── 유틸 ──────────────────────────────────────────────────────────────────────

def load_endboss_questions(course_level: str) -> list:
    """data/endboss/{course_level}.json 로드. JS 스타일 주석 허용."""
    import re
    path = os.path.join(ENDBOSS_DIR, f"{course_level}.json")
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()
    raw = re.sub(r"/\*.*?\*/", "", raw, flags=re.DOTALL)
    raw = re.sub(r"(?<!:)//[^\n]*", "", raw)
    return json.loads(raw)

def is_endboss_unlocked(user: dict) -> bool:
    """Unit 8 보스 클리어 여부 확인."""
    level = user.get("course_level", "beginner")
    unlocked = user.get("max_unlocked_unit", {})
    if isinstance(unlocked, dict):
        return unlocked.get(level, 1) > 8
    return int(unlocked) > 8

def get_phase_questions(all_qs: list, phase: int, project: str) -> list:
    """특정 phase + project 의 문제만 필터링해서 순서대로 반환."""
    return [q for q in all_qs if q.get("phase") == phase and q.get("project") == project]

def pick_unseen(pool: list, seen: list) -> Optional[dict]:
    """seen에 없는 문제 중 첫 번째 반환. 전부 소진 시 None."""
    for q in pool:
        if q["question_id"] not in seen:
            return q
    return None

def direct_grade(user_answer: str, correct_answer: str, q_type: str) -> bool:
    """output_select / multiple_choice / error_find / fill_in_blank 직접 채점."""
    ua = user_answer.strip()
    ca = str(correct_answer).strip()
    if ua == ca:
        return True
    # 선택지 알파벳만 입력한 경우 (예: "B" vs "B. 슬라임")
    if len(ua) == 1 and ua.upper() == ca.upper():
        return True
    # 전체 선택지 텍스트 입력한 경우 (예: "B. 슬라임" vs "B")
    if len(ca) == 1 and ua.upper().startswith(ca.upper() + "."):
        return True
    return False


# ── Pydantic 모델 ─────────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    project: str  # account | wordchain | grade | gpa

class AnswerRequest(BaseModel):
    question_id: str
    user_answer:  str = Field(..., max_length=4000)
    phase:        int          # 1 | 2 | 3
    my_hp:        int = MY_HP_INIT
    boss_hp:      int = BOSS_HP_INIT
    phase3_tries: int = 0      # Phase 3 현재 시도 횟수 (0-based)
    project:      str = ""

class ClearRequest(BaseModel):
    project: str


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get("/info")
def endboss_info(user: dict = Depends(get_current_user)):
    """해금 여부 + 왕관 수 + 이미 클리어한 레벨 반환."""
    user_id = user["id"]

    level = user.get("course_level", "beginner")
    return {
        "is_unlocked":      is_endboss_unlocked(user),
        "crowns":           user.get("crowns", 0),
        "retry_cost":       RETRY_CROWN_COST,
        "cleared_levels":   user.get("endboss_cleared_levels", []),
        "already_cleared":  level in user.get("endboss_cleared_levels", []),
        "course_level":     level,
    }


@router.post("/start")
def endboss_start(req: StartRequest, user: dict = Depends(get_current_user)):
    """
    배틀 시작.
    - 왕관 3개 차감
    - 선택한 프로젝트의 Phase 1 문제 5개 + Phase 2 문제 4개 순서대로 반환
    - Phase 3 첫 문제도 함께 반환 (phase3_first_question)
    """
    user_id = user["id"]

    if not is_endboss_unlocked(user):
        raise HTTPException(status_code=403, detail="엔드보스가 아직 해금되지 않았습니다. Unit 8 보스를 먼저 클리어하세요.")

    if user.get("crowns", 0) < RETRY_CROWN_COST:
        raise HTTPException(status_code=400, detail=f"왕관이 부족합니다. 엔드보스 도전에는 왕관 {RETRY_CROWN_COST}개가 필요합니다.")

    level = user.get("course_level", "beginner")
    all_qs = load_endboss_questions(level)
    if not all_qs:
        raise HTTPException(status_code=404, detail="엔드보스 문제 데이터가 없습니다.")

    phase1_pool = get_phase_questions(all_qs, phase=1, project=req.project)
    phase2_pool = get_phase_questions(all_qs, phase=2, project=req.project)
    phase3_pool = get_phase_questions(all_qs, phase=3, project=req.project)

    if len(phase1_pool) < 5:
        raise HTTPException(status_code=404, detail=f"프로젝트 '{req.project}'의 Phase 1 문제가 부족합니다. (최소 5개 필요)")
    if len(phase2_pool) < 4:
        raise HTTPException(status_code=404, detail=f"프로젝트 '{req.project}'의 Phase 2 문제가 부족합니다. (최소 4개 필요)")

    # 왕관 차감
    user["crowns"] = user.get("crowns", 0) - RETRY_CROWN_COST

    # Phase 1, 2 문제 확정
    p1_questions = phase1_pool[:5]
    p2_questions = phase2_pool[:4]

    # Phase 3 첫 문제 확정 + seen 기록
    p3_first = phase3_pool[0] if phase3_pool else None
    seen_ids  = [q["question_id"] for q in p1_questions + p2_questions]
    if p3_first:
        seen_ids.append(p3_first["question_id"])

    if "seen_questions" not in user or user["seen_questions"] is None:
        user["seen_questions"] = {}
    user["seen_questions"]["endboss"] = seen_ids
    save_user(user)

    return {
        "phase":               1,
        "project":             req.project,
        "phase1_questions":    [serialize_question(q) for q in p1_questions],   # 정답 제거(F)
        "phase2_questions":    [serialize_question(q) for q in p2_questions],   # 정답 제거(F)
        "phase3_first_question": serialize_question(p3_first) if p3_first else None,
        "my_hp":               MY_HP_INIT,
        "boss_hp":             BOSS_HP_INIT,
        "crowns_left":         user["crowns"],
    }


@router.post("/answer")
@limiter.limit("5/minute;100/day")
async def endboss_answer(request: Request, req: AnswerRequest, user: dict = Depends(get_current_user)):
    """
    답안 제출.

    Phase 1~2:
      - 정답 → boss_hp -= 200
      - 오답 → my_hp  -= 400
      - my_hp <= 0 → is_fail = True
      - boss_hp <= 0 (Phase 2 마지막) → phase3_ready = True

    Phase 3:
      - HP 무관
      - 정답 → is_clear = True
      - 오답 → phase3_tries + 1
        - tries >= 3 → is_fail = True
        - tries < 3  → next_phase3_question 반환
    """
    # user 는 Depends(get_current_user) 로 이미 주입됨. (기존 verify_token(authorization)
    # 호출은 미정의 심볼 참조로 NameError 를 일으키던 버그 — 제거.)
    user_id = user["id"]

    level  = user.get("course_level", "beginner")
    all_qs = load_endboss_questions(level)
    question = next((q for q in all_qs if q.get("question_id") == req.question_id), None)
    if not question:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    q_type = question.get("type", "")
    needs_claude = q_type == "code_input"

    # ── 채점 ──────────────────────────────────────────────────────────────────
    if needs_claude:
        advanced_note = ""
        if level == "advanced":
            advanced_note = (
                "\n[Advanced 레벨 특별 채점 기준]\n"
                "1. 기능 정확성 (50%): 주어진 요구 사항을 예외 없이 모두 충족하는가\n"
                "2. 코드 아키텍처 및 품질 (30%): 비동기 프로그래밍, 데코레이터, 제너레이터 등 고급 파이썬 기능을 목적에 맞게 올바르게 사용했는가\n"
                "3. 예외 처리 및 엣지 케이스 (20%): 발생 가능한 예외 상황(Network Error, Type Error 등)에 대한 대비가 되어있는가\n"
                "총점(score)이 70점 이상일 경우에만 is_correct=true 로 처리하세요.\n"
                "피드백 작성 시 감점된 부분과 개선 방향을 명확하게 제시해주세요.\n"
            )
        elif level == "intermediate":
            advanced_note = (
                "\n[Intermediate 레벨 특별 채점 기준]\n"
                "1. 기능 정확성 (60%): 문제의 요구사항을 해결했는가\n"
                "2. 코드 구조 및 효율성 (40%): 리스트 컴프리헨션, 적절한 자료구조(set, dict), 함수 모듈화를 잘 활용했는가\n"
                "총점(score)이 60점 이상일 경우 is_correct=true 로 처리하세요.\n"
            )
        else:
            advanced_note = (
                "\n[Beginner 레벨 특별 채점 기준]\n"
                "단순 문법 오류가 없고 핵심 로직이 올바르다면 is_correct=true 로 너그럽게 채점해주세요.\n"
                "점수(score)는 0 혹은 100점으로만 부여하세요.\n"
            )

        level_instruction = ""
        if level == "beginner":
            level_instruction = (
                "- 초보자 수준에 맞춰 비유와 일상 예시(예: 리스트 = 서랍장, 변수 = 상자)를 들어 친절하게 설명하고 추상적인 용어는 피하세요.\n"
                "- 단순 오타나 사소한 문법 오류보다는 로직의 큰 틀이 맞으면 정답 처리하되, 설명 시 단순 오타/누락을 가볍게 짚어주며 오답 소거식으로 올바른 답을 유도하세요."
            )
        elif level == "intermediate":
            level_instruction = (
                "- 파이썬의 표준(Pythonic) 코드 규칙 및 핵심 자료구조 용어를 명확히 사용하여 설명하세요.\n"
                "- 사용한 자료구조나 내장 함수의 활용 여부를 짚고, 짤막한 코드 흐름을 들어 왜 틀렸는지 핵심 분석을 포함하세요."
            )
        else:  # advanced
            level_instruction = (
                "- 비동기(async/await), 데코레이터, 메모리 참조 등 파이썬 심화 메커니즘을 중심으로 깊이 있게 설명하세요.\n"
                "- 엣지 케이스 및 예외 처리 방어 코드 검토, 최적화 및 확장성 있는 설계적 리팩터링 방향을 제시하세요."
            )

        prompt = f"""당신은 파이썬을 가르치는 전문 AI 튜터 '에이몬'입니다.
다음 코딩 문제에 대한 사용자의 코드를 다각도에서 분석하고 채점해주세요.
{advanced_note}

[레벨별 평가/피드백 기준: {level.upper()}]
{level_instruction}

[중요 지시사항]
- 오답(is_correct: false)일 시 "feedback" 필드의 내용은 반드시 아래의 '피드백 3문장 형식 규칙'을 엄격하게 준수하여 작성해야 합니다.
- 정답(is_correct: true)일 시 "feedback" 필드의 내용은 칭찬 및 해설을 담은 1~2문장의 격려말로 채우세요.
- 반드시 아래 JSON 포맷으로만 응답하고, 마크다운 코드 블록(` ```json `)이나 추가 텍스트를 포함하지 마세요.

[피드백 3문장 형식 규칙 (오답일 때 "feedback" 필드에 적용)]
- 첫 번째 문장: 아쉽지만 정답은 "{question.get('answer', '')}"입니다. (따옴표 안에 정답 예시 값을 정확히 기입할 것. 이 첫 번째 문장은 글자 수 제한이 없습니다.)
- 두 번째 문장: 왜 오답인지 핵심 개념 설명 (레벨별 기준 반영, **공백 포함 최대 30자 이내**로 극도로 짧게 요약하여 핵심 단어 위주로 작성하세요.)
- 세 번째 문장: 다시 풀 때 볼 기준 (레벨별 기준 반영, **공백 포함 최대 30자 이내**로 극도로 짧게 요약하여 핵심 단어 위주로 작성하세요.)

[문제 정보]
문제: {question['question']}
정답 예시: {question.get('answer', '')}
사용자 답변: {req.user_answer}

출력 포맷:
{{
  "is_correct": true/false,
  "score": 0~100,
  "feedback": "3문장 규칙을 준수한 한국어 피드백",
  "hint": "틀렸을 경우 정답에 도달할 수 있는 핵심 힌트 (맞았으면 빈 문자열)"
}}
"""
        result = await ask_claude_json(prompt)
        is_correct = result.get("is_correct", False)
    else:
        is_correct = direct_grade(req.user_answer, question.get("answer", ""), q_type)
        fb_key  = "correct" if is_correct else "incorrect"
        fb_text = question.get("feedback", {}).get(fb_key, "")
        result  = {
            "is_correct": is_correct,
            "score":      100 if is_correct else 0,
            "feedback":   fb_text,
            "hint":       "" if is_correct else question.get("hint", ""),
        }

    # 풀이 전수 기록 (채점 성공 시 정오답 무관 1건 — AI 피드백과 독립)
    if not result.get("grading_failed", False):
        save_attempt_item({
            "id":          str(uuid.uuid4()),
            "user_id":     user_id,
            "question_id": question.get("question_id"),
            "unit":        None,
            "stage":       f"endboss-p{req.phase}",
            "level":       level,
            "mode":        "endboss",
            "is_correct":  bool(is_correct),
            "answered_at": now_kst().isoformat(),
        })

    # ── Phase 1 / 2 HP 계산 ───────────────────────────────────────────────────
    if req.phase in (1, 2):
        safe_boss_hp = max(0, min(req.boss_hp, BOSS_HP_INIT))
        safe_my_hp   = max(0, min(req.my_hp, MY_HP_INIT))

        grading_failed = result.get("grading_failed", False)

        if grading_failed:
            new_boss_hp  = safe_boss_hp
            new_my_hp    = safe_my_hp
            is_fail      = False
            phase3_ready = False
        elif is_correct:
            new_boss_hp = safe_boss_hp - BOSS_HP_DELTA
            new_my_hp   = safe_my_hp
            is_fail      = False
            phase3_ready = (new_boss_hp <= 0)
        else:
            new_boss_hp = safe_boss_hp
            new_my_hp   = safe_my_hp - MY_HP_DELTA
            is_fail      = new_my_hp <= 0
            phase3_ready = False

        result.update({
            "my_hp":        new_my_hp,
            "boss_hp":      new_boss_hp,
            "is_fail":      is_fail,
            "phase3_ready": phase3_ready,
            "phase3_tries": 0,
            "is_clear":     False,
            "next_phase3_question": None,
        })

    # ── Phase 3 ───────────────────────────────────────────────────────────────
    else:
        grading_failed = result.get("grading_failed", False)

        if grading_failed:
            new_tries = req.phase3_tries
            is_clear  = False
            is_fail   = False
            next_q    = None
        else:
            new_tries = req.phase3_tries + (0 if is_correct else 1)
            is_clear  = is_correct
            is_fail   = (not is_correct) and (new_tries >= PHASE3_MAX_TRIES)

            next_q = None
            if not is_correct and not is_fail:
                # 다음 Phase 3 문제 출제 (중복 없음)
                if "seen_questions" not in user or user["seen_questions"] is None:
                    user["seen_questions"] = {}
                seen_questions = user["seen_questions"]
                seen = seen_questions.get("endboss", [])
                p3_pool = get_phase_questions(all_qs, phase=3, project=req.project)
                next_q  = pick_unseen(p3_pool, seen)
                if next_q:
                    seen_questions["endboss"] = seen + [next_q["question_id"]]
                    user["seen_questions"] = seen_questions
                    save_user(user)

        result.update({
            "my_hp":        req.my_hp,
            "boss_hp":      0,
            "is_fail":      is_fail,
            "phase3_ready": False,
            "phase3_tries": new_tries,
            "is_clear":     is_clear,
            "next_phase3_question": serialize_question(next_q) if next_q else None,  # 정답 제거(F)
        })

    # correct_answer 는 제출 '후' 응답에만 — error_find reveal 하이라이트용
    result["correct_answer"] = question.get("answer", "")
    return result


@router.post("/clear")
def endboss_clear(req: ClearRequest, user: dict = Depends(get_current_user)):
    """
    클리어 처리.
    - XP 15,000 지급 (레벨별 1회만)
    - 왕관 15개 지급
    - 캐릭터 진화
    - 칭호 부여
    - endboss_cleared_levels 기록
    """
    user_id = user["id"]

    # 클리어 보상(중복 가드 + 진화 + 칭호 + XP + 미션 boss_clear + seen 리셋)을
    # fresh user 기준으로 원자 처리. endboss_cleared_levels(list append) 와 missions 가
    # save_user delta-merge 에서 last-writer-wins 되던 문제 해소. (M-1, C-1 deferred)
    def mutator(u: dict) -> dict:
        level           = u.get("course_level", "beginner")
        cleared_levels  = u.get("endboss_cleared_levels", [])
        already_cleared = level in cleared_levels
        newly_earned_titles = []

        if not already_cleared:
            # 왕관
            u["crowns"] = u.get("crowns", 0) + CLEAR_CROWNS

            # 캐릭터 진화 (현재 캐릭터보다 등급이 높은 경우에만 덮어씀)
            new_char = CLEAR_CHARACTER.get(level)
            if new_char:
                char_rank = {"slime": 1, "robot": 2, "speech_bubble": 3, "final_ghost": 4}
                current_char = u.get("character", "slime")
                if char_rank.get(new_char, 1) > char_rank.get(current_char, 1):
                    u["character"] = new_char

            # 칭호
            title_id, title_name = CLEAR_TITLES.get(level, ("rookie_coder", "코드 ROOKIE"))
            earned = set(u.get("titles", []))
            if title_id not in earned:
                earned.add(title_id)
                u["titles"] = list(earned)
                newly_earned_titles.append({"id": title_id, "name": title_name})

            # XP 적용 및 기타 칭호 부여 (+ 미션 boss_clear 훅)
            events = apply_xp(u, CLEAR_XP, {"boss_cleared": True}, event_type="boss_clear")
            newly_earned_titles.extend(events["newly_earned_titles"])

            # cleared_levels 기록
            cleared_levels.append(level)
            u["endboss_cleared_levels"] = cleared_levels

            # seen 리셋
            if "seen_questions" not in u or u["seen_questions"] is None:
                u["seen_questions"] = {}
            u["seen_questions"]["endboss"] = []

        return {
            "already_cleared": already_cleared,
            "newly_earned_titles": newly_earned_titles,
        }

    try:
        user, result = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    already_cleared = result["already_cleared"]
    return {
        "already_cleared":    already_cleared,
        "xp_awarded":         0 if already_cleared else CLEAR_XP,
        "crowns_awarded":     0 if already_cleared else CLEAR_CROWNS,
        "lv":                 user.get("lv", 1),
        "newly_earned_titles": result["newly_earned_titles"],
        "cleared_levels":     user.get("endboss_cleared_levels", []),
    }
