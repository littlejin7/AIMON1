from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel
from services.claude_service import ask_claude_json
import os, uuid
from datetime import datetime, timedelta
from routers.titles import check_and_award_titles
from typing import Optional
from routers.utils import (
    load_users,
    save_users,
    verify_token,
    load_wrong_answers,
    save_wrong_answers,
)
from routers.quiz import load_questions_by_category
from routers.utils import limiter

router = APIRouter()


class BossHintRequest(BaseModel):
    question_id: str
    user_answer: str = ""

class BossAnswerRequest(BaseModel):
    question_id: str
    user_answer: str
    is_code_question: bool = False
    wrong_count: int = 0
    my_hp: int = 1000
    boss_hp: int = 1000
    unit: Optional[int] = None

# 서버 측 HP 고정 상수 – 클라이언트 조작 무력화
BOSS_HP_INIT  = 1000
MY_HP_INIT    = 1000
BOSS_HP_DELTA = 200   # 정답 시 보스 HP 감소 (5번 맞추면 클리어)
MY_HP_DELTA   = 350   # 오답 시 내 HP 감소




@router.get("/info")
def get_boss_info(unit: str = "1", authorization: str = Header(...)):
    user_id = verify_token(authorization)
    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    # 날짜 체크해서 무료 횟수 리셋
    today = (datetime.utcnow() + timedelta(hours=9)).strftime("%Y-%m-%d")
    if user.get("last_free_attempt_date") != today:
        user["daily_free_attempts"] = 2
        user["last_free_attempt_date"] = today
        save_users(users)
        
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
def start_boss_battle(unit: str = "1", authorization: str = Header(...)):
    user_id = verify_token(authorization)
    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # 왕관/무료 횟수 차감
    today = (datetime.utcnow() + timedelta(hours=9)).strftime("%Y-%m-%d")
    if user.get("last_free_attempt_date") != today:
        user["daily_free_attempts"] = 2
        user["last_free_attempt_date"] = today
        
    if user.get("daily_free_attempts", 0) > 0:
        user["daily_free_attempts"] -= 1
    else:
        if user.get("crowns", 0) <= 0:
            raise HTTPException(status_code=400, detail="왕관이 부족합니다.")
        user["crowns"] -= 1
        
    if unit == "final":
        raise HTTPException(status_code=400, detail="엔드보스는 /boss/endboss/start 를 사용해야 합니다.")
    
    course_level = user.get("course_level", "beginner")
    category = "unitboss"
    unit_num = int(unit)
    boss_qs = load_questions_by_category(category, course_level=course_level, unit=unit_num)
    if not boss_qs:
        raise HTTPException(status_code=404, detail="보스 문제가 없습니다.")
    import random
    
    # unitboss_seen_questions: 유닛별 분리 (endboss_seen_questions와도 분리)
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
    save_users(users)
    return chosen

@router.post("/next")
def get_next_question(unit: str = "1", authorization: str = Header(...)):
    user_id = verify_token(authorization)
    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
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
    save_users(users)
    return chosen


