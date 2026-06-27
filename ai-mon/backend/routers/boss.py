from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from services.claude_service import ask_claude_json
import os, uuid
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
    apply_xp,
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
        "boss_name": f"코드몬 Unit {unit} 보스",
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

    import random
    today = now_kst().strftime("%Y-%m-%d")
    # unitboss_seen_questions: 유닛별 분리 (endboss_seen_questions와도 분리)
    seen_key = f"unitboss_seen_{unit_num}" if unit_num is not None else "unitboss_seen_final"

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

        # 문제 선택은 fresh seen 기준 (CAS 재시도 시 재선택돼도 무해)
        if "seen_questions" not in u or u["seen_questions"] is None:
            u["seen_questions"] = {}
        seen_questions = u["seen_questions"]
        seen = seen_questions.get(seen_key, [])
        unseen = [q for q in boss_qs if q["question_id"] not in seen]

        if not unseen:  # 전부 소진하면 리셋
            seen_questions[seen_key] = []
            seen = []
            unseen = boss_qs

        chosen = random.choice(unseen)
        seen_questions[seen_key] = seen + [chosen["question_id"]]
        u["seen_questions"] = seen_questions

        # 서버 권위 세션 생성: 정답 누적 REQUIRED_CORRECT(5) 도달 시에만 클리어 허용.
        create_session(u, sid, MODE, unit_num, None, REQUIRED_CORRECT, MAX_WRONG)
        return chosen

    try:
        _, chosen = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")
    # 응답: 문제(정답 제거) + 배틀 토큰(프론트가 이후 /answer 마다 동봉).
    return {"question": serialize_question(chosen), "battle_token": token}

