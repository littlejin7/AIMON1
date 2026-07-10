---

## title: AI-MON Supabase 스키마 적용 체크리스트version: "2.0"status: currentscope: production and staging database changessource_of_truth: backend/data/schema.sql plus approved additive migrationslast_verified_commit:
830c0da32a3a2400bfa019e523448a506be74b7clast_verified_at: 2026-07-11

# AI-MON Supabase 스키마 적용 체크리스트

>
> 기존 운영 DB를 지우지 않고 현재 AI-MON 코드가 요구하는 PostgreSQL 구조를 안전하게 확인·적용·검증하는 절차
>

---

## 0. 핵심 결론

### 신규 Supabase 프로젝트

```text
schema.sql  
  ↓  
기본 테이블·인덱스·RPC 검증  
  ↓  
승인된 additive migration 적용  
  ↓  
필요 시 backfill  
  ↓  
앱 smoke test
```

### 기존 운영 Supabase

```text
현재 DB 구조 조회  
↓  
백업  
↓  
중복·NULL·고아 데이터 정리  
↓  
부족한 컬럼·테이블·인덱스만 additive 적용  
↓  
RPC·권한 검증  
↓  
backfill  
↓  
앱 smoke test
```

기존 운영 DB에 `schema.sql` 전체를 무조건 다시 실행하지 않습니다.

`CREATE TABLE IF NOT EXISTS`는 기존 테이블의 누락 컬럼을 추가하지 않으며, 운영 상태와 저장소 SQL 사이 차이를 자동 해결하지 않습니다.

---

## 1. 현재 저장소 SQL 상태

### 기준 파일

```text
backend/data/schema.sql
```

포함:

- `users`
- `refresh_tokens`
- `reset_tokens`
- `email_verification_codes`
- `progress`
- `wrong_answers`
- `attempts`
- 부분 unique index
- `update_user_atomic` RPC
- RPC 실행 권한 revoke
- 레거시 attempts 정렬용 SQL

### 신규 재화 마이그레이션

```text
backend/data/migration_gp_coin_additive.sql
```

현재 파일 상태:

```text
DRAFT — 운영 미적용
```

추가 대상:

- `coin_balance`
- `total_coin_earned`
- `gp`
- `gp_level_base`
- `evolution_stage`
- `ranking_score`
- `weekly_ranking_score`
- `legacy_xp_snapshot`

이 파일은 자동 실행되지 않습니다.

### backfill 초안

```text
backend/scripts/backfill_gp_coin.py
```

Python 실행은 JSON 저장소 전용입니다.

Supabase 운영 환경은 파일 하단의 SQL을 사람이 직접 검토·실행해야 합니다.

---

## 2. 절대 금지

- 운영 백업 없이 SQL 실행
- production에서 최초 검증
- `users` 테이블 삭제·재생성
- 기존 `xp`, `lv`, `character`, `crowns` 삭제
- 중복 데이터 확인 전 unique index 생성
- 컬럼 존재 확인 없이 backfill 실행
- `anon` 또는 `authenticated`에 원자 업데이트 RPC 허용
- 프론트엔드에 `service_role` 키 포함
- 운영 중 쓰기 트래픽이 활발한 상태에서 무계획 backfill
- 실패 후 신규 컬럼을 즉시 DROP
- 개인정보를 SQL 결과 캡처에 포함
- Git 파일이 있다는 이유만으로 운영 적용 완료 처리

---

## 3. 변경 기록

적용 전 다음 값을 기록합니다.

```text
Supabase project ref:  
환경: staging / production  
작업자:  
작업 일시:  
KST 기준:  
Git commit:  
적용 SQL 파일:  
SQL 파일 SHA:  
백업 ID:  
적용 사유:  
예상 영향:  
롤백 담당:
```

권장 Git commit:

```text
830c0da32a3a2400bfa019e523448a506be74b7c
```

다른 커밋을 배포할 경우 실제 배포 SHA를 기록합니다.

---

## 4. 환경변수 확인

백엔드 기준:

```text
USE_SUPABASE=true  
SUPABASE_URL=...  
SUPABASE_KEY=...  
SECRET_KEY=32자 이상
```

### `SUPABASE_KEY`

백엔드가 사용하는 키는 서버 전용이어야 합니다.

확인:

- Render 서버 환경변수에만 존재
- Vercel 프론트 환경변수에 없음
- `VITE_` prefix로 노출되지 않음
- Git에 커밋되지 않음
- 로그에 출력되지 않음
- service role 키 사용 여부 확인
- 키 교체 절차 확보

### `USE_SUPABASE`

문자열 소문자 `true`일 때만 Supabase 모드입니다.

```python
USE_SUPABASE = os.getenv("USE_SUPABASE", "false") == "true"
```

