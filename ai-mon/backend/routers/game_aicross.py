"""game_aicross.py — AICross(에이칸) 전용 데이터 로딩·헬퍼·라우트.

레거시 퍼즐(AICROSS_PUZZLES) 데이터/헬퍼와 신규 진행도(AICROSS_SETS) 로직,
그리고 /aicross/progress, /aicross/start, /aicross/clear 3개 라우트를 포함한다.
"""

import json
import os
import random
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from routers.utils import (
    get_current_user,
    now_kst,
    grant_reward,
    mutate_user_atomic,
    UserNotFoundError,
)
from routers.game_common import (
    MIN_PLAY_SECONDS,
    _make_game_token,
    _verify_game_token,
    _consume_nonce,
    _maybe_reset_daily_xp,
    _record_weekly_ranking,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# 레거시 AICross 퍼즐 데이터 (AICROSS_PUZZLES)
# ---------------------------------------------------------------------------

AICROSS_PUZZLES = {}
try:
    _puzzles_path = os.path.join(os.path.dirname(__file__), "../data/aicross_puzzles.json")
    if os.path.exists(_puzzles_path):
        with open(_puzzles_path, "r", encoding="utf-8") as f:
            AICROSS_PUZZLES = json.load(f)
except Exception as e:
    import logging
    logging.getLogger("uvicorn").error(f"Failed to load aicross_puzzles.json: {e}")

# Fallback basic puzzle if loading fails
if not AICROSS_PUZZLES:
    AICROSS_PUZZLES = {
        "basic_001": {
            "set_label": "기본 퍼즐",
            "grid": [
                ["", "", "", ""],
                ["", "#", "#", ""],
                ["", "", "", ""],
                ["", "", "", ""],
            ],
            "entries": [
                {
                    "id": "A1",
                    "direction": "across",
                    "row": 0,
                    "col": 0,
                    "length": 4,
                    "clue": "파이썬에서 순서가 있는 데이터 묶음을 담는 자료형 이름",
                    "answer": "LIST",
                },
                {
                    "id": "D1",
                    "direction": "down",
                    "row": 0,
                    "col": 0,
                    "length": 4,
                    "clue": "같은 동작을 여러 번 반복해서 실행하는 구조",
                    "answer": "LOOP",
                },
                {
                    "id": "D2",
                    "direction": "down",
                    "row": 0,
                    "col": 3,
                    "length": 4,
                    "clue": "type() 함수로 확인할 수 있는 데이터의 종류",
                    "answer": "TYPE",
                },
                {
                    "id": "A2",
                    "direction": "across",
                    "row": 2,
                    "col": 0,
                    "length": 3,
                    "clue": "객체 지향 프로그래밍을 줄여 부르는 약자",
                    "answer": "OOP",
                },
                {
                    "id": "A3",
                    "direction": "across",
                    "row": 3,
                    "col": 0,
                    "length": 4,
                    "clue": "여러 처리 단계를 연결해 흐르게 만든 구조",
                    "answer": "PIPE",
                },
            ],
        }
    }

AICROSS_DEFAULT_PUZZLE_ID = "set_001" if "set_001" in AICROSS_PUZZLES else "basic_001"


def _aicross_entry_length(entry: dict) -> int:
    if entry.get("length") is not None:
        return int(entry["length"])
    return len(_normalize_aicross_answer(entry.get("answer")))


def _aicross_public_puzzle(puzzle_id: str) -> dict:
    puzzle = AICROSS_PUZZLES.get(puzzle_id) or AICROSS_PUZZLES[list(AICROSS_PUZZLES.keys())[0]]
    return {
        "puzzle_id": puzzle_id,
        "set_label": puzzle.get("set_label", "코딩 명령어 퍼즐"),
        "grid": puzzle["grid"],
        "entries": [
            {
                "id": entry["id"],
                "direction": entry["direction"],
                "row": entry["row"],
                "col": entry["col"],
                "length": _aicross_entry_length(entry),
                "clue": entry["clue"],
            }
            for entry in puzzle["entries"]
        ],
        "max_score": 100,
    }


def _normalize_aicross_answer(value) -> str:
    return "".join(str(value or "").strip().upper().split())


def _aicross_cell_value(answers: dict, row: int, col: int) -> str:
    for key in (f"{row},{col}", f"{row}-{col}"):
        if key in answers:
            return _normalize_aicross_answer(answers[key])[:1]
    return ""


def _score_aicross_answers(puzzle_id: str, answers) -> dict:
    if puzzle_id not in AICROSS_PUZZLES:
        raise HTTPException(status_code=400, detail="Invalid aicross puzzle_id")
    if answers is None:
        answers = {}
    if not isinstance(answers, dict):
        raise HTTPException(status_code=400, detail="answers must be an object")

    puzzle = AICROSS_PUZZLES[puzzle_id]
    normalized = {str(k).upper(): _normalize_aicross_answer(v) for k, v in answers.items()}
    correct = 0
    total = len(puzzle["entries"])

    for entry in puzzle["entries"]:
        entry_id = entry["id"].upper()
        submitted = normalized.get(entry_id)
        if submitted is None:
            d_row = 1 if entry["direction"] == "down" else 0
            d_col = 1 if entry["direction"] == "across" else 0
            submitted = "".join(
                _aicross_cell_value(
                    answers,
                    entry["row"] + d_row * idx,
                    entry["col"] + d_col * idx,
                )
                for idx in range(_aicross_entry_length(entry))
            )
        if submitted == entry["answer"]:
            correct += 1

    score = round((correct / total) * 100) if total else 0
    return {
        "puzzle_id": puzzle_id,
        "correct": correct,
        "total": total,
        "score": score,
    }


# ---------------------------------------------------------------------------
# 에이칸 B-2: 서버 진행도 세트 (신규, 레거시 AICROSS_PUZZLES 와 완전히 분리)
# ---------------------------------------------------------------------------
# backend/data/aicross_sets.json 은 27개 세트(set_index/set_name/grid_size/entries)를
# 담은 "정적 layout" 데이터다. 레거시 backend/data/aicross_puzzles.json(AICROSS_PUZZLES,
# set_001.. 20세트, grid/entries/answer 구조)과는 이름도 내용도 다르며 서로 건드리지 않는다.
# 신규 로직은 이 섹션의 AICROSS_SETS 계열 이름만 사용한다.

AICROSS_SETS = []
try:
    _sets_path = os.path.join(os.path.dirname(__file__), "../data/aicross_sets.json")
    if os.path.exists(_sets_path):
        with open(_sets_path, "r", encoding="utf-8") as f:
            AICROSS_SETS = json.load(f)
except Exception as e:
    import logging
    logging.getLogger("uvicorn").error(f"Failed to load aicross_sets.json: {e}")

AICROSS_REWARD_DAILY_LIMIT = 3


def _aicross_set_count() -> int:
    return len(AICROSS_SETS)


def _aicross_letter_bank(answer: str) -> list:
    """정답 글자를 셔플한 배열(letterBank). 중복 글자는 그대로 유지하고, 원래(정답) 순서와
    같으면 다시 섞어 정답을 그대로 노출하지 않게 한다. 글자 자체는 힌트 UI(글자 셔플칩)용
    이라 노출해도 되지만, 배열 순서가 정답 그대로면 사실상 정답을 알려주는 것이므로 피한다.
    """
    chars = list(answer or "")
    if len(chars) <= 1:
        return chars
    shuffled = chars[:]
    for _ in range(20):
        random.shuffle(shuffled)
        if shuffled != chars:
            break
    return shuffled


def _aicross_set_public_puzzle(set_index: int) -> dict:
    """entries 에서 answer 를 제거한 public puzzle. 프론트는 좌표만으로 그리드를 그린다.
    letterBank 는 answer 글자를 셔플한 배열로, 정답 문자열 자체(순서 있는 answer)는
    아니지만 힌트박스의 글자 셔플칩 UI를 위해 내려준다.
    """
    aicross_set = AICROSS_SETS[set_index]
    return {
        "grid_size": aicross_set.get("grid_size"),
        "entries": [
            {
                "id": entry["id"],
                "direction": entry["direction"],
                "row": entry["row"],
                "col": entry["col"],
                "length": entry["length"],
                "clue": entry.get("clue", ""),
                "easyClue": entry.get("easyClue", ""),
                "letterBank": _aicross_letter_bank(entry.get("answer", "")),
            }
            for entry in aicross_set.get("entries", [])
        ],
    }


def _aicross_reward_count_today(game_rewards: dict, today_kst: str) -> int:
    """오늘 '보상을 받은' 에이칸 판 수. aicross_today_count 는 플레이 횟수가 아니라
    reward>0 로 지급이 실제 이뤄진 판 수(레거시 game_id=aicross 경로와 공유하는 카운터).
    날짜가 오늘이 아니면 아직 저장 전이므로 0으로 계산만 한다(이 시점에서 저장하지 않음).
    """
    if game_rewards.get("aicross_last_date") != today_kst:
        return 0
    return int(game_rewards.get("aicross_today_count", 0) or 0)


def _aicross_progress_snapshot(game_rewards: dict, today_kst: str) -> dict:
    """진행도 스냅샷(조회 전용, 저장 없음). progress/start 양쪽에서 재사용한다."""
    raw_completed = game_rewards.get("aicross_completed_sets")
    completed_set_ids = set()
    if isinstance(raw_completed, list):
        for v in raw_completed:
            try:
                completed_set_ids.add(int(v))
            except (TypeError, ValueError):
                continue

    best_scores = game_rewards.get("aicross_best_scores")
    if not isinstance(best_scores, dict):
        best_scores = {}
    clear_counts = game_rewards.get("aicross_set_clear_counts")
    if not isinstance(clear_counts, dict):
        clear_counts = {}

    total_sets = _aicross_set_count()
    last_set_index = game_rewards.get("aicross_last_set_index")
    if not isinstance(last_set_index, int) or not (0 <= last_set_index < total_sets):
        last_set_index = 0

    sets = []
    next_set_index = None
    for idx, aicross_set in enumerate(AICROSS_SETS):
        completed = idx in completed_set_ids
        if next_set_index is None and not completed:
            next_set_index = idx
        sets.append({
            "index": idx,
            "title": aicross_set.get("set_name", ""),
            "completed": completed,
            "best_score": int(best_scores.get(str(idx), 0) or 0),
            "clear_count": int(clear_counts.get(str(idx), 0) or 0),
        })

    if next_set_index is None:
        # 전체 세트 완료 — 마지막 플레이 세트(없으면 0)로 안전하게 폴백해 복습을 유도한다.
        next_set_index = last_set_index

    today_reward_count = _aicross_reward_count_today(game_rewards, today_kst)

    return {
        "total_sets": total_sets,
        "completed_sets": sorted(completed_set_ids),
        "last_set_index": last_set_index,
        "next_set_index": next_set_index,
        "today_reward_count": today_reward_count,
        "today_reward_limit": AICROSS_REWARD_DAILY_LIMIT,
        "today_reward_remaining": max(0, AICROSS_REWARD_DAILY_LIMIT - today_reward_count),
        "sets": sets,
    }


def _aicross_next_set_index(completed_ids: set, last_set_index: int) -> int:
    """첫 미완료 세트를 추천한다. 전체 완료 시 last_set_index(없으면 0)로 폴백."""
    for idx in range(_aicross_set_count()):
        if idx not in completed_ids:
            return idx
    return last_set_index if 0 <= last_set_index < _aicross_set_count() else 0


def _normalize_aicross_set_answer(value) -> str:
    """대소문자/공백 정규화. 레거시 _normalize_aicross_answer 와 별개 helper."""
    return "".join(str(value or "").strip().upper().split())


def _score_aicross_set_answers(set_index: int, answers) -> dict:
    """aicross_sets.json 의 answer 기준으로 answers(dict {entry_id: 'WORD'})를 채점한다.
    정답 문자열은 서버 내부에서만 비교하고 결과에 노출하지 않는다.
    """
    if answers is None:
        answers = {}
    if not isinstance(answers, dict):
        raise HTTPException(status_code=400, detail="answers must be an object")

    entries = AICROSS_SETS[set_index].get("entries", [])
    normalized = {str(k): _normalize_aicross_set_answer(v) for k, v in answers.items()}
    total = len(entries)
    correct = 0
    for entry in entries:
        submitted = normalized.get(str(entry["id"]))
        if submitted is not None and submitted == _normalize_aicross_set_answer(entry["answer"]):
            correct += 1

    score = round((correct / total) * 100) if total else 0
    return {"correct": correct, "total": total, "score": score}


# ---------------------------------------------------------------------------
# Pydantic 모델
# ---------------------------------------------------------------------------

class AicrossStartRequest(BaseModel):
    set_index: Optional[int] = None


class AicrossClearRequest(BaseModel):
    game_token: str
    set_index: int
    answers: Optional[dict] = None


# ---------------------------------------------------------------------------
# 라우트
# ---------------------------------------------------------------------------

@router.get("/aicross/progress")
def game_aicross_progress(user_ref: dict = Depends(get_current_user)):
    game_rewards = user_ref.get("game_rewards")
    if not isinstance(game_rewards, dict):
        game_rewards = {}
    today_kst = now_kst().date().isoformat()
    return _aicross_progress_snapshot(game_rewards, today_kst)


@router.post("/aicross/start")
def game_aicross_start(req: AicrossStartRequest, user_ref: dict = Depends(get_current_user)):
    game_rewards = user_ref.get("game_rewards")
    if not isinstance(game_rewards, dict):
        game_rewards = {}
    today_kst = now_kst().date().isoformat()
    snapshot = _aicross_progress_snapshot(game_rewards, today_kst)

    set_index = req.set_index if req.set_index is not None else snapshot["next_set_index"]
    total_sets = _aicross_set_count()
    if not isinstance(set_index, int) or not (0 <= set_index < total_sets):
        raise HTTPException(status_code=400, detail="Invalid set_index")

    token = _make_game_token("aicross", user_ref["id"], {"set_index": set_index})
    aicross_set = AICROSS_SETS[set_index]
    return {
        "game_token": token,
        "set_index": set_index,
        "set_label": aicross_set.get("set_name", ""),
        "puzzle": _aicross_set_public_puzzle(set_index),
    }


@router.post("/aicross/clear")
def game_aicross_clear(req: AicrossClearRequest, user_ref: dict = Depends(get_current_user)):
    """서버 채점 + 진행도 저장 + 차등 보상. 저장은 mutate_user_atomic 안에서 원자 처리한다.

    - completed_sets 는 잠금이 아니라 진행도/표시용이다. 완료 세트도 재채점/재보상 대상.
    - 하루 3판은 '보상 제한'. 3판 초과 후에도 채점/completed_sets 저장은 계속 가능하며
      reward=0, already_claimed=True 로만 응답한다.
    - aicross_today_count 는 오늘 '보상을 받은' 판 수 → reward_amount>0 일 때만 증가.
    - aicross_today_count/aicross_last_date/daily_xp 는 레거시 game_id=aicross 경로와 공유.
    """
    user_id = user_ref["id"]
    total_sets = _aicross_set_count()
    if not isinstance(req.set_index, int) or not (0 <= req.set_index < total_sets):
        raise HTTPException(status_code=400, detail="Invalid set_index")

    # --- 상태 무관 토큰 검증(서명·소유자·만료·최소경과)은 원자 경계 밖에서 미리 수행 ---
    token_payload = _verify_game_token(
        req.game_token, "aicross", user_id, MIN_PLAY_SECONDS["aicross"]
    )
    # 토큰이 발급된 세트와 제출 세트가 다르면 거부 (다른 세트 정답 재사용 방지)
    if token_payload.get("set_index") != req.set_index:
        raise HTTPException(status_code=400, detail="Aicross set_index mismatch")

    # 채점은 서버 answer 기준(stateless). nonce 소비/보상/저장은 아래 mutator 안에서.
    score_detail = _score_aicross_set_answers(req.set_index, req.answers)
    score = score_detail["score"]
    today_kst = now_kst().date().isoformat()

    def mutator(user: dict) -> dict:
        game_rewards = user.get("game_rewards", {})
        if not isinstance(game_rewards, dict):
            game_rewards = {}

        # 날짜 롤오버: daily_xp 공유 캡 리셋은 aicross_last_date 갱신 '전에' 수행해야
        # _maybe_reset_daily_xp 의 '오늘 첫 게임' 판정이 올바르다(레거시와 동일 순서).
        if game_rewards.get("aicross_last_date") != today_kst:
            _maybe_reset_daily_xp(game_rewards, today_kst)
            game_rewards["aicross_today_count"] = 0
            game_rewards["aicross_last_date"] = today_kst

        today_count = int(game_rewards.get("aicross_today_count", 0) or 0)

        # nonce 소비: 이 토큰의 clear 를 1회로 제한(진행도/보상 저장 리플레이 차단).
        # 보상 지급 여부와 무관하게 소비 → 3판 초과/저득점 재제출로 clear_count 파밍 방지.
        _consume_nonce(game_rewards, token_payload)

        idx = req.set_index
        idx_key = str(idx)

        completed_list = game_rewards.get("aicross_completed_sets")
        if not isinstance(completed_list, list):
            completed_list = []
        completed_ids = set()
        for v in completed_list:
            try:
                completed_ids.add(int(v))
            except (TypeError, ValueError):
                continue

        best_scores = game_rewards.get("aicross_best_scores")
        if not isinstance(best_scores, dict):
            best_scores = {}
        clear_counts = game_rewards.get("aicross_set_clear_counts")
        if not isinstance(clear_counts, dict):
            clear_counts = {}

        # best_score 갱신(점수 무관, 항상 최고점 유지)
        prev_best = int(best_scores.get(idx_key, 0) or 0)
        if score > prev_best:
            best_scores[idx_key] = score

        # 완료/클리어 카운트: 100점일 때만 갱신 (80~99/실패는 진행도만 유지)
        was_completed = idx in completed_ids
        is_first_completion = False
        clear_count_after = int(clear_counts.get(idx_key, 0) or 0)
        if score == 100:
            clear_count_after = clear_count_after + 1
            clear_counts[idx_key] = clear_count_after
            if not was_completed:
                is_first_completion = True
                completed_ids.add(idx)

        game_rewards["aicross_completed_sets"] = sorted(completed_ids)
        game_rewards["aicross_best_scores"] = best_scores
        game_rewards["aicross_set_clear_counts"] = clear_counts
        game_rewards["aicross_last_set_index"] = idx

        # ── 차등 보상 계산 ──────────────────────────────────────────────
        reward_amount = 0
        already_claimed = False
        coin_awarded = gp_awarded = ranking_awarded = 0

        if today_count >= AICROSS_REWARD_DAILY_LIMIT:
            already_claimed = True  # 하루 3판 보상 소진 (채점/저장은 위에서 이미 완료)
        else:
            if score == 100:
                if clear_count_after == 1:
                    reward_amount = 300     # 신규 세트 첫 완료
                elif clear_count_after in (2, 3):
                    reward_amount = 200     # 완료 세트 복습 1~2회차
                else:
                    reward_amount = 100     # 반복 복습(clear_count 4+)
            elif score >= 80:
                reward_amount = 100         # 부분 성공
            else:
                reward_amount = 0           # 실패

        if reward_amount > 0:
            # daily_xp 공유 캡(2500) 반영 — 캡에 걸리면 실제 지급이 줄 수 있다.
            daily_xp = int(game_rewards.get("daily_xp", 0) or 0)
            if daily_xp + reward_amount > 2500:
                reward_amount = max(0, 2500 - daily_xp)

            if reward_amount > 0:
                game_rewards["daily_xp"] = daily_xp + reward_amount
                _r = grant_reward(
                    user,
                    coin_delta=reward_amount,
                    ranking_score_delta=reward_amount,
                    gp_delta=reward_amount,
                    event_type="game_clear",
                )
                coin_awarded = _r["coin_delta"]
                gp_awarded = _r["gp_delta"]
                ranking_awarded = _r["ranking_score_delta"]
                # 보상을 받은 판만 카운트 증가(오늘 보상 판 수)
                today_count += 1
                game_rewards["aicross_today_count"] = today_count
                game_rewards["aicross_last_date"] = today_kst
                # 주간 랭킹: 실제 지급된 ranking_score 만 반영(캡 후 값). <=0 이면 no-op.
                _record_weekly_ranking(game_rewards, "aicross", ranking_awarded)

        user["game_rewards"] = game_rewards

        next_set_index = _aicross_next_set_index(
            completed_ids, game_rewards.get("aicross_last_set_index", 0)
        )

        return {
            "score": score,
            "correct": score_detail["correct"],
            "total": score_detail["total"],
            "completed": idx in completed_ids,
            "is_first_completion": is_first_completion,
            "set_clear_count": clear_count_after,
            "completed_sets": sorted(completed_ids),
            "next_set_index": next_set_index,
            "today_reward_count": today_count,
            "today_reward_limit": AICROSS_REWARD_DAILY_LIMIT,
            "today_reward_remaining": max(0, AICROSS_REWARD_DAILY_LIMIT - today_count),
            "already_claimed": already_claimed,
            "reward": {
                "coin_delta": coin_awarded,
                "gp_delta": gp_awarded,
                "ranking_score_delta": ranking_awarded,
            },
        }

    try:
        _, result = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")
    return result