@router.post("/next")
def get_next_question(unit: str = "1", user: dict = Depends(get_current_user)):
    user_id = user["id"]
    if unit == "final":
        raise HTTPException(status_code=400, detail="엔드보스는 /boss/endboss/next 플로우(phase3)를 사용해야 합니다.")
        
    course_level = user.get("course_level", "beginner")
    category = "unitboss"
    unit_num = int(unit)
    boss_qs = load_questions_by_category(category, course_level=course_level, unit=unit_num)

    if not boss_qs:
        raise HTTPException(status_code=404, detail="보스 문제가 없습니다.")
    import random

    seen_key = f"unitboss_seen_{unit_num}" if unit_num is not None else "unitboss_seen_final"
    if "seen_questions" not in user or user["seen_questions"] is None:
        user["seen_questions"] = {}
    seen_questions = user["seen_questions"]
    seen = seen_questions.get(seen_key, [])
    unseen = [q for q in boss_qs if q["question_id"] not in seen]

    if not unseen:  # 전부 소진하면 리셋
        seen_questions[seen_key] = []
        seen = []
        unseen = boss_qs

    chosen = random.choice(unseen)
    seen_questions[seen_key] = seen + [chosen["question_id"]]
    user["seen_questions"] = seen_questions
    save_user(user)
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
    
    level_instruction = ""
    if course_level == "beginner":
        level_instruction = (
            "초보자 수준에 맞춰 비유와 일상 예시를 들어 친절하게 설명해주세요.\n"
            "단순 오타나 사소한 문법 오류보다는 로직의 큰 틀이 맞으면 정답 처리하세요."
        )
    elif course_level == "intermediate":
        level_instruction = (
            "핵심 개념과 짤막한 코드 예시를 포함해 왜 틀렸는지 분석해주세요.\n"
            "파이썬다운(Pythonic) 코드 작성, 자료구조의 올바른 활용 여부를 우선적으로 평가하세요."
        )
    elif course_level == "advanced":
        level_instruction = (
            "고급 개념(비동기, 데코레이터 등)의 정확한 이해와 엣지 케이스 처리, 예외 상황 방어 로직을 엄격하게 평가하세요.\n"
            "원리와 더 나은 구조적 접근법에 대해 깊이 있게 설명해주세요."
        )

    # AI 채점 요청
    prompt = f"""당신은 파이썬을 가르치는 전문 AI 튜터 '에이몬'입니다.
다음 문제에 대한 사용자의 답변을 다각도에서 채점하고 피드백해주세요.

[레벨별 평가 기준: {course_level.upper()}]
{level_instruction}

[중요 지시사항]
- 사용자의 답변이 예시 정답의 기호(예: A, B, C, D)만 입력했거나 내용이 일치한다면 반드시 "is_correct": true 로 채점하세요.
- 반드시 아래 JSON 포맷으로만 응답하고 추가 텍스트나 마크다운(```json)을 출력하지 마세요.

[문제 정보]
문제 설명: {question['question']}
예시 정답: {question.get('answer', '없음')}

[사용자 답변]
{req.user_answer}

출력 포맷:
{{
  "is_correct": true/false,
  "score": 0~100 (정수),
  "feedback": "에이몬 튜터로서의 상세한 피드백 (한국어, 3-4문장)",
  "hint": "틀렸을 경우 정답에 도달할 수 있는 핵심 힌트 (맞았으면 빈 문자열)"
}}
"""
    q_type = question.get("type", "")
    correct_answer = str(question.get("answer", "")).strip()
    user_ans = req.user_answer.strip()

    def is_direct_match(user_ans: str, correct: str) -> bool:
        # 완전 일치
        if user_ans == correct:
            return True
        # 선택지 전체 텍스트로 답한 경우 (예: "B. 10 / 끝" → 앞 글자 "B"만 비교)
        if len(user_ans) >= 1 and user_ans[0].upper() == correct.upper():
            return True
        return False

    if q_type in ("multiple_choice", "output_select", "error_find"):
        matched = is_direct_match(user_ans, correct_answer)
        if matched:
            ai_result = {
                "is_correct": True,
                "score": 100,
                "feedback": question.get("feedback", {}).get("correct", "정답입니다! 잘하셨어요."),
                "hint": "",
            }
        else:
            ai_result = await ask_claude_json(prompt)
            # 직접 매칭 실패 → AI 채점에 위임. grading_failed=True면 is_correct를 덮어쓰지 않는다.
            # (채점 실패를 오답으로 오인하는 D-1 버그 방지)
            if not ai_result.get("grading_failed"):
                ai_result["is_correct"] = False
                ai_result["score"] = 0
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
    if not grading_failed:
        def mutator(u: dict) -> dict:
            v = apply_answer(u, payload, question.get("question_id"), is_correct)
            won = (v["status"] == "won")
            # 피드백 카운트 + 칭호 (채점 성공 시 매 답안)
            u["ai_feedback_count"] = u.get("ai_feedback_count", 0) + 1
            newly = check_and_award_titles(u, {})
            granted = False

            if won and not is_final_boss:
                cleared = u.get("unitboss_cleared_units")
                if not isinstance(cleared, list):
                    cleared = []
                already = unit_key in cleared

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
                    events = apply_xp(u, 3000, context, event_type="boss_clear")

                    title_ids = {t["id"] for t in newly}
                    for t in events["newly_earned_titles"]:
                        if t["id"] not in title_ids:
                            newly.append(t)

                    u["crowns"] = u.get("crowns", 0) + 1

                    if not isinstance(u.get("max_unlocked_unit"), dict):
                        old_val = u.get("max_unlocked_unit", 1)
                        u["max_unlocked_unit"] = {"beginner": old_val, "intermediate": 1, "advanced": 1}
                    u["max_unlocked_unit"][course_level] = max(u["max_unlocked_unit"].get(course_level, 1), next_unit)

                    cleared.append(unit_key)          # 지급 직후 같은 임계구역에서 가드 기록
                    u["unitboss_cleared_units"] = cleared
                    granted = True

            return {"view": v, "newly_earned_titles": newly, "granted": granted}

        try:
            _, mres = mutate_user_atomic(user_id, mutator)
        except UserNotFoundError:
            raise HTTPException(status_code=404, detail="User not found")
        view = mres["view"]
        newly_earned_titles = mres["newly_earned_titles"]
        reward_granted = mres["granted"]
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
        ai_result["xp_awarded"]     = 3000
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

    ai_result["newly_earned_titles"] = newly_earned_titles
    # correct_answer 는 제출 '후' 응답에만 — error_find reveal 하이라이트용(게이트 우회 불가)
    ai_result["correct_answer"] = question.get("answer", "")

    return ai_result