`True`, `TRUE`를 사용하면 코드상 false가 될 수 있으므로 정확히 `true`를 사용합니다.

---

## 5. 백업

### 5-1. 필수 백업

최소 대상:

- `users`
- `progress`
- `wrong_answers`
- `attempts`
- `refresh_tokens`
- `reset_tokens`
- `email_verification_codes`

### 5-2. 방법

우선순위:

1. Supabase PITR 또는 스냅샷
2. `pg_dump`
3. 테이블별 안전한 export
4. 별도 프로젝트 복제


### 5-3. 백업 검증

- 백업 생성 완료
- 백업 시각 기록
- 파일 또는 스냅샷 ID 기록
- 복원 권한 확인
- 복원 절차 확인
- 백업 암호화·접근권한 확인
- 개인정보 포함 파일 외부 공유 금지

백업을 만들었지만 복원 테스트가 없다면 완전한 롤백 수단으로 간주하지 않습니다.

---

## 6. 현재 DB 인벤토리

### 6-1. 테이블

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
    'attempts'  
  )  
ORDER BY table_name;
```

기대 결과: 7개 테이블.

### 6-2. users 컬럼

```sql
SELECT  
column_name,  
data_type,  
column_default,  
is_nullable  
FROM information_schema.columns  
WHERE table_schema = 'public'  
AND table_name = 'users'  
ORDER BY ordinal_position;
```

결과를 저장소 `schema.sql`과 대조합니다.

### 6-3. 신규 재화 컬럼

```sql
SELECT  
  column_name,  
  data_type,  
  column_default,  
  is_nullable  
FROM information_schema.columns  
WHERE table_schema = 'public'  
  AND table_name = 'users'  
  AND column_name IN (  
    'coin_balance',  
    'total_coin_earned',  
    'gp',  
    'gp_level_base',  
    'evolution_stage',  
    'ranking_score',  
    'weekly_ranking_score',  
    'legacy_xp_snapshot'  
  )  
ORDER BY column_name;
```

결과가 없으면 운영 미적용 상태입니다.

### 6-4. 기본 JSONB 컬럼

```sql
SELECT  
column_name,  
data_type,  
column_default  
FROM information_schema.columns  
WHERE table_schema = 'public'  
AND table_name = 'users'  
AND column_name IN (  
'endboss_cleared_levels',  
'miniboss_cleared_stages',  
'unitboss_cleared_units',  
'battle_sessions',  
'seen_questions',  
'max_unlocked_unit',  
'completed_units',  
'awarded_crown_units',  
'earned_streak_milestones',  
'titles',  
'game_rewards',  
'missions',  
'purchased_themes'  
)  
ORDER BY column_name;
```

### 6-5. version

```sql
SELECT  
  COUNT(*) FILTER (WHERE version IS NULL) AS null_version,  
  MIN(version) AS min_version,  
  MAX(version) AS max_version  
FROM users;
```

기대:

```text
null_version = 0  
min_version >= 0
```

---

## 7. 개인정보 없는 건수 기록

```sql
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users  
UNION ALL  
SELECT 'progress', COUNT(*) FROM progress  
UNION ALL  
SELECT 'wrong_answers', COUNT(*) FROM wrong_answers  
UNION ALL  
SELECT 'attempts', COUNT(*) FROM attempts  
UNION ALL  
SELECT 'refresh_tokens', COUNT(*) FROM refresh_tokens  
UNION ALL  
SELECT 'reset_tokens', COUNT(*) FROM reset_tokens  
UNION ALL  
SELECT 'email_verification_codes', COUNT(*) FROM email_verification_codes;
```

적용 전·후 건수를 비교합니다.

행 수 변화가 예상되지 않는 additive schema 작업에서 행 수가 줄면 즉시 중단합니다.

---

## 8. 중복 검사

### 8-1. 활성 username

DB 인덱스가 `lower(username)` 기준이므로 검사도 같은 기준을 사용합니다.

```sql
SELECT  
lower(username) AS normalized_username,  
COUNT(*) AS count  
FROM users  
WHERE deleted_at IS NULL  
GROUP BY lower(username)  
HAVING COUNT(*) > 1;
```

### 8-2. 활성 email

```sql
SELECT  
  lower(email) AS normalized_email,  
  COUNT(*) AS count  
FROM users  
WHERE deleted_at IS NULL  
  AND email IS NOT NULL  
  AND email <> ''  
