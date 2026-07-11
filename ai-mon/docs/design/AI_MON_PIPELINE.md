---
notion_page: https://app.notion.com/p/AI-MON-PIPELINE-373ea473fb45813a8d91cd58551751ab
title: AI-MON 실행 파이프라인
version: "2.1"
status: current
source_of_truth: GitHub main branch code and data
last_verified_commit: 6683cb7b4a9592aedceb1a6ee8a884d63661b8ef
last_verified_at: 2026-07-11
---

# AI-MON 실행 파이프라인

> 화면 이동, API, 채점, 진행도, 보상, 저장, PWA, 배치 작업이 연결되는 현재 구현 기준

## 0. 문서 범위

- 서비스·기능 범위: `AI_MON_PROPOSAL.md`
- 데이터 구조: `AI_MON_SCHEMA.md`
- 미션: `AI_MON_MISSIONS.md`
- 엔드보스: `ENDBOSS_DESIGN.md`
- 배포: `../ops/DEPLOY_CHECKLIST.md`

실제 동작이 문서와 충돌하면 GitHub `main` 코드와 데이터가 우선합니다.

---

## 1. 시스템 구조

```text
React + Vite + PWA
  ├─ 화면·라우팅·상태
  ├─ Pyodide 브라우저 Python 실행
  ├─ 설치 프롬프트
  └─ API 요청
        ↓ HTTPS + JWT
FastAPI
  ├─ 인증·OAuth
  ├─ 문제 원본
  ├─ 서버 채점
  ├─ 진행도 게이트
  ├─ 배틀 세션
  ├─ 보상·미션·게임 검증
  └─ 원자적 사용자 상태 변경
        ├─ Supabase PostgreSQL
        ├─ JSON 정적 데이터·개발 fallback
        ├─ Anthropic Claude
        ├─ Resend
        └─ SendGrid
```

### 책임

| 계층 | 책임 |
|---|---|
| 프론트 | 화면, 입력, 설치 UX, API 호출, Pyodide |
| FastAPI | 인증, 채점, 권한, 보상, 세션, 저장 |
| Supabase | 사용자·진도·시도·오답·토큰 |
| JSON | 커리큘럼·문제·미션 원본 |
| Claude | 자유도 높은 코드 채점·맞춤 설명 |
| Scheduler | 알림, 백업, 탈퇴 계정 정리 |

---

## 2. 앱 시작과 PWA

```text
브라우저 진입
→ React mount
→ 테마 적용
→ PWA 설치 이벤트 초기화
→ Pyodide background preload
→ SplashLoading
→ BrowserRouter
→ GlobalBGM
→ AppLayout + NavBar
```

PWA:

```text
vite-plugin-pwa
→ service worker autoUpdate
→ manifest 주입
→ beforeinstallprompt 저장
→ 회원가입 완료 화면에서 설치 가능 여부 확인
→ 설치 / 나중에
```

설치 거절 상태:

```text
localStorage: aimon:pwa-install-dismiss
1회 거절 → 7일
2회 거절 → 30일
3회 거절 → 자동 안내 중단
```

---

## 3. 라우트와 인증

### 3-1. 공개

| 경로 | 역할 |
|---|---|
| `/` | 랜딩 또는 로그인 홈 |
| `/auth` | 로그인 |
| `/register` | 회원가입 |
| `/find-id` | 아이디 찾기 |
| `/find-pw` | 비밀번호 재설정 |
| `/auth/callback/google` | Google callback |
| `/auth/callback/kakao` | Kakao callback |
| `/auth/callback/naver` | Naver callback |
| `/lesson` | 비로그인 Unit 1 체험 포함 레슨 홈 |
| `/stage/1/1` | 비로그인 공개 체험 |
| `/level-test-info` | 레벨 테스트 안내 |

### 3-2. 명시적 보호

