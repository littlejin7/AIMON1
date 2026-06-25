"""기존 유저 왕관 소급 보정 스크립트 (실행 보류 — 제안용).

배경:
  과거 lessons.json 의 beginner unit2 메타가 stages=7 로 잘못 적혀 있어
  required 스테이지에 실제로는 존재하지 않는 2-7 이 포함됐다. 그 결과 quiz 6스테이지
  + 보스를 모두 깬 유저도 unit2 왕관(beginner-2)을 영구히 못 받았다.
  메타를 stages=6 으로 고쳐도 크라운은 update_progress 호출 시점에만 지급되므로,
  이미 다 깬 유저는 '다시 제출'하지 않는 한 소급되지 않는다. → 이 스크립트로 1회 백필.

동작:
  - progress(완료 스테이지) 와 현재 lessons 메타(stages)로 progress.py 와 동일하게
    required = {unit-1..unit-stages} ∪ {unit-boss} 를 만든다.
  - required 를 모두 깬 유닛인데 awarded_crown_units 에 "<level>-<unit>" 이 없으면
    crowns += 1, awarded_crown_units 에 추가.
  - 특정 유닛이 아니라 전 유닛을 대상으로 하여, 같은 종류의 누락이 있으면 함께 보정한다.

안전장치:
  - 기본은 DRY-RUN(미적용). 실제 적용하려면 `--apply` 플래그.
  - JSON 스토리지(USE_SUPABASE=false)만 처리한다. Supabase 환경은 아래 주석 참고.

사용:
  python scripts/backfill_unit_crowns.py            # dry-run, 무엇이 바뀔지 출력
  python scripts/backfill_unit_crowns.py --apply    # 실제 반영
"""
import json
import os
import sys

# Windows 콘솔(cp949)에서도 한글 출력이 깨지지 않도록 UTF-8 강제
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND)

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("USE_SUPABASE", "false")

from routers.quiz import load_units  # noqa: E402

DATA = os.path.join(BACKEND, "data")
USERS_FILE = os.path.join(DATA, "users.json")
PROGRESS_FILE = os.path.join(DATA, "progress.json")


def _required(level: str, unit: int, stages: int) -> set[str]:
    return {f"{unit}-{i}" for i in range(1, stages + 1)} | {f"{unit}-boss"}


def main(apply: bool) -> None:
    if os.environ.get("USE_SUPABASE", "false").lower() == "true":
        print("USE_SUPABASE=true 환경에서는 이 스크립트를 쓰지 마세요(아래 주석 참고).")
        return

    users = json.load(open(USERS_FILE, encoding="utf-8"))
    progress = json.load(open(PROGRESS_FILE, encoding="utf-8"))

    # 유닛 메타: 레벨별로 캐시
    units_by_level = {
        lvl: {u["unit_id"]: u for u in load_units(lvl)}
        for lvl in ("beginner", "intermediate", "advanced")
    }

    # user_id -> {unit -> set(완료 stage)}
    done: dict[str, dict[int, set[str]]] = {}
    for p in progress:
        if p.get("is_completed") is not True:
            continue
        done.setdefault(p.get("user_id"), {}).setdefault(p.get("unit"), set()).add(p.get("stage"))

    changes = 0
    for u in users:
        uid = u.get("id")
        level = u.get("course_level", "beginner")
        awarded = u.get("awarded_crown_units") or []
        user_done = done.get(uid, {})
        for unit_id, meta in units_by_level.get(level, {}).items():
            stages = meta.get("stages")
            if not isinstance(stages, int):
                continue
            key = f"{level}-{unit_id}"
            # 레거시 형식 호환: 과거엔 awarded_crown_units 에 정수 unit_id 로 저장됐다.
            # 정수 형식이라도 이미 지급된 것으로 간주해 이중 지급/오탐을 막는다.
            if key in awarded or unit_id in awarded:
                continue
            completed = user_done.get(unit_id, set())
            if _required(level, unit_id, stages).issubset(completed):
                changes += 1
                print(f"[보정] user={uid} {key}: 왕관 +1 (현재 crowns={u.get('crowns', 0)})")
                if apply:
                    u["crowns"] = (u.get("crowns") or 0) + 1
                    awarded.append(key)
                    u["awarded_crown_units"] = awarded

    print(f"\n총 {changes}건 {'적용함' if apply else '(dry-run, 미적용)'}")
    if apply and changes:
        tmp = USERS_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(users, f, ensure_ascii=False, indent=2)
        os.replace(tmp, USERS_FILE)
        print(f"{USERS_FILE} 갱신 완료")


# ── Supabase 환경 보정 메모 ────────────────────────────────────────────
# USE_SUPABASE=true 인 경우 위 로직을 그대로 SQL/RPC 로 옮긴다. 동시성 안전을 위해
# 백엔드의 mutate_user_atomic 경로(version CAS)를 타거나, 트래픽이 없는 점검 시간에
# 다음과 같은 1회성 마이그레이션 SQL 로 처리한다(개념 예시):
#
#   -- progress 에서 유저별 완료 스테이지 집합을 만들고, lessons 메타의 stages 로
#   -- required 충족 여부를 계산해, awarded_crown_units 에 빠진 "<level>-<unit>" 을
#   -- 추가하고 crowns 를 +1 한다. (CLAUDE.md §1 원자 쓰기 규칙 준수)
# 실행 전 반드시 users 테이블 백업.

if __name__ == "__main__":
    main(apply="--apply" in sys.argv)
