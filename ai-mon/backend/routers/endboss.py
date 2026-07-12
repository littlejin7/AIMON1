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
import json, os, uuid, re
from typing import Optional

from routers.utils import (
    limiter,
    get_current_user,
    grant_reward,
    mutate_user_atomic,
    save_attempt_item,
    now_kst,
    UserNotFoundError,
    promote_course_level_from_endboss,
    derive_unlocked_course_levels,
    COURSE_LEVEL_ORDER,
    get_evolution_stage,
    character_for_stage,
    current_week_ranking_score,
)
from routers.quiz import serialize_question
from routers.battle_session import (
    make_battle_token,
    verify_battle_token,
    create_endboss_session,
    apply_endboss_answer,
    get_endboss_session,
    consume_session,
)

router = APIRouter()

MODE = "endboss"   # 배틀 토큰/세션 모드 식별자 (start/answer/clear 공통)

ENDBOSS_DIR    = os.path.join(os.path.dirname(__file__), "../data/endboss")

# ── 재도전 비용 ──────────────────────────────────────────────────────────────
RETRY_CROWN_COST = 3

# ── HP 설정 (Phase 1~2 전용) ──────────────────────────────────────────────────
BOSS_HP_INIT   = 1400
MY_HP_INIT     = 1200
BOSS_HP_DELTA  = 200   # 정답 시 보스 HP 감소
MY_HP_DELTA    = 400   # 오답 시 내 HP 감소

# ── Phase 3 최대 시도 횟수 ────────────────────────────────────────────────────
PHASE3_MAX_TRIES = 3

# ── 보상 ─────────────────────────────────────────────────────────────────────
# 엔드보스 클리어 보상 단위(coin=ranking 동일값). 보스는 GP 를 지급하지 않으므로
# gp_delta 는 항상 0. [임시 밸런스] 이 상수만 조정하면 지급액을 바꿀 수 있다.
BOSS_CLEAR_REWARD = 15000
CLEAR_CROWNS  = 15

CLEAR_TITLES = {
    "beginner":     ("rookie_coder",  "코드 ROOKIE"),
    "intermediate": ("ace_coder",     "ACE 코더"),
    "advanced":     ("ai_master",     "AI 마스터"),
}