- `/stage/:lessonId/:stage`
- `/boss`
- `/boss/:lessonId`
- `/boss/endboss`
- `/settings`
- `/game/ranking`
- `/game/aipang`
- `/game/runner`
- `/game/aibomb`
- `/game/pairs`
- `/game/aicross`

`/stage/1/1`이 먼저 선언되어 공개 체험으로 처리됩니다.

### 3-3. 셸은 공개, 데이터는 인증

- `/train`
- `/character`
- `/game`

현재는 화면 자체를 `ProtectedRoute`로 감싸지 않았지만 데이터 조회·보상 API가 JWT를 요구합니다.

개선 후보:

```text
A. 라우트 자체를 보호
B. 공개 미리보기 + 명시적 로그인 CTA
```

둘 중 하나로 정책을 통일해야 합니다.

---

## 4. 비로그인 체험

```text
/lesson
→ 비로그인 Unit 1 카드
→ /stage/1/1
→ 브리핑 로드
→ 개념 퀴즈 10개 로드
→ 문제별 서버 채점
→ 마지막 문제
```

완료 분기:

```text
점수 < 80
→ 결과 화면
→ 다시 도전 또는 가입 안내

점수 >= 80
→ localStorage에 임시 진행도 저장
→ 결과 화면
→ 회원가입 안내
```

저장 키:

```text
aimon-guest-trial-progress
```

저장 데이터:

```json
{
  "unit": 1,
  "stage": "1-1",
  "score": 80,
  "is_completed": true,
  "checkpoint": "done",
  "answered_questions": [],
  "saved_at": "ISO timestamp"
}
```

제한:

- 미니보스 시작 안 함
- `progress` API 저장 안 함
- 보상 지급 안 함
- 로그인 계정 진행도와 직접 합치지 않음

### 일반가입 승계

```text
POST /auth/register
→ JWT 저장
→ localStorage 읽기
→ 유효한 완료 기록 확인
→ POST /progress
→ 성공 시 localStorage 삭제
```

### 현재 누락

Google·Kakao·Naver callback은 인증 후 바로 홈으로 이동합니다.
체험 진행도 승계 helper가 소셜 callback에 연결돼 있지 않습니다.

---

## 5. 일반 회원가입

```text
/register
→ 아이디·이메일·비밀번호
→ GET /auth/check-id
→ GET /auth/check-email
→ POST /auth/email/send-code
→ Resend 인증 메일
→ POST /auth/email/verify-code
→ 닉네임 입력
→ GET /auth/check-nickname
→ 수준·목표·시간 선택
→ 저장 직전 닉네임 재검사
→ POST /auth/register
→ access/refresh token 저장
→ 체험 진행도 승계
→ PWA 설치 안내 가능
→ 홈
```

### 이메일 입력

```text
이메일 아이디
+ @
+ 도메인 드롭다운 또는 직접 입력
```

프론트 정규화:

- 아이디 소문자
- 도메인 소문자
- 공백·한글·중복 `@` 제거

서버도 활성 계정 기준 소문자 중복을 차단합니다.

### 가입 인증 메일

```text
EMAIL_ENABLED=true
EMAIL_PROVIDER=resend
RESEND_API_KEY
EMAIL_FROM
```

`EMAIL_ENABLED=false`는 개발 모드이며 운영 가입 인증에 사용하면 안 됩니다.

---

## 6. 소셜 OAuth

### 6-1. Google

```text
로그인 버튼
→ VITE_GOOGLE_CLIENT_ID 확인
→ 인앱브라우저 감지
   ├─ 감지됨: 외부 브라우저 안내
   └─ 일반 브라우저: Google authorize
→ /auth/callback/google
→ 서버 code 교환
→ token + user 저장
→ 홈
```

인앱 감지 대상:

- Naver
- KakaoTalk
- Instagram
- Facebook
- LINE
- Daum
- Android WebView
- iOS WebView

### 6-2. Kakao·Naver

