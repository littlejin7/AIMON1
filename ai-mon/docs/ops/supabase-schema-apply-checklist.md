---
title: AI-MON Supabase 스키마 적용 체크리스트
version: "2.1"
status: current
scope: production and staging database changes
source_of_truth: backend/data/schema.sql plus approved additive migrations
last_verified_commit: d4eb619e1479eb83d3c02859af8e6733e97e9d82
last_verified_at: 2026-07-11
---

# AI-MON Supabase 스키마 적용 체크리스트

> 운영 Supabase 구조, 데이터 이관, 인덱스, RLS, 권한을 검증하는 현재 기준 문서입니다.  
> 기존 운영 DB에 `schema.sql` 전체를 무조건 다시 실행하지 않습니다.

---

## 0. 현재 운영 상태

| 항목 | 상태 |
|---|---|
| Supabase 모드 | 적용 완료 |
| Render 백엔드 | 배포 완료 |
| 백엔드 URL | `https://aimon1.onrender.com` |
| 서버 DB 키 | Render 서버 환경변수에만 저장 |
| 신규 재화·GP·랭킹 컬럼 8개 | 적용 완료 |
| 활성 사용자 backfill | 14명 완료 |
| 미처리 사용자 | 0명 |
| 기존 코인·랭킹 값 보존 | 확인 완료 |
| 주요 테이블 RLS | 8개 활성화 완료 |
| anon/authenticated 테이블 직접 권한 | 제거 완료 |
| 공개 RPC 실행권한 | 제거 완료 |
| service_role RPC 권한 | 유지 확인 |
| username/email 대소문자 중복 | 0건 |
| 부분 unique index | 2개 적용 확인 |
| 적용 후 앱 스모크 테스트 | 완료 |
| `RUN_SCHEDULER` | 현재 `0` 유지 |

---

## 1. 기준 파일

```text
backend/data/schema.sql
backend/data/migration_gp_coin_additive.sql
backend/scripts/backfill_gp_coin.py
docs/ops/supabase-schema-apply-checklist.md
```

### 역할

- `schema.sql`
  - 신규 환경의 기본 테이블, 인덱스, RPC 기준
  - 기존 운영 DB의 누락 컬럼을 자동으로 모두 보완하는 migration 파일은 아님
- `migration_gp_coin_additive.sql`
  - 재화·GP·랭킹 컬럼 추가용 additive migration
  - 운영 적용 완료
- `backfill_gp_coin.py`
  - JSON 저장소용 Python backfill
  - Supabase용 가산형 SQL 예시 포함
- 이 문서
  - 실제 운영 적용 상태와 재검증 절차 기록

---

## 2. 운영 적용 완료 기록

### 2-1. 신규 컬럼

`public.users`에 다음 8개 컬럼 적용 완료:

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

### 2-2. 가산형 backfill

활성 사용자 14명 대상으로 기존 값을 덮어쓰지 않고 가산형으로 이관했습니다.

```sql
UPDATE public.users
SET
    coin_balance =
        COALESCE(coin_balance, 0) + COALESCE(xp, 0),

    total_coin_earned =
        COALESCE(total_coin_earned, 0) + COALESCE(xp, 0),

    ranking_score =
        COALESCE(ranking_score, 0) + COALESCE(xp, 0),

    gp = COALESCE(gp, 0),

    weekly_ranking_score =
        COALESCE(weekly_ranking_score, 0),

    evolution_stage = GREATEST(
        COALESCE(evolution_stage, 0),
        CASE character
            WHEN 'robot' THEN 1
            WHEN 'speech_bubble' THEN 2
            WHEN 'final_ghost' THEN 3
            ELSE 0
        END
    ),

    gp_level_base = CASE
        WHEN character = 'final_ghost' THEN GREATEST(
            COALESCE(gp_level_base, 0),
            COALESCE(lv, 1)
        )
        ELSE COALESCE(gp_level_base, 0)
    END,

    legacy_xp_snapshot = COALESCE(xp, 0)

WHERE legacy_xp_snapshot IS NULL
  AND deleted_at IS NULL;
```

### 2-3. 멱등 가드

재실행 방지는 다음 조건을 사용합니다.

```sql
legacy_xp_snapshot IS NULL
```

운영 backfill 완료 후 같은 SQL을 다시 실행하지 않습니다.

---

## 3. 절대 금지

