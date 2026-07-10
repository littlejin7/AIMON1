"""[초안 / 실행 보류] GP·Coin·Ranking 컷오버 backfill 스크립트.

배경:
  XP 폐기 개편(2단계 A~D)으로 users 에 신규 컬럼이 추가됐다(코드/스키마는 이미 반영,
  마이그레이션 초안: data/migration_gp_coin_additive.sql). 기존 유저의 신규 필드를
  '컷오버 시점 1회' 시드해야 한다. 이 스크립트가 그 초안이다.

전제:
  - 먼저 data/migration_gp_coin_additive.sql 로 컬럼이 추가돼 있어야 한다(Supabase).
  - 로컬(JSON) 은 컬럼 개념이 없으므로 이 스크립트가 직접 값을 채운다.

backfill 규칙(2단계 확정 방침):
  - coin_balance       ← xp            (상점 화폐 잔액으로 이관)
  - total_coin_earned  ← xp            (누적 획득 추정 시드; 정확한 과거값이 없어 xp 로 근사)
  - ranking_score      ← xp            (누적 랭킹 점수로 이관)
  - evolution_stage    ← character 매핑 (slime=0/robot=1/speech_bubble=2/final_ghost=3)
  - gp                 ← 0             (성장치는 3차 진화 후부터 새로 적립)
  - gp_level_base      ← evolution_stage>=3 이면 현재 lv, 아니면 0 (레벨 손실 방지)
  - weekly_ranking_score ← 0           (이번 주부터 game_rewards 파생으로 새로 집계)
  - legacy_xp_snapshot ← xp            (컷오버 백업 + '이미 마이그레이션됨' 멱등 마커)
  - xp 는 읽기만 하고 절대 덮어쓰지 않는다(drop/변경 금지).
  - crowns / lv / character / game_rewards 는 건드리지 않는다.

멱등성:
  - legacy_xp_snapshot 가 이미 채워진(≠ None) 유저는 '컷오버 완료'로 보고 건너뛴다.
    → 컷오버 후 라이브에서 바뀐 coin_balance/ranking_score 를 재실행이 덮어쓰지 않는다.

안전장치:
  - 기본은 DRY-RUN(미적용). 실제 반영은 `--apply` 플래그.
  - JSON 스토리지(USE_SUPABASE=false)만 처리한다. Supabase 는 맨 아래 SQL 주석 참고.
  - 개인정보(nickname/email/username)는 출력하지 않는다(집계 + user id 만).
  - 실행 전 반드시 users.json / users 테이블 백업.

사용:
  python scripts/backfill_gp_coin.py            # dry-run: 무엇이 바뀔지 집계 출력
  python scripts/backfill_gp_coin.py --apply    # 실제 반영(로컬 JSON)
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

# 진화 단계 매핑은 런타임과 드리프트 나지 않도록 routers.utils 에서 재사용한다.
from routers.utils import CHARACTER_TO_STAGE  # noqa: E402

DATA = os.path.join(BACKEND, "data")
USERS_FILE = os.path.join(DATA, "users.json")


def compute_backfill(u: dict) -> dict:
    """유저 하나에 대해 채울 신규 필드 값을 계산해 반환(기존 dict 는 변경하지 않음)."""
    xp = int(u.get("xp") or 0)
    lv = int(u.get("lv") or 1)
    stage = CHARACTER_TO_STAGE.get(u.get("character") or "slime", 0)
    return {
        "coin_balance": xp,
        "total_coin_earned": xp,
        "ranking_score": xp,
        "evolution_stage": stage,
        "gp": 0,
        "gp_level_base": lv if stage >= 3 else 0,
        "weekly_ranking_score": 0,
        "legacy_xp_snapshot": xp,
    }


def main(apply: bool) -> None:
    if os.environ.get("USE_SUPABASE", "false").lower() == "true":
        print("USE_SUPABASE=true 환경에서는 이 스크립트를 쓰지 마세요(맨 아래 SQL 주석 참고).")
        return

    if not os.path.exists(USERS_FILE):
        print(f"{USERS_FILE} 없음 — 처리할 대상 없음.")
        return

    users = json.load(open(USERS_FILE, encoding="utf-8"))

    to_migrate = 0
    skipped = 0
    stage_hist = {0: 0, 1: 0, 2: 0, 3: 0}
    coin_total = 0

    for u in users:
        # 멱등 마커: 이미 컷오버된 유저(legacy_xp_snapshot 채워짐)는 건너뛴다.
        if u.get("legacy_xp_snapshot") is not None:
            skipped += 1
            continue

        vals = compute_backfill(u)
        to_migrate += 1
        stage_hist[vals["evolution_stage"]] += 1
        coin_total += vals["coin_balance"]
        # 개인정보 없이 user id + 핵심 수치만 출력
        print(
            f"[backfill] id={u.get('id')} "
            f"coin={vals['coin_balance']} ranking={vals['ranking_score']} "
            f"stage={vals['evolution_stage']} gp_base={vals['gp_level_base']}"
        )
        if apply:
            for k, v in vals.items():
                u[k] = v

    print("\n── 요약 ──────────────────────────────────────────────")
    print(f"대상(신규 컷오버): {to_migrate}명 / 이미 완료(건너뜀): {skipped}명")
    print(f"evolution_stage 분포: {stage_hist}")
    print(f"coin_balance 시드 합계: {coin_total}")
    print(f"\n{'✅ 적용함(users.json 갱신)' if apply else '🔎 dry-run (미적용) — 확인 후 --apply'}")

    if apply and to_migrate:
        tmp = USERS_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(users, f, ensure_ascii=False, indent=2)
        os.replace(tmp, USERS_FILE)
        print(f"{USERS_FILE} 갱신 완료")


# ── Supabase(운영/스테이징) 환경 backfill SQL (사람이 직접 실행, 실행 보류) ──────
# USE_SUPABASE=true 환경은 이 파이썬을 쓰지 말고, 컬럼 추가(migration_gp_coin_additive.sql)
# 후 아래 '멱등' UPDATE 를 Supabase SQL Editor 에서 1회 실행한다. legacy_xp_snapshot IS NULL
# 가드로 이미 컷오버된 유저를 재실행이 덮어쓰지 않는다. ⚠ 실행 전 users 테이블 백업 필수.
#
#   UPDATE users
#      SET coin_balance =
#              COALESCE(coin_balance, 0) + COALESCE(xp, 0),
#
#          total_coin_earned =
#              COALESCE(total_coin_earned, 0) + COALESCE(xp, 0),
#
#          ranking_score =
#              COALESCE(ranking_score, 0) + COALESCE(xp, 0),
#
#          gp = COALESCE(gp, 0),
#
#          weekly_ranking_score =
#              COALESCE(weekly_ranking_score, 0),
#
#          evolution_stage = GREATEST(
#              COALESCE(evolution_stage, 0),
#              CASE character
#                  WHEN 'robot'         THEN 1
#                  WHEN 'speech_bubble' THEN 2
#                  WHEN 'final_ghost'   THEN 3
#                  ELSE 0
#              END
#          ),
#
#          gp_level_base = CASE
#              WHEN character = 'final_ghost' THEN GREATEST(
#                  COALESCE(gp_level_base, 0),
#                  COALESCE(lv, 1)
#              )
#              ELSE COALESCE(gp_level_base, 0)
#          END,
#
#          legacy_xp_snapshot = COALESCE(xp, 0)
#
#    WHERE legacy_xp_snapshot IS NULL
#      AND deleted_at IS NULL;
#                                   WHEN 'robot'         THEN 1
#                                   WHEN 'speech_bubble' THEN 2
#                                   WHEN 'final_ghost'   THEN 3
#                                   ELSE 0
#                                 END,
#          gp_level_base        = CASE
#                                   WHEN character = 'final_ghost' THEN COALESCE(lv, 1)
#                                   ELSE 0
#                                 END,
#          legacy_xp_snapshot   = COALESCE(xp, 0)
#    WHERE legacy_xp_snapshot IS NULL      -- 멱등 가드(이미 컷오버된 유저 제외)
#      AND deleted_at IS NULL;             -- 소프트 삭제 유저 제외
#
# 롤백(컷오버 되돌리기, 컬럼은 유지): 신규 값을 초기화하고 xp 로 되돌린다. xp 는 보존돼 무손실.
#   UPDATE users
#      SET coin_balance=0, total_coin_earned=0, ranking_score=0, gp=0,
#          gp_level_base=0, weekly_ranking_score=0, evolution_stage=0,
#          legacy_xp_snapshot=NULL
#    WHERE legacy_xp_snapshot IS NOT NULL;

if __name__ == "__main__":
    main(apply="--apply" in sys.argv)