@router.post("/hint")
@limiter.limit("5/minute;100/day")
async def get_boss_hint(request: Request, req: BossHintRequest, authorization: str = Header(...)):
    user_id = verify_token(authorization)
    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    course_level = user.get("course_level", "beginner") if user else "beginner"

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
@limiter.limit("5/minute;100/day")
async def submit_boss_answer(request: Request, req: BossAnswerRequest, authorization: str = Header(...)):
    user_id = verify_token(authorization)
    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    course_level = user.get("course_level", "beginner") if user else "beginner"

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

    if ai_result.get("is_correct"):
        new_boss_hp    = safe_boss_hp - BOSS_HP_DELTA
        new_my_hp      = safe_my_hp
        new_wrong_count = safe_wrong
    else:
        new_boss_hp    = safe_boss_hp
        new_my_hp      = safe_my_hp - MY_HP_DELTA
        new_wrong_count = safe_wrong + 1

    is_clear = new_boss_hp <= 0
    is_fail  = new_my_hp  <= 0 or new_wrong_count >= 3

    # 응답에 HP 정보 추가
    ai_result["my_hp"]       = new_my_hp
    ai_result["boss_hp"]     = new_boss_hp
    ai_result["wrong_count"] = new_wrong_count
    ai_result["is_clear"]    = is_clear
    ai_result["is_fail"]     = is_fail

    # 오답 기록
    if not ai_result.get("is_correct", False):
        wrong_answers = load_wrong_answers()
        wrong_answers.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "question_id": req.question_id,
            "user_answer": req.user_answer,
            "feedback": ai_result.get("feedback", ""),
            "timestamp": datetime.utcnow().isoformat(),
            "reviewed": False
        })
        save_wrong_answers(wrong_answers)

    # 1. Load users to increment feedback count & handle rewards
    users = load_users()
    u = next((user_entry for user_entry in users if user_entry["id"] == user_id), None)
    
    newly_earned_titles = []
    if u:
        # Increment AI feedback count
        u["ai_feedback_count"] = u.get("ai_feedback_count", 0) + 1
        newly_earned_titles = check_and_award_titles(u, {})

    # 2. is_clear일 때만 XP/진화 처리 및 진행도 완료 저장
    if is_clear:
        from routers.progress import load_progress, save_progress
        progress = load_progress()
        unit_val = int(req.unit) if req.unit is not None else int(question.get("unit", 1))
        stage_val = question.get("stage", f"{unit_val}-boss")
        existing = next((p for p in progress if p["user_id"] == user_id and p["unit"] == unit_val and p["stage"] == stage_val and p.get("course_level", "beginner") == course_level), None)
        
        award_xp = False
        if existing:
            if not existing.get("is_completed", False):
                award_xp = True
            existing["score"] = max(existing.get("score", 0), ai_result.get("score", 100))
            existing["is_completed"] = True
            existing["updated_at"] = datetime.utcnow().isoformat()
        else:
            award_xp = True
            progress.append({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "unit": unit_val,
                "stage": stage_val,
                "score": ai_result.get("score", 100),
                "is_completed": True,
                "course_level": course_level,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            })
        save_progress(progress)
        
        from routers.utils import calc_level

        if is_final_boss:
            # ── 엔드보스 클리어 보상은 endboss.py /boss/endboss/clear 에서 전담 처리 ──
            # 여기서 보상을 지급하면 중복 지급이 발생하므로, xp/crowns는 0으로 반환
            ai_result["xp_awarded"]     = 0
            ai_result["crowns_awarded"] = 0
            ai_result["unlocked_unit"]  = 9  # 엔드보스 이후 유닛 없음

        else:
            # ── 유닛 보스 클리어 보상 ────────────────────────────────────
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

            if award_xp and u:
                u["xp"] = u.get("xp", 0) + 3000
                if is_unit_boss:
                    if not isinstance(u.get("completed_units"), dict):
                        old_val = u.get("completed_units", 0)
                        u["completed_units"] = {
                            "beginner": old_val if course_level == "beginner" else 0,
                            "intermediate": old_val if course_level == "intermediate" else 0,
                            "advanced": old_val if course_level == "advanced" else 0
                        }
                    u["completed_units"][course_level] = u["completed_units"].get(course_level, 0) + 1

                new_lv = calc_level(u["xp"])
                u["lv"] = max(new_lv, u.get("lv", 1))

                lv = u["lv"]
                if lv >= 10 and u.get("character") == "slime":
                    u["character"] = "robot"
                elif lv >= 20 and u.get("character") == "robot":
                    u["character"] = "speech_bubble"
                elif lv >= 30 and u.get("character") == "speech_bubble":
                    u["character"] = "final_ghost"

                # boss_cleared 및 completed_stages 카운트 user에 저장
                u["boss_cleared"] = u.get("boss_cleared", 0) + 1
                u["completed_stages"] = u.get("completed_stages", 0) + 1

                context = {"boss_cleared": True}
                newly_earned_clear = check_and_award_titles(u, context)

                title_ids = {t["id"] for t in newly_earned_titles}
                for t in newly_earned_clear:
                    if t["id"] not in title_ids:
                        newly_earned_titles.append(t)

                u["crowns"] = u.get("crowns", 0) + 1

                if not isinstance(u.get("max_unlocked_unit"), dict):
                    old_val = u.get("max_unlocked_unit", 1)
                    u["max_unlocked_unit"] = {
                        "beginner": old_val if course_level == "beginner" else 1,
                        "intermediate": old_val if course_level == "intermediate" else 1,
                        "advanced": old_val if course_level == "advanced" else 1
                    }
                u["max_unlocked_unit"][course_level] = max(u["max_unlocked_unit"].get(course_level, 1), next_unit)

                ai_result["xp_awarded"]     = 3000
                ai_result["crowns_awarded"] = 1
                ai_result["unlocked_unit"]  = next_unit
            else:
                ai_result["xp_awarded"]     = 0
                ai_result["crowns_awarded"] = 0
                ai_result["unlocked_unit"]  = next_unit
    else:
        ai_result["xp_awarded"] = 0
        ai_result["crowns_awarded"] = 0
        ai_result["unlocked_unit"] = 1

    # Save users
    save_users(users)
    ai_result["newly_earned_titles"] = newly_earned_titles

    return ai_result