- 운영 백업 없이 대량 SQL 실행
- `users` 테이블 삭제·재생성
- 기존 `xp`, `lv`, `character`, `crowns` 삭제
- 중복 검사 전 unique index 생성
- `coin_balance`, `ranking_score` 등을 기존 값 무시하고 XP로 덮어쓰기
- 완료된 backfill SQL 재실행
- `anon` 또는 `authenticated`에 테이블 쓰기 권한 부여
- 프론트에 service-role/secret 키 포함
- `VITE_` 또는 `REACT_APP_` 변수로 서버 키 노출
- 실제 키를 Git, 문서, 로그, 스크린샷에 기록
- RLS 오류 발생 시 원인 확인 없이 RLS 비활성화

---

## 4. 서버 환경변수 기준

Render 백엔드:

```text
USE_SUPABASE=true
SUPABASE_URL=<project-url>
SUPABASE_KEY=<server-only-secret-or-service-role-key>
SECRET_KEY=<long-random-secret>
ANTHROPIC_API_KEY=<server-key>
ALLOWED_ORIGINS=<comma-separated-frontend-origins>
RUN_SCHEDULER=0
```

### 보안 기준

- `SUPABASE_KEY`는 Render 서버 환경변수에만 존재
- 프론트 저장소에 없음
- Vercel 공개 환경변수에 없음
- `VITE_` 접두사로 사용하지 않음
- Git에 실제 값이 커밋되지 않음
- 애플리케이션 로그에 출력하지 않음

로컬 확인:

```powershell
git grep -n -I -E "sb_secret_|service_role|SUPABASE_KEY|VITE_SUPABASE|REACT_APP_SUPABASE"
```

정상적으로 나올 수 있는 항목:

```text
.env.example의 placeholder
backend의 os.getenv("SUPABASE_KEY")
render.yaml의 환경변수 이름
보안 문서 설명
```

---

## 5. 주요 테이블 기준

현재 보안 대상:

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

### RLS 확인

```sql
SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n
  ON n.oid = c.relnamespace
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

기대 결과:

```text
8개 모두 rls_enabled = true
```

`rls_forced=false`는 현재 서버 구조에서 허용됩니다.

---

## 6. RLS·직접 접근 보안 기준

AI-MON은 FastAPI 백엔드를 데이터 접근의 단일 경로로 사용합니다.

운영 기준:

```text
anon 정책 없음
authenticated 정책 없음
anon/authenticated 테이블 직접 권한 없음
anon/authenticated 공개 RPC 실행권한 없음
service_role 백엔드 접근만 허용
```

### 적용 SQL

신규 환경 또는 권한이 되돌아간 환경에서만 검토 후 실행합니다.

```sql
BEGIN;

DROP POLICY IF EXISTS allow_anon_select
ON public.users;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrong_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduler_locks ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
ON TABLE
    public.users,
    public.refresh_tokens,
    public.reset_tokens,
    public.email_verification_codes,
    public.progress,
    public.wrong_answers,
    public.attempts,
    public.scheduler_locks
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE
    public.users,
    public.refresh_tokens,
    public.reset_tokens,
    public.email_verification_codes,
    public.progress,
    public.wrong_answers,
    public.attempts,
    public.scheduler_locks
TO service_role;

REVOKE EXECUTE
ON ALL FUNCTIONS IN SCHEMA public
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON ALL FUNCTIONS IN SCHEMA public
TO service_role;

COMMIT;
```

---

## 7. 정책 확인

```sql
SELECT
    tablename,
    policyname,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
      'users',
      'refresh_tokens',
      'reset_tokens',
      'email_verification_codes',
      'progress',
      'wrong_answers',
      'attempts',
      'scheduler_locks'
  )
ORDER BY tablename, policyname;
```

현재 기대 결과:

```text
0 rows
```

특히 아래 정책이 없어야 합니다.

```text
allow_anon_select
```

---

## 8. 테이블 직접 권한 확인

```sql
SELECT
    table_name,
    grantee,
    privilege_type
FROM information_schema.role_table_grants
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
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
```

기대 결과:

```text
0 rows
```

---

## 9. RPC 권한 확인

```sql
SELECT
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,

    has_function_privilege(
        'anon',
        p.oid,
        'EXECUTE'
    ) AS anon_can_execute,

    has_function_privilege(
        'authenticated',
        p.oid,
        'EXECUTE'
    ) AS authenticated_can_execute,

    has_function_privilege(
        'service_role',
        p.oid,
        'EXECUTE'
    ) AS service_role_can_execute

FROM pg_proc AS p
JOIN pg_namespace AS n
  ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;
```

기대:

```text
anon_can_execute = false
authenticated_can_execute = false
service_role_can_execute = true
```

핵심 함수:

```text
update_user_atomic(uuid, jsonb, jsonb, jsonb)
```

---

## 10. username/email 중복 검사

### 활성 username

```sql
SELECT
    lower(username) AS normalized_username,
    COUNT(*) AS duplicate_count
