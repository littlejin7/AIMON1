"""유저 상태(도메인) mutation 로직 — routers.utils 에서 분리.

user dict 를 제자리(in-place)에서 변경/직렬화하는 도메인 계층. 저장은 하지 않는다
(호출부가 mutate_user_atomic / save_user 로 커밋). 스토리지 백엔드 전역
(USE_SUPABASE / supabase / *_FILE)에는 의존하지 않으며, 스토리지 읽기가 필요한
serialize_user 만 routers.utils 를 통해 call-time 로 역참조한다(iso_week /
get_progress_by_user). 이렇게 해야 테스트가 routers.utils.* 를 몽키패치했을 때
그대로 반영된다.

routers.utils 가 여기 정의를 re-export 하므로, 외부는 계속
`from routers.utils import ...` 로 접근한다.
"""

import logging

import routers.utils as _u  # call-time 역참조 전용 (iso_week / get_progress_by_user)
from routers._helpers import CHARACTER_TO_STAGE

logger = logging.getLogger("uvicorn.error")


# ── 코스 레벨(course_level) 파생 / 배치 / 승급 ────────────────────────────────
COURSE_LEVEL_ORDER = ("beginner", "intermediate", "advanced")
NEXT_COURSE_LEVEL = {
    "beginner": "intermediate",
    "intermediate": "advanced",
}


def derive_unlocked_course_levels(user: dict) -> list[str]:
    """Return course levels unlocked by endboss / unit-boss clear history.

    언락 판정은 endboss_cleared_levels 와 unitboss_cleared_units 로만 결정한다.
    (progress 기반 확장 루프는 제거 — 언락 SSOT 를 보스 클리어 이력으로 단일화.)

    승격은 순차(sequential)다: 상위 레벨이 열리면 그 아래 레벨도 모두 열린 것으로
    간주해 항상 COURSE_LEVEL_ORDER 의 '연속 prefix' 를 반환한다. 따라서
    derive_course_level_from_endboss() 의 unlocked[-1] 이 중간 레벨을 건너뛰지 않는다.
    """
    cleared = user.get("endboss_cleared_levels")
    if not isinstance(cleared, list):
        cleared = []
    cleared_set = set(cleared)

    unlocked_set = {"beginner"}
    if "beginner" in cleared_set or "intermediate" in cleared_set:
        unlocked_set.add("intermediate")
    if "intermediate" in cleared_set or "advanced" in cleared_set:
        unlocked_set.add("advanced")

    for item in user.get("unitboss_cleared_units") or []:
        if not isinstance(item, str) or "-" not in item:
            continue
        level = item.split("-", 1)[0]
        if level in COURSE_LEVEL_ORDER:
            unlocked_set.add(level)

    # 순차 보장: 가장 높은 언락 레벨까지의 연속 prefix 로 채운다(건너뜀 방지).
    highest_idx = 0
    for i, level in enumerate(COURSE_LEVEL_ORDER):
        if level in unlocked_set:
            highest_idx = i
    return list(COURSE_LEVEL_ORDER[: highest_idx + 1])


def derive_course_level_from_endboss(user: dict) -> str:
    """Return the highest course level unlocked by cleared endboss records."""
    unlocked = derive_unlocked_course_levels(user)
    return unlocked[-1]


def course_level_floor(level: str) -> list[str]:
    """Return the sequential course prefix up to level."""
    idx = COURSE_LEVEL_ORDER.index(level) if level in COURSE_LEVEL_ORDER else 0
    return list(COURSE_LEVEL_ORDER[: idx + 1])