```text
authorize
→ callback
→ 서버 code 교환
→ token + user
→ 홈
```

현재 기술 부채:

- 프론트에 Client ID fallback이 존재함
- 배포 환경변수로만 공급하도록 정리 필요
- 소셜 신규 가입에도 게스트 진행도 승계 필요

---

## 7. 레벨 테스트와 코스

```text
가입·로그인
→ 레벨 테스트 안내
→ 문제 제출
→ 서버 채점
→ course_level 갱신
→ 하위 코스 recognized
→ 현재 코스 학습
```

클라이언트가 프로필 수정이나 가입 요청으로 `is_level_tested=true`를 임의 지정해도 서버는 신뢰하지 않습니다.
레벨 테스트 제출 API만 상태를 확정합니다.

---

## 8. 스테이지 로드

```text
/stage/:unit/:stage
→ unit metadata
→ briefing slides
→ quiz questions
→ progress
→ Promise.all
→ 화면 상태 구성
```

문제 요청:

```text
unit
stage
course_level
limit=10
attempt
```

재도전:

```text
attempt 1 → Set A
attempt 2 → Set B
attempt 3+ → A+B 혼합
```

로드 실패:

- 401: 로그인 필요
- 403: 이전 스테이지 게이트
- 500·네트워크: 재시도
- HTTP 200 + 빈 배열: 문제 데이터 없음

자동 뒤로가기를 하지 않고 오류 사유와 재시도 버튼을 표시합니다.

---

## 9. 개념 퀴즈

```text
문제 표시
→ 사용자 답
→ 문제 유형 판별
→ 서버 채점·시도 기록
→ 결과·피드백 반환
→ 다음 문제
```

채점 경로:

| 유형 | 경로 |
|---|---|
| 객관식·단답 | attempts 서버 재채점 |
| code_input | code submit |
| 미니보스 | miniboss answer |
| 유닛보스 | boss answer |
| 엔드보스 | endboss answer |

개념 퀴즈 마지막:

```text
60% 미만
→ 실패 모달
→ 다음 문제 세트로 재도전

60% 이상
→ 미니보스 시작
```

비로그인 1-1은 예외로 80% 이상일 때 체험 완료 처리하며 미니보스로 넘어가지 않습니다.

---

## 10. 스테이지 미니보스

```text
POST /boss/miniboss/start
→ battle_token
→ 5문제
→ 문제별 /answer
→ 서버 correct/wrong 누적
```

판정:

```text
4정답 → won
2오답 → lost
```

HP:

- 보스 500
- 사용자 900
- UI 연출용
- 승패 권한 없음

승리:

```text
POST /boss/miniboss/clear
→ token 검증
→ status == won
→ 세션 consume
→ 최초 보상
→ progress 완료 저장
→ 다음 스테이지 해금
```

프론트가 보낸 점수나 HP만으로 완료되지 않습니다.

---

## 11. 유닛 보스

```text
모든 스테이지 완료
→ /boss 진입
→ 무료 도전 또는 왕관 차감
→ battle_token
→ unseen 우선 문제
→ 정답 5 / 오답 3
→ clear
→ 보상·왕관·다음 Unit
```

객관식·출력·오류 찾기는 서버 직접 채점합니다.
코드 작성형만 코드 채점 결과를 사용합니다.

---

## 12. 엔드보스

```text
Unit 8 보스 완료 또는 하위 코스 인정
→ 코스 선택
→ 프로젝트 선택
→ 왕관 3 차감
→ Phase 1
→ Phase 2
→ Phase 3
→ status=won
→ clear
```

보상:

- 코인 15,000
- 누적 랭킹점수 15,000
- 왕관 15
- 코스 칭호
- 진화
- 다음 코스 승급

클리어 API는 서버 세션이 `won`이 아니면 보상을 거부합니다.

---

## 13. 진행도와 시도 기록

### progress

스테이지별:

