from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from jose import jwt, JWTError
from services.claude_service import ask_claude_json
import json, os, uuid
from datetime import datetime
from routers.titles import check_and_award_titles
from typing import Optional

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "aimon-dev-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

from routers.quiz import load_questions_by_category

WRONG_ANSWERS_FILE = os.path.join(os.path.dirname(__file__), "../data/wrong_answers.json")
USERS_FILE = os.path.join(os.path.dirname(__file__), "../data/users.json")

def load_users():
    if not os.path.exists(USERS_FILE):
        return []
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


def verify_token(authorization: str) -> str:
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="토큰이 유효하지 않습니다.")


def load_wrong_answers():
    if not os.path.exists(WRONG_ANSWERS_FILE):
        return []
    with open(WRONG_ANSWERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_wrong_answers(data):
    with open(WRONG_ANSWERS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


class BossAnswerRequest(BaseModel):
    question_id: str
    user_answer: str
    is_code_question: bool = False
    wrong_count: int = 0
    my_hp: int = 1000
    boss_hp: int = 1000
    unit: Optional[int] = None


@router.get("/info")
def get_boss_info(unit: str = "1", authorization: str = Header(...)):
    user_id = verify_token(authorization)
    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    # 날짜 체크해서 무료 횟수 리셋
    today = datetime.utcnow().strftime("%Y-%m-%d")
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
    
    # 왕관/무료 횟수 차감
    today = datetime.utcnow().strftime("%Y-%m-%d")
    if user.get("last_free_attempt_date") != today:
        user["daily_free_attempts"] = 2
        user["last_free_attempt_date"] = today
        
    if user.get("daily_free_attempts", 0) > 0:
        user["daily_free_attempts"] -= 1
    else:
        if user.get("crowns", 0) <= 0:
            raise HTTPException(status_code=400, detail="왕관이 부족합니다.")
        user["crowns"] -= 1
        
    course_level = user.get("course_level", "beginner")
    boss_qs = load_questions_by_category("unitboss", course_level=course_level, unit=unit)
    if not boss_qs:
        raise HTTPException(status_code=404, detail="보스 문제가 없습니다.")
    import random
    
    seen = user.get("boss_seen_questions", [])
    unseen = [q for q in boss_qs if q["question_id"] not in seen]

    if not unseen:  # 전부 소진하면 리셋
        user["boss_seen_questions"] = []
        unseen = boss_qs

    chosen = random.choice(unseen)
    user["boss_seen_questions"] = user.get("boss_seen_questions", []) + [chosen["question_id"]]
    save_users(users)
    return chosen
    
@router.post("/next")
def get_next_question(unit: str = "1", authorization: str = Header(...)):
    user_id = verify_token(authorization)
    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    course_level = user.get("course_level", "beginner")
    category = "finalboss" if unit == "final" else "unitboss"
    unit_num = None if unit == "final" else int(unit)
    boss_qs = load_questions_by_category(category, course_level=course_level, unit=unit_num)
    
    if not boss_qs:
        raise HTTPException(status_code=404, detail="보스 문제가 없습니다.")
    import random

    seen = user.get("boss_seen_questions", [])
    unseen = [q for q in boss_qs if q["question_id"] not in seen]

    if not unseen:  # 전부 소진하면 리셋
        user["boss_seen_questions"] = []
        unseen = boss_qs

    chosen = random.choice(unseen)
    user["boss_seen_questions"] = user.get("boss_seen_questions", []) + [chosen["question_id"]]
    save_users(users)
    return chosen


@router.post("/answer")
async def submit_boss_answer(req: BossAnswerRequest, authorization: str = Header(...), unit: Optional[str] = None):
    user_id = verify_token(authorization)
    users = load_users()
    user = next((u for u in users if u["id"] == user_id), None)
    course_level = user.get("course_level", "beginner") if user else "beginner"

    questions = load_questions_by_category("unitboss", course_level) + load_questions_by_category("finalboss", course_level)
    # 우리 스키마는 "question_id" 필드 사용 ("id" 필드 없음)
    question = next(
        (q for q in questions if q.get("question_id") == req.question_id or q.get("id") == req.question_id),
        None,
    )
    if not question:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    is_unit_boss = question.get("quiz_category") == "unit_boss"
    
    level_instruction = "비유와 일상 예시를 들어 왜 틀렸는지 친절하게 설명해주세요."
    if course_level == "intermediate":
        level_instruction = "핵심 개념과 코드 예시를 포함해 왜 틀렸는지 분석해주세요."
    elif course_level == "advanced":
        level_instruction = "원리와 엣지 케이스까지 깊이 있게 틀린 이유를 설명해주세요."

    # AI 채점 요청
    prompt = f"""
당신은 파이썬을 가르치는 친절한 AI 튜터 '에이몬'입니다.
다음 코딩 문제에 대한 사용자의 답변을 채점하고 피드백해주세요.
틀렸을 경우, {level_instruction}

[중요 지시사항]
- 사용자의 답변이 예시 정답의 기호(예: A, B, C, D)만 입력했거나 내용이 일치한다면 반드시 "is_correct": true 로 채점하세요.
- JSON 응답 외에 어떠한 부가 설명 텍스트도 출력하지 마세요. 오직 JSON만 출력해야 합니다.

문제: {question['question']}
예시 정답: {question.get('answer', '없음')}
사용자 답변: {req.user_answer}

채점 결과를 JSON으로 반환하세요:
{{
  "is_correct": true/false,
  "score": 0~100,
  "feedback": "에이몬 튜터로서의 친절한 피드백 (한국어, 2-3문장)",
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

    if q_type in ("multiple_choice", "output_select", "fill_in_blank"):
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
        # code_input 타입만 Claude 채점
        ai_result = await ask_claude_json(prompt)

    # 채점 후 HP 계산 로직 추가
    if ai_result.get("is_correct"):
        new_boss_hp = req.boss_hp - 150
        new_my_hp = req.my_hp
        new_wrong_count = req.wrong_count
    else:
        new_boss_hp = req.boss_hp
        new_my_hp = req.my_hp - 350
        new_wrong_count = req.wrong_count + 1

    is_clear = new_boss_hp <= 0
    is_fail = new_my_hp <= 0 or new_wrong_count >= 3

    # 응답에 HP 정보 추가
    ai_result["my_hp"] = new_my_hp
    ai_result["boss_hp"] = new_boss_hp
    ai_result["wrong_count"] = new_wrong_count
    ai_result["is_clear"] = is_clear
    ai_result["is_fail"] = is_fail

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
        })
        save_wrong_answers(wrong_answers)

    # is_clear일 때만 XP/진화 처리 및 진행도 완료 저장
    if is_clear:
        from routers.progress import load_progress, save_progress
        progress = load_progress()
        existing = next((p for p in progress if p["user_id"] == user_id and p["unit"] == question.get("unit") and p["stage"] == question.get("stage")), None)
        
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
                "unit": question.get("unit", 1),
                "stage": question.get("stage", "1-boss"),
                "score": ai_result.get("score", 100),
                "is_completed": True,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            })
        save_progress(progress)
        
        # XP 및 보스 클리어 카운트 (진화 조건) 추가
        try:
            cleared_unit = int(unit) if unit is not None else (int(req.unit) if getattr(req, "unit", None) is not None else (int(question.get("unit")) if question and question.get("unit") is not None else 1))
        except (ValueError, TypeError):
            cleared_unit = 1

        next_unit = cleared_unit + 1

        if award_xp:
            users = load_users()
            ai_result["newly_earned_titles"] = []
            for u in users:
                if u["id"] == user_id:
                    u["xp"] = u.get("xp", 0) + 3000  # 유닛 보스 클리어 XP
                    if is_unit_boss:
                        u["completed_units"] = u.get("completed_units", 0) + 1
                    
                    def calc_level(xp):
                        lv = 1
                        accumulated = 0
                        while lv < 30:
                            needed = lv * 1000
                            if xp < accumulated + needed:
                                break
                            accumulated += needed
                            lv += 1
                        return lv

                    new_lv = calc_level(u["xp"])
                    u["lv"] = max(new_lv, u.get("lv", 1))
                    
                    lv = u["lv"]
                    if lv >= 10 and u.get("character") == "slime":
                        u["character"] = "robot"
                    elif lv >= 20 and u.get("character") == "robot":
                        u["character"] = "speech_bubble"
                    elif lv >= 30 and u.get("character") == "speech_bubble":
                        u["character"] = "final_ghost"
                    
                    context = {"boss_cleared": True}
                    newly_earned = check_and_award_titles(u, context)
                    ai_result["newly_earned_titles"] = newly_earned

                    # 2. Find the user and increment user["crowns"] by the next unit number (crown count = next_unit_number)
                    u["crowns"] = u.get("crowns", 0) + next_unit
                    # 3. Set user["max_unlocked_unit"] to max(current value, cleared_unit + 1)
                    u["max_unlocked_unit"] = max(u.get("max_unlocked_unit", 1), next_unit)
                    break

            save_users(users)
            ai_result["xp_awarded"] = 3000
            ai_result["crowns_awarded"] = next_unit
            ai_result["unlocked_unit"] = next_unit
        else:
            ai_result["xp_awarded"] = 0
            ai_result["newly_earned_titles"] = []
            ai_result["crowns_awarded"] = 0
            ai_result["unlocked_unit"] = next_unit
    else:
        ai_result["xp_awarded"] = 0
        ai_result["newly_earned_titles"] = []
        ai_result["crowns_awarded"] = 0
        ai_result["unlocked_unit"] = 1

    return ai_result
