---
title: AI-MON Supabase 스키마 적용 체크리스트
version: "2.2"
status: current
scope: production and staging database changes
source_of_truth: backend/data/schema.sql plus approved additive migrations
last_verified_commit: 6683cb7b4a9592aedceb1a6ee8a884d63661b8ef
last_verified_at: 2026-07-11
---

# AI-MON Supabase 스키마 적용 체크리스트

> Git 저장소의 목표 구조와 실제 운영 DB 상태를 분리합니다.
> 특정 시점 사용자 수나 완료 상태를 현재 문서에 고정하지 않습니다.

## 0. 핵심 원칙

- 운영 DB에 `schema.sql` 전체를 무조건 재실행하지 않음
- 기존 컬럼·데이터를 삭제하지 않는 additive migration 우선
- 실행 전 백업
- 실행 전 영향 행 수 조회
- 실행 후 구조·권한·앱 스모크
- 실제 키와 개인정보를 출력·기록하지 않음
- 완료된 backfill을 재실행하지 않음

---

## 1. 기준 파일

```text
backend/data/schema.sql
backend/data/migration_gp_coin_additive.sql
backend/scripts/backfill_gp_coin.py
docs/ops/supabase-schema-apply-checklist.md
```

역할:

| 파일 | 역할 |
|---|---|
| `schema.sql` | 신규 환경 목표 구조 |
| additive migration | 기존 환경 컬럼 추가 |
| backfill script | 기존 데이터 이관 보조 |
| 이 문서 | 운영 검수 절차 |

---

## 2. 실행 전 기록

```text
환경: staging / production
Project:
실행일:
실행자:
애플리케이션 SHA:
현재 DB backup:
변경 SQL 파일:
롤백 또는 완화 방법:
```

민감값은 기록하지 않습니다.

---

## 3. 대상 테이블

현재 주요 테이블:

```text
users
refresh_tokens
reset_tokens
email_verification_codes
progress
wrong_answers
attempts
scheduler_locks
```

존재 확인:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users',
    'refresh_tokens',
    'reset_tokens',
    'email_verification_codes',
    'progress',
    'wrong_answers',
    'attempts',
    'scheduler_locks'
  )
ORDER BY table_name;
```

기대:

```text
8 rows
```

---

## 4. users 필수 컬럼

```text
id
username
password
nickname
email
role
course_level
is_level_tested
marketing_agreed
character
lv
xp
coin_balance
total_coin_earned
gp
gp_level_base
evolution_stage
ranking_score
weekly_ranking_score
legacy_xp_snapshot
crowns
streak
last_login
daily_free_attempts
last_free_attempt_date
ai_feedback_count
token_version
equipped_title
endboss_cleared_levels
miniboss_cleared_stages
unitboss_cleared_units
battle_sessions
seen_questions
max_unlocked_unit
completed_units
awarded_crown_units
earned_streak_milestones
titles
game_rewards
version
missions
purchased_themes
created_at
deleted_at
```

조회:

```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
ORDER BY ordinal_position;
```

누락 컬럼은 승인된 additive migration으로만 추가합니다.

---

## 5. 신규 재화·랭킹 컬럼

필수:

```text
coin_balance
total_coin_earned
gp
gp_level_base
evolution_stage
ranking_score
weekly_ranking_score
legacy_xp_snapshot
```

null 확인:

```sql
SELECT
  count(*) FILTER (WHERE coin_balance IS NULL) AS coin_balance_null,
  count(*) FILTER (WHERE total_coin_earned IS NULL) AS total_coin_earned_null,
  count(*) FILTER (WHERE gp IS NULL) AS gp_null,
  count(*) FILTER (WHERE evolution_stage IS NULL) AS evolution_stage_null,
  count(*) FILTER (WHERE ranking_score IS NULL) AS ranking_score_null,
  count(*) FILTER (WHERE weekly_ranking_score IS NULL) AS weekly_ranking_score_null
FROM public.users
WHERE deleted_at IS NULL;
```

현재 수치는 실행 시 기록합니다.

```text
활성 사용자:
null 보유:
미처리:
```

---

## 6. backfill

현재 migration은 기존 값을 덮어쓰지 않는 가산형 정책을 사용합니다.

핵심 가드:

```sql
legacy_xp_snapshot IS NULL
```

실행 전 대상 수:

```sql
SELECT count(*) AS backfill_targets
FROM public.users
WHERE legacy_xp_snapshot IS NULL
  AND deleted_at IS NULL;
```

`0`이면 이미 처리됐을 가능성이 높습니다. 기록과 이전 SQL을 확인한 후 재실행하지 않습니다.

실행 전 샘플은 개인정보 대신 집계값만 사용합니다.

```sql
SELECT
  count(*) AS users,
  sum(coalesce(xp, 0)) AS legacy_xp_total,
  sum(coalesce(coin_balance, 0)) AS coin_total,
  sum(coalesce(ranking_score, 0)) AS ranking_total
FROM public.users
WHERE deleted_at IS NULL;
```

실행 후 같은 집계를 비교합니다.

---

## 7. 활성 계정 중복

username:

```sql
SELECT lower(username), count(*)
FROM public.users
WHERE deleted_at IS NULL
GROUP BY lower(username)
HAVING count(*) > 1;
```

email:

```sql
SELECT lower(email), count(*)
FROM public.users
WHERE deleted_at IS NULL
  AND email IS NOT NULL
  AND email <> ''
