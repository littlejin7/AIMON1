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
from routers.quiz import load_questions_by_category, assert_boss_access

router = APIRouter()


class BossHintRequest(BaseModel):
    question_id: str
    user_answer: str = Field("", max_length=4000)

class BossAnswerRequest(BaseModel):
    question_id: str
    user_answer: str = Field(..., max_length=4000)
    is_code_question: bool = False
    wrong_count: int = 0
    my_hp: int = 1000
    boss_hp: int = 1000
    unit: Optional[int] = None

# 서버 측 HP 고정 상수 – 클라이언트 조작 무력화
BOSS_HP_INIT  = 1000
MY_HP_INIT    = 1000
BOSS_HP_DELTA = 200   # 정답 시 보스 HP 감소 (5번 맞추면 클리어)
MY_HP_DELTA   = -(-MY_HP_INIT // 3)       # ceil(MY_HP_INIT/3) = 334: 3오답에 HP 정확히 0




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

    # ── 진입 비용 차감(무료 우선, 없으면 왕관) + 문제 선택을 한 임계구역에서 ──
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
        return chosen

    try:
        _, chosen = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")
    return chosen

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
    return chosen


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

    # HP 계산: 클라이언트 HP 값을 유효 범위로 클램프 후 고정 delta 적용 (HP 조작 방지)
    safe_boss_hp = max(0, min(req.boss_hp, BOSS_HP_INIT))
    safe_my_hp   = max(0, min(req.my_hp,   MY_HP_INIT))
    safe_wrong   = max(0, min(req.wrong_count, 2))  # 0~2 사이로 클램프

    grading_failed = ai_result.get("grading_failed", False)

    if grading_failed:
        new_boss_hp     = safe_boss_hp
        new_my_hp       = safe_my_hp
        new_wrong_count = safe_wrong
    elif ai_result.get("is_correct"):
        new_boss_hp    = safe_boss_hp - BOSS_HP_DELTA
        new_my_hp      = safe_my_hp
        new_wrong_count = safe_wrong
    else:
        new_boss_hp    = safe_boss_hp
        new_my_hp      = max(0, safe_my_hp - MY_HP_DELTA)
        new_wrong_count = safe_wrong + 1

    is_clear = (new_boss_hp <= 0) if not grading_failed else False
    # 패배 단일 기준: 3오답 = HP 0 (MY_HP_DELTA = ceil(MY_HP_INIT/3)로 항상 동시 성립)
    is_fail  = (new_wrong_count >= 3) if not grading_failed else False

    # 응답에 HP 정보 추가
    ai_result["my_hp"]       = new_my_hp
    ai_result["boss_hp"]     = new_boss_hp
    ai_result["wrong_count"] = new_wrong_count
    ai_result["is_clear"]    = is_clear
    ai_result["is_fail"]     = is_fail

    # 풀이 전수 기록 (채점 성공 시 정오답 무관 1건 — AI 피드백/오답 저장과 독립)
    if not grading_failed:
        save_attempt_item({
            "id":          str(uuid.uuid4()),
            "user_id":     user_id,
            "question_id": question.get("question_id"),
            "unit":        req.unit,
            "stage":       None,
            "level":       course_level,
            "mode":        "unitboss",
            "is_correct":  bool(ai_result.get("is_correct", False)),
            "answered_at": now_kst().isoformat(),
        })

    # 오답 기록 (채점 실패가 아닐 때만)
    if not ai_result.get("is_correct", False) and not grading_failed:
        save_wrong_answer_item({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "question_id": req.question_id,
            "user_answer": req.user_answer,
            "feedback": ai_result.get("feedback", ""),
            "timestamp": now_kst().isoformat(),
            "reviewed": False
        })

    # ── 진행도(별도 스토리지)는 '읽기(가드 보조)'만 먼저, '쓰기(완료표시)'는 mutate 이후 ──
    # progress.is_completed 는 '학습 진행 표시' 용도로만 유지한다. 유닛보스 보상
    # 중복가드의 단일 진실은 user 컬럼 unitboss_cleared_units 로 이전(M-4 해소):
    # progress 는 users 와 다른 스토리지라 mutate_user_atomic 임계구역으로 보호되지
    # 않아 동시 제출 시 TOCTOU 로 XP/왕관 이중 지급이 가능했다.
    #
    # was_completed_before: progress.is_completed 의 '이번 요청 쓰기 전' 값. 레거시(과거
    # progress 가드로 이미 보상받은) 유저를 mutator 안에서 재지급 없이 백필하는 데 쓴다.
    # ★ 완료표시 쓰기를 mutate '이후' 로 미루는 이유: mutate 이전에 쓰면 동시 형제 요청이
    #   우리가 쓴 is_completed=True 를 읽고 was_completed_before=True 로 오인 → 백필(무지급)
    #   하여 양쪽 다 미지급되는 race 가 생긴다. mutate 이후로 미루면 was_completed_before=True
    #   는 오직 '이전 세션 레거시' 만 의미하게 되어 동시 제출도 정확히 1회 지급된다.
    was_completed_before = False
    next_unit = 1
    unit_key = None   # 보상 가드 키 "{course_level}-{unit}" (mutator 가 user 컬럼으로 멱등 판정)
    progress_existing = None
    progress_unit_val = None
    progress_stage_val = None
    if is_clear and not grading_failed:
        unit_val = int(req.unit) if req.unit is not None else int(question.get("unit", 1))
        stage_val = question.get("stage", f"{unit_val}-boss")
        unit_key = f"{course_level}-{unit_val}"
        progress_unit_val, progress_stage_val = unit_val, stage_val

        progress = get_progress_by_user(user_id, course_level)
        existing = next((p for p in progress if p["unit"] == unit_val and p["stage"] == stage_val), None)
        progress_existing = existing
        if existing:
            was_completed_before = existing.get("is_completed", False)
        # (완료표시 저장은 mutate 이후로 미룸 — 위 ★ 주석 참고)

        if not is_final_boss:
            try:
                if req.unit is not None:
                    cleared_unit = int(req.unit)
                elif question and question.get("unit") is not None:
                    cleared_unit = int(question.get("unit"))
                else:
                    cleared_unit = 1
            except Exception:
                cleared_unit = 1
            next_unit = cleared_unit + 1

    # 유닛보스 클리어 이벤트 여부(엔드보스 보상은 endboss.py 전담). '이미 지급됐는지'의
    # 최종 판정은 mutator 안에서 user 컬럼(unitboss_cleared_units) 기준으로 한다.
    attempt_unit_reward = (is_clear and not grading_failed and not is_final_boss and unit_key is not None)

    # ── 유저 상태 변경(피드백 카운트·칭호·유닛보스 보상)은 fresh user 기준 원자 처리 ──
    # ai_feedback_count(counter)·titles(list)·missions(boss_clear) 가 save_user
    # delta-merge 에서 덮어써지던 문제 해소. (M-1)
    # 유닛보스 보상 중복가드를 progress(별도 스토리지)에서 unitboss_cleared_units(user
    # 컬럼)로 이전 → '검사→지급→append' 가 같은 임계구역에서 원자적. 동시 이중 제출에도
    # 정확히 1회만 지급. (M-4 해소; endboss/miniboss 와 동일 패턴)
    def mutator(u: dict) -> dict:
        newly = []
        granted = False   # 이 호출에서 실제로 XP/왕관을 지급했는지 (응답 보상 필드용)
        # 피드백 카운트 + 칭호 (채점 성공 시 매 답안)
        u["ai_feedback_count"] = u.get("ai_feedback_count", 0) + 1
        newly = check_and_award_titles(u, {})

        if attempt_unit_reward:
            cleared = u.get("unitboss_cleared_units")
            if not isinstance(cleared, list):
                cleared = []
            already = unit_key in cleared

            # 레거시 호환: 과거 progress 가드로 이미 보상받은 유저(was_completed_before)는
            # 재지급 없이 컬럼만 백필. 백필도 already 검사를 거쳐 멱등.
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

        return {"newly_earned_titles": newly, "granted": granted}

    # 채점 실패가 아닐 때만 유저 상태를 원자 저장 (grading_failed 면 변경 없음 → 저장 생략)
    newly_earned_titles = []
    reward_granted = False   # mutator 가 이 호출에서 실제 지급했는지 (응답 보상 필드의 진실)
    if not grading_failed:
        try:
            _, mres = mutate_user_atomic(user_id, mutator)
            newly_earned_titles = mres["newly_earned_titles"]
            reward_granted = mres["granted"]
        except UserNotFoundError:
            raise HTTPException(status_code=404, detail="User not found")

    # ── 진행도(별도 스토리지) 완료 표시 — 보상 mutate '이후' 에 기록(학습 표시용) ──
    # 위 ★ 주석: mutate 이전에 쓰면 동시 형제 요청이 was_completed_before 를 오인한다.
    if is_clear and not grading_failed:
        if progress_existing is not None:
            progress_existing["score"] = max(progress_existing.get("score", 0), ai_result.get("score", 100))
            progress_existing["is_completed"] = True
            progress_existing["updated_at"] = now_kst().isoformat()
            save_progress_item(progress_existing)
        else:
            save_progress_item({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "unit": progress_unit_val,
                "stage": progress_stage_val,
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

    return ai_result
