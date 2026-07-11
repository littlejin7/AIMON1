---
title: AI-MON Supabase 마이그레이션 계획
version: "archive-1.0"
status: historical
original_created_at: 2026-06-22
migration_completed_at: 2026-07-11
superseded_by:
  - docs/ops/supabase-schema-apply-checklist.md
  - backend/data/schema.sql
  - backend/data/migration_gp_coin_additive.sql
---

# AI-MON Supabase 마이그레이션 계획

> **상태: 역사 문서 / 마이그레이션 완료**
>
> 이 문서는 JSON 저장소에서 Supabase로 전환하기 위해 작성한 초기 계획의 결정 사항과 완료 이력을 보존합니다.  
> 현재 운영 절차와 보안 기준은 `docs/ops/supabase-schema-apply-checklist.md`를 따릅니다.

---

## 0. 중요 보안 정정

초기 계획에서 사용한 아래 표현은 현재 기준이 아닙니다.

```env
SUPABASE_KEY=your-anon-key
```

현재 기준:

```env
SUPABASE_KEY=your-server-secret-or-service-role-key
```

규칙:

- 백엔드 Render 환경변수에만 저장
- 프론트에 포함 금지
- `VITE_` 또는 `REACT_APP_` 접두사 사용 금지
- Git에 실제 값 커밋 금지
- 로그·문서·스크린샷에 실제 값 노출 금지
- 프론트는 Supabase 테이블을 직접 호출하지 않고 FastAPI를 경유

---

## 1. 마이그레이션 목표

초기 목표:

1. JSON 파일 기반 사용자·진행도·오답 데이터를 Supabase PostgreSQL로 전환
2. Refresh Token 구조 도입
3. 동시성 안전한 사용자 업데이트 경로 마련
4. 학습·보스·게임·미션 데이터를 서버 권위 방식으로 저장
5. 운영 백엔드 배포
6. DB 직접 접근 보안 적용

현재 상태:

```text
목표 1: 완료
목표 2: 완료
목표 3: 완료
목표 4: 완료
목표 5: Render 백엔드 배포 완료
목표 6: RLS·grant·RPC 차단 완료
```

---

## 2. 전환 완료 구조

```text
Frontend
  ↓ HTTPS / JWT
FastAPI Backend on Render
  ↓ server-only Supabase key
Supabase PostgreSQL
```

프론트는 다음 작업을 직접 수행하지 않습니다.

```text
users 직접 SELECT/UPDATE
progress 직접 INSERT/UPDATE
wrong_answers 직접 쓰기
refresh_tokens 직접 조회
RPC 직접 실행
```

---

## 3. 현재 데이터 저장소

운영 모드:

```text
USE_SUPABASE=true
```

주요 테이블:

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

핵심 사용자 JSONB/상태 컬럼은 `backend/data/schema.sql`을 기준으로 관리합니다.

---

## 4. 핵심 구현 완료 항목

### 인증

- access token
- refresh token
- 비밀번호 재설정 토큰
- 이메일 인증코드
- 소셜 로그인
- 탈퇴 상태 처리
- 닉네임 중복 검증
- 저장 직전 재검사

### 동시성

- `update_user_atomic` RPC
- `mutate_user_atomic` 경로
- version 기반 낙관적 동시성
- 보상·미션·구매 중복 방지
- scheduler 단일 실행 락

### 학습·전투

- progress 저장
- wrong_answers 저장
- attempts 전수 기록
- 미니보스·유닛보스·엔드보스 서버 세션
- battle token
- 서버 채점
- 클리어 전 보상 차단

### 게임·재화

- 게임 보상
- 코인
- 누적 획득 코인
- GP
- 진화 단계
- 랭킹 점수
- 주간 랭킹 점수
- 레거시 XP 스냅샷

---

## 5. 재화·GP·랭킹 migration 완료

적용 컬럼:

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

운영 처리:

```text
활성 사용자 14명 가산형 backfill 완료
미처리 사용자 0명
기존 코인·랭킹 값 보존
진화 단계 이관
보상·상점 스모크 테스트 완료
```

중요:

- 기존 값을 XP로 덮어쓰지 않음
- `legacy_xp_snapshot IS NULL` 가드 사용
- 완료된 backfill은 재실행하지 않음

---

## 6. username/email 중복 기준

현재 활성 계정 기준 부분 unique index를 사용합니다.

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

효과:

```text
Test / test 중복 차단
A@MAIL.COM / a@mail.com 중복 차단
소프트 삭제 계정은 index 조건에서 제외
```

---

## 7. RLS·권한 보안 완료

완료 상태:

```text
주요 8개 테이블 RLS 활성화
allow_anon_select 삭제
anon/authenticated 테이블 직접 권한 제거
anon/authenticated 공개 RPC 실행권한 제거
service_role 백엔드 권한 유지
프론트 서버 키 미사용
```

현재 AI-MON은 클라이언트용 RLS 정책을 두지 않습니다. 데이터 접근은 FastAPI 백엔드로 통일합니다.

---

## 8. Render 배포 완료

백엔드:

```text
https://aimon1.onrender.com
```

설정:

```text
Root Directory: ai-mon/backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
Instance Type: Free
```

현재:

```text
RUN_SCHEDULER=0
```

프론트 배포와 예약 작업 검증 후 단일 실행 프로세스에서만 `1` 전환을 검토합니다.

---

## 9. 원래 단계별 계획의 결과

| 원래 단계 | 결과 |
|---|---|
| Phase 0 — 준비 | 완료 |
| Phase 1 — 테이블 설계 | 완료 및 운영 스키마로 발전 |
| Phase 2 — 코드 전환 | 완료 |
| Phase 3 — 데이터 import | 완료 |
| Phase 4 — 동시성 보완 | 완료 |
| Phase 5 — 인증·Refresh Token | 완료 |
| Phase 6 — 운영 검증 | 백엔드·DB 완료 |
| Phase 7 — 프론트 운영 배포 | 남음 |
| Phase 8 — Scheduler 운영 전환 | 남음 |

---

## 10. 남은 운영 작업

```text
프론트 운영 배포
VITE_API_BASE_URL에 Render URL 설정
실제 프론트 주소를 ALLOWED_ORIGINS에 추가
운영 전체 회귀 테스트
무료 Render sleep 영향 확인
Scheduler 실행 방식 확정
RUN_SCHEDULER 최종 전환
```

---

## 11. 현재 기준 문서

운영자는 다음 순서로 확인합니다.

```text
1. docs/ops/supabase-schema-apply-checklist.md
2. docs/ops/DEPLOY_CHECKLIST.md
3. backend/data/schema.sql
4. backend/data/migration_gp_coin_additive.sql
5. backend/scripts/backfill_gp_coin.py
```

이 문서의 과거 SQL 또는 환경변수 예시는 신규 운영 적용의 직접 근거로 사용하지 않습니다.

---

## 12. 보존 목적

이 문서를 유지하는 이유:

- 초기 설계 배경 보존
- JSON → Supabase 전환 의사결정 기록
- 운영 구조 변화 추적
- 과거 계획과 현재 구현 차이 설명
- 후속 마이그레이션 회고 자료

현재 구현과 충돌할 경우 항상 최신 체크리스트와 코드가 우선합니다.
