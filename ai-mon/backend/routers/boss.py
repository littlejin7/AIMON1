from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from services.claude_service import ask_claude_json
import os, random, uuid
from datetime import datetime, timedelta
from typing import Optional
from routers.utils import (
    save_user,
    get_progress_by_user,
    save_progress_item,
    save_wrong_answer_item,
    save_attempt_item,
    now_kst,
    get_current_user,
    grant_reward,
    get_evolution_stage,
    current_week_ranking_score,
    limiter,
    mutate_user_atomic,
    UserNotFoundError,
)
from routers.titles import check_and_award_titles
from routers.quiz import load_questions_by_category, assert_boss_access, serialize_question
from routers.battle_session import (
    make_battle_token,
    verify_battle_token,
    create_session,
    apply_answer,
    get_session,
)

router = APIRouter()

MODE = "unitboss"


class BossHintRequest(BaseModel):
    question_id: str
    user_answer: str = Field("", max_length=4000)

class BossAnswerRequest(BaseModel):
    question_id: str
    user_answer: str = Field(..., max_length=4000)
    battle_token: str                       # /start 에서 발급. 서버 세션 식별·검증.
    is_code_question: bool = False
    unit: Optional[int] = None
    # wrong_count/my_hp/boss_hp 는 더 이상 받지 않는다(클라 권위 제거). 누적은 서버 세션이 소유.