GROUP BY lower(email)  
HAVING COUNT(*) > 1;
```

### 8-3. 활성 nickname

현재 기본 스키마의 nickname unique index는 비활성입니다.

상태 확인용:

```sql
SELECT  
lower(trim(nickname)) AS normalized_nickname,  
COUNT(*) AS count  
FROM users  
WHERE deleted_at IS NULL  
AND nickname IS NOT NULL  
AND trim(nickname) <> ''  
GROUP BY lower(trim(nickname))  
HAVING COUNT(*) > 1;
```

닉네임 인덱스를 추가할 계획이 없다면 조회만 합니다.

### 8-4. 중복 발견 시

- 대상 UUID만 별도 기록
- 계정 소유 관계 확인
- 임의 삭제 금지
- 백업 후 병합·이름 변경·탈퇴 상태 처리
- 정리 후 쿼리 재실행
- 결과 0건 확인

SQL 결과 캡처에 실제 이메일·아이디를 노출하지 않는 방식을 사용합니다.

---

## 9. JSONB 타입 검사

```sql
SELECT  
  COUNT(*) FILTER (  
    WHERE jsonb_typeof(COALESCE(missions, '{}'::jsonb)) <> 'object'  
  ) AS bad_missions,  
  COUNT(*) FILTER (  
    WHERE jsonb_typeof(COALESCE(game_rewards, '{}'::jsonb)) <> 'object'  
  ) AS bad_game_rewards,  
  COUNT(*) FILTER (  
    WHERE jsonb_typeof(COALESCE(battle_sessions, '{}'::jsonb)) <> 'object'  
  ) AS bad_battle_sessions,  
  COUNT(*) FILTER (  
    WHERE jsonb_typeof(COALESCE(seen_questions, '{}'::jsonb)) <> 'object'  
  ) AS bad_seen_questions,  
  COUNT(*) FILTER (  
    WHERE jsonb_typeof(COALESCE(purchased_themes, '[]'::jsonb)) <> 'array'  
  ) AS bad_purchased_themes  
FROM users;
```

배열 컬럼:

```sql
SELECT  
COUNT(*) FILTER (  
WHERE jsonb_typeof(COALESCE(endboss_cleared_levels, '[]'::jsonb)) <> 'array'  
) AS bad_endboss,  
COUNT(*) FILTER (  
WHERE jsonb_typeof(COALESCE(miniboss_cleared_stages, '[]'::jsonb)) <> 'array'  
) AS bad_miniboss,  
COUNT(*) FILTER (  
WHERE jsonb_typeof(COALESCE(unitboss_cleared_units, '[]'::jsonb)) <> 'array'  
) AS bad_unitboss,  
COUNT(*) FILTER (  
WHERE jsonb_typeof(COALESCE(titles, '[]'::jsonb)) <> 'array'  
) AS bad_titles  
FROM users;
```

0이 아닌 값이 있으면 backfill 전에 정리합니다.

---

## 10. 관계 무결성

### 10-1. progress 고아 행

```sql
SELECT COUNT(*) AS orphan_progress  
FROM progress p  
LEFT JOIN users u ON u.id = p.user_id  
WHERE p.user_id IS NOT NULL  
  AND u.id IS NULL;
```

### 10-2. wrong_answers 고아 행

```sql
SELECT COUNT(*) AS orphan_wrong_answers  
FROM wrong_answers w  
LEFT JOIN users u ON u.id = w.user_id  
WHERE w.user_id IS NOT NULL  
AND u.id IS NULL;
```

### 10-3. attempts 고아 행

```sql
SELECT COUNT(*) AS orphan_attempts  
FROM attempts a  
LEFT JOIN users u ON u.id = a.user_id  
WHERE a.user_id IS NOT NULL  
  AND u.id IS NULL;
```

기대: 모두 0.

---

## 11. attempts 검사

### 11-1. 필수값

```sql
SELECT  
COUNT(*) FILTER (WHERE id IS NULL) AS null_id,  
COUNT(*) FILTER (WHERE question_id IS NULL) AS null_question_id,  
COUNT(*) FILTER (WHERE mode IS NULL) AS null_mode,  
COUNT(*) FILTER (WHERE is_correct IS NULL) AS null_is_correct,  
COUNT(*) FILTER (WHERE answered_at IS NULL) AS null_answered_at  
FROM attempts;
```

### 11-2. 타입

```sql
SELECT  
  column_name,  
  data_type,  
  column_default,  
  is_nullable  
FROM information_schema.columns  
WHERE table_schema = 'public'  
  AND table_name = 'attempts'  
ORDER BY ordinal_position;
```

기대 핵심:


| 컬럼        | 타입      |
|---------------|-------------|
| `id`          | uuid        |
| `user_id`     | uuid        |
| `answered_at` | timestamptz |
| `is_correct`  | boolean     |


### 11-3. mode 분포

```sql
SELECT mode, COUNT(*)  
FROM attempts  
GROUP BY mode  
ORDER BY mode;
```

예상 모드:

- `quiz`
- `train`
- `random`
- `boss_rush`
- `miniboss`
- `unitboss`
- `endboss`

알 수 없는 값이 있다고 바로 삭제하지 말고 레거시 사용 여부를 확인합니다.

---

## 12. 인덱스·제약조건

### 12-1. users 인덱스

```sql
SELECT  
  indexname,  
  indexdef  
