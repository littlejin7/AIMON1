"""
엔드보스 (Endboss) 라우터
기획서: ENDBOSS_DESIGN.md

엔드포인트:
  GET  /boss/endboss/info      해금 여부 + 왕관 수 조회
  POST /boss/endboss/start     배틀 시작 (왕관 3개 차감, Phase 1 문제 5개 반환)
  POST /boss/endboss/answer    답안 제출 → HP 계산 / 페이즈 전환 / Phase 3 카운트
  POST /boss/endboss/clear     클리어 처리 (XP + 왕관 + 진화 + 칭호, 중복 방지)
"""

from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel
from services.claude_service import ask_claude_json
from routers.titles import check_and_award_titles
import json, os, random
from typing import Optional

from routers.utils import (
    calc_level,
    load_users,
    save_users,
    verify_token,
    limiter,
)

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
    user_answer:  str
    phase:        int          # 1 | 2 | 3
    my_hp:        int = MY_HP_INIT
    boss_hp:      int = BOSS_HP_INIT
    phase3_tries: int = 0      # Phase 3 현재 시도 횟수 (0-based)
    project:      str = ""

class ClearRequest(BaseModel):
    project: str


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get("/info")
def endboss_info(authorization: str = Header(...)):
    """해금 여부 + 왕관 수 + 이미 클리어한 레벨 반환."""
    user_id = verify_token(authorization)
    users   = load_users()
    user    = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

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
def endboss_start(req: StartRequest, authorization: str = Header(...)):
    """
    배틀 시작.
    - 왕관 3개 차감
    - 선택한 프로젝트의 Phase 1 문제 5개 + Phase 2 문제 4개 순서대로 반환
    - Phase 3 첫 문제도 함께 반환 (phase3_first_question)
    """
    user_id = verify_token(authorization)
    users   = load_users()
    user    = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

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
    save_users(users)

    return {
        "phase":               1,
        "project":             req.project,
        "phase1_questions":    p1_questions,
        "phase2_questions":    p2_questions,
        "phase3_first_question": p3_first,
        "my_hp":               MY_HP_INIT,
        "boss_hp":             BOSS_HP_INIT,
        "crowns_left":         user["crowns"],
    }


@router.post("/answer")
@limiter.limit("5/minute;100/day")
async def endboss_answer(request: Request, req: AnswerRequest, authorization: str = Header(...)):
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
    user_id = verify_token(authorization)
    users   = load_users()
    user    = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

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

        prompt = f"""당신은 파이썬을 가르치는 전문 AI 튜터 '에이몬'입니다.
다음 코딩 문제에 대한 사용자의 코드를 다각도에서 분석하고 채점해주세요.
{advanced_note}
[출력 형식 제한]
반드시 아래 JSON 포맷으로만 응답하고, 마크다운 코드 블록(` ```json `)이나 추가 텍스트를 포함하지 마세요.

[문제 정보]
문제: {question['question']}
정답 예시: {question.get('answer', '')}
사용자 답변: {req.user_answer}

{{
  "is_correct": true/false,
  "score": 0~100,
  "feedback": "코드의 잘된 점과 부족한 점, 개선 방향에 대한 구체적인 피드백 (한국어, 3-4문장)",
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

    # ── Phase 1 / 2 HP 계산 ───────────────────────────────────────────────────
    if req.phase in (1, 2):
        safe_boss_hp = max(0, min(req.boss_hp, BOSS_HP_INIT))
        safe_my_hp   = max(0, min(req.my_hp, MY_HP_INIT))

        if is_correct:
            new_boss_hp = safe_boss_hp - BOSS_HP_DELTA
            new_my_hp   = safe_my_hp
        else:
            new_boss_hp = safe_boss_hp
            new_my_hp   = safe_my_hp - MY_HP_DELTA

        is_fail       = new_my_hp <= 0
        phase3_ready  = (not is_fail) and (new_boss_hp <= 0)

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
                save_users(users)

        result.update({
            "my_hp":        req.my_hp,
            "boss_hp":      0,
            "is_fail":      is_fail,
            "phase3_ready": False,
            "phase3_tries": new_tries,
            "is_clear":     is_clear,
            "next_phase3_question": next_q,
        })

    return result


@router.post("/clear")
def endboss_clear(req: ClearRequest, authorization: str = Header(...)):
    """
    클리어 처리.
    - XP 15,000 지급 (레벨별 1회만)
    - 왕관 15개 지급
    - 캐릭터 진화
    - 칭호 부여
    - endboss_cleared_levels 기록
    """
    user_id = verify_token(authorization)
    users   = load_users()
    user    = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    level           = user.get("course_level", "beginner")
    cleared_levels  = user.get("endboss_cleared_levels", [])
    already_cleared = level in cleared_levels
    newly_earned_titles = []

    if not already_cleared:
        # XP
        user["xp"] = user.get("xp", 0) + CLEAR_XP

        # 레벨 재계산

        user["lv"] = max(calc_level(user["xp"]), user.get("lv", 1))

        # 왕관
        user["crowns"] = user.get("crowns", 0) + CLEAR_CROWNS

        # 캐릭터 진화 (현재 캐릭터보다 등급이 높은 경우에만 덮어씀)
        new_char = CLEAR_CHARACTER.get(level)
        if new_char:
            char_rank = {"slime": 1, "robot": 2, "speech_bubble": 3, "final_ghost": 4}
            current_char = user.get("character", "slime")
            if char_rank.get(new_char, 1) > char_rank.get(current_char, 1):
                user["character"] = new_char

        # 칭호
        title_id, title_name = CLEAR_TITLES.get(level, ("rookie_coder", "코드 ROOKIE"))
        earned = set(user.get("titles", []))
        if title_id not in earned:
            earned.add(title_id)
            user["titles"] = list(earned)
            newly_earned_titles.append({"id": title_id, "name": title_name})

        # boss_cleared 및 completed_stages 카운트 user에 저장
        user["boss_cleared"] = user.get("boss_cleared", 0) + 1
        user["completed_stages"] = user.get("completed_stages", 0) + 1

        # 기타 칭호 체크
        context_titles = check_and_award_titles(user, {"boss_cleared": True})
        newly_earned_titles.extend(context_titles)

        # cleared_levels 기록
        cleared_levels.append(level)
        user["endboss_cleared_levels"] = cleared_levels

        # seen 리셋
        if "seen_questions" not in user or user["seen_questions"] is None:
            user["seen_questions"] = {}
        user["seen_questions"]["endboss"] = []

        save_users(users)

    return {
        "already_cleared":    already_cleared,
        "xp_awarded":         0 if already_cleared else CLEAR_XP,
        "crowns_awarded":     0 if already_cleared else CLEAR_CROWNS,
        "lv":                 user.get("lv", 1),
        "newly_earned_titles": newly_earned_titles,
        "cleared_levels":     user.get("endboss_cleared_levels", []),
    }