def apply_level_test_placement(user: dict, level: str) -> str:
    """Apply level-test placement and mark lower tiers as recognized clears.

    A user placed into intermediate/advanced should not see the tiers below that
    placement as locked. We record only lower tiers as cleared; the placed tier
    itself remains the current learning target.
    """
    level = level if level in COURSE_LEVEL_ORDER else "beginner"
    user["course_level"] = level
    user["is_level_tested"] = True

    lower_levels = course_level_floor(level)[:-1]

    cleared = user.get("endboss_cleared_levels")
    if not isinstance(cleared, list):
        cleared = []
    for lower in lower_levels:
        if lower not in cleared:
            cleared.append(lower)
    user["endboss_cleared_levels"] = cleared

    max_unlocked = user.get("max_unlocked_unit")
    if not isinstance(max_unlocked, dict):
        old_val = max_unlocked if isinstance(max_unlocked, int) else 1
        max_unlocked = {"beginner": old_val, "intermediate": 1, "advanced": 1}
    for lv in COURSE_LEVEL_ORDER:
        max_unlocked.setdefault(lv, 1)
    for lower in lower_levels:
        max_unlocked[lower] = max(max_unlocked.get(lower, 1), 9)
    user["max_unlocked_unit"] = max_unlocked

    completed_units = user.get("completed_units")
    if not isinstance(completed_units, dict):
        old_val = completed_units if isinstance(completed_units, int) else 0
        completed_units = {"beginner": old_val, "intermediate": 0, "advanced": 0}
    for lv in COURSE_LEVEL_ORDER:
        completed_units.setdefault(lv, 0)
    for lower in lower_levels:
        completed_units[lower] = max(completed_units.get(lower, 0), 8)
    user["completed_units"] = completed_units

    return level


def promote_course_level_from_endboss(user: dict) -> bool:
    """Mutate user.course_level when endboss clear history unlocks the next level.

    단조 승급만 허용한다(강등 금지). 레벨테스트로 course_level 이 이미 앞서 있는
    유저가 target_level 로 하위 엔드보스를 클리어해도, 그 하위 레벨의 derive 결과가
    현재보다 낮으면 course_level 을 내리지 않는다.
    """
    current = user.get("course_level", "beginner")
    promoted = derive_course_level_from_endboss(user)
    current_idx = COURSE_LEVEL_ORDER.index(current) if current in COURSE_LEVEL_ORDER else 0
    promoted_idx = COURSE_LEVEL_ORDER.index(promoted) if promoted in COURSE_LEVEL_ORDER else 0
    if promoted_idx > current_idx:
        user["course_level"] = promoted
        return True
    return False


# ── 진화 단계(evolution_stage) ↔ 신규 재화/성장 필드 ─────────────────────────
# evolution_stage(0~3) 가 성장의 단일 소스이며, character 는 여기서 파생되는
# 표시값이다. 진화는 엔드보스 클리어(routers/endboss.py)에서 evolution_stage 를
# 올릴 때만 발생한다. apply_xp 는 더 이상 진화를 트리거하지 않는다.
def get_evolution_stage(user: dict) -> int:
    """유저의 진화 단계(0~3)를 반환한다.

    evolution_stage 필드가 있으면 그 값을, 없으면(레거시 유저) 기존 character
    로부터 산출한다. 실제 DB backfill 은 3단계에서 수행하며, 그 전까지는 런타임
    파생으로 호환한다.
    """
    stage = user.get("evolution_stage")
    if isinstance(stage, int) and not isinstance(stage, bool):
        return max(0, min(3, stage))
    return CHARACTER_TO_STAGE.get(user.get("character") or "slime", 0)


def gp_gate(user: dict, gp_delta: int) -> int:
    """GP 게이트: 3차 진화(evolution_stage>=3) 전에는 GP 가 절대 발생하지 않는다.

    `if evolution_stage < 3: gp_delta = 0`. 보상 계산부(게임/스테이지/보스)가
    공통으로 재사용한다. 보스 클리어 자체는 gp_delta 0 이 기본이다.
    """
    return int(gp_delta) if get_evolution_stage(user) >= 3 else 0


# 신규 재화/성장/랭킹 필드의 코드상 기본값(누적 카운터류). purchased_themes 와
# 동일하게 serialize_user 에서 런타임 기본값으로 주입한다. 실제 DB backfill
# (및 legacy_xp_snapshot 스냅샷)은 3단계에서 수행한다.
def reward_field_defaults() -> dict:
    return {
        "coin_balance": 0,
        "total_coin_earned": 0,
        "gp": 0,
        "ranking_score": 0,
        "weekly_ranking_score": 0,
    }