FROM pg_indexes  
WHERE schemaname = 'public'  
  AND tablename = 'users'  
ORDER BY indexname;
```

필수:

```text
users_username_active_uq  
users_email_active_uq
```

정의:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS users_username_active_uq  
  ON users (lower(username))  
  WHERE deleted_at IS NULL;  
  
CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_uq  
  ON users (lower(email))  
  WHERE deleted_at IS NULL  
    AND email IS NOT NULL  
    AND email <> '';
```

기존 체크리스트의 plain `username`, `email` 인덱스는 현재 기준이 아닙니다.

### 12-2. progress unique

```sql
SELECT  
conname,  
pg_get_constraintdef(oid)  
FROM pg_constraint  
WHERE conrelid = 'public.progress'::regclass;
```

필수:

```text
UNIQUE(user_id, unit, stage, course_level)
```

### 12-3. attempts 인덱스

```sql
SELECT indexname, indexdef  
FROM pg_indexes  
WHERE schemaname = 'public'  
AND tablename = 'attempts'  
ORDER BY indexname;
```

필수:

- `idx_attempts_user`
- `idx_attempts_user_q`
- `idx_attempts_user_unit`

---

## 13. 함수·권한

### 13-1. 함수 존재

```sql
SELECT  
  n.nspname AS schema_name,  
  p.proname AS function_name,  
  pg_get_function_identity_arguments(p.oid) AS arguments  
FROM pg_proc p  
JOIN pg_namespace n ON n.oid = p.pronamespace  
WHERE n.nspname = 'public'  
  AND p.proname = 'update_user_atomic';
```

기대 인자:

```text
uuid, jsonb, jsonb, jsonb
```

### 13-2. 직접 실행 권한

```sql
SELECT  
  has_function_privilege(  
    'anon',  
    'public.update_user_atomic(uuid,jsonb,jsonb,jsonb)',  
    'EXECUTE'  
  ) AS anon_can_execute,  
  has_function_privilege(  
    'authenticated',  
    'public.update_user_atomic(uuid,jsonb,jsonb,jsonb)',  
    'EXECUTE'  
  ) AS authenticated_can_execute,  
  has_function_privilege(  
    'public',  
    'public.update_user_atomic(uuid,jsonb,jsonb,jsonb)',  
    'EXECUTE'  
  ) AS public_can_execute;
```

기대:

```text
false / false / false
```

### 13-3. revoke

```sql
REVOKE EXECUTE  
ON FUNCTION public.update_user_atomic(uuid, jsonb, jsonb, jsonb)  
FROM public;  
  
REVOKE EXECUTE  
ON FUNCTION public.update_user_atomic(uuid, jsonb, jsonb, jsonb)  
FROM anon;  
  
REVOKE EXECUTE  
ON FUNCTION public.update_user_atomic(uuid, jsonb, jsonb, jsonb)  
FROM authenticated;
```

---

## 14. 테이블 직접 접근 보안

현재 `schema.sql`은 RPC revoke를 정의하지만 테이블 RLS 정책을 정의하지 않습니다.

따라서 반드시 확인합니다.

```sql
SELECT  
schemaname,  
tablename,  
rowsecurity  
FROM pg_tables  
WHERE schemaname = 'public'  
AND tablename IN (  
'users',  
'progress',  
'wrong_answers',  
'attempts',  
'refresh_tokens',  
'reset_tokens',  
'email_verification_codes'  
)  
ORDER BY tablename;
```

### 정책 선택

AI-MON은 백엔드가 데이터 접근의 단일 진실이므로 다음 중 하나를 적용해야 합니다.

#### 방식 A — RLS 활성화 + 클라이언트 정책 없음

직접 클라이언트 접근을 차단하고 service role만 사용합니다.

#### 방식 B — anon/authenticated 테이블 권한 revoke

PostgREST 직접 호출 권한을 제거합니다.

### 검증

- anon key로 `users` 조회 불가
- anon key로 `progress` 쓰기 불가
- authenticated key로 타 사용자 데이터 조회 불가
- service role 백엔드만 정상
- 프론트가 Supabase 테이블을 직접 호출하지 않음

정책을 실제 환경에서 확인하지 않았다면 배포 완료로 처리하지 않습니다.

---

## 15. 신규 구축 절차

대상: 데이터가 없는 새 Supabase 프로젝트.

### 15-1. 실행

1. `backend/data/schema.sql` 검토
2. SQL Editor에 실행
3. 기본 테이블·인덱스·RPC 검증
4. 직접 접근 보안 정책 적용
5. 신규 재화 마이그레이션 승인 여부 결정
6. 승인된 경우 `migration_gp_coin_additive.sql` 실행
7. 환경변수 설정
8. 백엔드 배포
9. smoke test


