---
title: AI-MON 운영 배포 체크리스트
version: "2.2"
status: current
source_of_truth: repository configuration plus deployment dashboard verification
last_verified_commit: 6683cb7b4a9592aedceb1a6ee8a884d63661b8ef
last_verified_at: 2026-07-11
---

# AI-MON 운영 배포 체크리스트

> Git으로 확인 가능한 코드 기준과 Render·Supabase·프론트 대시보드에서 확인해야 하는 운영 상태를 분리합니다.

## 0. 상태 표기

| 표기 | 의미 |
|---|---|
| 코드 확인 | 저장소에서 검증 가능 |
| 운영 확인 | 외부 대시보드·실기기 확인 필요 |
| 완료 기록 | 확인 날짜·담당·근거를 직접 기록 |

현재 상태를 문서에 고정값으로 추정하지 않습니다.

---

## 1. 배포 기준 커밋

```powershell
cd C:\AIMON1\ai-mon

git status -sb
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
```

완료 기준:

```text
작업 트리 clean
현재 branch = main
HEAD = origin/main
```

기록:

```text
배포 SHA:
확인 날짜:
담당:
```

---

## 2. 비밀정보 사전 점검

```powershell
git grep -n -I -E "sb_secret_|service_role|sk-ant-|re_[A-Za-z0-9]|GOOGLE_CLIENT_SECRET=.+|KAKAO_CLIENT_SECRET=.+|NAVER_CLIENT_SECRET=.+"
```

허용:

- 환경변수 이름
- 빈 값
- `<placeholder>`
- 설명 문구

금지:

- 실제 API key
- service-role JWT
- OAuth secret
- 실제 이메일 공급자 키
- 관리자 secret

노출 의심 시:

1. 키 재발급
2. 배포 환경변수 교체
3. 재배포
4. 기존 키 폐기
5. Git 기록·로그·스크린샷 범위 확인

---

## 3. Render 백엔드 코드 기준

`render.yaml` 기준:

```text
Service Type: Web Service
Plan: Free
Runtime: Python
Branch: main
Root Directory: ai-mon/backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

운영 대시보드에서 실제 설정과 일치하는지 확인합니다.

---

## 4. 백엔드 환경변수

### 4-1. 인증·토큰

```text
SECRET_KEY
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS
```

### 4-2. Supabase

```text
SUPABASE_URL
SUPABASE_KEY
USE_SUPABASE=true
```

`SUPABASE_KEY`는 서버 전용 secret/service-role 키입니다.

### 4-3. AI

```text
ANTHROPIC_API_KEY
```

코드는 `CLAUDE_API_KEY` fallback도 읽지만 운영 기준은 `ANTHROPIC_API_KEY`로 통일합니다.

### 4-4. CORS

```text
ALLOWED_ORIGINS
```

예:

```text
http://localhost:3000,https://ai-mon.app,https://www.ai-mon.app
```

규칙:

- 쉼표 구분
- 마지막 `/` 제거
- 실제 origin만 등록
- `*` 금지
- 변경 후 재배포

### 4-5. 가입 인증 메일 — Resend

```text
EMAIL_ENABLED=true
EMAIL_PROVIDER=resend
RESEND_API_KEY
EMAIL_FROM
```

`EMAIL_FROM`은 Resend에서 인증된 발신 도메인·주소를 사용합니다.

운영에서 `EMAIL_ENABLED=false`이면 실제 메일이 발송되지 않습니다.

### 4-6. 운영 알림 메일 — SendGrid

```text
SENDGRID_API_KEY
SENDGRID_FROM_EMAIL
```

가입 인증과 스트릭 알림은 공급자와 함수가 다르므로 둘을 혼동하지 않습니다.

### 4-7. OAuth 서버

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
KAKAO_CLIENT_ID
KAKAO_CLIENT_SECRET
NAVER_CLIENT_ID
NAVER_CLIENT_SECRET
```

공급자가 secret을 요구하지 않는 특정 경로라도 빈 값 여부와 백엔드 구현을 확인합니다.