def ensure_reward_fields(user: dict) -> dict:
    """유저 dict 에 신규 재화/성장 필드가 없으면 기본값을 채운다(제자리 변경).

    - 누적 카운터(coin_balance 등): reward_field_defaults() 기본값.
    - evolution_stage: 없으면 character 로부터 파생한 값으로 채운다.
    기존 값이 있으면 절대 덮어쓰지 않는다. xp/crowns 는 건드리지 않는다.
    """
    for k, v in reward_field_defaults().items():
        if user.get(k) is None:
            user[k] = v
    ev = user.get("evolution_stage")
    if not isinstance(ev, int) or isinstance(ev, bool):
        user["evolution_stage"] = get_evolution_stage(user)
    return user


# ── GP → 레벨 곡선 (임시 밸런스) ──────────────────────────────────────────────
# lv 는 3차 진화(evolution_stage>=3) 이후에만 의미를 갖는다. 그 전에는 신규
# 레벨업이 없고 기존 lv 값은 동결된다(레거시 xp 로 lv 를 올리지 않는다). 3차 진화
# 후 lv 는 gp 누적으로만 오른다. [임시 밸런스] 아래 상수만 조정하면 커브가 바뀐다.
GP_PER_LEVEL = 1000   # [임시 밸런스] 레벨당 필요 GP (선형). 추후 커브 교체 가능.


def calc_level_from_gp(gp: int) -> int:
    """3차 진화 후 gp 누적으로 얻는 '추가 레벨 수'.
    [임시 밸런스] 선형 — GP_PER_LEVEL 마다 +1."""
    return max(0, int(gp or 0)) // GP_PER_LEVEL


def recompute_level_from_gp(user: dict) -> None:
    """레벨 재계산(제자리). 정책:
    - evolution_stage < 3: 신규 레벨업 없음 → lv 동결(변경하지 않음).
    - evolution_stage >= 3: 진화 시점 lv 를 gp_level_base 로 1회 캡처하고,
      lv = max(현재 lv, gp_level_base + calc_level_from_gp(gp)). gp 로만 증가.
    lv 는 절대 감소하지 않는다.
    """
    if get_evolution_stage(user) < 3:
        return
    base = user.get("gp_level_base")
    if not isinstance(base, int) or isinstance(base, bool):
        base = user.get("lv") or 1
        user["gp_level_base"] = base
    target = base + calc_level_from_gp(user.get("gp") or 0)
    user["lv"] = max(user.get("lv") or 1, target)


# ── 주간 랭킹 파생 / 직렬화 ───────────────────────────────────────────────────
def current_week_ranking_score(user: dict) -> int:
    """현재 ISO 주의 게임 랭킹 점수 합. 게임별 주간 맵(game_rewards["weekly_ranking"])
    에서 계산한다. 주가 바뀌면 해당 주 키가 없어 0 이 되므로 자동으로 주간 리셋된다.
    (상위 스칼라 weekly_ranking_score 는 저장하지 않고 이 파생값을 응답에 노출한다.)
    """
    gr = user.get("game_rewards")
    if not isinstance(gr, dict):
        return 0
    weekly = gr.get("weekly_ranking")
    if not isinstance(weekly, dict):
        return 0
    wkmap = weekly.get(_u.iso_week())
    if not isinstance(wkmap, dict):
        return 0
    total = 0
    for v in wkmap.values():
        if isinstance(v, (int, float)) and v > 0:
            total += int(v)
    return total