### 15-2. 주의

`schema.sql`에는 신규 코인·GP·랭킹 컬럼이 없습니다.

현재 애플리케이션이 해당 기능을 사용한다면 clean setup에서도 additive migration이 필요합니다.

---

## 16. 기존 DB 패치 절차

대상: 이미 사용자 데이터가 있는 Supabase.

### 16-1. 준비

- staging 복제
- 현재 구조 export
- 테이블 건수 기록
- 중복 검사
- JSONB 타입 검사
- 고아 행 검사
- 백업
- 쓰기 트래픽 조정 계획

### 16-2. baseline 누락 컬럼

예시:

```sql
BEGIN;  
  
ALTER TABLE users  
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;  
  
ALTER TABLE users  
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;  
  
ALTER TABLE users  
  ADD COLUMN IF NOT EXISTS missions jsonb DEFAULT '{}'::jsonb;  
  
ALTER TABLE users  
  ADD COLUMN IF NOT EXISTS purchased_themes jsonb DEFAULT '["dark"]'::jsonb;  
  
ALTER TABLE users  
  ADD COLUMN IF NOT EXISTS battle_sessions jsonb DEFAULT '{}'::jsonb;  
  
ALTER TABLE users  
  ADD COLUMN IF NOT EXISTS seen_questions jsonb DEFAULT '{}'::jsonb;  
  
ALTER TABLE users  
  ADD COLUMN IF NOT EXISTS endboss_cleared_levels jsonb DEFAULT '[]'::jsonb;  
  
ALTER TABLE users  
  ADD COLUMN IF NOT EXISTS miniboss_cleared_stages jsonb DEFAULT '[]'::jsonb;  
  
ALTER TABLE users  
  ADD COLUMN IF NOT EXISTS unitboss_cleared_units jsonb DEFAULT '[]'::jsonb;  
  
COMMIT;
```

실제 적용 SQL은 인벤토리 결과를 기준으로 필요한 컬럼만 포함합니다.

### 16-3. 기본값 backfill

기존 NULL이 있다면:

```sql
UPDATE users  
SET  
version = COALESCE(version, 0),  
missions = COALESCE(missions, '{}'::jsonb),  
purchased_themes = COALESCE(purchased_themes, '["dark"]'::jsonb),  
battle_sessions = COALESCE(battle_sessions, '{}'::jsonb),  
seen_questions = COALESCE(seen_questions, '{}'::jsonb),  
endboss_cleared_levels = COALESCE(endboss_cleared_levels, '[]'::jsonb),  
miniboss_cleared_stages = COALESCE(miniboss_cleared_stages, '[]'::jsonb),  
unitboss_cleared_units = COALESCE(unitboss_cleared_units, '[]'::jsonb);
```

타입이 잘못된 JSONB 값은 COALESCE로 해결되지 않으므로 별도 정리가 필요합니다.

---

## 17. 부분 unique index 적용

### 17-1. 기존 강한 제약 확인

```sql
SELECT  
  conname,  
  pg_get_constraintdef(oid)  
FROM pg_constraint  
WHERE conrelid = 'public.users'::regclass  
  AND contype = 'u';
```

### 17-2. 중복 정리 완료 후

```sql
ALTER TABLE users  
DROP CONSTRAINT IF EXISTS users_username_key;  

ALTER TABLE users  
DROP CONSTRAINT IF EXISTS users_email_key;  

CREATE UNIQUE INDEX IF NOT EXISTS users_username_active_uq  
ON users (lower(username))  
WHERE deleted_at IS NULL;  

CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_uq  
ON users (lower(email))  
WHERE deleted_at IS NULL  
AND email IS NOT NULL  
AND email <> '';
```

### 17-3. 검증

```sql
SELECT indexname, indexdef  
FROM pg_indexes  
WHERE schemaname = 'public'  
  AND tablename = 'users'  
  AND indexname IN (  
    'users_username_active_uq',  
    'users_email_active_uq'  
  );
```

---

## 18. attempts 정렬

`attempts` 테이블이 오래된 형식이라면 `schema.sql`의 “Existing database migration helper” 블록을 사용합니다.

실행 전:

- non-UUID `id` 없음
- non-UUID `user_id` 없음
- 필수값 NULL 없음
- users에 없는 user_id 없음
- 백업 완료

블록이 예외를 발생시키면 데이터를 수정하지 않고 원인을 먼저 해결합니다.

---

## 19. 신규 재화 컬럼 적용

### 19-1. 승인 게이트

다음이 모두 확인된 경우에만 진행합니다.

- 코인·GP·랭킹 코드 배포 예정
- 운영 DB에 컬럼 없음 확인
- 마이그레이션 내용 리뷰
- 백업 완료
- backfill 정책 승인
- 라이브 쓰기 조정
- staging 적용 성공
- rollback 계획