GROUP BY lower(email)
HAVING count(*) > 1;
```

기대:

```text
0 rows
```

중복이 있으면 unique index 생성 전에 수동 정리합니다.

---

## 8. partial unique index

확인:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'users_username_active_uq',
    'users_email_active_uq'
  )
ORDER BY indexname;
```

기대:

```text
users_username_active_uq → lower(username), deleted_at IS NULL
users_email_active_uq → lower(email), deleted_at IS NULL, 빈 이메일 제외
```

소프트 삭제 계정은 재사용 정책에 따라 인덱스 조건에서 제외됩니다.

---

## 9. progress

확인:

- `user_id`
- `unit`
- `stage`
- `score`
- `is_completed`
- `checkpoint`
- `course_level`
- timestamps
- `(user_id, unit, stage, course_level)` unique

중복 확인:

```sql
SELECT user_id, unit, stage, course_level, count(*)
FROM public.progress
GROUP BY user_id, unit, stage, course_level
HAVING count(*) > 1;
```

기대:

```text
0 rows
```

---

## 10. attempts

필수:

```text
id uuid
user_id uuid
question_id text
unit integer
stage text
level text
mode text
is_correct boolean
answered_at timestamptz
created_at timestamptz
```

구조:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'attempts'
ORDER BY ordinal_position;
```

인덱스:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'attempts';
```

---

## 11. JSONB 상태

`users` JSONB 주요 필드:

```text
endboss_cleared_levels
miniboss_cleared_stages
unitboss_cleared_units
battle_sessions
seen_questions
max_unlocked_unit
completed_units
awarded_crown_units
earned_streak_milestones
titles
game_rewards
missions
purchased_themes
```

타입 이상 확인:

```sql
SELECT count(*) AS invalid_rows
FROM public.users
WHERE deleted_at IS NULL
  AND (
    jsonb_typeof(coalesce(battle_sessions, '{}'::jsonb)) <> 'object'
    OR jsonb_typeof(coalesce(missions, '{}'::jsonb)) <> 'object'
    OR jsonb_typeof(coalesce(titles, '[]'::jsonb)) <> 'array'
    OR jsonb_typeof(coalesce(purchased_themes, '[]'::jsonb)) <> 'array'
  );
```

기대:

```text
0
```

---

## 12. RLS

조회:

```sql
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'users',
    'refresh_tokens',
    'reset_tokens',
    'email_verification_codes',
    'progress',
    'wrong_answers',
    'attempts',
    'scheduler_locks'
  )
ORDER BY c.relname;
```

운영 기준:

```text
8개 모두 rls_enabled=true
```

`rls_forced=false`는 현재 service-role 백엔드 구조에서 허용할 수 있습니다.

---

## 13. 정책과 직접 권한

AI-MON은 FastAPI를 데이터 접근의 단일 경로로 사용합니다.

운영 기준:

```text
anon 정책 없음
authenticated 정책 없음
anon/authenticated 테이블 직접 grant 없음
anon/authenticated RPC execute 없음
service_role 백엔드 접근 가능
```

정책:

```sql
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

테이블 권한:

```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, table_name, privilege_type;
```

기대:

```text
0 rows
```

---

## 14. RPC 권한

대상 예:

```text
update_user_atomic
try_acquire_scheduler_lock
renew_scheduler_lock
release_scheduler_lock
```

권한은 실제 함수 signature를 조회한 뒤 적용합니다.

조회:

```sql
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.proacl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;
```

검증:

- public execute revoke
- anon execute revoke
- authenticated execute revoke
- service-role backend 호출 성공

---

## 15. 외래키와 삭제

확인:

- refresh_tokens → users
- progress → users
- wrong_answers → users
- attempts → users
- `ON DELETE CASCADE` 의도

조회:

```sql
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;
```

---

## 16. 적용 순서

```text
1. 백업
2. 현재 구조·대상 행 수 기록
3. 중복·null·타입 이상 검사
4. additive DDL
5. index
6. backfill
7. RLS
8. table grant revoke
9. RPC execute revoke
10. backend environment 확인
11. backend deploy
12. 앱 스모크
13. 전후 집계
14. 완료 기록
```

---

## 17. 애플리케이션 스모크

- 일반 회원가입
- 이메일 인증
- 로그인·refresh
- 진행도 저장
- attempts 저장
- wrong_answers 저장·복습
- 미니보스 세션
- 유닛보스 세션
- 엔드보스 세션
- 미션 수령
- 게임 보상
- 상점 구매
- soft delete
- scheduler lock

오류 로그에서 확인:

```text
permission denied
row-level security
42501
column does not exist
invalid input syntax
RPC not found
```

---

## 18. 절대 금지

- 백업 없는 대량 UPDATE
- `users` 삭제·재생성
- `xp`, `lv`, `character`, `crowns` 즉시 삭제
- 중복 확인 전 unique index
- 기존 coin·ranking 값을 XP로 덮어쓰기
- 완료된 backfill 재실행
- 문제 해결을 위한 RLS 비활성화
- anon/authenticated direct write 허용
- 프론트에 service-role key
- 실제 사용자 데이터 문서 복사
- 실제 key·JWT·email 목록 출력

---

## 19. 완료 기록

```text
환경:
Project:
적용 SHA:
적용 SQL:
백업:
적용 전 대상 행:
적용 후 미처리 행:
중복 검사:
RLS:
direct grants:
RPC grants:
backend smoke:
실행자:
실행일:
결론:
```

운영 상태를 바꿀 때 이 기록을 별도 배포 로그나 이슈에 남기고, 현재 기준 문서에는 시점성 사용자 수를 고정하지 않습니다.
