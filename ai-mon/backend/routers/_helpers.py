"""순수 leaf 유틸리티 — routers.utils 에서 분리한 무상태 헬퍼 모음.

이 모듈은 프로젝트 내부의 어떤 모듈도 import 하지 않는다(순환 방지, 최하위 레이어).
스토리지 백엔드 전역(USE_SUPABASE / supabase / *_FILE)에 의존하는 코드는 절대 넣지 않는다.
routers.utils 가 여기 정의를 그대로 re-export 하므로, 외부는 계속
`from routers.utils import ...` 로 접근한다.
"""

import copy


# ── 예외 ──────────────────────────────────────────────────────────────────────
class UserNotFoundError(Exception):
    """mutate_user_atomic: 대상 유저가 존재하지 않음."""
    pass


class UserSaveError(Exception):
    """저장이 '조용한 덮어쓰기' 없이는 완료될 수 없음(lost-update 위험). 호출부로 거부 신호."""
    pass


# ── 문자열/구조 헬퍼 ──────────────────────────────────────────────────────────
def normalize_nickname(nickname: str | None) -> str:
    return str(nickname or "").strip()


def _merge_dicts(current: dict, original: dict, modified: dict) -> dict:
    res = copy.deepcopy(current)
    for k, v in modified.items():
        if k not in original:
            res[k] = copy.deepcopy(v)
        elif original[k] != v:
            if isinstance(v, (int, float)) and isinstance(original[k], (int, float)) and isinstance(current.get(k), (int, float)):
                delta = v - original[k]
                res[k] = current.get(k, 0) + delta
            elif isinstance(v, dict) and isinstance(original[k], dict) and isinstance(current.get(k), dict):
                res[k] = _merge_dicts(current.get(k, {}), original[k], v)
            else:
                res[k] = copy.deepcopy(v)
    for k in list(original.keys()):
        if k not in modified:
            res.pop(k, None)
    return res


# ── attempts 진단 로그 헬퍼 ──────────────────────────────────────────────────
def _attempt_log_context(item: dict) -> dict:
    """Return only non-sensitive attempt fields for diagnostics."""
    allowed = {
        "id",
        "user_id",
        "question_id",
        "unit",
        "stage",
        "level",
        "mode",
        "is_correct",
        "answered_at",
    }
    return {k: item.get(k) for k in allowed if k in item}


# 레슨(채점 결과가 오답 발생원) 모드 vs 복습(맞히면 오답을 해소하는) 모드
LESSON_MODES = {"quiz", "miniboss"}
REVIEW_MODES = {"train", "random", "boss_rush"}


# ── 파생 카운터 SSOT 정책 (boss_cleared / completed_stages) ────────────────────
# 이 두 값의 단일 진실(SSOT)은 progress(+ endboss_cleared_levels)다.
# serialize_user 가 매 응답마다 progress 기준으로 *파생 계산*하므로, user 레코드에
# 절대 영속화하면 안 된다(영속 stale 값 ↔ 파생 계산값 드리프트의 원인).
# 영속화 차단을 모든 쓰기 경로에서 보장하기 위해 mutate_user_atomic 코어에서
# write 직전 strip 한다. (save_user 도 같은 키를 pop — 이중 안전망)
# 부가 효과: Supabase users 테이블엔 이 두 컬럼이 없으므로, 레거시/직렬화 잔재로
# 키가 끼면 update 가 "column not found" 로 500 난다. 코어 strip 이 이를 원천 차단.
_DERIVED_USER_FIELDS = ("boss_cleared", "completed_stages")


def _strip_derived_fields(user: dict) -> None:
    """progress 파생 카운터를 영속화 직전 제거한다. SSOT=progress. (제자리 변경)"""
    for k in _DERIVED_USER_FIELDS:
        user.pop(k, None)


# ── 레벨 계산 (XP 곡선) ───────────────────────────────────────────────────────
def calc_level(xp: int) -> int:
    """XP 기준 레벨 계산 (최대 30레벨)"""
    lv = 1
    accumulated = 0
    while lv < 30:
        needed = lv * 1000
        if xp < accumulated + needed:
            break
        accumulated += needed
        lv += 1
    return lv


# ── 진화 단계(evolution_stage) ↔ 캐릭터 매핑 ──────────────────────────────────
# evolution_stage(0~3) 가 성장의 단일 소스이며, character 는 여기서 파생되는
# 표시값이다. 진화는 엔드보스 클리어(routers/endboss.py)에서 evolution_stage 를
# 올릴 때만 발생한다.
CHARACTER_TO_STAGE = {"slime": 0, "robot": 1, "speech_bubble": 2, "final_ghost": 3}
STAGE_TO_CHARACTER = {v: k for k, v in CHARACTER_TO_STAGE.items()}


def character_for_stage(stage: int) -> str:
    """evolution_stage → 대표 캐릭터. 범위를 벗어나면 0~3 으로 클램프한다."""
    s = max(0, min(3, int(stage or 0)))
    return STAGE_TO_CHARACTER[s]
