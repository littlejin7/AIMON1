from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import List, Optional
import math
import uuid
from datetime import datetime
from routers.utils import (
    serialize_user,
    get_progress_by_user,
    get_attempts_by_user,
    save_progress_item,
    get_current_user,
    grant_reward,
    get_evolution_stage,
    current_week_ranking_score,
    now_kst,
    mutate_user_atomic,
    UserNotFoundError,
    LESSON_MODES,
)
# TODO(backlog): quiz 모듈을 두 번 import(assert_stage_access, load_units). 한 줄로 합칠 것. (사소)
from routers.quiz import assert_stage_access

router = APIRouter()

# 비보스 스테이지 완료 서버검증 파라미터
QUIZ_SERVE_LIMIT = 10    # quiz.get_questions 기본 limit 과 동기화 (set당 출제 수 상한)
STAGE_PASS_RATIO = 0.8   # Stage.jsx 의 is_completed: totalScore >= 80 과 동기화


def _stage_required_correct(course_level: str, unit: int, stage: str) -> int:
    """해당 stage 완료에 필요한 '서버채점 정답 distinct 문제 수'.

    출제 풀(quiz set A, 없으면 전체)을 limit 상한으로 자른 출제 수의 PASS_RATIO 만큼.
    퀴즈 풀이가 아예 없는 스테이지(데이터 예외)는 0 을 반환해 카운트 게이트를 비적용한다.
    """
    from routers.quiz import load_questions_by_category
    qs = [q for q in load_questions_by_category("quiz", course_level, unit)
          if q.get("stage") == stage]
    if not qs:
        return 0
    set_a = [q for q in qs if q.get("quiz_set") == "A"]
    pool_size = len(set_a) if set_a else len(qs)
    served = min(QUIZ_SERVE_LIMIT, pool_size)
    return max(1, math.ceil(STAGE_PASS_RATIO * served))


def _server_graded_correct_qids(user_id: str, course_level: str, unit: int, stage: str) -> tuple:
    """레슨모드(quiz/miniboss) attempts 에서 'qid별 첫 시도' 결과를 집계.

    반환: (first_correct_qids, attempted_qids)
      - first_correct_qids: qid별 '가장 이른 attempt(min answered_at)'가 is_correct=True 인 qid 집합.
        같은 qid에 (오답→재시도 정답) 기록이 있으면 첫 기록이 오답이므로 **집계 제외**(엿보기 차단).
      - attempted_qids: attempt 가 1건이라도 있는 모든 qid 집합(폴백 보충 게이트용).

    정렬 동률 대비: answered_at 이 같으면 attempt id 문자열로 안정적 tiebreak.
    attempts.is_correct 는 객관식/단답 서버 재채점 결과(G 방어)이므로 위조 불가.
    """
    # qid -> (정렬키, is_correct) 중 가장 이른 것만 보관
    earliest: dict = {}
    attempted_qids: set = set()
    for a in get_attempts_by_user(user_id):
        if a.get("level") != course_level:
            continue
        if a.get("unit") != unit:
            continue
        if a.get("stage") != stage:
            continue
        if a.get("mode") not in LESSON_MODES:
            continue
        qid = a.get("question_id")
        if not qid:
            continue
        attempted_qids.add(qid)
        # 동률 tiebreak: (answered_at, id) 오름차순으로 '첫 기록' 결정
        sort_key = (str(a.get("answered_at") or ""), str(a.get("id") or ""))
        cur = earliest.get(qid)
        if cur is None or sort_key < cur[0]:
            earliest[qid] = (sort_key, bool(a.get("is_correct")))

    first_correct_qids = {qid for qid, (_, ok) in earliest.items() if ok}
    return first_correct_qids, attempted_qids


def _supplement_from_answered(
    answered_questions: list,
    attempted_qids: set,
    course_level: str,
    unit: int,
    stage: str,
) -> int:
    """answered_questions 를 서버 재채점해 '첫 시도 정답' 카운트에 보충할 수를 반환.

    '첫 시도' 의미 일치 원칙:
      - attempt 가 1건이라도 존재하는 qid 는 **서버 첫 기록을 우선**하고 폴백으로 덮어쓰지
        않는다. (오답→재시도 정답 qid 가 폴백으로 되살아나는 것을 차단)
      - attempt 가 전무한 qid(네트워크 유실로 기록 누락) 만 보충 대상.
    보안 원칙:
      - 클라 is_correct 는 무시. user_answer 만 grade_objective 로 서버 재채점.
      - stage 퀴즈 풀에 없는 question_id 는 조용히 무시(외부 qid 주입 차단).
    프론트는 '첫 답안'을 보내므로(sessionAnswersRef 첫 답안 보존), 보충도 첫 시도 의미를 따른다.
    """
    from routers.quiz import load_questions_by_category
    from routers.battle_session import grade_objective

    stage_pool = {
        q.get("question_id"): q
        for q in load_questions_by_category("quiz", course_level, unit)
        if q.get("stage") == stage
    }
    if not stage_pool:
        return 0

    extra: set = set()
    for item in answered_questions:
        qid = item.question_id
        user_answer = item.user_answer or ""
        # 이미 attempt 가 있는 qid 는 서버 첫 기록이 권위 → 폴백 제외.
        if not qid or qid in attempted_qids or qid in extra:
            continue
        q = stage_pool.get(qid)
        if q is None:
            continue  # stage 풀 밖 qid → 무시
        if grade_objective(user_answer, q.get("answer", "")):
            extra.add(qid)

    return len(extra)