# 서버 측 HP 고정 상수 – 표시용. 클리어 판정 권한은 서버 세션(정답 누적)에 있다.
BOSS_HP_INIT  = 1000
MY_HP_INIT    = 1000
BOSS_HP_DELTA = 200   # 정답 시 보스 HP 감소 (5번 맞추면 클리어)
MY_HP_DELTA   = -(-MY_HP_INIT // 3)       # ceil(MY_HP_INIT/3) = 334: 3오답에 HP 정확히 0

# 서버 권위 클리어 조건 (HP 상수에서 파생)
REQUIRED_CORRECT = BOSS_HP_INIT // BOSS_HP_DELTA   # 5 (정답 누적 도달 시 승리)
MAX_WRONG        = 3                                # 오답 누적 도달 시 패배

# 유닛보스 클리어 보상 단위(coin=ranking=gp 후보 동일값). gp 는 gp_gate(3차 진화>=3)
# 통과 시에만 실제 지급. [기존 xp 3000 을 coin/ranking 으로 이관]
UNITBOSS_CLEAR_REWARD = 3000


def _display_answer_from_choices(question: dict, answer: str = "") -> str:
    answer = str(answer or "").strip()
    if len(answer) == 1 and answer.upper() in "ABCDE":
        prefix = f"{answer.upper()}."
        for choice in question.get("choices") or []:
            text = str(choice)
            if text.upper().startswith(prefix):
                return text[2:].strip()
    return answer


def _build_static_wrong_feedback(question: dict, correct_answer: str = "") -> str:
    """객관식 계열 오답용 정적 피드백 조립 (LLM 미사용).

    객관식은 직접 매칭으로 이미 오답 확정이므로 LLM 채점이 불필요하다. 피드백 텍스트만
    데이터에서 안전하게 조립해 즉시 반환한다(2~10초 딜레이 제거).
    우선순위: feedback.incorrect > feedback.wrong > explanation > hint > 기본 문구.
    정답 텍스트가 있으면 첫 문장으로 덧붙인다. 필드가 없어도 서버 에러 없이 동작한다.
    """
    fb = question.get("feedback")
    fb = fb if isinstance(fb, dict) else {}
    body = (
        fb.get("incorrect")
        or fb.get("wrong")
        or question.get("explanation")
        or question.get("hint")
        or "다시 한 번 핵심 개념을 확인해보세요."
    )
    body = str(body).strip()
    ca = _display_answer_from_choices(question, correct_answer)
    if ca:
        return f'아쉽지만 정답은 "{ca}"입니다.\n{body}'
    return body


def _pick_unserved_question(pool: list, served_qids: list[str]) -> dict:

    unseen = [q for q in pool if q.get("question_id") not in served_qids]
    if not unseen:
        raise HTTPException(status_code=404, detail="더 이상 출제할 보스 문제가 없습니다.")
    return random.choice(unseen)


def _legacy_served_key(unit_num: int) -> str:
    return f"unitboss_legacy_served_{unit_num}"


def _pre_migration_seen_key(unit_num: int) -> str:
    # 재도전 이력 버그 수정(2026-07) 이전에 쓰이던 구키. 운영 백업(data/backup/*/users.json)의
    # 기존 유저 이력이 여기 쌓여 있으므로, prior_seen 조회 시 이 구키도 합집합으로 읽어
    # 과거 이력을 승계한다(신규 저장은 _legacy_served_key 로만, 점진적 이전).
    return f"unitboss_seen_{unit_num}"




@router.get("/info")
def get_boss_info(unit: str = "1", user: dict = Depends(get_current_user)):
    user_id = user["id"]
        
    # 날짜 체크해서 무료 횟수 리셋
    today = now_kst().strftime("%Y-%m-%d")
    if user.get("last_free_attempt_date") != today:
        user["daily_free_attempts"] = 2
        user["last_free_attempt_date"] = today
        save_user(user)
        
    # 보스 메타데이터 (고정값으로 MVP 구현)
    return {
        "boss_name": f"Unit {unit} 보스",
        "xp_reward": 3000,
        "hints_allowed": 2,
        "crown_cost_from_attempt": 1,
        "free_attempts_per_day": user.get("daily_free_attempts", 2),
        "crowns": user.get("crowns", 5)
    }

@router.post("/start")
def start_boss_battle(unit: str = "1", user: dict = Depends(get_current_user)):
    user_id = user["id"]

    # ── 유저 상태 무관 검증/I/O 는 mutate '밖'에서 먼저 (실패해도 차감 없음) ──
    if unit == "final":
        raise HTTPException(status_code=400, detail="엔드보스는 /boss/endboss/start 를 사용해야 합니다.")

    course_level = user.get("course_level", "beginner")
    category = "unitboss"
    unit_num = int(unit)
    # 진입 게이트: 레벨테스트 완료 + 유닛 해금 + 해당 유닛 모든 스테이지 완료
    assert_boss_access(user, unit_num, course_level)
    boss_qs = load_questions_by_category(category, course_level=course_level, unit=unit_num)
    if not boss_qs:
        raise HTTPException(status_code=404, detail="보스 문제가 없습니다.")

    today = now_kst().strftime("%Y-%m-%d")
    # 배틀 토큰(sid)은 서버 발급 nonce → 위조 불가. 정답 누적은 서버 세션에만 쌓인다.
    token, sid = make_battle_token(MODE, unit_num, None, user_id)

    # ── 진입 비용 차감(무료 우선, 없으면 왕관) + 문제 선택 + 세션 생성을 한 임계구역에서 ──
    # 가드(무료>0 / 왕관>0)와 차감을 fresh user 기준으로 같은 락 안에서 수행 →
    # 동시 진입에도 read→check→write race 없이 정확히 차감/차단. (CLAUDE.md §1·§3)
    # 가드 미통과 시 HTTPException 을 raise 하면 mutate_user_atomic 이 write 없이
    # no-op 로 중단되어(=차감 안 됨) 그대로 전파된다.
    def mutator(u: dict) -> dict:
        # 날짜 바뀌면 무료 횟수 리셋
        if u.get("last_free_attempt_date") != today:
            u["daily_free_attempts"] = 2
            u["last_free_attempt_date"] = today

        if u.get("daily_free_attempts", 0) > 0:
            u["daily_free_attempts"] -= 1
        else:
            if u.get("crowns", 0) <= 0:
                raise HTTPException(status_code=400, detail="왕관이 부족합니다.")
            u["crowns"] -= 1

        if "seen_questions" not in u or u["seen_questions"] is None:
            u["seen_questions"] = {}
        legacy_key = _legacy_served_key(unit_num)
        pre_migration_key = _pre_migration_seen_key(unit_num)
        prior_seen = list(dict.fromkeys(
            u["seen_questions"].get(legacy_key, []) + u["seen_questions"].get(pre_migration_key, [])
        ))
        unseen = [q for q in boss_qs if q.get("question_id") not in prior_seen]
        if not unseen:
            unseen = list(boss_qs)
            prior_seen = []
        chosen = random.choice(unseen)

        # 서버 권위 세션 생성: 정답 누적 REQUIRED_CORRECT(5) 도달 시에만 클리어 허용.
        create_session(u, sid, MODE, unit_num, None, REQUIRED_CORRECT, MAX_WRONG)
        u["battle_sessions"][sid]["served_qids"] = [chosen["question_id"]]
        # 재도전 이력에 누적 저장(덮어쓰기 아님) → 다음 재도전에서 안 본 문제 우선 출제.
        u["seen_questions"][legacy_key] = prior_seen + [chosen["question_id"]]
        return chosen

    try:
        _, chosen = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")
    # 응답: 문제(정답 제거) + 배틀 토큰(프론트가 이후 /answer 마다 동봉).
    return {"question": serialize_question(chosen), "battle_token": token}

@router.post("/next")
def get_next_question(unit: str = "1", battle_token: str | None = None, user: dict = Depends(get_current_user)):
    user_id = user["id"]
    if unit == "final":
        raise HTTPException(status_code=400, detail="엔드보스는 /boss/endboss/next 플로우(phase3)를 사용해야 합니다.")
        
    course_level = user.get("course_level", "beginner")
    category = "unitboss"
    unit_num = int(unit)
    boss_qs = load_questions_by_category(category, course_level=course_level, unit=unit_num)

    if not boss_qs:
        raise HTTPException(status_code=404, detail="보스 문제가 없습니다.")

    if battle_token:
        payload = verify_battle_token(battle_token, user_id, MODE)
        if payload.get("unit") != unit_num:
            raise HTTPException(status_code=400, detail="Battle token unit mismatch")

        def mutator(u: dict) -> dict:
            sessions = u.get("battle_sessions") if isinstance(u.get("battle_sessions"), dict) else {}
            sess = sessions.get(payload["sid"])
            if not sess or sess.get("status") != "active":
                raise HTTPException(status_code=400, detail="전투 세션이 만료되었거나 존재하지 않습니다. 다시 시작해주세요.")

            served = sess.setdefault("served_qids", [])
            chosen = _pick_unserved_question(boss_qs, served)
            served.append(chosen["question_id"])
            sessions[payload["sid"]] = sess
            u["battle_sessions"] = sessions
            return chosen

        try:
            _, chosen = mutate_user_atomic(user_id, mutator)
        except UserNotFoundError:
            raise HTTPException(status_code=404, detail="User not found")
    else:
        legacy_key = _legacy_served_key(unit_num)

        def mutator(u: dict) -> dict:
            if "seen_questions" not in u or u["seen_questions"] is None:
                u["seen_questions"] = {}
            served = u["seen_questions"].get(legacy_key, [])
            try:
                chosen = _pick_unserved_question(boss_qs, served)
            except HTTPException:
                served = []
                chosen = random.choice(boss_qs)
            u["seen_questions"][legacy_key] = served + [chosen["question_id"]]
            return chosen

        try:
            _, chosen = mutate_user_atomic(user_id, mutator)
        except UserNotFoundError:
            raise HTTPException(status_code=404, detail="User not found")
    return serialize_question(chosen)  # 정답 제거(F)


@router.post("/hint")
@limiter.limit("10/minute;100/day")
async def get_boss_hint(request: Request, req: BossHintRequest, user: dict = Depends(get_current_user)):
    user_id = user["id"]
    course_level = user.get("course_level", "beginner")

    questions = load_questions_by_category("unitboss", course_level)
    question = next(
        (q for q in questions if q.get("question_id") == req.question_id or q.get("id") == req.question_id),
        None,
    )
    if not question:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    prompt = f"""당신은 파이썬 튜터 '에이몬'입니다.
다음 문제에 대해 사용자가 요청한 힌트를 제공해주세요.
정답을 직접적으로 알려주지 말고, 어떤 방향으로 접근해야 할지 짧고 명확하게 가이드해주세요. (한국어, 1~2문장)

문제: {question['question']}
현재 사용자가 작성한 답안/코드: {req.user_answer}

JSON 포맷으로 아래와 같이 응답하세요:
{{
  "hint": "힌트 내용"
}}"""
    
    ai_result = await ask_claude_json(prompt)
    return {"hint": ai_result.get("hint", "힌트를 생성할 수 없습니다.")}

@router.post("/answer")
@limiter.limit("30/minute;100/day")
async def submit_boss_answer(request: Request, req: BossAnswerRequest, user: dict = Depends(get_current_user)):
    user_id = user["id"]
    course_level = user.get("course_level", "beginner")

    # 배틀 토큰 검증(서명·소유자·모드·만료) — 상태 무관이므로 원자 경계 밖에서 먼저.
    payload = verify_battle_token(req.battle_token, user_id, MODE)

    questions = load_questions_by_category("unitboss", course_level)
    # 우리 스키마는 "question_id" 필드 사용 ("id" 필드 없음)
    question = next(
        (q for q in questions if q.get("question_id") == req.question_id or q.get("id") == req.question_id),
        None,
    )
    if not question:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    is_unit_boss = question.get("quiz_category") == "unit_boss"
    is_final_boss = question.get("quiz_category") == "final_boss"
    q_type = question.get("type", "")
    correct_answer = str(question.get("answer", "")).strip()
    user_ans = req.user_answer.strip()
    
    level_instruction = ""
    if course_level == "beginner":
        level_instruction = (
            "- 초보자 수준에 맞춰 비유와 일상 예시(예: 리스트 = 서랍장, 변수 = 상자)를 들어 친절하게 설명하고 추상적인 용어는 피하세요.\n"
            "- 단순 오타나 사소한 문법 오류보다는 로직의 큰 틀이 맞으면 정답 처리하되, 설명 시 단순 오타/누락을 가볍게 짚어주며 오답 소거식으로 올바른 답을 유도하세요."
        )
    elif course_level == "intermediate":
        level_instruction = (
            "- 파이썬의 표준(Pythonic) 코드 규칙 및 핵심 자료구조 용어를 명확히 사용하여 설명하세요.\n"
            "- 사용한 자료구조나 내장 함수의 활용 여부를 짚고, 짤막한 코드 흐름을 들어 왜 틀렸는지 핵심 분석을 포함하세요."
        )
    elif course_level == "advanced":
        level_instruction = (
            "- 비동기(async/await), 데코레이터, 메모리 참조 등 파이썬 심화 메커니즘을 중심으로 깊이 있게 설명하세요.\n"
            "- 엣지 케이스 및 예외 처리 방어 코드 검토, 최적화 및 확장성 있는 설계적 리팩터링 방향을 제시하세요."
        )

    # AI 채점 요청
    prompt = f"""당신은 파이썬을 가르치는 전문 AI 튜터 '에이몬'입니다.
다음 문제에 대한 사용자의 답변을 다각도에서 채점하고 피드백해주세요.

[레벨별 평가/피드백 기준: {course_level.upper()}]
{level_instruction}

[중요 지시사항]
- 사용자의 답변이 예시 정답의 기호(예: A, B, C, D)만 입력했거나 내용이 일치한다면 반드시 "is_correct": true 로 채점하세요.
- 오답(is_correct: false)일 시 "feedback" 필드의 내용은 반드시 아래의 '피드백 3문장 형식 규칙'을 엄격하게 준수하여 작성해야 합니다.
- 정답(is_correct: true)일 시 "feedback" 필드의 내용은 칭찬 및 해설을 담은 1~2문장의 격려말로 채우세요.
- 반드시 아래 JSON 포맷으로만 응답하고 추가 텍스트나 마크다운(```json)을 출력하지 마세요.

[피드백 3문장 형식 규칙 (오답일 때 "feedback" 필드에 적용)]
- 첫 번째 문장: 아쉽지만 정답은 "{correct_answer}"입니다. (따옴표 안에 정답 값을 정확히 기입할 것. 이 첫 번째 문장은 글자 수 제한이 없습니다.)
- 두 번째 문장: 왜 오답인지 핵심 개념 설명 (레벨별 기준 반영, **공백 포함 최대 30자 이내**로 극도로 짧게 요약하여 핵심 단어 위주로 작성하세요.)
- 세 번째 문장: 다시 풀 때 볼 기준 (레벨별 기준 반영, **공백 포함 최대 30자 이내**로 극도로 짧게 요약하여 핵심 단어 위주로 작성하세요.)

[문제 정보]
문제 설명: {question['question']}
예시 정답: {correct_answer}

[사용자 답변]
{user_ans}

출력 포맷:
{{
  "is_correct": true/false,
  "score": 0~100 (정수),
  "feedback": "3문장 규칙을 준수한 한국어 피드백",
  "hint": "틀렸을 경우 정답에 도달할 수 있는 핵심 힌트 (맞았으면 빈 문자열)"
}}
"""

    def is_direct_match(user_ans: str, correct: str) -> bool:
        # 완전 일치
        if user_ans == correct:
            return True
        # 선택지 전체 텍스트로 답한 경우 (예: "B. 10 / 끝" → 앞 글자 "B"만 비교)
        if len(user_ans) >= 1 and user_ans[0].upper() == correct.upper():
            return True
        return False

    if q_type == "code_multi_input":
        # Deterministic grading for code_multi_input
        template = question.get("code_template", "")
        correct_code = template
        for i, ans in enumerate(question.get("answer", [])):
            correct_code = correct_code.replace(f"{{slot{i+1}}}", ans)
            
        def clean(c):
            return "".join(c.split())
            
        if clean(user_ans) == clean(correct_code):
            ai_result = {
                "is_correct": True,
                "score": 100,
                "feedback": question.get("feedback", {}).get("correct", "정답입니다! 잘하셨어요."),
                "hint": "",
            }
        else:
            correct_ans = ", ".join(question.get("answer", []))
            hint_text = question.get("hint", "")
            ai_result = {
                "is_correct": False,
                "score": 0,
                "feedback": f"아쉽지만 정답은 \"{correct_ans}\"입니다.\n{hint_text}",
                "hint": hint_text,
                "grading_failed": False,
            }
    elif q_type in ("multiple_choice", "output_select", "error_find"):
        matched = is_direct_match(user_ans, correct_answer)
        if matched:
            ai_result = {
                "is_correct": True,
                "score": 100,
                "feedback": question.get("feedback", {}).get("correct", "정답입니다! 잘하셨어요."),
                "hint": "",
            }
        else:
            # 객관식 계열은 직접 매칭으로 이미 오답 확정 → LLM 호출 없이 정적 피드백 조립.
            # (채점 정책 변경 아님. is_correct=False 확정은 기존과 동일, 딜레이만 제거)
            ai_result = {
                "is_correct": False,
                "score": 0,
                "feedback": _build_static_wrong_feedback(question, correct_answer),
                "hint": question.get("hint", ""),
                "grading_failed": False,
            }
    else:
        # fill_in_blank, code_input
        if user_ans == correct_answer or is_direct_match(user_ans, correct_answer):
            ai_result = {
                "is_correct": True,
                "score": 100,
                "feedback": question.get("feedback", {}).get("correct", "정답입니다! 잘하셨어요."),
                "hint": "",
            }
        else:
            ai_result = await ask_claude_json(prompt)

    grading_failed = ai_result.get("grading_failed", False)
    is_correct = bool(ai_result.get("is_correct", False)) and not grading_failed

    # ── 보상 준비값(서버 세션이 'won' 일 때만 사용) — is_clear 와 무관하게 미리 계산 ──
    # ★ 실제 클리어 판정은 아래 mutator 안에서 '서버 세션 status==won'(=정답 누적이
    #   REQUIRED_CORRECT 도달)으로만 내린다. 클라가 보낸 boss_hp 는 더 이상 쓰지 않으므로
    #   boss_hp=200 위조로 1정답 클리어가 불가능하다(B 어뷰징 방어).
    unit_val  = int(req.unit) if req.unit is not None else int(question.get("unit", 1))
    stage_val = question.get("stage", f"{unit_val}-boss")
    unit_key  = f"{course_level}-{unit_val}"   # 보상 멱등 가드 키
    try:
        next_unit = (int(req.unit) if req.unit is not None
                     else int(question.get("unit")) if question.get("unit") is not None
                     else 1) + 1
    except Exception:
        next_unit = 2

    # progress 레거시 백필 판정용 읽기 — 클리어는 정답에서만 발생하므로 정답일 때만.
    # was_completed_before: 과거 progress 가드로 이미 보상받은 유저를 mutator 안에서
    # 재지급 없이 컬럼만 백필하는 데 쓴다. (완료표시 쓰기는 mutate 이후로 미룸)
    was_completed_before = False
    progress_existing = None
    if is_correct:
        progress = get_progress_by_user(user_id, course_level)
        progress_existing = next(
            (p for p in progress if p["unit"] == unit_val and p["stage"] == stage_val), None
        )
        if progress_existing:
            was_completed_before = progress_existing.get("is_completed", False)

    # ── 세션 카운트 갱신 + 피드백/칭호 + 유닛보스 보상을 한 임계구역에서 원자 처리 ──
    # apply_answer 가 서버 채점 결과로 세션 정답/오답 누적을 올리고 status 를 정한다.
    # 보상은 won 이고 unitboss_cleared_units 가드를 통과할 때만 — '검사→지급→append'
    # 가 같은 락 안에서 멱등. 동시 이중 제출에도 정확히 1회만 지급. (M-1·M-4)
    view = None
    newly_earned_titles = []
    reward_granted = False
    reward_deltas = {"coin_delta": 0, "gp_delta": 0, "ranking_score_delta": 0}
    user_after = user
    if not grading_failed:
        def mutator(u: dict) -> dict:
            v = apply_answer(u, payload, question.get("question_id"), is_correct)
            won = (v["status"] == "won")
            # 피드백 카운트 + 칭호 (채점 성공 시 매 답안)
            u["ai_feedback_count"] = u.get("ai_feedback_count", 0) + 1
            newly = check_and_award_titles(u, {})
            granted = False
            reward = {"coin_delta": 0, "gp_delta": 0, "ranking_score_delta": 0}

            if won and not is_final_boss:
                cleared = u.get("unitboss_cleared_units")
                if not isinstance(cleared, list):
                    cleared = []
                already = unit_key in cleared

                # 유닛 해금은 일회성 보상 가드(already)와 분리 — won 이면 항상 반영한다.
                # 해금이 보상 가드 안에 묶여 있으면, unitboss_cleared_units 가 max_unlocked_unit
                # 보다 앞선 어긋난 상태(데이터 리셋/레거시 백필 등)에서 재클리어해도 해금이
                # 영영 복구되지 않는다. 실제 보상(coin/crown/title)만 아래 already 가드로 멱등 처리.
                if not isinstance(u.get("max_unlocked_unit"), dict):
                    old_val = u.get("max_unlocked_unit", 1)
                    u["max_unlocked_unit"] = {"beginner": old_val, "intermediate": 1, "advanced": 1}
                u["max_unlocked_unit"][course_level] = max(u["max_unlocked_unit"].get(course_level, 1), next_unit)

                # 레거시 백필 (재지급 없이 컬럼만, already 검사로 멱등)
                if not already and was_completed_before:
                    cleared.append(unit_key)
                    u["unitboss_cleared_units"] = cleared
                    already = True

                if not already:
                    if is_unit_boss:
                        if not isinstance(u.get("completed_units"), dict):
                            old_val = u.get("completed_units", 0)
                            u["completed_units"] = {"beginner": old_val, "intermediate": 0, "advanced": 0}
                        u["completed_units"][course_level] = u["completed_units"].get(course_level, 0) + 1

                    context = {"boss_cleared": True}
                    # xp 신규 지급 중단 → coin/ranking 분리 발급. gp 는 gate 통과 시만.
                    rr = grant_reward(
                        u,
                        coin_delta=UNITBOSS_CLEAR_REWARD,
                        ranking_score_delta=UNITBOSS_CLEAR_REWARD,
                        gp_delta=UNITBOSS_CLEAR_REWARD,
                        context=context,
                        event_type="boss_clear",
                    )
                    reward = {
                        "coin_delta": rr["coin_delta"],
                        "gp_delta": rr["gp_delta"],
                        "ranking_score_delta": rr["ranking_score_delta"],
                    }
                    events = rr["events"]

                    title_ids = {t["id"] for t in newly}
                    for t in events["newly_earned_titles"]:
                        if t["id"] not in title_ids:
                            newly.append(t)

                    # crowns 는 기존 흐름 유지(보상 분리와 무관).
                    u["crowns"] = u.get("crowns", 0) + 1

                    cleared.append(unit_key)          # 지급 직후 같은 임계구역에서 가드 기록
                    u["unitboss_cleared_units"] = cleared
                    granted = True

            return {"view": v, "newly_earned_titles": newly, "granted": granted,
                    "reward": reward, "user": u}

        try:
            user_after, mres = mutate_user_atomic(user_id, mutator)
        except UserNotFoundError:
            raise HTTPException(status_code=404, detail="User not found")
        view = mres["view"]
        newly_earned_titles = mres["newly_earned_titles"]
        reward_granted = mres["granted"]
        reward_deltas = mres["reward"]
    else:
        # 채점 실패: 세션 변경 없음 — 표시용 카운트만 현재 스냅샷에서 읽는다.
        view = get_session(user, payload["sid"]) or {
            "correct": 0, "wrong": 0, "required": REQUIRED_CORRECT, "status": "active",
        }

    is_clear = (view["status"] == "won")  if not grading_failed else False
    is_fail  = (view["status"] == "lost") if not grading_failed else False

    # 표시용 HP/오답수: 서버 세션 카운트에서 파생 (권위 없음)
    ai_result["boss_hp"]     = max(0, BOSS_HP_INIT - view["correct"] * BOSS_HP_DELTA)
    ai_result["my_hp"]       = max(0, MY_HP_INIT   - view["wrong"]   * MY_HP_DELTA)
    ai_result["wrong_count"] = view["wrong"]
    ai_result["is_clear"]    = is_clear
    ai_result["is_fail"]     = is_fail
    ai_result["correct"]     = view["correct"]
    ai_result["required"]    = view["required"]

    # 풀이 전수 기록 (채점 성공 시 1건 — 서버 채점 결과. 게이팅/통계의 단일 진실)
    if not grading_failed:
        save_attempt_item({
            "id":          str(uuid.uuid4()),
            "user_id":     user_id,
            "question_id": question.get("question_id"),
            "unit":        req.unit,
            "stage":       None,
            "level":       course_level,
            "mode":        "unitboss",
            "is_correct":  is_correct,
            "answered_at": now_kst().isoformat(),
        })

    # 오답 기록 (채점 실패가 아닐 때만)
    if not is_correct and not grading_failed:
        save_wrong_answer_item({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "question_id": req.question_id,
            "user_answer": req.user_answer,
            "feedback": ai_result.get("feedback", ""),
            "timestamp": now_kst().isoformat(),
            "reviewed": False
        })

    # ── 진행도(별도 스토리지) 완료 표시 — 보상 mutate '이후' 에 기록(학습 표시용) ──
    if is_clear:
        if progress_existing is not None:
            progress_existing["score"] = max(progress_existing.get("score", 0), ai_result.get("score", 100))
            progress_existing["is_completed"] = True
            progress_existing["updated_at"] = now_kst().isoformat()
            save_progress_item(progress_existing)
        else:
            save_progress_item({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "unit": unit_val,
                "stage": stage_val,
                "score": ai_result.get("score", 100),
                "is_completed": True,
                "course_level": course_level,
                "created_at": now_kst().isoformat(),
                "updated_at": now_kst().isoformat(),
            })

    # ── 응답 보상 필드 (실제 지급 여부 = mutator 의 granted 기준) ──
    if reward_granted:
        # xp_awarded 는 하위호환 표기(=보상 단위). 신규 소비자는 reward.* 를 쓴다.
        ai_result["xp_awarded"]     = UNITBOSS_CLEAR_REWARD
        ai_result["crowns_awarded"] = 1
        ai_result["unlocked_unit"]  = next_unit
    elif is_clear and not grading_failed and is_final_boss:
        # 엔드보스: 보상은 endboss.py 전담, 여기선 0
        ai_result["xp_awarded"]     = 0
        ai_result["crowns_awarded"] = 0
        ai_result["unlocked_unit"]  = 9
    elif is_clear and not grading_failed:
        # 유닛보스 재클리어/이미 지급됨 → 0 (unitboss_cleared_units 가드)
        ai_result["xp_awarded"]     = 0
        ai_result["crowns_awarded"] = 0
        ai_result["unlocked_unit"]  = next_unit
    else:
        ai_result["xp_awarded"] = 0
        ai_result["crowns_awarded"] = 0
        ai_result["unlocked_unit"] = 1

    # 분리 보상 구조 (프론트 전환용). reward 는 실제 지급된 delta, user_state 는 최신 스냅샷.
    ai_result["reward"] = reward_deltas
    ai_result["user_state"] = {
        "coin_balance": user_after.get("coin_balance", 0),
        "gp": user_after.get("gp", 0),
        "lv": user_after.get("lv", 1),
        "evolution_stage": get_evolution_stage(user_after),
        "ranking_score": user_after.get("ranking_score", 0),
        "weekly_ranking_score": current_week_ranking_score(user_after),
        "crowns": user_after.get("crowns", 0),
    }
    ai_result["newly_earned_titles"] = newly_earned_titles
    # correct_answer 는 제출 '후' 응답에만 — error_find reveal 하이라이트용(게이트 우회 불가)
    ai_result["correct_answer"] = question.get("answer", "")

    return ai_result