# 엔드보스 클리어 = 진화 트리거. 레벨별 도달 진화 단계(evolution_stage).
# 초급→1, 중급→2, 고급→3. character 는 evolution_stage 에서 파생한다.
# (기존 CLEAR_CHARACTER 직접 대입을 evolution_stage 파생으로 대체)
CLEAR_EVOLUTION_STAGE = {
    "beginner":     1,
    "intermediate": 2,
    "advanced":     3,
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

def resolve_level(user: dict, target_level: Optional[str]) -> str:
    """도전할 레벨을 결정한다.

    - target_level 미지정(None/빈값) → 계정 course_level 을 그대로 사용하고 추가
      해금 게이트를 적용하지 않는다. 기존(단일 레벨) 동작을 100% 보존하기 위함.
      (레벨테스트로 course_level 만 앞선 유저의 기존 응답을 바꾸지 않는다.)
    - target_level 명시 → 값 검증 + '선택 가능 레벨(endboss_selectable_levels)'
      게이트를 적용한다. 선택 불가한 레벨을 요청하면 403.
    """
    if not target_level:
        return user.get("course_level", "beginner")
    if target_level not in ("beginner", "intermediate", "advanced"):
        raise HTTPException(status_code=400, detail="잘못된 레벨입니다.")
    if target_level not in endboss_selectable_levels(user):
        raise HTTPException(status_code=403, detail="해금되지 않은 레벨입니다.")
    return target_level


def is_endboss_unlocked(user: dict, level: str) -> bool:
    """주어진 레벨 엔드보스 진입 가능 여부.

    배치 레벨(course_level)보다 낮은 티어 = 레벨테스트로 통과한 '인정' 구간이므로
    해당 레벨 유닛 진행과 무관하게 직행 진입을 허용한다(사다리 하위칸). 그 외(현재
    진행 티어 이상)는 기존 게이트 그대로 그 레벨 Unit 8 보스 클리어를 요구한다.
    """
    cleared = user.get("endboss_cleared_levels")
    if isinstance(cleared, list) and level in cleared:
        return True

    course = user.get("course_level", "beginner")
    if level in COURSE_LEVEL_ORDER and course in COURSE_LEVEL_ORDER:
        if COURSE_LEVEL_ORDER.index(level) < COURSE_LEVEL_ORDER.index(course):
            return True
    unlocked = user.get("max_unlocked_unit", {})
    if isinstance(unlocked, dict):
        return unlocked.get(level, 1) > 8
    return int(unlocked) > 8


def endboss_selectable_levels(user: dict) -> list:
    """엔드보스 사다리에서 '선택 가능(칩 노출 + resolve_level 통과)'한 레벨 목록.

    = 클리어 이력 기반 해금(derive_unlocked_course_levels) ∪ course_level 이하(배치 바닥선).
    - 'L in base' 절 유지: 레벨테스트 재응시 등으로 course_level 이 클리어 이력보다 낮아진
      엣지에서도, 실제로 깬 상위 레벨이 목록에서 사라지지 않도록 방어한다.
    - course_level 바닥선은 여기서만 얹는다. derive_unlocked_course_levels(언락 SSOT=
      보스 클리어 이력) 와 커리큘럼 전환 로직은 오염시키지 않는다.
    """
    base = set(derive_unlocked_course_levels(user))
    course = user.get("course_level", "beginner")
    ci = COURSE_LEVEL_ORDER.index(course) if course in COURSE_LEVEL_ORDER else 0
    return [L for L in COURSE_LEVEL_ORDER
            if L in base or COURSE_LEVEL_ORDER.index(L) <= ci]


def endboss_level_status(user: dict, level: str) -> dict:
    """사다리 UI용 레벨별 상태.

    cleared(최우선) > recognized(인정·직행) / current(현재목표) / locked(잠김).
    """
    cleared = user.get("endboss_cleared_levels") or []
    if level in cleared:
        return {"level": level, "status": "cleared", "enterable": True}

    course = user.get("course_level", "beginner")
    li = COURSE_LEVEL_ORDER.index(level) if level in COURSE_LEVEL_ORDER else 0
    ci = COURSE_LEVEL_ORDER.index(course) if course in COURSE_LEVEL_ORDER else 0
    if li < ci:
        return {"level": level, "status": "recognized", "enterable": True}
    if li == ci:
        return {"level": level, "status": "current", "enterable": is_endboss_unlocked(user, level)}
    return {"level": level, "status": "locked", "enterable": False}

def get_phase_questions(all_qs: list, phase: int, project: str) -> list:
    """특정 phase + project 의 문제만 필터링해서 순서대로 반환."""
    return [q for q in all_qs if q.get("phase") == phase and q.get("project") == project]

def pick_unseen(pool: list, seen: list) -> Optional[dict]:
    """seen에 없는 문제 중 첫 번째 반환. 전부 소진 시 None."""
    for q in pool:
        if q["question_id"] not in seen:
            return q
    return None


def _seen_key(level: str, project: str) -> str:
    return f"endboss_{level}_{project}"


def _phase12_seen_key(level: str, project: str, phase: int) -> str:
    """Phase1/2 전용 서브키. phase3 seen(_seen_key)과 별도 저장해 충돌을 막는다."""
    return f"endboss_p{phase}_{level}_{project}"


def pick_batch_unseen(pool: list, seen: list, count: int) -> tuple[list, list]:
    """원본 데이터 순서대로 count개 선택.
    Phase 1/2 엔드보스는 고정된 문제 순서를 유지한다.
    반환: (선택된 문제 리스트, 갱신된 seen id 리스트)."""
    chosen = list(pool)[:count]
    new_seen = seen + [q["question_id"] for q in chosen]
    return chosen, new_seen


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
    target_level: Optional[str] = None   # 미지정 시 계정 course_level 사용(하위호환)

class AnswerRequest(BaseModel):
    question_id: str
    user_answer:  str = Field(..., max_length=4000)
    phase:        int          # 1 | 2 | 3
    battle_token: str          # /start 에서 발급. 서버 세션 식별·검증(HP/페이즈 권위).
    project:      str = ""
    target_level: Optional[str] = None   # 미지정 시 계정 course_level 사용(하위호환)
    # my_hp/boss_hp/phase3_tries 는 더 이상 받지 않는다(클라 권위 제거) — 응답 HP·시도수는
    # 서버 세션에서 파생한다. (하위호환: 클라가 보내도 무시)
    my_hp:        int = MY_HP_INIT
    boss_hp:      int = BOSS_HP_INIT
    phase3_tries: int = 0

class ClearRequest(BaseModel):
    project: str
    # 신규 클리어엔 필수(status=="won" 검증용). 이미 클리어한 레벨의 멱등 재호출은
    # 세션 없이도 통과하므로 Optional 로 둔다.
    battle_token: Optional[str] = None
    target_level: Optional[str] = None   # 미지정 시 계정 course_level 사용(하위호환)


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get("/info")
def endboss_info(target_level: Optional[str] = None, user: dict = Depends(get_current_user)):
    """해금 여부 + 왕관 수 + 이미 클리어한 레벨 반환."""
    level = resolve_level(user, target_level)
    cleared_levels = user.get("endboss_cleared_levels")
    if not isinstance(cleared_levels, list):
        cleared_levels = []
    return {
        "is_unlocked":      is_endboss_unlocked(user, level),
        "crowns":           user.get("crowns", 0),
        "retry_cost":       RETRY_CROWN_COST,
        "cleared_levels":   cleared_levels,
        "already_cleared":  level in cleared_levels,
        "course_level":     level,
        "unlocked_levels":  derive_unlocked_course_levels(user),
        "levels":           [endboss_level_status(user, L) for L in COURSE_LEVEL_ORDER],
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

    level = resolve_level(user, req.target_level)

    if not is_endboss_unlocked(user, level):
        raise HTTPException(status_code=403, detail="엔드보스가 아직 해금되지 않았습니다. Unit 8 보스를 먼저 클리어하세요.")

    # 문제 로드/풀 검증은 유저 상태 무관 → 원자 경계 밖에서 먼저 (실패해도 왕관 차감 없음).
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
    if len(phase3_pool) < PHASE3_MAX_TRIES:
        raise HTTPException(status_code=404, detail="엔드보스 문제 데이터가 부족합니다. 잠시 후 다시 시도해주세요.")

    # 배틀 토큰(sid)은 서버 발급 nonce → 위조 불가. HP·페이즈·승리는 서버 세션에만 쌓인다.
    token, sid = make_battle_token(MODE, None, level, user_id)

    # ── 왕관 가드+차감 / 문제 선택 / seen 갱신 / 세션 생성을 한 임계구역에서 (CLAUDE.md §1·§3) ──
    # 왕관 검사→차감을 fresh user 기준 같은 락 안에서 수행 → 동시 진입에도 TOCTOU 이중차감/우회 없음.
    # 가드 미통과 시 HTTPException raise → mutate_user_atomic 이 write 없이 no-op(차감 안 됨) 로 중단.
    p1_key = _phase12_seen_key(level, req.project, 1)
    p2_key = _phase12_seen_key(level, req.project, 2)
    p3_key = _seen_key(level, req.project)

    def mutator(u: dict) -> dict:
        if u.get("crowns", 0) < RETRY_CROWN_COST:
            raise HTTPException(status_code=400, detail=f"왕관이 부족합니다. 엔드보스 도전에는 왕관 {RETRY_CROWN_COST}개가 필요합니다.")
        u["crowns"] = u.get("crowns", 0) - RETRY_CROWN_COST

        if "seen_questions" not in u or u["seen_questions"] is None:
            u["seen_questions"] = {}
        seen_qs = u["seen_questions"]

        # Phase 1, 2 문제 확정 — JSON 원본 순서 고정.
        p1_questions, p1_seen = pick_batch_unseen(phase1_pool, seen_qs.get(p1_key, []), 5)
        p2_questions, p2_seen = pick_batch_unseen(phase2_pool, seen_qs.get(p2_key, []), 4)
        seen_qs[p1_key] = p1_seen
        seen_qs[p2_key] = p2_seen

        # Phase 3 첫 문제 확정 + seen 기록 (phase1/2 서브키와 분리된 phase3 전용 키)
        p3_first = phase3_pool[0] if phase3_pool else None
        p3_seen = seen_qs.get(p3_key, [])
        if p3_first:
            p3_seen = p3_seen + [p3_first["question_id"]]
        seen_qs[p3_key] = p3_seen
        seen_qs["endboss"] = p3_seen
        u["seen_questions"] = seen_qs

        # 서버 권위 세션 생성: phase1~2 HP 게이트 → phase3 정답으로만 status="won".
        create_endboss_session(u, sid, level, req.project, BOSS_HP_INIT, MY_HP_INIT, PHASE3_MAX_TRIES)

        return {
            "p1_questions": p1_questions,
            "p2_questions": p2_questions,
            "p3_first": p3_first,
            "crowns_left": u["crowns"],
        }

    try:
        user, result = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "phase":               1,
        "project":             req.project,
        "battle_token":        token,
        "phase1_questions":    [serialize_question(q) for q in result["p1_questions"]],   # 정답 제거(F)
        "phase2_questions":    [serialize_question(q) for q in result["p2_questions"]],   # 정답 제거(F)
        "phase3_first_question": serialize_question(result["p3_first"]) if result["p3_first"] else None,
        "my_hp":               MY_HP_INIT,
        "boss_hp":             BOSS_HP_INIT,
        "crowns_left":         result["crowns_left"],
    }


@router.post("/answer")
@limiter.limit("30/minute;1000/day")
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

    # 배틀 토큰 검증(서명·소유자·모드·만료) — 상태 무관이므로 원자 경계 밖에서 먼저.
    payload = verify_battle_token(req.battle_token, user_id, MODE)

    level  = resolve_level(user, req.target_level)
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
        if q_type == "code_multi_input":
            template = question.get("code_template", "")
            answers = question.get("answer", [])
            if not isinstance(answers, list):
                answers = [answers]

            # 정답 slot 줄 추출: slot이 있는 줄의 들여쓰기 제거 후 정답 조합
            correct_code_full = template
            for i, ans in enumerate(answers):
                correct_code_full = correct_code_full.replace(f"{{slot{i+1}}}", str(ans))

            def clean(c):
                return "".join(c.split())

            # 단일 라인 입력 방식: slot줄만 추출해서 비교
            lines = template.split("\n")
            slot_line_idx = next(
                (i for i, line in enumerate(lines) if re.search(r"\{slot\d+\}", line)),
                None
            )
            if slot_line_idx is not None:
                correct_line = correct_code_full.split("\n")[slot_line_idx].strip()
                user_stripped = req.user_answer.strip()
                # 단일 라인 비교 우선, 전체 코드 비교 하위 호환
                is_correct = (clean(user_stripped) == clean(correct_line)
                              or clean(req.user_answer) == clean(correct_code_full))
            else:
                is_correct = clean(req.user_answer) == clean(correct_code_full)
        else:
            is_correct = direct_grade(req.user_answer, question.get("answer", ""), q_type)
            
        fb = question.get("feedback", {}) or {}
        fb_text = fb.get("correct", "") if is_correct else (fb.get("incorrect") or fb.get("wrong") or "")
        result  = {
            "is_correct": is_correct,
            "grading_failed": False,
            "score":      100 if is_correct else 0,
            "feedback":   fb_text,
            "hint":       "" if is_correct else question.get("hint", ""),
            "explanation": question.get("explanation", ""),
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

    # ── 서버 권위 세션 갱신 (클라 my_hp/boss_hp/phase3_tries 불신) ──────────────
    # HP·페이즈·승리 판정은 모두 서버 세션이 소유한다. 클라가 boss_hp=200 등을 위조해도
    # 서버 세션 카운트만 쓰므로 무의미하다. phase3 승리(status="won")만 /clear 보상을 연다.
    grading_failed = result.get("grading_failed", False)
    qid = question.get("question_id")

    if grading_failed:
        # 채점 실패: 세션 변경 없음 — 표시용은 현재 스냅샷에서 읽는다.
        view = get_endboss_session(user, payload["sid"]) or {
            "boss_hp": BOSS_HP_INIT, "my_hp": MY_HP_INIT, "correct": 0,
            "phase3_tries": 0, "phase3_unlocked": False, "status": "active",
        }
        next_q = None
    else:
        # phase3 오답 시 다음 문제 출제용 풀(seen 중복 없이). phase1~2 엔 불필요.
        phase3_pool = get_phase_questions(all_qs, phase=3, project=req.project) if req.phase == 3 else []

        def mutator(u: dict) -> dict:
            v = apply_endboss_answer(
                u, payload, qid, req.phase, is_correct,
                boss_hp_delta=BOSS_HP_DELTA, my_hp_delta=MY_HP_DELTA,
            )
            nq = None
            # phase3 오답이고 아직 패배(lost)가 아니면 다음 phase3 문제 출제 + seen 기록.
            if req.phase == 3 and not is_correct and v["status"] != "lost":
                if "seen_questions" not in u or u["seen_questions"] is None:
                    u["seen_questions"] = {}
                seen_questions = u["seen_questions"]
                key = _seen_key(level, req.project)
                seen = seen_questions.get(key)
                if not isinstance(seen, list):
                    seen = seen_questions.get("endboss", [])
                nq = pick_unseen(phase3_pool, seen)
                if not nq:
                    seen = [qid]
                    nq = pick_unseen(phase3_pool, seen)
                if nq:
                    next_seen = seen + [nq["question_id"]]
                    seen_questions[key] = next_seen
                    seen_questions["endboss"] = next_seen
                    u["seen_questions"] = seen_questions
            return {"view": v, "next_q": nq}

        try:
            user, mres = mutate_user_atomic(user_id, mutator)
        except UserNotFoundError:
            raise HTTPException(status_code=404, detail="User not found")
        view   = mres["view"]
        next_q = mres["next_q"]

    is_clear = (view["status"] == "won")  if not grading_failed else False
    is_fail  = (view["status"] == "lost") if not grading_failed else False
    # phase3_ready: 이번 정답으로 phase1~2 게이트(boss_hp<=0)를 막 통과한 순간에만 True.
    phase3_ready = (not grading_failed) and req.phase in (1, 2) and is_correct and view["boss_hp"] <= 0

    result.update({
        "my_hp":        view["my_hp"],
        "boss_hp":      view["boss_hp"],
        "is_fail":      is_fail,
        "phase3_ready": phase3_ready,
        "phase3_tries": view["phase3_tries"],
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
    - coin·ranking_score 15,000 지급 (레벨별 1회만, xp 신규 지급 중단)
    - 왕관 15개 지급
    - 진화: evolution_stage 증가(초급→1/중급→2/고급→3), character 는 파생. 강등 방지.
    - GP 는 지급하지 않음 (gp_delta 항상 0)
    - 칭호 부여
    - endboss_cleared_levels 기록
    """
    user_id = user["id"]

    # 도전 레벨 결정(target_level 미지정 시 course_level). 검증/해금 게이트는
    # 임계구역 밖에서 1회만 — mutator 는 CAS 로 여러 번 실행될 수 있으므로.
    level = resolve_level(user, req.target_level)

    # 배틀 토큰 검증(서명·소유자·모드·만료) — 상태 무관이므로 원자 경계 밖에서 먼저.
    # 이미 클리어한 레벨의 멱등 재호출은 토큰 없이도 통과하므로, 있을 때만 검증한다.
    sid = None
    if req.battle_token:
        payload = verify_battle_token(req.battle_token, user_id, MODE)
        sid = payload.get("sid")

    # 클리어 보상(중복 가드 + 진화 + 칭호 + XP + 미션 boss_clear + seen 리셋)을
    # fresh user 기준으로 원자 처리. endboss_cleared_levels(list append) 와 missions 가
    # save_user delta-merge 에서 last-writer-wins 되던 문제 해소. (M-1, C-1 deferred)
    def mutator(u: dict) -> dict:
        cleared_levels  = u.get("endboss_cleared_levels") or []
        already_cleared = level in cleared_levels
        newly_earned_titles = []
        reward = {"coin_delta": 0, "gp_delta": 0, "ranking_score_delta": 0}
        from_stage = get_evolution_stage(u)
        to_stage   = from_stage

        if not already_cleared:
            # ★ 서버 권위 클리어 게이트: 신규 클리어는 서버 세션 status=="won"(=phase3 를
            #   실제로 맞혀 승리)일 때만 허용한다. /answer 없이 /clear 를 직접 호출하면 세션이
            #   없거나 active/lost 라 403 으로 차단된다(보상 탈취 방어 — P0). 이미 클리어한
            #   레벨은 위 already_cleared 로 세션 없이도 멱등 성공한다.
            view = get_endboss_session(u, sid) if sid else None
            if not view or view["status"] != "won":
                raise HTTPException(status_code=403, detail="엔드보스를 실제로 물리쳐야 클리어할 수 있습니다.")
            # 세션의 레벨/프로젝트가 요청과 일치하는지 확인 (다른 레벨 승리 세션 재사용 차단).
            if view.get("level") != level or view.get("project") != req.project:
                raise HTTPException(status_code=403, detail="이 전투의 클리어 대상이 일치하지 않습니다.")

            # 왕관
            u["crowns"] = u.get("crowns", 0) + CLEAR_CROWNS

            # 진화: 엔드보스 클리어가 유일한 트리거. evolution_stage 를 올린다.
            #   초급→1 / 중급→2 / 고급→3. max() 로 강등 방지(하위 레벨 재클리어 시 유지).
            #   character 는 evolution_stage 에서 파생(character_for_stage).
            target_stage = CLEAR_EVOLUTION_STAGE.get(level, from_stage)
            to_stage = max(from_stage, target_stage)
            if to_stage != from_stage:
                u["evolution_stage"] = to_stage
                u["character"] = character_for_stage(to_stage)
            else:
                # 이미 같거나 상위 단계 — 단계는 유지하되 필드를 명시적으로 보존.
                u["evolution_stage"] = to_stage

            # 칭호
            title_id, title_name = CLEAR_TITLES.get(level, ("rookie_coder", "코드 ROOKIE"))
            earned = set(u.get("titles") or [])
            if title_id not in earned:
                earned.add(title_id)
                u["titles"] = list(earned)
                newly_earned_titles.append({"id": title_id, "name": title_name})

            # 보상: coin + ranking_score 분리 발급(xp 신규 지급 중단). 진화는 위
            # evolution_stage 로만 발생하고, 보스 클리어는 gp 를 지급하지 않는다(gp_delta=0).
            # grant_reward 가 칭호·미션 boss_clear 훅(apply_xp(0))을 함께 굴린다.
            rr = grant_reward(
                u,
                coin_delta=BOSS_CLEAR_REWARD,
                ranking_score_delta=BOSS_CLEAR_REWARD,
                gp_delta=0,
                context={"boss_cleared": True},
                event_type="boss_clear",
            )
            reward = {"coin_delta": rr["coin_delta"], "gp_delta": rr["gp_delta"],
                      "ranking_score_delta": rr["ranking_score_delta"]}
            newly_earned_titles.extend(rr["events"]["newly_earned_titles"])

            # cleared_levels 기록
            cleared_levels.append(level)
            u["endboss_cleared_levels"] = cleared_levels
            promote_course_level_from_endboss(u)

            # seen 리셋
            if "seen_questions" not in u or u["seen_questions"] is None:
                u["seen_questions"] = {}
            u["seen_questions"]["endboss"] = []

            # 보상 후 세션 소비 — 같은 won 세션으로 재클리어(리플레이) 차단.
            consume_session(u, sid)

        return {
            "already_cleared": already_cleared,
            "newly_earned_titles": newly_earned_titles,
            "reward": reward,
            "from_stage": from_stage,
            "to_stage": to_stage,
        }

    try:
        user, result = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    already_cleared = result["already_cleared"]
    return {
        "already_cleared":    already_cleared,
        # 진화(성공) 정보를 보상보다 앞에 둔다 — 프론트 표시 우선순위(진화 연출 우선) 대비.
        "evolution": {
            "evolved":    result["to_stage"] > result["from_stage"],
            "from_stage": result["from_stage"],
            "to_stage":   result["to_stage"],
        },
        "reward": result["reward"],   # {coin_delta, gp_delta:0, ranking_score_delta}
        "user_state": {
            "coin_balance": user.get("coin_balance", 0),
            "gp": user.get("gp", 0),
            "lv": user.get("lv", 1),
            "evolution_stage": get_evolution_stage(user),
            "ranking_score": user.get("ranking_score", 0),
            "weekly_ranking_score": current_week_ranking_score(user),
            "crowns": user.get("crowns", 0),
        },
        # ── 하위호환 표기 필드(프론트 전환 전) ──
        "xp_awarded":         0 if already_cleared else BOSS_CLEAR_REWARD,
        "crowns_awarded":     0 if already_cleared else CLEAR_CROWNS,
        "gp_delta":           0,   # 보스 클리어 보상으로 GP 는 지급하지 않는다(항상 0).
        "lv":                 user.get("lv", 1),
        "evolution_stage":    get_evolution_stage(user),
        "character":          user.get("character", "slime"),
        "newly_earned_titles": result["newly_earned_titles"],
        "cleared_levels":     user.get("endboss_cleared_levels") or [],
    }