class AnsweredQuestion(BaseModel):
    question_id: str
    user_answer: str   # 서버가 grade_objective 로 재채점. is_correct 는 무시.


class ProgressUpdateRequest(BaseModel):
    unit: int
    stage: str  # 예: "1-1", "1-2", "1-final"
    score: int
    is_completed: bool = False
    checkpoint: Optional[str] = None
    # 완료 직전 flush 실패 폴백: quiz 답안을 서버가 재채점해 graded 에 합산.
    # 네트워크 유실로 attempt 기록 누락된 정상통과 유저의 영구 소프트락 방지.
    answered_questions: Optional[List[AnsweredQuestion]] = None


@router.get("/")
def get_progress(course_level: str = Query("beginner"), user: dict = Depends(get_current_user)):
    return get_progress_by_user(user["id"], course_level)


@router.post("/")
def update_progress(req: ProgressUpdateRequest, user_ref: dict = Depends(get_current_user)):
    user_id = user_ref["id"]
    course_level = user_ref.get("course_level", "beginner")

    # 비보스 스테이지 완료 신청 시 선행조건 + 서버채점 통과 검증.
    # (boss/miniboss 완료 기록은 각 전담 라우터가 관리 → 여기선 비보스만 게이트)
    #
    # ★ 서버 권위 완료 게이트 (C 어뷰징 방어):
    #   is_completed=True 는 '해당 unit-stage 서버채점 정답이 필요정답수 이상'일 때만 허용.
    #   클라가 is_completed=true 를 위조해도 attempts(서버 재채점) 누적이 없으면 403 으로
    #   막혀 1-1(공개)부터 순차 위조로 유닛 체인을 해금하는 경로가 차단된다.
    #   단, 미니보스로 이미 클리어된 스테이지는 miniboss 라우터가 전투 승리를 검증한
    #   권위이므로 이 카운트 게이트를 면제한다(이중 기준 방지).
    is_boss_stage = "boss" in req.stage
    if req.is_completed and not is_boss_stage:
        assert_stage_access(user_ref, req.unit, req.stage, course_level)

        stage_key = req.stage if "-" in str(req.stage) else f"{req.unit}-{req.stage}"
        miniboss_cleared = stage_key in (user_ref.get("miniboss_cleared_stages") or [])
        if not miniboss_cleared:
            required = _stage_required_correct(course_level, req.unit, req.stage)
            if required > 0:
                first_correct_qids, attempted_qids = _server_graded_correct_qids(
                    user_id, course_level, req.unit, req.stage)
                graded = len(first_correct_qids)   # qid별 '첫 시도 정답'만 집계
                if graded < required:
                    # 1차: 첫시도 정답이 부족 → answered_questions 폴백으로 보충 시도.
                    # 단 attempt 가 이미 있는 qid 는 서버 첫 기록 우선(폴백으로 안 덮음).
                    supp = 0
                    if req.answered_questions:
                        supp = _supplement_from_answered(
                            req.answered_questions, attempted_qids,
                            course_level, req.unit, req.stage,
                        )
                    if graded + supp < required:
                        raise HTTPException(
                            status_code=403,
                            detail=(
                                f"스테이지 통과 조건을 충족하지 않았습니다."
                                f" (서버 채점 정답 {graded + supp}/{required})"
                            ),
                        )

    progress = get_progress_by_user(user_id, course_level)

    existing = next(
        (p for p in progress if p["unit"] == req.unit and p["stage"] == req.stage),
        None,
    )

    award_xp = False
    target_item = None
    if existing:
        if not existing.get("is_completed", False) and req.is_completed:
            award_xp = True
        existing["score"] = max(existing.get("score", 0), req.score)
        existing["is_completed"] = req.is_completed or existing.get("is_completed", False)
        if req.checkpoint:
            if existing.get("checkpoint") != "done":
                existing["checkpoint"] = req.checkpoint
        existing["updated_at"] = now_kst().isoformat()
        target_item = existing
    else:
        award_xp = req.is_completed
        target_item = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "unit": req.unit,
            "stage": req.stage,
            "score": req.score,
            "is_completed": req.is_completed,
            "checkpoint": req.checkpoint,
            "course_level": course_level,
            "created_at": now_kst().isoformat(),
            "updated_at": now_kst().isoformat(),
        }
        progress.append(target_item)

    save_progress_item(target_item)  # progress 저장은 락 밖 (user 와 별개 스토리지)

    stage = req.stage
    xp_gain = 3000 if "boss" in stage else 2000

    user_unit_stages = [
        p for p in progress
        if p.get("unit") == req.unit and p.get("is_completed") is True
    ]
    completed_stage_ids = {p.get("stage") for p in user_unit_stages}

    try:
        from routers.quiz import load_units
        lessons_data = load_units(course_level)
        lesson = next((l for l in lessons_data if l.get("unit_id") == req.unit), None)
        if not lesson:
            raise ValueError(f"Unit metadata not found for unit_id={req.unit}")
        if "stages" not in lesson:
            raise ValueError(f"'stages' key not found in unit metadata for unit_id={req.unit}")
        total_stages = lesson["stages"]
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").error(
            "[C-3] Failed to load unit stages: unit=%s, level=%s, error=%s",
            req.unit, course_level, str(e),
        )
        raise HTTPException(
            status_code=500,
            detail="유닛 완료 판정 중 오류가 발생했습니다. (오류: 유닛 메타데이터 누락)",
        )

    required_stages = {f"{req.unit}-{i}" for i in range(1, total_stages + 1)} | {f"{req.unit}-boss"}
    unit_just_completed = required_stages.issubset(completed_stage_ids)

    # d_quiz3 미션 진척(missions.daily.progress)과 왕관·XP 를 원자 쓰기 경로로 저장.
    # save_user delta-merge 는 Supabase 에서 missions 를 직접 덮어써 last-writer-wins 가 되므로
    # mutate_user_atomic 경로가 필수다. (C-1 [필수])
    def mutator(user: dict) -> dict:
        crowns_awarded = 0
        if unit_just_completed:
            awarded_units = user.get("awarded_crown_units") or []
            val = f"{course_level}-{req.unit}"
            if val not in awarded_units:
                crowns_awarded = 1
                user["crowns"] = (user.get("crowns") or 0) + crowns_awarded
                awarded_units.append(val)
                user["awarded_crown_units"] = awarded_units

        context = {"stage_completed": award_xp, "unit_fully_done": unit_just_completed}
        # xp 신규 지급 중단 → coin/ranking 분리 발급. gp 는 gate 통과 시만.
        amount = xp_gain if award_xp else 0
        rr = grant_reward(user, coin_delta=amount, ranking_score_delta=amount,
                          gp_delta=amount, context=context, event_type="stage_clear")
        reward = {"coin_delta": rr["coin_delta"], "gp_delta": rr["gp_delta"],
                  "ranking_score_delta": rr["ranking_score_delta"]}
        return {"crowns_awarded": crowns_awarded, "events": rr["events"], "reward": reward}

    try:
        user, result = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    serialized = serialize_user(user)
    return {
        "message": "진행상황이 저장되었습니다.",
        # xp_awarded 는 하위호환 표기(=보상 단위). 신규 소비자는 reward.* 를 쓴다.
        "xp_awarded": xp_gain if award_xp else 0,
        "crowns_awarded": result["crowns_awarded"],
        "character": serialized.get("character", "slime"),
        "lv": serialized.get("lv", 1),
        "newly_earned_titles": result["events"]["newly_earned_titles"],
        "reward": result["reward"],
        "user_state": {
            "coin_balance": serialized.get("coin_balance", 0),
            "gp": serialized.get("gp", 0),
            "lv": serialized.get("lv", 1),
            "evolution_stage": get_evolution_stage(serialized),
            "ranking_score": serialized.get("ranking_score", 0),
            "weekly_ranking_score": serialized.get("weekly_ranking_score", 0),
            "crowns": serialized.get("crowns", 0),
        },
    }


@router.get("/stats")
def get_stats(user: dict = Depends(get_current_user)):
    user_id = user["id"]
    course_level = user.get("course_level", "beginner")

    user_progress = get_progress_by_user(user_id, course_level)

    completed = [p for p in user_progress if p.get("is_completed")]
    total_score = sum(p["score"] for p in user_progress)
    avg_score = total_score / len(user_progress) if user_progress else 0

    return {
        "total_stages": len(user_progress),
        # completed_stages 는 progress(is_completed) 에서 파생. SSOT=progress 이며
        # serialize_user 의 동일 파생 계산과 같은 정의를 유지해야 한다(드리프트 방지).
        "completed_stages": len(completed),
        "total_score": total_score,
        "average_score": round(avg_score, 1),
    }