def serialize_user(user: dict) -> dict:
    # 1. Make a copy of user
    res = user.copy()

    # 2. Get current course level
    course_level = res.get("course_level", "beginner")
    if course_level not in COURSE_LEVEL_ORDER:
        course_level = "beginner"
    res["course_level"] = course_level
    unlocked_levels = set(derive_unlocked_course_levels(res))
    unlocked_levels.update(course_level_floor(course_level))
    res["unlocked_course_levels"] = [
        level for level in COURSE_LEVEL_ORDER if level in unlocked_levels
    ]

    cleared_levels = res.get("endboss_cleared_levels")
    if not isinstance(cleared_levels, list):
        cleared_levels = []
    lower_clears = course_level_floor(course_level)[:-1]
    res["endboss_cleared_levels"] = [
        level for level in COURSE_LEVEL_ORDER
        if level in set(cleared_levels).union(lower_clears)
    ]

    # 3. Handle awarded_crown_units
    raw_crowns = res.get("awarded_crown_units") or []
    filtered_crowns = []
    for item in raw_crowns:
        if isinstance(item, int):
            if course_level == "beginner":
                filtered_crowns.append(item)
        elif isinstance(item, str):
            if "-" in item:
                level, unit_str = item.split("-", 1)
                if level == course_level:
                    try:
                        filtered_crowns.append(int(unit_str))
                    except ValueError:
                        pass  # "level-NaN" 같은 비정수 unit_str — 왕관 목록에서 제외
    res["awarded_crown_units"] = filtered_crowns

    # 4. Handle max_unlocked_unit
    raw_max = res.get("max_unlocked_unit") or 1
    if isinstance(raw_max, dict):
        res["max_unlocked_unit"] = raw_max.get(course_level, 1)
    else:
        if course_level == "beginner":
            res["max_unlocked_unit"] = raw_max
        else:
            res["max_unlocked_unit"] = 1

    # 5. Handle completed_units
    raw_completed = res.get("completed_units") or 0
    if isinstance(raw_completed, dict):
        res["completed_units"] = raw_completed.get(course_level, 0)
    else:
        if course_level == "beginner":
            res["completed_units"] = raw_completed
        else:
            res["completed_units"] = 0

    # 6. boss_cleared, completed_stages 기본값 0 보장 및 progress.json 기반 동적 보정
    uid = res.get("id")
    db_completed_stages = 0
    db_boss_cleared = 0
    if uid:
        try:
            progress_list = _u.get_progress_by_user(uid, course_level)
            user_stages = [
                p for p in progress_list
                if p.get("is_completed") is True
            ]
            db_completed_stages = len(user_stages)
            db_boss_cleared = sum(1 for p in user_stages if "boss" in str(p.get("stage", "")))

            # endboss 클리어 레벨이 있으면 추가
            cleared_levels = res.get("endboss_cleared_levels") or []
            if course_level in cleared_levels:
                db_boss_cleared += 1
        except Exception as e:
            logger.exception(f"Failed to calculate progress in serialize_user for user {uid}: {str(e)}")

    res["boss_cleared"] = db_boss_cleared
    res["completed_stages"] = db_completed_stages

    # 기본값 보장 (dark는 항상 무료 보유)
    pt = res.get("purchased_themes") or []
    if "dark" not in pt:
        pt = ["dark"] + pt
    res["purchased_themes"] = pt

    # 신규 재화/성장 필드 런타임 기본값 (purchased_themes 와 동일 패턴).
    # 기존 값은 보존하고 없을 때만 채운다. xp/crowns 는 건드리지 않는다.
    ensure_reward_fields(res)
    # weekly_ranking_score 는 저장 스칼라 대신 게임 주간 맵에서 파생(자동 주간 리셋).
    res["weekly_ranking_score"] = current_week_ranking_score(res)

    res.pop("password", None)
    res.pop("deleted_at", None)
    return res