### 4-8. 스케줄러

```text
RUN_SCHEDULER
```

정책:

- 단일 실행만 허용
- 멀티워커·다중 인스턴스는 하나만 `1`
- 무료 Render sleep 영향을 고려
- 검증 전에는 무조건 켰다고 가정하지 않음

### 4-9. 선택

```text
ADMIN_SECRET
PYTHON_VERSION
```

실제 값은 Git에 기록하지 않습니다.

---

## 5. 프론트 환경변수

```text
VITE_API_BASE_URL
VITE_GOOGLE_CLIENT_ID
VITE_KAKAO_CLIENT_ID
VITE_NAVER_CLIENT_ID
```

규칙:

- `VITE_` 값은 브라우저에 공개됨
- OAuth Client ID만 허용
- Client Secret, Supabase secret, Anthropic, Resend key 금지
- 프론트 코드의 Kakao·Naver Client ID fallback 제거 권장

예:

```text
VITE_API_BASE_URL=https://<backend-host>
```

마지막 `/`는 제거합니다.

---

## 6. Supabase 사전 확인

상세 기준:

```text
docs/ops/supabase-schema-apply-checklist.md
```

필수 확인:

- 필수 테이블 존재
- 최신 users 컬럼 존재
- partial unique index
- RLS
- anon/authenticated direct grant 차단
- RPC public execute 차단
- service-role backend 동작
- 백업 확보

운영 DB에 `schema.sql` 전체를 무조건 재실행하지 않습니다.

---

## 7. 백엔드 배포

순서:

1. 배포 SHA 기록
2. 환경변수 확인
3. Supabase 변경 선적용 여부 확인
4. Render deploy
5. build log 확인
6. start log 확인
7. health 확인
8. version 확인

예상 health:

```json
{"status":"AI MON Backend is running"}
```

확인 URL은 실제 Render 서비스 주소를 대시보드에서 복사합니다.

기록:

```text
Backend URL:
배포 SHA:
배포 시각:
Build:
Health:
Version:
```

---

## 8. 프론트 배포

확인:

- Root directory
- build command
- output directory
- SPA rewrite
- 환경변수
- custom domain
- HTTPS
- backend CORS

배포 후:

```text
실제 프론트 origin
→ Render ALLOWED_ORIGINS
→ backend redeploy
```

기록:

```text
Frontend URL:
Custom domain:
배포 SHA:
CORS 반영:
```

---

## 9. PWA 배포 확인

코드 기준:

- service worker auto update
- manifest
- standalone
- portrait
- 192·512·maskable icons
- 회원가입 완료 후 설치 안내

실기기 확인:

### Android Chrome

- 설치 배너 또는 설치 버튼
- 홈 화면 아이콘
- standalone 실행
- 아이콘 잘림 없음
- 신규 배포 후 업데이트

### Desktop Chrome

- 주소창 설치 가능
- 설치 모달
- 앱 창 실행
- uninstall/reinstall

### iOS Safari

- 공유 → 홈 화면에 추가
- 아이콘
- standalone
- 자동 설치 모달이 없음을 고려한 별도 안내 여부

캐시 확인:

- 이전 아이콘이 계속 나오면 설치 앱 삭제 후 재설치
- 서비스 워커와 manifest 캐시 갱신
- DevTools Application에서 등록 상태 확인

---

## 10. 인증 스모크

### 일반 회원가입

- 아이디 소문자 정규화
- 이메일 소문자 정규화
- 도메인 드롭다운·직접 입력
- 아이디 중복
- 이메일 중복
- 닉네임 중복
- 인증 메일 수신
- 코드 만료
- 잘못된 코드
- 가입 완료
- 로그인 상태 유지
- PWA 설치 안내

### 소셜

- Google
- Kakao
- Naver

각 공급자:

- 외부 브라우저
- redirect URI
- 신규 가입
- 기존 로그인
- 취소
- 오류
- 로그아웃 후 재로그인

Google 인앱브라우저:

- 카카오톡
- 네이버
- Instagram
- Android WebView
- iOS WebView

기대:

```text
OAuth 직접 진행 대신 외부 브라우저 안내
```

### 계정 관리

- 아이디 찾기
- 비밀번호 재설정
- 탈퇴 확인
- 탈퇴 완료
- 탈퇴 후 토큰 차단
- 삭제 계정 로그인 차단

---

## 11. 게스트 체험 스모크

```text
비로그인 /lesson
→ Unit 1
→ Stage 1-1
→ 브리핑
→ 개념 퀴즈
```

확인:

- 80% 미만 재도전
- 80% 이상 완료
- 미니보스 미진입
- 서버 보상 없음
- localStorage 생성
- 일반가입 후 progress 승계
- 승계 성공 후 localStorage 삭제

현재 알려진 갭:

- 소셜 가입 승계는 별도 구현·검수 필요

---

## 12. 학습 스모크

### 스테이지

- 이전 스테이지 게이트
- 브리핑
- 문제 로드 실패 UI
- 빈 문제 UI
- 답안 서버 채점
- 오답 저장
- attempts 기록
- 60% 미만 재도전
- 60% 이상 미니보스
- Set A/B/A+B

### 미니보스

- 5문제
- 4정답 승리
- 2오답 패배
- token 소유자
- 중복 제출
- clear 전 승리 검증
- 새로고침·재진입

### 유닛 보스

- 해금
- 하루 무료 횟수
- 왕관 차감
- 힌트
- 5정답·3오답
- 최초 보상
- 재클리어 중복 보상 차단

### 엔드보스

- 코스 상태
- 프로젝트별 문제
- 왕관 3
- Phase 1~3
- status=won 전 clear 거부
- 최초 보상
- 승급
- 진화
- 재도전 중복 보상 차단

---

## 13. 재화·미션·게임 스모크

### 재화

- coin_balance
- total_coin_earned
- ranking_score
- weekly score
- GP gate
- crowns
- shop 차감

### 미션

- daily 진척
- weekly 진척
- 수동 수령
- 중복 수령 차단
- KST reset

### 게임

- game_token
- 최소 시간
- nonce
- 일일 cap
- 각 게임 보상
- 에이칸 서버 채점
- 주간 랭킹
- 30초 캐시

---

## 14. Scheduler

`RUN_SCHEDULER=1` 전 확인:

- 실행 프로세스 수
- DB lock
- 알림 메일 환경변수
- 백업 저장 위치
- 탈퇴 계정 삭제 정책
- 무료 인스턴스 sleep
- 중복 실행 로그

완료 기록:

```text
RUN_SCHEDULER:
실행 인스턴스:
DB lock:
첫 실행 로그:
중복 없음:
```

운영 안정성이 필요하면 외부 Cron 또는 상시 worker를 검토합니다.

---

## 15. 롤백

배포 전 기록:

```text
이전 backend SHA:
이전 frontend SHA:
DB 변경 SQL:
DB 롤백 SQL:
환경변수 변경:
```

장애 시:

1. 신규 트래픽 영향 확인
2. 프론트 이전 SHA
3. 백엔드 이전 SHA
4. 환경변수 복원
5. additive DB 변경은 성급히 DROP하지 않음
6. 데이터 손실 여부 확인
7. 장애 원인과 재배포 조건 기록

---

## 16. 최종 승인표

```text
[ ] Git clean / SHA 일치
[ ] 비밀정보 없음
[ ] Supabase 사전 검증
[ ] Backend build
[ ] Backend health/version
[ ] Frontend build
[ ] CORS
[ ] 일반 회원가입 이메일
[ ] Google/Kakao/Naver
[ ] 게스트 1-1
[ ] 학습·미니보스·유닛보스·엔드보스
[ ] 재화·미션·게임
[ ] PWA Android/Desktop/iOS
[ ] Scheduler 결정
[ ] 롤백 기록
```

승인:

```text
배포 SHA:
배포일:
검수자:
결론:
차단 이슈:
비차단 이슈:
```
