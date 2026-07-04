# Supabase Schema 적용 체크리스트 및 검증 가이드

본 문서는 AI-MON 서비스의 데이터베이스 저장소를 JSON 파일에서 Supabase(PostgreSQL)로 안전하게 마이그레이션하기 위해, 실제 DB에 [schema.sql](file:///c:/AIMON1/ai-mon/backend/data/schema.sql)을 적용하기 전후로 수행해야 할 작업 절차와 검증 방법을 정리한 문서입니다.

---

## 1. 사전 검증 및 데이터 분석 (적용 전)

실제 스키마를 적용하기 전, 기존 JSON 파일 데이터 또는 개발용 DB에 중복 및 정합성 오류가 없는지 확인합니다.

### 1-1. 활성 계정 중복 데이터 확인 SQL
소프트 삭제되지 않은 활성 사용자 중 동일한 `username`이나 `email`을 가진 중복 계정이 있는지 검사합니다.

```sql
-- 1. 활성 username 중복 확인
SELECT username, COUNT(*)
FROM users
WHERE deleted_at IS NULL
GROUP BY username
HAVING COUNT(*) > 1;

-- 2. 활성 email 중복 확인
SELECT email, COUNT(*)
FROM users
WHERE deleted_at IS NULL
  AND email IS NOT NULL
  AND email <> ''
GROUP BY email
HAVING COUNT(*) > 1;
```

> [!WARNING]
> 만약 위 쿼리 결과로 중복된 데이터가 조회된다면, 중복 계정을 정리(예: 백업 후 삭제 또는 이름 변경)해야 유니크 인덱스 생성 시 에러가 발생하지 않습니다.

---

## 2. DB 스키마 적용 및 마이그레이션 순서 (Supabase SQL Editor)

Supabase 대시보드의 **SQL Editor**에 쿼리를 복사하여 실행할 때, 다음 순서를 준수하십시오.

### 2-1. 신규 구축 (Clean Setup)인 경우
1. [schema.sql](file:///c:/AIMON1/ai-mon/backend/data/schema.sql) 파일 전체를 복사하여 SQL Editor에서 한 번에 실행합니다.
2. 테이블 생성, 인덱스 생성, RPC 등록 및 `REVOKE` 보안 설정이 일괄 적용됩니다.

### 2-2. 기존 DB에 스키마를 패치(Migration)하는 경우
기존에 일부 테이블이 생성되어 있던 경우, 아래 순서로 명령을 실행하여 마이그레이션합니다.

1. **소프트 삭제 및 동시성 제어 컬럼 추가**:
   ```sql
   ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS missions jsonb DEFAULT '{}';
   ALTER TABLE users ADD COLUMN IF NOT EXISTS purchased_themes jsonb DEFAULT '["dark"]';
   ALTER TABLE users ADD COLUMN IF NOT EXISTS battle_sessions jsonb DEFAULT '{}';
   ```
2. **기존 강한 UNIQUE 제약 조건 삭제** (소프트 삭제 유저와의 중복 허용 목적):
   ```sql
   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
   ```
3. **활성 계정 전용 부분 유니크 인덱스(Partial Unique Index) 생성**:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS users_username_active_uq ON users (username) WHERE deleted_at IS NULL;
   CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_uq ON users (email) WHERE deleted_at IS NULL AND email IS NOT NULL AND email <> '';
   ```
4. **신규 테이블 생성**:
   - `attempts` 테이블이 없을 경우, [schema.sql](file:///c:/AIMON1/ai-mon/backend/data/schema.sql)의 6번 테이블 정의 및 인덱스 부분을 실행합니다.
5. **RPC(update_user_atomic) 및 보안 정책 적용**:
   - [schema.sql](file:///c:/AIMON1/ai-mon/backend/data/schema.sql)의 7번 RPC 정의와 아래 `REVOKE` 구문을 순서대로 실행합니다.

---

## 3. 적용 후 상태 검증 (적용 후)

스키마가 정상적으로 반영되었는지 데이터베이스 카탈로그를 조회하여 확인합니다.

### 3-1. 테이블 및 컬럼 존재 여부 검증 SQL
`users` 테이블에 필수 컬럼들이 모두 정상 정의되었는지 확인합니다.

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('version', 'missions', 'purchased_themes', 'battle_sessions', 'deleted_at');
```

### 3-2. 유니크 인덱스(Index) 활성화 여부 검증 SQL
`username`과 `email`의 부분 유니크 인덱스가 올바르게 생성되었는지 확인합니다.

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users'
  AND indexname IN ('users_username_active_uq', 'users_email_active_uq');
```

### 3-3. RPC(update_user_atomic) 등록 및 권한 검증 SQL
함수가 데이터베이스에 정상 등록되었는지 확인합니다.

```sql
SELECT routine_name, data_type
FROM information_schema.routines
WHERE routine_name = 'update_user_atomic';
```

---

## 4. update_user_atomic RPC 보안성 분석

### 4-1. 클라이언트 직접 호출 시 위험 분석
- **위험성 (High)**: `update_user_atomic` RPC는 내부적으로 동적 쿼리를 조립하여 실행합니다. 만약 일반 클라이언트(`anon` 또는 `authenticated` 권한)가 PostgREST API(`/rest/v1/rpc/update_user_atomic`)를 통해 이 함수를 직접 호출할 경우, 본인의 역할(`role`)을 `admin`으로 변경하거나 `xp`, `crowns` 등을 임의로 수정하여 어뷰징할 수 있는 심각한 보안 위협이 존재합니다.
- **원인**: 함수 내부에서 호출자가 대상 사용자(`p_user_id`)와 일치하는지 또는 백엔드 권한인지에 대한 검증 로직이 누락되어 있기 때문입니다.

### 4-2. 해결 및 안전장치 (REVOKE)
AI-MON 서비스는 백엔드가 데이터베이스 통신의 단일 진실 공급원(SSOT) 역할을 담당하며, 백엔드 서버는 `service_role` 키를 사용하여 Supabase에 접근합니다.
따라서, 일반 클라이언트의 악용을 원천 차단하기 위해 **일반 사용자 권한의 RPC 호출을 명시적으로 취소**합니다.

```sql
-- public, anon, authenticated 역할의 실행 권한을 전면 회수
REVOKE EXECUTE ON FUNCTION update_user_atomic(uuid, jsonb, jsonb, jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION update_user_atomic(uuid, jsonb, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION update_user_atomic(uuid, jsonb, jsonb, jsonb) FROM authenticated;
```
> [!NOTE]
> 위 `REVOKE` 정책을 실행하면 외부 클라이언트(`anon` 키 사용)의 API 호출은 `403 Forbidden` 처리되어 안전하게 보호되며, 백엔드 서버(`service_role` 키 사용)는 문제없이 해당 RPC를 호출할 수 있습니다.

---

## 5. 서비스 동작 및 앱 Smoke Test 시나리오

Supabase 적용 후 애플리케이션에서 아래 **11단계 시나리오**를 순서대로 진행하며 정상 작동 여부를 검증합니다.

1. **일반 회원가입**: 신규 계정 등록이 오류 없이 완료되는지 확인
2. **로그인**: 가입한 계정으로 로그인 후 토큰이 정상 발급되는지 확인
3. **`/user/me` 정상 조회**: 내 정보 조회 API가 200 OK를 반환하는지 확인
4. **레벨테스트 `submit`**: 최초 진입 시 레벨 테스트 제출 및 결과 반영이 정상인지 확인
5. **레슨 `stage 1-1` 진입**: 퀴즈 및 학습 화면 진입에 문제가 없는지 확인
6. **미션 `claim`**: 달성한 미션의 보상 수령 API(`POST /missions/claim`)가 정상 작동하는지 확인
7. **`crowns` 증가 확인**: 보상 수령 후 사용자 재화(왕관)가 실시간으로 증가하는지 확인
8. **`Aipang` 또는 `AICross` game `start`/`clear`**: 미니게임 시작 및 클리어 시 보상 지급과 동시성 처리가 정상인지 확인
9. **회원 탈퇴**: 설정 페이지에서 회원 탈퇴(`DELETE /user/me`)가 에러 없이 수행되고 `deleted_at`이 기록되는지 확인
10. **같은 `username`/`email` 재가입**: 탈퇴 직후 동일한 아이디와 이메일로 즉시 재가입이 허용되고, 이전 기록이 초기화된 새 UUID로 가입되는지 확인
11. **새로고침 후 user 상태 유지**: 페이지 새로고침을 해도 로그인 및 사용자 세션 상태가 안정적으로 유지되는지 확인