### 19-2. 컬럼 추가

검토 후 실행:

```text
backend/data/migration_gp_coin_additive.sql
```

모든 문장이 `ADD COLUMN IF NOT EXISTS`이므로 재실행 자체는 멱등입니다.

하지만 “컬럼 존재”와 “값이 올바르게 backfill됨”은 별개입니다.

### 19-3. 적용 확인

```sql
SELECT  
  column_name,  
  data_type,  
  column_default,  
  is_nullable  
FROM information_schema.columns  
WHERE table_schema = 'public'  
  AND table_name = 'users'  
  AND column_name IN (  
    'coin_balance',  
    'total_coin_earned',  
    'gp',  
    'gp_level_base',  
    'evolution_stage',  
    'ranking_score',  
    'weekly_ranking_score',  
    'legacy_xp_snapshot'  
  )  
ORDER BY column_name;
```

기대: 8행.

---

## 20. 신규 재화 backfill

### 20-1. 현재 초안 규칙


| 신규 필드          | 값                                   |
|------------------------|---------------------------------------|
| `coin_balance`         | 기존 `xp`                           |
| `total_coin_earned`    | 기존 `xp`                           |
| `ranking_score`        | 기존 `xp`                           |
| `evolution_stage`      | `character` 매핑                    |
| `gp`                   | 0                                     |
| `gp_level_base`        | final_ghost면 기존 lv, 아니면 0 |
| `weekly_ranking_score` | 0                                     |
| `legacy_xp_snapshot`   | 기존 xp                             |


보존:

- `xp`
- `lv`
- `character`
- `crowns`
- `game_rewards`

### 20-2. 사전 dry-run 집계

개인정보 없이 확인:

```sql
SELECT  
COUNT(*) AS target_users,  
COALESCE(SUM(xp), 0) AS xp_sum,  
COUNT(*) FILTER (WHERE character = 'slime') AS slime_count,  
COUNT(*) FILTER (WHERE character = 'robot') AS robot_count,  
COUNT(*) FILTER (WHERE character = 'speech_bubble') AS bubble_count,  
COUNT(*) FILTER (WHERE character = 'final_ghost') AS final_count  
FROM users  
WHERE legacy_xp_snapshot IS NULL  
AND deleted_at IS NULL;
```

### 20-3. 적용 SQL

쓰기 트래픽을 조정한 상태에서:

```sql
BEGIN;  
  
UPDATE users  
SET  
  coin_balance = COALESCE(xp, 0),  
  total_coin_earned = COALESCE(xp, 0),  
  ranking_score = COALESCE(xp, 0),  
  gp = 0,  
  weekly_ranking_score = 0,  
  evolution_stage = CASE character  
    WHEN 'robot' THEN 1  
    WHEN 'speech_bubble' THEN 2  
    WHEN 'final_ghost' THEN 3  
    ELSE 0  
  END,  
  gp_level_base = CASE  
    WHEN character = 'final_ghost' THEN COALESCE(lv, 1)  
    ELSE 0  
  END,  
  legacy_xp_snapshot = COALESCE(xp, 0)  
WHERE legacy_xp_snapshot IS NULL  
  AND deleted_at IS NULL;  
  
COMMIT;
```

### 20-4. 라이브 쓰기 주의

backfill 동안 사용자가 코인을 획득하면 해당 값이 XP 시드로 덮일 수 있습니다.

안전한 방법:

1. 신규 재화 쓰기 코드 배포 전 backfill
2. 짧은 maintenance window
3. 조건부 update와 이벤트 정지
4. 변경 전후 합계 대조


---

## 21. backfill 검증

```sql
SELECT  
COUNT(*) FILTER (  
WHERE legacy_xp_snapshot IS NULL  
AND deleted_at IS NULL  
) AS not_migrated,  
COUNT(*) FILTER (  
WHERE coin_balance < 0  
OR total_coin_earned < 0  
OR gp < 0  
OR ranking_score < 0  
) AS negative_values,  
COUNT(*) FILTER (  
WHERE evolution_stage NOT BETWEEN 0 AND 3  
) AS bad_evolution_stage  
FROM users;
```

기대:

```text
not_migrated = 0  
negative_values = 0  
bad_evolution_stage = 0
```

정합성:

```sql
SELECT COUNT(*) AS mismatched_snapshot  
FROM users  
WHERE deleted_at IS NULL  
AND legacy_xp_snapshot IS NOT NULL  
AND legacy_xp_snapshot <> COALESCE(xp, 0);
```

컷오버 직후 기대: 0.

이후 XP가 레거시 흐름에서 변할 수 있다면 장기적으로 동일성을 요구하지 않습니다.

---

## 22. RPC와 CAS 경로

현재 사용자 저장에는 두 경로가 있습니다.

