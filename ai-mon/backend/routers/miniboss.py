"""
미니보스 (Miniboss) 라우터
스테이지 내 미니보스 배틀 처리

엔드포인트:
  GET  /boss/miniboss/info      스테이지 미니보스 정보
  POST /boss/miniboss/start     배틀 시작 (해당 stage 문제 반환)
  POST /boss/miniboss/answer    답안 제출 → HP 계산
  POST /boss/miniboss/clear     클리어 처리 (XP + 진행도, 중복 방지)
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
import json, os, random, uuid
from datetime import datetime
from typing import Optional

from routers.utils import (
    get_progress_by_user,
    save_progress_item,
    save_attempt_item,
    now_kst,
    get_current_user,
    grant_reward,
    get_evolution_stage,
    current_week_ranking_score,
    mutate_user_atomic,
    UserNotFoundError,
)
from routers.quiz import assert_stage_access, serialize_question, select_attempt_question_pool
from routers.battle_session import (
    make_battle_token,
    verify_battle_token,
    create_session,
    apply_answer,
    get_session,
    consume_session,
    grade_objective,
)

MODE = "miniboss"

router = APIRouter()

MINIBOSS_DIR  = os.path.join(os.path.dirname(__file__), "../data/miniboss")

# ── HP 설정 (표시용) ──────────────────────────────────────────────────────────
# 서버 권위 전환 후 my_hp/boss_hp 는 '표시용'일 뿐이며 클리어 판정 권한이 없다.
# 클리어는 서버가 센 정답 누적이 REQUIRED_CORRECT 에 도달했는지로만 결정한다.
BOSS_HP_INIT  = 500   # 정답 5번이면 클리어
MY_HP_INIT    = 900   # 오답 3번이면 실패
BOSS_HP_DELTA = 100   # 정답 시 보스 HP 감소
MY_HP_DELTA   = 300   # 오답 시 내 HP 감소

# 서버 권위 클리어 조건
# REQUIRED_CORRECT 는 HP 상수와 의도적으로 분리: 미니보스는 5문항 중 3정답이면 통과.
# (유닛보스 REQUIRED_CORRECT=5 와 독립 — boss.py 를 건드리지 않는다)
QUESTIONS_PER_BATTLE = 5
REQUIRED_CORRECT = 3                                # 3정답이면 승리
MAX_WRONG        = MY_HP_INIT // MY_HP_DELTA       # 3 (오답 누적이 이 수 도달 시 패배)

# ── 보상 ─────────────────────────────────────────────────────────────────────
# 미니보스 클리어 보상 단위(coin=ranking=gp 후보 동일값). gp 는 gp_gate(3차 진화>=3)
# 통과 시에만 실제 지급. [기존 xp 500 을 coin/ranking 으로 이관]
CLEAR_REWARD = 500
CLEAR_XP = CLEAR_REWARD   # 하위호환 상수명 유지(응답 xp_awarded 표기용)



# ── 유틸 ──────────────────────────────────────────────────────────────────────

def load_miniboss_questions(course_level: str, unit: int) -> list:
    """data/miniboss/{course_level}/unit_{unit}.json 로드."""
    path = os.path.join(MINIBOSS_DIR, course_level, f"unit_{unit}.json")
    if not os.path.exists(path):
        # 폴백: beginner
        if course_level != "beginner":
            path = os.path.join(MINIBOSS_DIR, "beginner", f"unit_{unit}.json")
        if not os.path.exists(path):
            return []
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # beginner: {"questions": [...]} / intermediate·advanced: [...]
    return data if isinstance(data, list) else data.get("questions", [])

# 선택형 직접 채점은 battle_session.grade_objective 로 통합(드리프트 방지).


# ── Pydantic 모델 ─────────────────────────────────────────────────────────────

class AnswerRequest(BaseModel):
    question_id:  str
    user_answer:  str
    battle_token: str          # /start 에서 발급. 서버 세션을 식별·검증.
    unit:         int = 1
    stage:        str = ""
    # code_input 은 grade_objective 로 판정 불가 → /code/submit(서버 채점)이 권위.
    # 프론트가 그 결과를 code_is_correct 로 중계한다. 객관식/단답엔 무시.
    code_is_correct: Optional[bool] = None
    # my_hp/boss_hp 는 더 이상 받지 않는다(클라 권위 제거). 응답의 HP 는 서버 세션 파생.

class ClearRequest(BaseModel):
    unit:         int
    stage:        str
    battle_token: str          # /start 에서 발급. status=="won" 검증에 사용.


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get("/info")
def miniboss_info(unit: int = 1, stage: str = "1-1", user: dict = Depends(get_current_user)):
    """미니보스 정보 반환 (HP 설정, 이미 클리어 여부)."""
    user_id = user["id"]

    cleared = user.get("miniboss_cleared_stages") or []
    stage_key = stage if "-" in str(stage) else f"{unit}-{stage}"

    return {
        "boss_hp_init":    BOSS_HP_INIT,
        "my_hp_init":      MY_HP_INIT,
        "boss_hp_delta":   BOSS_HP_DELTA,
        "my_hp_delta":     MY_HP_DELTA,
        "xp_reward":       CLEAR_XP,
        "already_cleared": stage_key in cleared,
    }


@router.post("/start")
def miniboss_start(
    unit: int = 1,
    stage: str = "1-1",
    attempt: int = Query(1),
    user: dict = Depends(get_current_user),
):
    """
    미니보스 배틀 시작.
    - 해당 stage 문제 10개를 seen 관리하며 순서대로 반환
    - 모두 소진 시 리셋 후 재출제
    """
    user_id = user["id"]

    course_level = user.get("course_level", "beginner")
    all_qs = load_miniboss_questions(course_level, unit)
    stage_qs = [q for q in all_qs if q.get("stage") == stage]
    attempt_pool = select_attempt_question_pool(stage_qs, attempt)

    if not stage_qs:
        raise HTTPException(status_code=404, detail=f"Unit {unit} / Stage {stage} 미니보스 문제가 없습니다.")

    # ── seen 갱신 + 배틀 토큰 발급 + 서버 세션 생성을 한 임계구역에서 (CLAUDE.md §1) ──
    # 배틀 토큰(sid)은 서버 발급 nonce 라 위조 불가. 정답 누적은 서버 세션에만 쌓인다.
    token, sid = make_battle_token(MODE, unit, stage, user_id)

    def mutator(u: dict) -> dict:
        if "seen_questions" not in u or u["seen_questions"] is None:
            u["seen_questions"] = {}
        seen_questions = u["seen_questions"]
        miniboss_seen = seen_questions.setdefault("miniboss", {})
        stage_seen = miniboss_seen.get(stage, [])

        unseen = [q for q in attempt_pool if q["question_id"] not in stage_seen]
        if not unseen:
            unseen = list(attempt_pool)


        try:
            attempt_no = int(attempt)
        except (TypeError, ValueError):
            attempt_no = 1
        if attempt_no >= 3:
            random.shuffle(unseen)
        chosen = unseen[:QUESTIONS_PER_BATTLE]  # 최대 5문제
        miniboss_seen[stage] = [q["question_id"] for q in chosen]
        seen_questions["miniboss"] = miniboss_seen
        u["seen_questions"] = seen_questions

        # 이 배틀의 필요정답수 = 출제 문제수(보통 5). 모두 맞혀야 승리.
        required = max(1, min(REQUIRED_CORRECT, len(chosen)))
        create_session(u, sid, MODE, unit, stage, required, MAX_WRONG)
        return {"chosen": chosen, "required": required}

    try:
        _, result = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "unit":         unit,
        "stage":        stage,
        "questions":    [serialize_question(q) for q in result["chosen"]],  # 정답 제거(F)
        "my_hp":        MY_HP_INIT,
        "boss_hp":      BOSS_HP_INIT,
        "battle_token": token,
        "required":     result["required"],
    }


@router.post("/answer")
def miniboss_answer(req: AnswerRequest, user: dict = Depends(get_current_user)):
    """
    답안 제출 → 서버 채점 + 서버 세션 카운트 갱신.
    - is_correct 는 서버(grade_objective)가 결정 (클라 입력 불신).
    - 정답 누적이 required 도달 → is_clear=True (status="won").
    - 오답 누적이 max_wrong 도달 → is_fail=True (status="lost").
    - 응답의 my_hp/boss_hp 는 서버 세션 카운트에서 파생한 '표시용' 값.
    """
    user_id = user["id"]

    # 배틀 토큰 검증(서명·소유자·모드·만료)은 상태 무관 → 원자 경계 밖에서 먼저.
    payload = verify_battle_token(req.battle_token, user_id, MODE)

    course_level = user.get("course_level", "beginner")
    all_qs = load_miniboss_questions(course_level, req.unit)
    question = next((q for q in all_qs if q.get("question_id") == req.question_id), None)
    if not question:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없습니다.")

    # 서버 채점 — 객관식/단답은 정답과 직접 대조(grade_objective). code_input 은
    # /code/submit 가 권위이므로 프론트가 중계한 code_is_correct 를 사용한다.
    q_type = question.get("type") or question.get("quiz_type")
    if q_type == "code_input":
        is_correct = bool(req.code_is_correct)
    else:
        is_correct = grade_objective(req.user_answer, question.get("answer", ""))
    fb_key  = "correct" if is_correct else "wrong"
    feedback = question.get("feedback", {}).get(fb_key, "")

    # ── 세션 카운트 갱신을 fresh user 기준으로 원자 처리 (CLAUDE.md §1·§3) ──
    def mutator(u: dict) -> dict:
        return apply_answer(u, payload, question.get("question_id"), is_correct)

    try:
        _, view = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    is_clear = view["status"] == "won"
    is_fail  = view["status"] == "lost"

    # 표시용 HP: 서버 세션 카운트에서 파생 (권위 없음)
    # 비율 계산: correct/required 비율만큼 HP 소모 → required 정답 도달 시 정확히 0.
    _req = max(view["required"], 1)
    display_boss_hp = max(0, round(BOSS_HP_INIT * (1 - view["correct"] / _req)))
    display_my_hp   = max(0, MY_HP_INIT - view["wrong"] * MY_HP_DELTA)

    # 풀이 전수 기록 (서버 채점 결과로 1건 — 게이팅/통계의 단일 진실)
    save_attempt_item({
        "id":          str(uuid.uuid4()),
        "user_id":     user_id,
        "question_id": question.get("question_id"),
        "unit":        req.unit,
        "stage":       req.stage or None,
        "level":       course_level,
        "mode":        "miniboss",
        "is_correct":  bool(is_correct),
        "answered_at": now_kst().isoformat(),
    })

    return {
        "is_correct": is_correct,
        "feedback":   feedback,
        "hint":       "" if is_correct else question.get("hint", ""),
        # correct_answer 는 제출 '후' 응답에만 — reveal 하이라이트용(게이트 우회 불가)
        "correct_answer": question.get("answer", ""),
        "my_hp":      display_my_hp,
        "boss_hp":    display_boss_hp,
        "is_clear":   is_clear,
        "is_fail":    is_fail,
        "correct":    view["correct"],
        "required":   view["required"],
    }


@router.post("/clear")
def miniboss_clear(req: ClearRequest, user: dict = Depends(get_current_user)):
    """
    클리어 처리 (중복 방지).
    - XP 500 지급 (최초 1회)
    - miniboss_cleared_stages 기록
    - 진행도 저장
    """
    user_id = user["id"]

    # 해당 스테이지 접근 권한 검증 (레벨테스트 + 유닛 해금 + 이전 스테이지 완료)
    course_level = user.get("course_level", "beginner")
    assert_stage_access(user, req.unit, req.stage, course_level)

    # 배틀 토큰 검증(서명·소유자·모드·만료) — 상태 무관이므로 원자 경계 밖에서 먼저.
    payload = verify_battle_token(req.battle_token, user_id, MODE)
    sid = payload.get("sid")

    stage_key = req.stage if "-" in str(req.stage) else f"{req.unit}-{req.stage}"

    # 클리어 가드(miniboss_cleared_stages, list append) + XP + 미션(miniboss_clear)
    # 훅을 fresh user 기준으로 원자 처리. apply_xp(event_type) 가 _ensure_period 로
    # missions 객체를 건드리므로 save_user 가 아닌 mutate_user_atomic 필수. (M-1)
    #
    # ★ 서버 권위 클리어 게이트: 신규 클리어는 서버 세션 status=="won"(=정답 누적이
    #   required 도달)일 때만 허용한다. /answer 없이 /clear 직접 호출하면 세션이
    #   active/없음이라 403 으로 차단된다(A 어뷰징 방어). 이미 클리어한 스테이지는
    #   세션 없이도 멱등 성공(already_cleared)으로 빠진다.
    def mutator(u: dict) -> dict:
        cleared = u.get("miniboss_cleared_stages") or []
        already_cleared = stage_key in cleared
        reward = {"coin_delta": 0, "gp_delta": 0, "ranking_score_delta": 0}
        if not already_cleared:
            view = get_session(u, sid)
            if not view or view["status"] != "won":
                raise HTTPException(status_code=403, detail="전투에서 승리해야 클리어할 수 있습니다.")
            # xp 신규 지급 중단 → coin/ranking 분리 발급. gp 는 gate 통과 시만.
            rr = grant_reward(u, coin_delta=CLEAR_REWARD, ranking_score_delta=CLEAR_REWARD,
                              gp_delta=CLEAR_REWARD, event_type="miniboss_clear")
            reward = {"coin_delta": rr["coin_delta"], "gp_delta": rr["gp_delta"],
                      "ranking_score_delta": rr["ranking_score_delta"]}
            cleared.append(stage_key)
            u["miniboss_cleared_stages"] = cleared
            consume_session(u, sid)   # 보상 후 세션 소비 (리플레이 방지)
        return {
            "already_cleared": already_cleared,
            "cleared_stages": u.get("miniboss_cleared_stages", []),
            "reward": reward,
        }

    try:
        user, result = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    already_cleared = result["already_cleared"]
    xp_awarded = 0
    if not already_cleared:
        xp_awarded = CLEAR_XP

        # 진행도 저장(별도 스토리지) — 신규 클리어 시에만 락 밖에서 수행
        course_level = user.get("course_level", "beginner")
        progress = get_progress_by_user(user_id, course_level)
        existing = next(
            (p for p in progress if p["unit"] == req.unit and p["stage"] == req.stage),
            None,
        )
        if existing:
            existing["is_completed"] = True
            existing["updated_at"]   = now_kst().isoformat()
            target_item = existing
        else:
            target_item = {
                "id":           str(uuid.uuid4()),
                "user_id":      user_id,
                "unit":         req.unit,
                "stage":        req.stage,
                "score":        100,
                "is_completed": True,
                "course_level": course_level,
                "created_at":   now_kst().isoformat(),
                "updated_at":   now_kst().isoformat(),
            }
        save_progress_item(target_item)

    return {
        "already_cleared":  already_cleared,
        # xp_awarded 는 하위호환 표기(=보상 단위). 신규 소비자는 reward.* 를 쓴다.
        "xp_awarded":       xp_awarded,
        "lv":               user.get("lv", 1),
        "cleared_stages":   result["cleared_stages"],
        "reward":           result["reward"],
        "user_state": {
            "coin_balance": user.get("coin_balance", 0),
            "gp": user.get("gp", 0),
            "lv": user.get("lv", 1),
            "evolution_stage": get_evolution_stage(user),
            "ranking_score": user.get("ranking_score", 0),
            "weekly_ranking_score": current_week_ranking_score(user),
            "crowns": user.get("crowns", 0),
        },
    }