# ── XP / 보상 적용 (제자리 변경, 저장은 호출부 책임) ──────────────────────────
def apply_xp(user: dict, xp_gain: int, context: dict = None, event_type: str = None) -> dict:
    """
    Apply XP, recalculate level, and check/award titles.
    Returns dictionary describing the events.

    진화(evolution)는 더 이상 여기서 처리하지 않는다 — 진화는 엔드보스 클리어에서
    evolution_stage 를 올릴 때만 발생한다. 반환 dict 의 "evolved" 는 계약 유지를
    위해 항상 None 이다.

    순수 in-place 변경 함수: user 를 그 자리에서만 갱신하고 저장은 호출부 책임
    (save_user 또는 mutate_user_atomic). 내부에서 save 를 호출하지 않으므로
    mutate_user_atomic 의 mutator 안에서도 그대로 재사용된다.

    event_type 이 주어지면 미션 진척 훅(bump_mission)을 함께 굴린다. (XP 발생 지점
    = 미션 이벤트 지점) 출석(login)은 XP 가 없고 day_key 가 필요하므로 호출부에서
    bump_mission 을 직접 호출한다.
    """
    old_xp = user.get("xp") or 0
    old_lv = user.get("lv") or 1

    # 1. Apply XP (레거시 누적만 — 신규 지급은 grant_reward 로 이관되어 대부분 0).
    user["xp"] = old_xp + xp_gain

    # 2. 레벨은 더 이상 xp 로 올리지 않는다(레벨 소스 전환).
    #    - evolution_stage < 3: 신규 레벨업 없음(기존 lv 동결).
    #    - evolution_stage >= 3: gp 누적으로만 lv 상승(grant_reward 가 gp 변경 시
    #      recompute_level_from_gp 로 처리). 여기서는 lv 를 건드리지 않는다.
    level_up = (user.get("lv") or 1) > old_lv

    # 3. 진화는 여기서 발생하지 않는다.
    #    정책: 진화 트리거는 엔드보스 클리어(routers/endboss.py 의 evolution_stage
    #    증가)뿐이다. character 는 evolution_stage 에서 파생된다. evolved 는 호출부
    #    응답 계약 유지를 위해 항상 None.
    evolved = None

    # 4. Award titles
    from routers.titles import check_and_award_titles
    newly_earned_titles = check_and_award_titles(user, context or {})

    # 5. Mission progress hook (청크 1: bump_mission 은 정의 없으면 no-op)
    if event_type:
        try:
            from routers.missions_core import bump_mission  # 함수 내부 import 로 순환 import 회피
            bump_mission(user, event_type)
        except Exception:
            # 미션 진척 실패가 XP/보상 처리를 깨지 않도록 격리(무음 아님, 로깅).
            logger.exception("bump_mission failed for event_type=%s", event_type)

    return {
        "xp_gained": xp_gain,
        "old_xp": old_xp,
        "new_xp": user["xp"],
        "level_up": level_up,
        "old_lv": old_lv,
        "new_lv": user.get("lv") or 1,
        "evolved": evolved,
        "newly_earned_titles": newly_earned_titles
    }


def grant_reward(user: dict, *, coin_delta: int = 0, ranking_score_delta: int = 0,
                 gp_delta: int = 0, context: dict = None, event_type: str = None) -> dict:
    """이벤트 보상을 coin / ranking_score / gp 로 분리 적용한다(제자리 변경, 저장은
    호출부 책임 — apply_xp 와 동일하게 mutate_user_atomic 안에서 재사용 가능).

    - coin_balance / total_coin_earned += coin_delta
    - ranking_score(누적, 리더보드 소스) += ranking_score_delta
    - gp += gp_gate(user, gp_delta)  → 3차 진화(evolution_stage>=3) 에서만 실제 지급
    - recompute_level_from_gp(user)  → 3차 후 gp 로만 lv 상승
    - apply_xp(user, 0, context, event_type) 로 칭호·미션 훅을 그대로 재사용(신규 xp 0)

    weekly_ranking_score 는 상위 스칼라로 저장하지 않고, 게임 주간 랭킹은 게임별
    주간 맵(game_rewards)으로, user_state 표시는 serialize_user 파생으로 처리한다.

    반환: {"coin_delta", "gp_delta"(실적용), "ranking_score_delta", "level_up", "events"}.
    """
    ensure_reward_fields(user)
    coin_delta = max(0, int(coin_delta or 0))
    ranking_score_delta = max(0, int(ranking_score_delta or 0))
    applied_gp = gp_gate(user, gp_delta)

    lv_before = user.get("lv") or 1
    if coin_delta:
        user["coin_balance"] = (user.get("coin_balance") or 0) + coin_delta
        user["total_coin_earned"] = (user.get("total_coin_earned") or 0) + coin_delta
    if ranking_score_delta:
        user["ranking_score"] = (user.get("ranking_score") or 0) + ranking_score_delta
    if applied_gp:
        user["gp"] = (user.get("gp") or 0) + applied_gp
    recompute_level_from_gp(user)

    events = apply_xp(user, 0, context, event_type=event_type)
    return {
        "coin_delta": coin_delta,
        "gp_delta": applied_gp,
        "ranking_score_delta": ranking_score_delta,
        "level_up": (user.get("lv") or 1) > lv_before,
        "events": events,
    }