### `save_user`

원본 사용자 캐시가 있으면 `update_user_atomic` RPC를 사용합니다.

RPC 실패 시 전체 객체 upsert로 조용히 fallback하지 않고 저장 오류를 발생시킵니다.

### `mutate_user_atomic`

Supabase에서는:

```text
version 읽기  
  ↓  
fresh user에 mutator 적용  
  ↓  
WHERE id=? AND version=? UPDATE  
  ↓  
충돌 시 재읽기·재시도
```

즉, RPC와 `version` 컬럼이 모두 필요합니다.

검증:

- RPC 존재
- RPC 권한 revoke
- `version` NOT NULL DEFAULT 0
- 모든 기존 행 version 비NULL
- 동시성 테스트 통과

---

## 23. 배포 순서

권장:

```text
1. DB 인벤토리  
2. 백업  
3. 중복·정합성 정리  
4. baseline 누락 스키마 적용  
5. 인덱스·RPC·권한 적용  
6. 신규 재화 컬럼 적용  
7. backfill  
8. DB 검증  
9. 백엔드 배포  
10. 백엔드 smoke test  
11. 프론트 배포  
12. 브라우저 smoke test  
13. 모니터링
```

코드가 신규 컬럼을 쓰는데 DB 컬럼이 없는 상태를 만들지 않습니다.

---

## 24. 앱 Smoke Test

### 인증

- 일반 회원가입
- 이메일 인증 코드 발송·검증
- 로그인
- 토큰 갱신
- Google 로그인
- Kakao 로그인
- `/user/me`
- 비밀번호 변경
- 로그아웃

### 사용자 상태

- 코인 필드 응답
- GP 필드 응답
- 진화 단계 응답
- 누적 랭킹 응답
- purchased_themes에 dark 포함
- 비밀번호 미노출

### 학습

- 레벨 테스트
- Unit 1 Stage 1-1
- 문제 조회 정답 미노출
- attempt 저장
- progress 저장
- 스테이지 완료 게이트
- 오답 저장
- 오답 복습

### 보스

- 미니보스 시작·답안·클리어
- 유닛보스 시작·답안·클리어
- battle_sessions 저장
- 중복 보상 방지
- 엔드보스 상태 조회
- 엔드보스 재화·진화 저장

### 미션

- 목록 조회
- 진척
- 수동 claim
- 코인·랭킹·왕관 반영
- 동시 claim 한 번만 지급

### 게임

- start token
- clear
- nonce 재사용 거부
- 일일 보상 캡
- 주간 랭킹 맵
- 에이칸 진행도
- 일일 챌린지

### 상점

- 테마 구매
- 코인 차감
- 중복 구매 거부
- 잔액 부족 거부
- purchased_themes 저장

### 탈퇴

- `DELETE /user/me`
- `deleted_at` 기록
- 활성 조회 제외
- refresh token 삭제
- 복원 기간 내 계정 복원
- 보존 기간 이후 purge
- 동일 아이디 재가입 정책 확인

---

## 25. 직접 DB 검증

### 사용자 민감 필드 제외 샘플

실사용 계정 정보를 출력하지 않고 테스트 계정 UUID 하나로 확인합니다.

```sql
SELECT  
  id,  
  course_level,  
  is_level_tested,  
  character,  
  evolution_stage,  
  lv,  
  xp,  
  coin_balance,  
  total_coin_earned,  
  gp,  
  gp_level_base,  
  ranking_score,  
  weekly_ranking_score,  
  crowns,  
  version,  
  jsonb_typeof(missions) AS missions_type,  
  jsonb_typeof(game_rewards) AS game_rewards_type,  
  jsonb_typeof(battle_sessions) AS battle_sessions_type  
FROM users  
WHERE id = '<TEST_USER_UUID>';
```

이메일·username·nickname·password는 결과 캡처에서 제외합니다.

---

## 26. 모니터링

배포 직후 확인:

- HTTP 500 증가 없음
- PostgREST column not found 없음
- `update_user_atomic` RPC 실패 없음
- CAS retry 초과 없음
- duplicate key 오류 없음
- JSON decode 오류 없음
- `attempts` insert 오류 없음
- progress upsert conflict 없음
- 음수 코인 없음
- 미션 중복 지급 없음
- 게임 nonce 중복 지급 없음
- 이메일 인증 저장 오류 없음

검색할 대표 로그:

```text
PGRST  
column  
schema cache  
update_user_atomic  
UserSaveError  
write conflict  
duplicate key  
foreign key  
violates not-null
```

Supabase 스키마 변경 직후 PostgREST schema cache 반영이 지연되면 프로젝트 API 재시작 또는 잠시 후 재확인합니다.

---

## 27. 롤백

### 27-1. 우선순위