- unit
- stage
- course_level
- score
- is_completed
- checkpoint

### attempts

채점된 문제별:

- question_id
- unit
- stage
- level
- mode
- is_correct
- answered_at

### wrong_answers

오답과 복습 상태를 저장합니다.

진행도 완료는 다음 스테이지 게이트의 근거이므로 저장 실패 시 재시도하고 로그를 남깁니다.

---

## 14. 보상

```text
도메인 이벤트
→ grant_reward
→ coin_delta
→ ranking_score_delta
→ GP gate
→ mutate_user_atomic
→ 응답 user_state
```

GP:

```text
evolution_stage < 3 → gp_delta=0
evolution_stage >= 3 → 정책값 지급
```

상점:

```text
coin_balance만 차감
gp·ranking_score 불변
```

레거시 `xp_awarded`는 일부 응답에서 호환용으로 유지될 수 있으나 신규 기획 기준은 아닙니다.

---

## 15. 미션

```text
사용자 행동
→ bump_mission(event)
→ daily·weekly 정의 검사
→ progress 증가
→ 홈에서 수령
→ POST /missions/claim
→ 원자적 중복 검증
→ 보상
```

기간:

- daily: KST 날짜
- weekly: KST ISO 주차
- 접근 시 lazy reset
- 별도 reset scheduler 없음

---

## 16. 미니게임과 랭킹

```text
게임 시작
→ game_token
→ 플레이
→ 결과 제출
→ 소유자·게임·만료·nonce·시간·범위 검증
→ 보상
→ 주간 기록
```

에이칸:

```text
서버 puzzle_id
→ 정답 비공개 grid·entries
→ 사용자 answers
→ 서버 채점
```

랭킹:

- 누적: `ranking_score`
- 주간 게임: 게임별 주간 점수
- 30초 TTL cache
- 현재 가중치 1.0

---

## 17. 저장과 동시성

운영:

```text
FastAPI
→ server-only SUPABASE_KEY
→ Supabase
```

핵심 상태 변경:

- `mutate_user_atomic`
- version 기반 충돌 방어
- nonce consume
- 세션 consume
- 최초 클리어 이력

클라이언트는 Supabase 테이블이나 RPC를 직접 호출하지 않습니다.

---

## 18. 이메일과 스케줄러

가입 인증:

```text
Resend
```

운영 알림:

```text
SendGrid
```

Scheduler 후보 작업:

- 스트릭 리마인더
- JSON 백업
- 탈퇴 계정 영구 삭제
- 만료 배틀 세션 정리

여러 워커·인스턴스에서는 단일 실행을 보장해야 합니다.
무료 Render는 sleep 동안 내부 스케줄러가 실행되지 않을 수 있습니다.

---

## 19. 오류 처리 원칙

| 오류 | 원칙 |
|---|---|
| 인증 실패 | 로그인 안내, 토큰 재발급 경로 |
| 게이트 실패 | 필요한 이전 단계 표시 |
| 문제 없음 | 빈 화면 대신 명시적 상태 |
| AI 실패 | 실제 오답과 구분, 재시도 |
| 저장 실패 | 재시도·로그·보상 중복 방지 |
| 배틀 중복 제출 | 프론트 lock + 서버 세션 멱등 |
| 이메일 실패 | 가입 인증 실패로 명확히 반환 |
| OAuth 인앱 | 외부 브라우저 안내 |

---

## 20. 현재 파이프라인 갭

### P0

- 소셜 가입 체험 진행도 승계
- OAuth Client ID fallback 제거
- `.env.example`, Render, 배포 문서 환경변수 일치
- 공개 셸 라우트 인증 UX 통일

### P1

- iOS PWA 수동 설치 흐름
- 배포 전체 스모크 자동화
- 외부 OAuth 검수 상태 표준화
- Scheduler 운영 방식 확정

### P2

- 통계
- 리그
- 실데이터 기반 랭킹 가중치
