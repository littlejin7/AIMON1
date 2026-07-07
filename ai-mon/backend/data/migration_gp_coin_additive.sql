-- ============================================================================
-- [초안 / DRAFT — 운영 미적용] GP·Coin·Ranking 개편 additive 마이그레이션
-- ----------------------------------------------------------------------------
-- 목적: XP 폐기 → coin/gp/ranking_score 분리 개편(2단계 A~D)에 필요한 신규 컬럼을
--       users 테이블에 '추가만' 한다. 기존 컬럼(xp/lv/character/crowns/game_rewards)은
--       절대 삭제하지 않는다. xp 는 backfill 소스이므로 반드시 유지한다.
--
-- 실행 방법(사람이 직접): Supabase SQL Editor 에 붙여넣어 1회 실행.
--   - 이 파일은 자동으로 실행되지 않는다. 승인·백업 후 수동 실행한다.
--   - 모든 문장이 IF NOT EXISTS 라 재실행해도 안전(idempotent).
--
-- 순서: (1) 이 마이그레이션으로 컬럼 추가 → (2) backfill 스크립트로 값 시드
--       (scripts/backfill_gp_coin.py) → (3) 읽기 컷오버 → (4) 훗날 구 필드 정리.
--
-- ⚠ 실행 전 반드시 users 테이블 백업(pg_dump 또는 Supabase 스냅샷).
-- ============================================================================

-- ── 재화(coin) ───────────────────────────────────────────────────────────────
-- coin_balance      : 상점 전용 재화 잔액(구매 시 차감). numeric-merge 대상.
-- total_coin_earned : 누적 획득 코인(모니터링/업적용, 소비와 무관). numeric-merge.
ALTER TABLE users ADD COLUMN IF NOT EXISTS coin_balance      integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_coin_earned integer NOT NULL DEFAULT 0;

-- ── 성장(gp) ─────────────────────────────────────────────────────────────────
-- gp            : 3차 진화(evolution_stage>=3) 이후에만 증가하는 성장치. numeric-merge.
-- gp_level_base : 3차 진화 시점의 lv 를 1회 캡처한 기준선(레벨 손실 방지). 스칼라(other).
--                 lv = gp_level_base + floor(gp / GP_PER_LEVEL). 3차 전엔 0.
ALTER TABLE users ADD COLUMN IF NOT EXISTS gp            integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gp_level_base integer NOT NULL DEFAULT 0;

-- ── 진화 단계 ────────────────────────────────────────────────────────────────
-- evolution_stage : 0~3. slime=0 / robot=1 / speech_bubble=2 / final_ghost=3.
--                   진화는 엔드보스 클리어로만 상승. character 는 여기서 파생. 스칼라(other).
ALTER TABLE users ADD COLUMN IF NOT EXISTS evolution_stage integer NOT NULL DEFAULT 0;

-- ── 랭킹 ─────────────────────────────────────────────────────────────────────
-- ranking_score        : 누적 랭킹 점수(게임+미션+보스 적립분, 소비 없음). 리더보드 소스.
--                        numeric-merge. 매우 활발한 유저 대비 여유가 필요하면 bigint 로.
-- weekly_ranking_score : 주간 랭킹 점수 저장 컬럼. 단, 런타임은 serialize_user 가
--                        game_rewards["weekly_ranking"] 에서 '파생'해 노출하므로 저장값은
--                        보통 0 으로 유지된다. 컬럼은 코드가 기본값(0)을 쓰기 때문에 필요.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ranking_score        integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_ranking_score integer NOT NULL DEFAULT 0;

-- ── 레거시 XP 스냅샷 ─────────────────────────────────────────────────────────
-- legacy_xp_snapshot : 컷오버 시점의 xp 백업(감사/롤백 근거용). NULL 허용, 런타임 미사용.
ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_xp_snapshot integer DEFAULT NULL;

-- ============================================================================
-- 삭제/변경하지 않는 것(명시):
--   - xp        : 유지(backfill 소스, drop 금지)
--   - lv        : 유지(level 신규 필드 추가하지 않고 재사용)
--   - character : 유지(evolution_stage 파생 소스)
--   - crowns    : 유지(별개 자원, 이번 개편과 무관)
--   - game_rewards(jsonb) : 스키마 변경 없음. weekly_ranking 은 이 jsonb 내부 키라
--                           별도 컬럼이 필요 없다.
--
-- 검증 쿼리(적용 후 컬럼 존재 확인 — 개인정보 미노출):
--   SELECT column_name, data_type, column_default, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='users'
--      AND column_name IN ('coin_balance','total_coin_earned','gp','gp_level_base',
--                          'evolution_stage','ranking_score','weekly_ranking_score',
--                          'legacy_xp_snapshot')
--    ORDER BY column_name;
--
-- 롤백(컬럼 제거 — 데이터 유실 주의, 백필 후에는 지양):
--   ALTER TABLE users DROP COLUMN IF EXISTS coin_balance;      -- (외 7개 컬럼 동일)
--   xp/lv/character/crowns 는 절대 건드리지 않으므로 롤백해도 원자료 손실 없음.
-- ============================================================================
