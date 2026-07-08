from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import hmac
import hashlib
import base64
import json
import random
import secrets
import time
from routers.utils import (
    get_current_user,
    get_current_user_optional,
    now_kst,
    iso_week,
    prev_iso_week,
    grant_reward,
    get_evolution_stage,
    current_week_ranking_score,
    SECRET_KEY,
    mutate_user_atomic,
    UserNotFoundError,
    load_users,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# 게임 세션 토큰 (B-4 어뷰징 방어)
# ---------------------------------------------------------------------------
# /game/start 에서 HMAC 서명 토큰을 발급하고, /game/clear 에서 검증한다.
# 보상을 "실제 플레이 세션"에 묶어 무노동 수령 / distance 위조 / 리플레이를 차단.
# 현재 단계: game_token 은 optional (프론트 미연동). 청크 4에서 required 전환 예정.

TOKEN_TTL_SECONDS = 600  # 발급 후 10분 내 clear 만 유효

# 게임별 최소 플레이 시간(초). 즉시 제출(무플레이) 차단용.
MIN_PLAY_SECONDS = {
    "runner": 5,
    "aipang": 5,
    "aizzak": 30,
    "aicross": 5,
    "aibomb": 15,
}
SUPPORTED_GAME_IDS = frozenset(MIN_PLAY_SECONDS)


AICROSS_PUZZLES = {}
try:
    import os
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


def _make_game_token(game_id: str, user_id: str, extra_payload: Optional[dict] = None) -> str:
    """game_id/user_id/발급시각/nonce 를 담아 HMAC-SHA256 서명한 토큰을 만든다."""
    payload = {
        "game_id": game_id,
        "user_id": user_id,
        "ts": int(now_kst().timestamp()),
        "nonce": secrets.token_urlsafe(12),
    }
    if extra_payload:
        payload.update(extra_payload)
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig = hmac.new(SECRET_KEY.encode(), raw, hashlib.sha256).digest()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    mac = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{body}.{mac}"


def _verify_game_token(token: str, game_id: str, user_id: str, elapsed_floor: int):
    """토큰 서명/소유자/만료/최소경과시간을 검증하고 payload(dict)를 반환. 실패 시 400."""
    try:
        body, mac = token.split(".", 1)
        raw = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
        expected = hmac.new(SECRET_KEY.encode(), raw, hashlib.sha256).digest()
        got = base64.urlsafe_b64decode(mac + "=" * (-len(mac) % 4))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid game token")

    if not hmac.compare_digest(expected, got):
        raise HTTPException(status_code=400, detail="Invalid game token signature")

    payload = json.loads(raw.decode())
    if payload.get("game_id") != game_id or payload.get("user_id") != user_id:
        raise HTTPException(status_code=400, detail="Game token mismatch")

    now_ts = int(now_kst().timestamp())
    age = now_ts - int(payload.get("ts", 0))
    if age < 0 or age > TOKEN_TTL_SECONDS:
        raise HTTPException(status_code=400, detail="Game token expired")
    if age < elapsed_floor:
        raise HTTPException(status_code=400, detail="Abnormal gameplay detected (too fast)")

    return payload


def _consume_nonce(game_rewards: dict, payload: dict):
    """nonce 일회성 보장. 사용한 nonce 를 만료시각과 함께 보관하고 만료분은 prune."""
    now_ts = int(now_kst().timestamp())
    used = game_rewards.get("used_tokens")
    if not isinstance(used, dict):
        used = {}
    # 만료된 nonce 정리 (user 객체 비대화 방지)
    used = {n: exp for n, exp in used.items() if isinstance(exp, int) and exp > now_ts}

    nonce = payload.get("nonce")
    if nonce in used:
        raise HTTPException(status_code=400, detail="Game token already used")
    used[nonce] = int(payload.get("ts", now_ts)) + TOKEN_TTL_SECONDS
    game_rewards["used_tokens"] = used


def _maybe_reset_daily_xp(game_rewards: dict, today_kst: str) -> None:
    """공유 daily_xp 캡을 '오늘의 첫 게임' 시점에 한 번만 0으로 리셋한다.

    daily_xp 는 XP 지급 게임(runner/aizzak/aicross/aibomb)이 공유하는 일일 캡이다.
    SUPPORTED_GAME_IDS(=MIN_PLAY_SECONDS 의 key)의 *_last_date 가 전부 오늘이 아닐 때
    (=오늘 아직 아무 게임도 안 함)에만 리셋한다. 개별 분기가 서로를 부분적으로만 확인하던
    기존 방식(aizzak=runner만, aicross=runner+aizzak, runner=무조건)은 특정 실행 순서에서
    다른 게임의 당일 누적분을 지우던 정합성 버그가 있어 이 헬퍼로 통일한다.
    게임 목록을 SUPPORTED_GAME_IDS 에서 파생시켜, 새 미니게임 추가 시 이 하드코딩된
    리스트에 넣는 걸 잊어 리셋 판단에서 조용히 빠지는 회귀를 원천 차단한다.
    aipang 은 XP 는 안 주지만, 오늘의 첫 게임이 될 수 있으므로 리셋 주체에 포함한다.
    """
    if all(
        game_rewards.get(f"{g}_last_date") != today_kst
        for g in SUPPORTED_GAME_IDS
    ):
        game_rewards["daily_xp"] = 0


# ---------------------------------------------------------------------------
# 주간 랭킹 소스: 주간 게임 랭킹 점수 누적 (game_rewards["weekly_ranking"])
# ---------------------------------------------------------------------------
# 랭킹/지난주 우승자의 단일 진실. game_id → 그 주에 실제 지급된 ranking_score(daily 캡
# 반영 후)를 ISO 주별로 누적한다. 게임별 점수 체계(거리/점수/스테이지)가 서로 달라
# 비교 불가하므로, "주간 게임 랭킹 점수 합산"이라는 단일 비교 지표로 통일한다.
#   game_rewards["weekly_ranking"] = { "<ISO주>": { "<game_id>": <누적 ranking_score> } }
# (XP 소스에서 ranking_score 소스로 교체. 리더보드는 coin/gp 가 아니라 이 값으로 정렬한다.)
# 보관은 이번 주 + 지난주 2주만(자동 prune) — user 레코드 비대화 방지.
def _record_weekly_ranking(game_rewards: dict, game_id: str, score: int) -> None:
    """이번 주 game_id 의 주간 랭킹 점수를 누적하고 이번 주/지난주만 남긴다. (in-place)

    score<=0(무보상·이미 클레임·크라운 전용 aipang)이면 아무 것도 하지 않는다 → 랭킹 크레딧 없음.
    같은 임계구역(mutate_user_atomic)에서 fresh 상태에 대해 호출되므로 동시성 안전.
    """
    if score <= 0:
        return
    wk = iso_week()
    prev = prev_iso_week()
    weekly = game_rewards.get("weekly_ranking")
    if not isinstance(weekly, dict):
        weekly = {}
    # 이번 주 + 지난주만 롤링 보관 (오래된 주는 prune)
    weekly = {w: v for w, v in weekly.items() if w in (wk, prev) and isinstance(v, dict)}
    cur = weekly.get(wk)
    if not isinstance(cur, dict):
        cur = {}
    cur[game_id] = int(cur.get(game_id, 0) or 0) + int(score)
    weekly[wk] = cur
    game_rewards["weekly_ranking"] = weekly


class GameStartRequest(BaseModel):
    game_id: str


class GameClearRequest(BaseModel):
    game_id: str
    distance: Optional[int] = None
    score: Optional[int] = None
    puzzle_id: Optional[str] = None
    answers: Optional[dict] = None
    correct_count: Optional[int] = None  # 에이짝 전용: 클라이언트 제출값, 서버에서 범위 검증만
    game_token: str  # B-4: 프론트 배선 완료 후 required 전환


class AicrossStartRequest(BaseModel):
    set_index: Optional[int] = None


class AicrossClearRequest(BaseModel):
    game_token: str
    set_index: int
    answers: Optional[dict] = None


@router.post("/start")
def game_start(req: GameStartRequest, user_ref: dict = Depends(get_current_user)):
    if req.game_id not in SUPPORTED_GAME_IDS:
        raise HTTPException(status_code=400, detail="Invalid game_id")
    if req.game_id == "aicross":
        import random
        puzzle_ids = [k for k in AICROSS_PUZZLES.keys() if k != "basic_001"]
        if not puzzle_ids:
            puzzle_ids = list(AICROSS_PUZZLES.keys())
        puzzle_id = random.choice(puzzle_ids) if puzzle_ids else AICROSS_DEFAULT_PUZZLE_ID
        token = _make_game_token(req.game_id, user_ref["id"], {"puzzle_id": puzzle_id})
        return {
            "game_token": token,
            "game_id": "aicross",
            "puzzle": _aicross_public_puzzle(puzzle_id),
        }
    token = _make_game_token(req.game_id, user_ref["id"])
    return {"game_token": token}


@router.post("/clear")
def game_clear(req: GameClearRequest, user_ref: dict = Depends(get_current_user)):
    user_id = user_ref["id"]

    # KST 기준 날짜 구하기 (UTC + 9)
    today_kst = now_kst().date().isoformat()

    # --- 상태 무관(stateless) 토큰 검증은 원자 경계 밖에서 미리 수행 ---
    # 서명·소유자·만료·최소경과시간 검증은 user 영속 상태와 무관하므로 락 밖에서 OK.
    # nonce '소비'(일회성)는 영속 상태 기준이어야 하므로 아래 mutator 안에서 수행.
    distance_val = None
    submitted_score_result = 0
    aizzak_correct = None
    aizzak_elapsed = None
    aibomb_cleared = None
    aicross_score_detail = None
    if req.game_id == "aipang":
        token_payload = _verify_game_token(
            req.game_token, "aipang", user_id, MIN_PLAY_SECONDS["aipang"]
        )
    elif req.game_id == "runner":
        # 클라이언트 조작 방지: 음수 floor + 상한 검증
        distance_val = max(0, req.distance if req.distance is not None else (req.score or 0))
        if distance_val > 10000:
            raise HTTPException(status_code=400, detail="Abnormal gameplay detected (distance too high)")
        # 최소 경과시간을 distance 에 비례시켜 "높은 distance 즉시 제출" 위조를 차단
        elapsed_floor = max(MIN_PLAY_SECONDS["runner"], distance_val // 60)
        token_payload = _verify_game_token(
            req.game_token, "runner", user_id, elapsed_floor
        )
    elif req.game_id == "aizzak":
        # correct_count 범위 검증 (클라 점수·시간·XP 입력은 무시, 서버가 직접 산출)
        if req.correct_count is None or not (0 <= req.correct_count <= 8):
            raise HTTPException(status_code=400, detail="correct_count는 0~8 범위여야 합니다.")
        token_payload = _verify_game_token(
            req.game_token, "aizzak", user_id, MIN_PLAY_SECONDS["aizzak"]
        )
        # 경과시간: 클라 제출값 불신 — 토큰 발급시각(ts) 기준 서버가 직접 계산
        aizzak_elapsed = int(now_kst().timestamp()) - int(token_payload["ts"])
        aizzak_correct = req.correct_count
    elif req.game_id == "aibomb":
        # correct_count(=클리어 스테이지 수) 범위 검증. 클라 점수·시간·XP 입력은 무시,
        # 서버가 correct_count 로만 XP 산출.
        if req.correct_count is None or not (0 <= req.correct_count <= 10):
            raise HTTPException(status_code=400, detail="correct_count는 0~10 범위여야 합니다.")
        token_payload = _verify_game_token(
            req.game_token, "aibomb", user_id, MIN_PLAY_SECONDS["aibomb"]
        )
        aibomb_cleared = req.correct_count
    elif req.game_id == "aicross":
        token_payload = _verify_game_token(
            req.game_token, "aicross", user_id, MIN_PLAY_SECONDS["aicross"]
        )
        token_puzzle_id = token_payload.get("puzzle_id")
        puzzle_id = req.puzzle_id or token_puzzle_id
        if token_puzzle_id and req.puzzle_id and req.puzzle_id != token_puzzle_id:
            raise HTTPException(status_code=400, detail="Aicross puzzle mismatch")
        if puzzle_id:
            aicross_score_detail = _score_aicross_answers(puzzle_id, req.answers)
            submitted_score_result = aicross_score_detail["score"]
        else:
            submitted_score_result = max(0, min(int(req.score or 0), 100))
            aicross_score_detail = {
                "puzzle_id": None,
                "correct": None,
                "total": None,
                "score": submitted_score_result,
                "legacy_score_only": True,
            }
    else:
        raise HTTPException(status_code=400, detail="Invalid game_id")

    def mutator(user: dict) -> dict:
        """영속 상태에서 새로 읽은 user 기준으로 nonce 소비·캡·보상을 원자 처리."""
        crowns_awarded = 0
        xp_awarded = 0            # 캡 반영 후 '보상 단위'(coin=ranking=gp 후보 동일값)
        coin_awarded = 0
        gp_awarded = 0            # gp_gate 통과(3차 진화>=3) 시에만 실제 지급
        ranking_awarded = 0
        score_result = submitted_score_result
        already_claimed = False

        # game_rewards 딕셔너리 초기화
        game_rewards = user.get("game_rewards", {})
        if not isinstance(game_rewards, dict):
            game_rewards = {}

        # [하위 호환성 및 마이그레이션]
        # 1단계: 레거시 필드 (awarded_game_crowns, runner_plays) 이관
        legacy_crowns = user.pop("awarded_game_crowns", None)
        legacy_plays = user.pop("runner_plays", None)

        if legacy_crowns and isinstance(legacy_crowns, dict):
            aipang_date = legacy_crowns.get("aipang")
            if aipang_date:
                game_rewards["aipang_last_date"] = aipang_date

        if legacy_plays and isinstance(legacy_plays, dict):
            sorted_dates = sorted(legacy_plays.keys())
            if sorted_dates:
                last_date = sorted_dates[-1]
                game_rewards["runner_last_date"] = last_date
                game_rewards["runner_today_count"] = legacy_plays[last_date]

        # 2단계: 이전 game_rewards["aipang"]["last_reward_date"] 및 game_rewards["runner"]["plays"] 형태 마이그레이션
        if "aipang" in game_rewards and isinstance(game_rewards["aipang"], dict):
            old_aipang = game_rewards.pop("aipang", {})
            old_date = old_aipang.get("last_reward_date")
            if old_date:
                game_rewards["aipang_last_date"] = old_date

        if "runner" in game_rewards and isinstance(game_rewards["runner"], dict):
            old_runner = game_rewards.pop("runner", {})
            old_plays = old_runner.get("plays", {})
            if isinstance(old_plays, dict):
                sorted_dates = sorted(old_plays.keys())
                if sorted_dates:
                    last_date = sorted_dates[-1]
                    game_rewards["runner_last_date"] = last_date
                    game_rewards["runner_today_count"] = old_plays[last_date]

        # ── 게임 종류에 따른 보상 처리 ──────────────────────────────────────────
        if req.game_id == "aizzak":
            aizzak_last  = game_rewards.get("aizzak_last_date")
            aizzak_count = game_rewards.get("aizzak_today_count", 0)

            if aizzak_last != today_kst:
                aizzak_count = 0
                # daily_xp 공유 캡: 오늘의 첫 게임일 때만 리셋 (헬퍼로 통일)
                _maybe_reset_daily_xp(game_rewards, today_kst)

            if aizzak_count >= 3:
                already_claimed = True
            else:
                # nonce 소비: 보상 지급과 같은 임계구역 → 동시 동일토큰 이중통과 차단
                _consume_nonce(game_rewards, token_payload)
                aizzak_count += 1
                game_rewards["aizzak_today_count"] = aizzak_count
                game_rewards["aizzak_last_date"]   = today_kst

                # 점수 산출 — 서버가 직접 계산, 클라 입력값 불신
                if aizzak_elapsed <= 60:
                    time_bonus = 300
                elif aizzak_elapsed <= 90:
                    time_bonus = 200
                elif aizzak_elapsed <= 120:
                    time_bonus = 100
                else:
                    time_bonus = 0
                score_result = aizzak_correct * 50 + time_bonus

                # XP 산출
                if score_result >= 700:
                    xp_awarded = 300
                elif score_result >= 600:
                    xp_awarded = 200
                else:
                    xp_awarded = 100


                # 글로벌 일일 게임 XP 캡 (2500)
                daily_xp = game_rewards.get("daily_xp", 0)
                if daily_xp + xp_awarded > 2500:
                    xp_awarded = max(0, 2500 - daily_xp)
                game_rewards["daily_xp"] = daily_xp + xp_awarded
                _r = grant_reward(user, coin_delta=xp_awarded,
                                  ranking_score_delta=xp_awarded,
                                  gp_delta=xp_awarded, event_type="game_clear")
                coin_awarded, gp_awarded, ranking_awarded = (
                    _r["coin_delta"], _r["gp_delta"], _r["ranking_score_delta"])

        elif req.game_id == "aipang":
            if game_rewards.get("aipang_last_date") == today_kst:
                already_claimed = True
            else:
                # nonce 소비를 보상 지급과 같은 임계구역에서 수행 → 동시 동일토큰 이중통과 차단
                _consume_nonce(game_rewards, token_payload)
                # 공유 daily_xp 캡: aipang(크라운 전용)이 오늘의 첫 게임이면 여기서 리셋해야
                # 이후 XP 게임이 전날 잔여 캡에 막히지 않는다.
                _maybe_reset_daily_xp(game_rewards, today_kst)
                game_rewards["aipang_last_date"] = today_kst
                crowns_awarded = 1
                user["crowns"] = user.get("crowns", 0) + crowns_awarded

        elif req.game_id == "aicross":
            aicross_last = game_rewards.get("aicross_last_date")
            aicross_count = game_rewards.get("aicross_today_count", 0)

            if aicross_last != today_kst:
                aicross_count = 0
                _maybe_reset_daily_xp(game_rewards, today_kst)

            if aicross_count >= 3:
                already_claimed = True
            else:
                _consume_nonce(game_rewards, token_payload)
                aicross_count += 1
                game_rewards["aicross_today_count"] = aicross_count
                game_rewards["aicross_last_date"] = today_kst

                if score_result >= 100:
                    xp_awarded = 200
                elif score_result >= 80:
                    xp_awarded = 150
                elif score_result > 0:
                    xp_awarded = 100

                daily_xp = game_rewards.get("daily_xp", 0)
                if daily_xp + xp_awarded > 2500:
                    xp_awarded = max(0, 2500 - daily_xp)

                game_rewards["daily_xp"] = daily_xp + xp_awarded
                _r = grant_reward(user, coin_delta=xp_awarded,
                                  ranking_score_delta=xp_awarded,
                                  gp_delta=xp_awarded, event_type="game_clear")
                coin_awarded, gp_awarded, ranking_awarded = (
                    _r["coin_delta"], _r["gp_delta"], _r["ranking_score_delta"])

        elif req.game_id == "aibomb":
            aibomb_last  = game_rewards.get("aibomb_last_date")
            aibomb_count = game_rewards.get("aibomb_today_count", 0)

            if aibomb_last != today_kst:
                aibomb_count = 0
                _maybe_reset_daily_xp(game_rewards, today_kst)

            if aibomb_count >= 3:
                already_claimed = True
            else:
                # nonce 소비: 보상 지급과 같은 임계구역 → 동시 동일토큰 이중통과 차단
                _consume_nonce(game_rewards, token_payload)
                aibomb_count += 1
                game_rewards["aibomb_today_count"] = aibomb_count
                game_rewards["aibomb_last_date"]   = today_kst

                # XP 산출 — 서버가 correct_count(클리어 스테이지 수)로만 산출
                # 확정 스펙: 한 판 최대 100, 하루 3판(캡)=300
                if aibomb_cleared >= 10:
                    xp_awarded = 100
                elif aibomb_cleared >= 9:
                    xp_awarded = 70
                elif aibomb_cleared >= 7:
                    xp_awarded = 50
                else:
                    xp_awarded = 0

                # 글로벌 일일 게임 XP 캡 (2500)
                daily_xp = game_rewards.get("daily_xp", 0)
                if daily_xp + xp_awarded > 2500:
                    xp_awarded = max(0, 2500 - daily_xp)
                game_rewards["daily_xp"] = daily_xp + xp_awarded
                _r = grant_reward(user, coin_delta=xp_awarded,
                                  ranking_score_delta=xp_awarded,
                                  gp_delta=xp_awarded, event_type="game_clear")
                coin_awarded, gp_awarded, ranking_awarded = (
                    _r["coin_delta"], _r["gp_delta"], _r["ranking_score_delta"])

        else:  # runner
            runner_last = game_rewards.get("runner_last_date")
            runner_count = game_rewards.get("runner_today_count", 0)

            # 날짜가 바뀌었으면 카운트 초기화
            if runner_last != today_kst:
                runner_count = 0
                _maybe_reset_daily_xp(game_rewards, today_kst)

            if runner_count >= 5:
                already_claimed = True
            else:
                # nonce 소비를 보상 지급과 같은 임계구역에서 수행
                _consume_nonce(game_rewards, token_payload)
                runner_count += 1
                game_rewards["runner_today_count"] = runner_count
                game_rewards["runner_last_date"] = today_kst

                if distance_val < 1000:
                    xp_awarded = 200
                elif distance_val <= 3000:
                    xp_awarded = 350
                else:
                    xp_awarded = 500

                # 일일 게임 XP 캡 확인 (최대 2500) — fresh 상태 기준이라 캡도 원자적
                daily_xp = game_rewards.get("daily_xp", 0)
                if daily_xp + xp_awarded > 2500:
                    xp_awarded = max(0, 2500 - daily_xp)

                game_rewards["daily_xp"] = daily_xp + xp_awarded
                _r = grant_reward(user, coin_delta=xp_awarded,
                                  ranking_score_delta=xp_awarded,
                                  gp_delta=xp_awarded, event_type="game_clear")
                coin_awarded, gp_awarded, ranking_awarded = (
                    _r["coin_delta"], _r["gp_delta"], _r["ranking_score_delta"])

        # 주간 랭킹 소스 누적 (실제 지급된 ranking_score 기준, 캡 반영 후). <=0 이면 no-op.
        _record_weekly_ranking(game_rewards, req.game_id, ranking_awarded)

        user["game_rewards"] = game_rewards
        # 파생 카운터(boss_cleared/completed_stages) strip 은 mutate_user_atomic 코어가
        # 일괄 처리(SSOT). 여기서 따로 pop 하지 않는다.

        result = {
            "crowns_awarded": crowns_awarded,
            # xp_awarded 는 하위호환 표기(=보상 단위). 신규 소비자는 reward.* 를 쓴다.
            "xp_awarded": xp_awarded,
            "score": score_result,
            "already_claimed": already_claimed,
            "reward": {
                "coin_delta": coin_awarded,
                "gp_delta": gp_awarded,
                "ranking_score_delta": ranking_awarded,
            },
            "user_state": {
                "coin_balance": user.get("coin_balance", 0),
                "gp": user.get("gp", 0),
                "lv": user.get("lv", 1),
                "evolution_stage": get_evolution_stage(user),
                "ranking_score": user.get("ranking_score", 0),
                "weekly_ranking_score": current_week_ranking_score(user),
                "crowns": user.get("crowns", 0),
            },
            # 레거시 표시 필드 유지(프론트 전환 전 하위호환)
            "total_crowns": user.get("crowns", 0),
            "total_xp": user.get("xp", 0),
        }
        if req.game_id == "aicross" and aicross_score_detail:
            result.update({
                "puzzle_id": aicross_score_detail["puzzle_id"],
                "correct": aicross_score_detail["correct"],
                "total": aicross_score_detail["total"],
            })
        return result

    try:
        _, result = mutate_user_atomic(user_id, mutator)
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")
    return result


# ---------------------------------------------------------------------------
# 에이칸 B-2: 서버 진행도 API (신규, 레거시 /start·/clear 와 별개 라우트)
# ---------------------------------------------------------------------------
# 이 단계(프롬프트 3)에서는 progress 조회와 start 발급만 구현한다. 채점/completed_sets
# 저장/차등 보상은 POST /game/aicross/clear(다음 단계)에서 처리한다. 하루 3판 보상 카운트
# (aicross_today_count/aicross_last_date)는 레거시 game_id=aicross 경로와 같은 필드를
# 공유하므로 여기서는 읽기만 하고 쓰지 않는다(저장은 clear 단계에서 원자적으로 처리).

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


# ---------------------------------------------------------------------------
# 미니게임 주간 랭킹 (읽기 전용 집계)
# ---------------------------------------------------------------------------
# 지표: 주간 게임 랭킹 점수 합산(_record_weekly_ranking 로 누적된 game_rewards["weekly_ranking"]).
# - GET /game/ranking          : 전 게임 합산 Top N + 내 순위 (홈 게임 탭 요약)
# - GET /game/ranking/by-game  : 게임별 Top N + 내 순위 + 지난주 우승자 (전체보기 페이지)
# - GET /game/ranking/overall  : top-level 누적 ranking_score(게임+미션+보스 합산, 소비
#                                없음) 기준 Top N + 내 순위. 위 두 주간 엔드포인트와는
#                                별개 지표이며 서로 영향을 주지 않는다.
# 더미 없음: 데이터가 없으면 빈 목록 / last_week_winner=null 을 그대로 반환한다.

# 랭킹에 노출할 XP 지급 게임. 에이팡(aipang)은 크라운 전용(XP 0)이라 점수 랭킹에서 제외.
RANKED_GAMES = (
    ("runner", "에이런"),
    ("aizzak", "에이짝"),
    ("aicross", "AI 크로스워드"),
    ("aibomb", "에이밤"),
)
_GAME_TITLES = dict(RANKED_GAMES)
RANKING_WEIGHT = {
    "runner": 1.0,
    "aizzak": 1.0,
    "aicross": 1.0,
    "aibomb": 1.0,
}

_RANKING_CACHE_TTL = 30
_ranking_cache = {}


def _cached_ranking(cache_key: str, builder):
    now = time.monotonic()
    entry = _ranking_cache.get(cache_key)
    if entry and now - entry[0] < _RANKING_CACHE_TTL:
        return entry[1]

    result = builder()
    _ranking_cache[cache_key] = (now, result)
    return result


def _weekly_score_map(user: dict, wk: str) -> dict:
    """해당 유저의 지정 ISO 주 게임별 랭킹 점수 맵 {game_id: score}. 방어적으로 정제한다."""
    gr = user.get("game_rewards")
    if not isinstance(gr, dict):
        return {}
    weekly = gr.get("weekly_ranking")
    if not isinstance(weekly, dict):
        return {}
    wkmap = weekly.get(wk)
    if not isinstance(wkmap, dict):
        return {}
    out = {}
    for gid, v in wkmap.items():
        if gid in _GAME_TITLES and isinstance(v, (int, float)) and v > 0:
            out[gid] = int(v)
    return out


def _ranking_weekly_score_map(user: dict, wk: str) -> dict:
    raw = _weekly_score_map(user, wk)
    result = {}
    for game_id, score in raw.items():
        weight = RANKING_WEIGHT.get(game_id, 1.0)
        result[game_id] = int(round(int(score or 0) * weight))
    return result


def _display_nickname(user: dict) -> str:
    return (user.get("nickname") or user.get("username") or "익명").strip() or "익명"


def _rank_entries(entries: list) -> list:
    """점수 desc 정렬 후 동점자 동순위(competition ranking: 1,2,2,4)를 부여한다."""
    ordered = sorted(entries, key=lambda e: (-e["score"], e["nickname"]))
    rank = 0
    prev_score = None
    for i, e in enumerate(ordered):
        if e["score"] != prev_score:
            rank = i + 1
            prev_score = e["score"]
        e["rank"] = rank
    return ordered


def _clamp_limit(limit) -> int:
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = 3
    return max(1, min(limit, 50))


def _me_row(ranked: list, user_ref: Optional[dict]):
    """로그인 유저의 순위 행. 이번 주 기록이 없으면 rank='-', score=0."""
    if not user_ref:
        return None
    mine = next((e for e in ranked if e["user_id"] == user_ref["id"]), None)
    if mine:
        return {"rank": mine["rank"], "character": mine["character"], "score": mine["score"]}
    return {"rank": "-", "character": user_ref.get("character") or "slime", "score": 0}


def _compute_last_week_winner(users: list, prev_wk: str) -> Optional[dict]:
    """지난주 게임 XP 합산 1위. 데이터 없으면 None (더미 없음).

    게임명(game_title)은 그 유저가 지난주 XP 를 가장 많이 얻은 게임으로 표기한다.
    """
    best = None  # (total, nickname, user, per_game_map)
    for u in users:
        m = _ranking_weekly_score_map(u, prev_wk)
        total = sum(m.values())
        if total <= 0:
            continue
        nick = _display_nickname(u)
        if best is None or total > best[0] or (total == best[0] and nick < best[1]):
            best = (total, nick, u, m)
    if best is None:
        return None
    total, nick, u, m = best
    top_gid = max(m, key=lambda g: m[g]) if m else None
    return {
        "nickname": nick,
        "character": u.get("character") or "slime",
        "score": total,
        "game_title": _GAME_TITLES.get(top_gid),
    }


@router.get("/ranking/overall")
def game_ranking_overall(limit: int = 3, user_ref: Optional[dict] = Depends(get_current_user_optional)):
    """누적 랭킹 — 유저의 top-level 누적 ranking_score(게임+미션+보스 합산 적립분,
    grant_reward 로 쌓이는 소비 없는 값) 기준 Top N + 내 순위.

    기존 주간 게임 랭킹(/ranking, /ranking/by-game)과는 별개 지표다. 저 둘은 이번 주
    게임 플레이만(game_rewards["weekly_ranking"]) 집계하며 절대 건드리지 않는다.
    coin_balance/gp 로는 정렬하지 않는다 — 오직 누적 ranking_score.
    """
    limit = _clamp_limit(limit)
    user_id = user_ref.get("id") if user_ref else "anon"
    cache_key = f"ranking_overall:{limit}:{user_id}"

    def build():
        entries = []
        for u in load_users():
            if u.get("deleted_at"):
                continue
            score = int(u.get("ranking_score") or 0)
            if score <= 0:
                continue
            entries.append({
                "user_id": u.get("id"),
                "nickname": _display_nickname(u),
                "character": u.get("character") or "slime",
                "score": score,
            })
        ranked = _rank_entries(entries)
        top = [
            {"rank": e["rank"], "nickname": e["nickname"], "character": e["character"], "score": e["score"]}
            for e in ranked[:limit]
        ]
        return {"top": top, "me": _me_row(ranked, user_ref)}

    return _cached_ranking(cache_key, build)


@router.get("/ranking")
def game_ranking(limit: int = 3, user_ref: Optional[dict] = Depends(get_current_user_optional)):
    """통합 '이번 주 미니게임 랭킹' — 주간 게임 XP 합산 Top N + 내 순위."""
    limit = _clamp_limit(limit)
    wk = iso_week()
    user_id = user_ref.get("id") if user_ref else "anon"
    cache_key = f"ranking:{wk}:{limit}:{user_id}"

    def build():
        entries = []
        for u in load_users():
            if u.get("deleted_at"):
                continue
            total = sum(_ranking_weekly_score_map(u, wk).values())
            if total <= 0:
                continue
            entries.append({
                "user_id": u.get("id"),
                "nickname": _display_nickname(u),
                "character": u.get("character") or "slime",
                "score": total,
            })
        ranked = _rank_entries(entries)
        top = [
            {"rank": e["rank"], "nickname": e["nickname"], "character": e["character"], "score": e["score"]}
            for e in ranked[:limit]
        ]
        return {"top": top, "me": _me_row(ranked, user_ref)}

    return _cached_ranking(cache_key, build)


@router.get("/ranking/by-game")
def game_ranking_by_game(limit: int = 3, user_ref: Optional[dict] = Depends(get_current_user_optional)):
    """게임별 주간 XP Top N + 내 순위 + 지난주 우승자 배너 데이터."""
    limit = _clamp_limit(limit)
    wk = iso_week()
    prev_wk = prev_iso_week()
    user_id = user_ref.get("id") if user_ref else "anon"
    cache_key = f"ranking_by_game:{wk}:{prev_wk}:{limit}:{user_id}"

    def build():
        users = [u for u in load_users() if not u.get("deleted_at")]

        games = []
        for gid, title in RANKED_GAMES:
            entries = []
            for u in users:
                score = _ranking_weekly_score_map(u, wk).get(gid, 0)
                if score <= 0:
                    continue
                entries.append({
                    "user_id": u.get("id"),
                    "nickname": _display_nickname(u),
                    "character": u.get("character") or "slime",
                    "score": score,
                })
            ranked = _rank_entries(entries)
            top = [
                {"rank": e["rank"], "nickname": e["nickname"], "character": e["character"], "score": e["score"]}
                for e in ranked[:limit]
            ]
            games.append({
                "game_id": gid,
                "title": title,
                "top": top,
                "me": _me_row(ranked, user_ref),
            })

        return {
            "games": games,
            "last_week_winner": _compute_last_week_winner(users, prev_wk),
        }

    return _cached_ranking(cache_key, build)