FROM public.users
WHERE deleted_at IS NULL
GROUP BY lower(username)
HAVING COUNT(*) > 1;
```

기대:

```text
0 rows
```

### 활성 email

```sql
SELECT
    lower(email) AS normalized_email,
    COUNT(*) AS duplicate_count
FROM public.users
WHERE deleted_at IS NULL
  AND email IS NOT NULL
  AND email <> ''
GROUP BY lower(email)
HAVING COUNT(*) > 1;
```

기대:

```text
0 rows
```

---

## 11. 부분 unique index

현재 기준:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS users_username_active_uq
ON public.users (lower(username))
WHERE deleted_at IS NULL;
```

```sql
CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_uq
ON public.users (lower(email))
WHERE deleted_at IS NULL
  AND email IS NOT NULL
  AND email <> '';
```

확인:

```sql
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND indexname IN (
      'users_username_active_uq',
      'users_email_active_uq'
  )
ORDER BY indexname;
```

기대 결과:

```text
2 rows
```

보장되는 동작:

```text
Test / test 중복 불가
A@MAIL.COM / a@mail.com 중복 불가
소프트 삭제된 계정은 조건에서 제외
```

기존 단순 unique 제약이 추가로 남아 있으면 대소문자 중복 방지는 유지되지만, 탈퇴 계정의 값 재사용을 막을 수 있으므로 별도 정리 여부를 검토합니다.

---

## 12. 재화·랭킹 스모크 테스트

### 보상 획득 전후

확인 필드:

```text
coin_balance
total_coin_earned
ranking_score
gp
evolution_stage
```

정상:

```text
코인 보상 획득
→ coin_balance 증가
→ total_coin_earned 증가
→ 랭킹 대상 보상이면 ranking_score 증가
```

### 상점 구매 전후

정상:

```text
coin_balance만 상품 가격만큼 감소
total_coin_earned 유지
ranking_score 유지
gp 유지
구매 상품 지급
```

---

## 13. RLS 적용 후 앱 스모크 테스트

Render 백엔드를 통해 실행:

```text
로그인
→ 내 프로필 조회
→ 스테이지 진입
→ 진행도 저장
→ 보상 획득
→ 로그아웃
→ 재로그인
```

오류 예시:

```text
permission denied for table users
new row violates row-level security policy
42501
```

오류 발생 시:

1. RLS를 끄지 않음
2. Render `SUPABASE_KEY` 종류 확인
3. 공개 키가 아니라 서버용 secret/service-role인지 확인
4. 환경변수 따옴표 포함 여부 확인
5. 재배포 후 로그 확인

---

## 14. 배포 및 스케줄러 상태

현재:

```text
Render Backend: https://aimon1.onrender.com
RUN_SCHEDULER=0
Frontend production deploy: 미완료
```

`RUN_SCHEDULER=1` 전환 조건:

- 프론트 운영 배포 완료
- 예약 메일 발송 설정 확인
- 백업 및 탈퇴 계정 정리 작업 확인
- 실행 프로세스가 정확히 1개임을 확인
- 중복 실행 방지 락 확인

무료 Render 인스턴스가 잠든 동안 내부 스케줄러는 실행되지 않을 수 있으므로 운영 스케줄러 구조는 별도 결정합니다.

---

## 15. 운영 변경 기록 템플릿

```text
환경:
작업 일시:
작업자:
검증 기준 commit:
백업 ID:
적용 SQL:
적용 대상:
적용 전 건수:
적용 후 건수:
RLS 결과:
테이블 grant 결과:
RPC 권한 결과:
unique index 결과:
앱 smoke 결과:
롤백 여부:
비고:
```

---

## 16. 완료 기준

```text
[완료] 신규 컬럼 8개 존재
[완료] 활성 사용자 14명 가산형 backfill
[완료] legacy_xp_snapshot 미처리 사용자 0명
[완료] 기존 코인·랭킹 값 보존
[완료] 주요 8개 테이블 RLS 활성화
[완료] allow_anon_select 제거
[완료] anon/authenticated 직접 테이블 권한 0건
[완료] anon/authenticated 공개 RPC 실행권한 false
[완료] service_role RPC 실행권한 true
[완료] username/email 대소문자 중복 0건
[완료] 부분 unique index 2개
[완료] Render 백엔드 스모크 테스트
[대기] 프론트 운영 배포
[대기] RUN_SCHEDULER 최종 전환
```