1. 신규 앱 배포 롤백
2. 쓰기 트래픽 중단
3. 영향 범위 확인
4. 데이터 복원 또는 보정
5. 원인 수정 후 재적용


### 27-2. additive 컬럼

신규 컬럼은 즉시 DROP하지 않습니다.

앱을 구버전으로 되돌려도 기존 컬럼이 남아 있는 것은 일반적으로 문제가 없습니다.

### 27-3. backfill 되돌리기

사전 승인된 경우에만:

```sql
UPDATE users  
SET  
  coin_balance = 0,  
  total_coin_earned = 0,  
  ranking_score = 0,  
  gp = 0,  
  gp_level_base = 0,  
  weekly_ranking_score = 0,  
  evolution_stage = 0,  
  legacy_xp_snapshot = NULL  
WHERE legacy_xp_snapshot IS NOT NULL;
```

주의:

- 컷오버 후 발생한 신규 코인·랭킹 데이터가 있으면 유실됩니다.
- 라이브 사용 후에는 이 SQL보다 백업 복원 또는 이벤트 기반 보정이 안전합니다.

### 27-4. 인덱스

부분 unique index 제거 전 기존 제약 복구 가능 여부를 확인합니다.

소프트 삭제 계정이 같은 username/email을 공유할 수 있으므로 과거 전체 UNIQUE를 무조건 복구하면 실패합니다.

---

## 28. 완료 증거

다음 자료를 작업 기록에 남깁니다.

- 적용한 SQL 원문
- Git SHA
- SQL 파일 SHA
- 적용 시각
- 작업자
- 백업 ID
- 적용 전 테이블 건수
- 적용 후 테이블 건수
- 컬럼 조회 결과
- 인덱스 조회 결과
- RPC 권한 조회 결과
- RLS 또는 권한 차단 결과
- backfill 대상·완료 수
- smoke test 결과
- 오류 로그 확인
- 롤백 여부

개인정보가 포함된 스크린샷은 문서 저장소에 올리지 않습니다.

---

## 29. 배포 승인 게이트

### GO

다음 조건을 모두 만족해야 합니다.

- staging 성공
- 운영 백업 완료
- 중복 0건 또는 승인된 정리 완료
- 고아 행 0건
- 필수 JSONB 타입 정상
- 필수 컬럼 존재
- 신규 재화 컬럼 존재
- backfill 완료
- 부분 unique index 정상
- RPC 존재·권한 차단
- 테이블 직접 접근 차단
- 핵심 smoke test 통과
- 500·DB 오류 없음
- 롤백 수단 확인

### NO-GO

하나라도 해당하면 중단합니다.

- 백업 없음
- 운영 DB 상태 미확인
- 중복 계정 존재
- 필수 컬럼 누락
- backfill 정책 미승인
- anon/authenticated 직접 쓰기 가능
- RPC 권한 노출
- smoke test 실패
- 코인·왕관 이중 지급
- 사용자 데이터 행 수 감소
- 복원 방법 불명확

---

## 30. 현재 프로젝트에서 확인이 필요한 것

GitHub 저장소만으로는 다음을 확인할 수 없습니다.

- 운영 Supabase에 `schema.sql`이 실제 적용됐는지
- 신규 재화 마이그레이션이 실제 실행됐는지
- backfill이 실행됐는지
- 운영 RLS와 grants 상태
- RPC 권한 상태
- 현재 데이터 중복·고아·NULL 상태
- 운영 백업 상태

따라서 해당 항목은 SQL 조회 결과 또는 Supabase 대시보드 증거가 있을 때만 완료로 표시합니다.

---

## 31. 주요 파일

- `backend/data/schema.sql`
- `backend/data/migration_gp_coin_additive.sql`
- `backend/scripts/backfill_gp_coin.py`
- `backend/routers/utils.py`
- `backend/routers/storage.py`
- `backend/routers/user_state.py`
- `backend/tests/test_concurrency.py`
- `backend/tests/test_reward_split.py`
- `backend/tests/test_missions.py`

---

## 32. 최종 원칙

1. 운영 DB 상태를 조회한 뒤 필요한 변경만 적용합니다.
2. 모든 변경은 백업과 staging 검증 후 진행합니다.
3. 저장소 SQL 존재를 운영 적용 완료로 간주하지 않습니다.
4. 신규 재화 컬럼과 backfill은 별도 승인 단계입니다.
5. 활성 계정 unique는 `lower()` 부분 인덱스를 사용합니다.
6. `update_user_atomic`은 일반 클라이언트가 호출할 수 없어야 합니다.
7. 테이블 직접 접근도 RLS 또는 권한 회수로 차단합니다.
8. `version` 기반 CAS와 RPC 경로를 모두 검증합니다.
9. 개인정보를 검증 결과에 노출하지 않습니다.
10. smoke test와 로그 확인까지 끝나야 배포 완료입니다.


 
