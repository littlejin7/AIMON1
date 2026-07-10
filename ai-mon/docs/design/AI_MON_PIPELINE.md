---

## notion_page: [https://app.notion.com/p/AI-MON-PIPELINE-373ea473fb45813a8d91cd58551751ab](https://app.notion.com/p/AI-MON-PIPELINE-373ea473fb45813a8d91cd58551751ab)title: AI MON PIPELINEversion: "2.0"status: currentsource_of_truth: GitHub main branch code and datalast_verified_commit: 830c0da32a3a2400bfa019e523448a506be74b7clast_verified_at: 2026-07-11

# AI MON 파이프라인

>
> AI-MON의 화면 이동, 서버 API, 채점, 진행도, 보상, 저장, 배치 작업이  

> 실제로 어떤 순서로 연결되는지를 설명하는 현재 구현 기준 문서
>

---

## 0. 문서 목적

이 문서는 AI-MON의 **실행 흐름**을 설명합니다.

- 서비스 개념과 기능 범위: [`AI_MON_PROPOSAL.md`](./AI_MON_PROPOSAL.md)
- 정적 JSON, PostgreSQL 테이블, API 데이터 필드: [`AI_MON_SCHEMA.md`](./AI_MON_SCHEMA.md)
- 미션 상세 정의: [`AI_MON_MISSIONS.md`](./AI_MON_MISSIONS.md)
- 엔드보스 상세 규칙: [`ENDBOSS_DESIGN.md`](./ENDBOSS_DESIGN.md)

실제 동작이 문서와 충돌할 경우 GitHub `main` 브랜치의 코드와 데이터가 우선합니다.

### 문서에서 사용하는 상태 표기


| 표기        | 의미                                                                          |
|---------------|---------------------------------------------------------------------------------|
| 현재 구현 | `main`에 코드와 연결 경로가 존재함                                  |
| 부분 구현 | 코드가 있으나 운영 설정, 외부 검수, DB 적용 확인이 필요함 |
| 향후 계획 | 아직 실제 사용자 흐름에 연결되지 않음                           |
| 현재 한계 | 구현은 동작하지만 보안·운영·구조 개선이 남아 있음        |


---

## 1. 명칭


| 개념                              | 명칭                                          |
|-------------------------------------|-------------------------------------------------|
| 학습 난이도·과정            | 코스 (`beginner`, `intermediate`, `advanced`) |
| 학습 대단위                    | 유닛 (`Unit`)                                 |
| 유닛 내부 학습 단위         | 스테이지 (`Stage`)                          |
| 스테이지 개념 설명          | 브리핑                                       |
| 스테이지 문제                 | 퀴즈                                          |
| 스테이지 마지막 관문       | 스테이지 미니보스                       |
| 유닛 마지막 관문             | 유닛 보스                                   |
| 코스 마지막 관문             | 엔드보스                                    |
| 오답·랜덤 반복 학습        | 훈련                                          |
| 소비성 일반 재화             | 코인 (`coin_balance`)                         |
| 전체 누적 경쟁 점수         | 랭킹점수 (`ranking_score`)                  |
| 주간 미니게임 경쟁 점수   | 주간 게임 랭킹                            |
| 최종 진화 후 성장치         | GP                                              |
| 보스 도전·힌트 특수 재화 | 왕관 (`crowns`)                               |
| 캐릭터 성장 기준             | 진화 단계 (`evolution_stage`)               |


---

## 2. 전체 시스템 구조

```text
┌─────────────────────────────────────────────────────────────┐  
│                       React + Vite                           │  
│                                                             │  
│  Home / Lesson / Train / Game / My Aimon                   │  
│  Auth / Stage / Boss / EndBoss / Settings / Ranking        │  
│                                                             │  
│  - 화면 상태                                                 │  
│  - Pyodide 브라우저 Python 실행                              │  
│  - API 요청                                                  │  
└─────────────────────────────┬───────────────────────────────┘  
                              │ HTTPS + JWT  
                              ▼  
┌─────────────────────────────────────────────────────────────┐  
│                         FastAPI                             │  
│                                                             │  
│  Auth / User / Quiz / Progress / Attempts                  │  
│  Miniboss / Unitboss / Endboss / Code / Train              │  
│  Missions / Games / Ranking / Titles / Guide               │  
│                                                             │  
│  - 인증                                                      │  
│  - 문제 원본 보관                                            │  
│  - 서버 채점                                                 │  
│  - 배틀 세션                                                 │  
│  - 진행도 게이트                                             │  
│  - 보상 검증                                                 │  
│  - 원자적 사용자 상태 변경                                   │  
└──────────────┬──────────────────────┬───────────────────────┘  
               │                      │  
               ▼                      ▼  
┌────────────────────────┐   ┌───────────────────────────────┐  
│ Supabase PostgreSQL    │   │ Anthropic Claude             │  
│                        │   │                               │  
│ users                  │   │ 자유도가 높은 코드 채점       │  
│ progress               │   │ 맞춤 오답 설명                │  
│ wrong_answers          │   │ 유닛보스 힌트                 │  
│ attempts               │   └───────────────────────────────┘  
│ refresh/reset tokens   │  
│ verification codes     │   ┌───────────────────────────────┐  
└──────────────┬─────────┘   │ Email providers               │  
               │             │                               │  
               ▼             │ Resend: 가입 인증             │  
┌────────────────────────┐   │ SendGrid: 스트릭 리마인더      │  
│ JSON fallback / backup │   └───────────────────────────────┘  
└────────────────────────┘
```

### 핵심 책임 분리


| 계층          | 책임                                                                        |
|-----------------|-------------------------------------------------------------------------------|
| 프론트엔드 | 화면 렌더링, 사용자 입력, Pyodide 실행, API 호출                |
| FastAPI         | 인증, 원본 문제 조회, 채점, 권한·게이트 검증, 보상 계산 |
| Supabase        | 사용자 상태와 학습 이력 영속 저장                               |
| Claude          | 직접 비교로 판정하기 어려운 코드와 설명 생성               |
| Scheduler       | 이메일, JSON 백업, 탈퇴 계정 영구 삭제                           |
| JSON 데이터  | 커리큘럼, 문제, 미션 정의와 로컬 fallback                        |


---

## 3. 프론트엔드 화면 파이프라인

### 3-1. 앱 시작

```text
브라우저 앱 진입  
↓  
React App 마운트  
↓  
테마 적용  
↓  
Pyodide CDN 로더 확인  
↓  
Pyodide 백그라운드 preload  
↓  
SplashLoading 종료  
↓  
React Router 렌더링  
↓  
GlobalBGM + AppLayout + NavBar
```

- 앱의 기준 캔버스 폭은 420px입니다.
- 뷰포트 폭에 따라 `--app-scale`을 계산해 모바일 중심 화면을 유지합니다.
- Pyodide는 코드 입력 문제를 대비해 앱 시작 후 백그라운드에서 준비합니다.
- 전체화면 게임은 공통 AppLayout과 NavBar를 사용하지 않습니다.

### 3-2. 하단 내비게이션

```text
홈  
├─ 오늘 학습  
├─ 미션  
├─ 누적 랭킹  
└─ 사용자 진행 요약  
  
레슨  
├─ 코스  
├─ 유닛  
├─ 스테이지  
├─ 미니보스  
├─ 유닛보스  
└─ 엔드보스  
  
훈련  
├─ 오답 복습  
├─ 랜덤 훈련  
└─ 보스 러시  
  
미니게임  
├─ 에이팡  
├─ 에이짝  
├─ 에이런  
├─ 에이밤  
├─ 에이칸  
└─ 주간 랭킹  
  
내 에이몬  
├─ 캐릭터  
├─ 진화 단계  
├─ 재화  
├─ 칭호  
└─ 설정 진입
```

### 3-3. 현재 라우트 구분

#### 명시적 공개 라우트


| 경로                  | 역할                                   |
|-------------------------|------------------------------------------|
| `/`                     | 비로그인 랜딩 또는 로그인 홈 |
| `/auth`                 | 로그인                                |
| `/register`             | 일반 회원가입                      |
| `/find-id`              | 아이디 찾기                         |
| `/find-pw`              | 비밀번호 재설정                   |
| `/auth/callback/google` | Google 콜백                            |
| `/auth/callback/naver`  | Naver 콜백                             |
| `/auth/callback/kakao`  | Kakao 콜백                             |
| `/lesson`               | 레슨 홈                               |
| `/stage/1/1`            | 비로그인 공개 체험               |
| `/level-test-info`      | 레벨 테스트 안내                  |


#### `ProtectedRoute`가 명시된 라우트


| 경로                    | 역할                         |
|---------------------------|--------------------------------|
| `/stage/:lessonId/:stage` | 공개 체험 외 스테이지 |
| `/boss`                   | 보스 선택                  |
| `/boss/:lessonId`         | 유닛 보스                  |
| `/boss/endboss`           | 엔드보스                   |
| `/settings`               | 설정                         |
| `/game/ranking`           | 게임 랭킹 전체보기     |
| `/game/aipang`            | 에이팡                      |
| `/game/runner`            | 에이런                      |
| `/game/aibomb`            | 에이밤                      |
| `/game/pairs`             | 에이짝                      |
| `/game/aicross`           | 에이칸                      |


#### 화면 진입은 열려 있으나 인증 API를 사용하는 탭

- `/train`
- `/character`
- `/game`

이 화면들은 App 라우트에서 직접 `ProtectedRoute`로 감싸지 않았습니다. 실제 데이터 조회와 보상 행동은 JWT가 필요한 API에서 제한합니다.

### 3-4. 내비게이션 알림 점

```text
NavBar 렌더링 또는 경로 변경  
↓  
GET /missions/  
GET /game/challenge/status  
↓  
수령 가능한 미션 존재?  
├─ 예 → 홈 탭 알림 점  
└─ 아니오 → 표시 안 함  
↓  
일일 게임 챌린지 완료 + 미수령?  
├─ 예 → 미니게임 탭 알림 점  
└─ 아니오 → 표시 안 함
```

보상 수령 후 `aimon:reward-status-changed` 이벤트가 발생하면 알림 상태를 다시 조회합니다.

---

## 4. 인증 파이프라인

### 4-1. 일반 회원가입

```text
/register  
  ↓  
아이디·닉네임·이메일 입력  
  ↓  
GET /auth/check-id  
GET /auth/check-email  
GET /auth/check-nickname  
  ↓  
POST /auth/email/send-code  
  ↓  
인증코드 생성 + 만료시각 저장  
  ↓  
Resend 발송  
  ↓  
POST /auth/email/verify-code  
  ↓  
서버에서 코드·이메일·만료 여부 확인  
  ↓  
POST /auth/register  
  ↓  
저장 직전 아이디·이메일·닉네임 중복 재검사  
  ↓  
비밀번호 해시 저장  
  ↓  
사용자 생성  
  ↓  
로그인 또는 레벨 테스트 유도
```

### 4-2. 이메일 인증

```text
EMAIL_ENABLED=false  
└─ 개발 모드: 실제 발송 없이 서버 로그에 코드 기록  

EMAIL_ENABLED=true  
↓  
EMAIL_PROVIDER=resend 확인  
↓  
RESEND_API_KEY + EMAIL_FROM 확인  
↓  
Resend API 요청  
↓  
200 또는 202  
├─ 성공 → 인증 화면 유지  
└─ 실패 → 가입 진행 중단 + 발송 오류 반환
```

- 인증코드는 6자리입니다.
- 이메일 안내상 유효시간은 5분입니다.
- API 응답에 인증코드를 노출하지 않습니다.

### 4-3. 로그인

```text
POST /auth/login  
  ↓  
사용자 조회  
  ↓  
소프트 삭제 계정 제외  
  ↓  
비밀번호 검증  
  ↓  
Access Token + Refresh Token 발급  
  ↓  
last_login / streak 갱신  
  ↓  
프론트 인증 스토어 저장  
  ↓  
홈 이동
```

### 4-4. 소셜 로그인

```text
Google / Kakao / Naver 인증  
↓  
각 공급자 콜백 페이지  
↓  
공급자 토큰 또는 인증값 수신  
↓  
POST /auth/social/{provider}  
↓  
공급자 사용자 정보 확인  
↓  
기존 계정 조회  
├─ 존재 → 로그인 처리  
└─ 없음 → 소셜 사용자 생성  
↓  
저장 직전 닉네임 충돌 재검사  
↓  
JWT 발급  
↓  
홈 또는 레벨 테스트
```

>
> 코드 경로 존재와 각 공급자의 운영 승인·검수 완료는 별개입니다. 배포 전 공급자 콘솔 상태를 확인해야 합니다.
>

### 4-5. 비밀번호 재설정

```text
POST /auth/forgot-password  
  ↓  
사용자 확인  
  ↓  
재설정 토큰 또는 인증 정보 생성  
  ↓  
이메일 발송  
  ↓  
POST /auth/reset-password  
  ↓  
토큰 유효성 확인  
  ↓  
새 비밀번호 해시 저장  
  ↓  
사용한 토큰 폐기
```

### 4-6. 계정 삭제

```text
설정 화면  
↓  
탈퇴 확인 팝업  
↓  
DELETE /user/me  
↓  
사용자 deleted_at 기록  
↓  
로그아웃·로컬 토큰 제거  
↓  
탈퇴 완료 안내  
↓  
매일 04:00 KST purge 작업  
↓  
30일 보존기간이 지난 계정 영구 삭제
```

---

## 5. 레벨 테스트와 코스 배치

```text
로그인 사용자  
  ↓  
is_level_tested 확인  
  ├─ true → 현재 코스 학습  
  └─ false → 레벨 테스트 CTA  
                ↓  
         테스트 답안 제출  
                ↓  
      POST /auth/level-test/submit  
                ↓  
       서버가 결과 레벨 결정  
                ↓  
 apply_level_test_placement()  
                ↓  
 course_level + is_level_tested 저장  
                ↓  
 하위 코스를 recognized clear로 기록  
                ↓  
 배치된 코스 Unit 1부터 시작
```

### 배치 규칙


| 배치 결과 | 처리                                         |
|---------------|------------------------------------------------|
| Beginner      | 하위 인정 없음, Beginner 시작          |
| Intermediate  | Beginner 인정, Intermediate 시작           |
| Advanced      | Beginner·Intermediate 인정, Advanced 시작 |


- 배치된 코스 자체를 클리어 처리하지 않습니다.
- 상위 코스 배치 사용자가 하위 코스 잠금 상태로 보이지 않도록 하위 코스만 인정 기록합니다.
- 코스 승급은 강등 없이 단조 증가합니다.

---

## 6. 레슨 데이터 로드 파이프라인

```text
LessonHome 진입  
↓  
GET /quiz/units?course_level={level}  
↓  
backend/data/lessons_{level}.json 우선  
↓ 파일 없음 또는 기본 코스  
backend/data/lessons.json fallback  
↓  
유닛 제목·설명·스테이지 수 반환  
↓  
사용자 max_unlocked_unit과 비교  
↓  
열림 / 완료 / 잠금 상태 렌더링
```

### 스테이지 진입

```text
/stage/{unit}/{stage}  
  ↓  
GET /quiz/lessons/{lessonId}  
GET /quiz/questions  
  ↓  
course_level + unit + stage로 JSON 조회  
  ↓  
정답·해설·힌트 등 민감 필드 제거  
  ↓  
브리핑과 문제 반환  
  ↓  
프론트 렌더링
```

### 문제 데이터 경로

```text
backend/data/  
├─ lessons/  
│  ├─ beginner/unit_1.json  
│  ├─ intermediate/unit_1.json  
│  └─ advanced/unit_1.json  
├─ quiz/  
├─ miniboss/  
├─ unitboss/  
└─ endboss/  
├─ beginner.json  
├─ intermediate.json  
└─ advanced.json
```

과거 파이널보스 디렉터리가 아니라 `endboss/`가 현재 경로입니다.

---

## 7. 스테이지 퀴즈 파이프라인

### 7-1. 문제 세트 선택

```text
퀴즈 요청  
  ↓  
attempt 번호 확인  
  ├─ 1회차 → quiz_set A  
  ├─ 2회차 → quiz_set B  
  └─ 3회차 이상 → A+B 혼합 후 셔플  
  ↓  
요청한 stage 문제 필터  
  ↓  
최대 출제 수 적용  
  ↓  
정답 필드 제거  
  ↓  
프론트 전달
```

문제에 Set 메타데이터가 없으면 전체 풀을 fallback으로 사용합니다.

### 7-2. 객관식·단답 제출

적용 유형:

- `multiple_choice`
- `output_select`
- `error_find`
- `fill_in_blank`

```text
사용자 답 선택  
↓  
POST /attempts  
body:  
question_id  
unit  
stage  
level  
mode  
user_answer  
client is_correct  
↓  
서버가 원본 문제 검색  
↓  
서버 answer와 user_answer 직접 비교  
↓  
클라이언트 is_correct 무시·보정  
↓  
로그인 사용자면 attempts 1건 저장  
↓  
제출 후에만 정오답·피드백·힌트·정답 반환  
↓  
화면에 결과 표시
```

비로그인 Stage 1-1 체험도 서버 채점을 사용합니다. 비로그인 사용자는 채점 결과만 받고 attempts 저장은 생략합니다.

### 7-3. 오답 피드백

```text
서버 채점 결과 = 오답  
  ↓  
문제 데이터에 정적 feedback 존재?  
  ├─ 예 → 즉시 반환  
  └─ 추가 AI 설명 필요 → POST /quiz/ai-feedback  
                              ↓  
                         레벨별 프롬프트  
                              ↓  
                         Claude 응답  
                              ↓  
                         화면 인라인 출력
```

객관식 계열 보스 문제는 LLM을 호출하지 않고 정적 피드백을 조합합니다.

### 7-4. 풀이 기록

`attempts`는 다음 용도로 사용합니다.

- 첫 시도 정답 수 계산
- 스테이지 완료 서버 검증
- 오답 복습 대상 구성
- 정답률 통계
- 클라이언트 `is_correct` 위조 방어

---

## 8. 코드형 문제 파이프라인

적용 유형:

- `code_input`
- `code_multi_input`

### 8-1. 현재 실행·채점 흐름

```text
사용자 코드 작성  
↓  
브라우저 Pyodide 실행  
↓  
stdout / stderr 생성  
↓  
POST /code/submit  
body:  
question_id  
code  
output  
error  
unit  
stage  
course_level  
award  
↓  
서버가 question_id로 원본 문제 조회  
↓  
결정론적 채점 가능?  
├─ expected_output 일치 → 즉시 정답  
├─ code_multi_input 슬롯 일치 → 즉시 정오답  
└─ 그 외 → Claude JSON 채점  
↓  
grading_failed 확인  
├─ true → HP·보상·진행도 변경 없음  
└─ false → 정오답 반환  
↓  
award=true + 정답?  
├─ 예 → 코드 문제 보상·진행도 처리  
└─ 아니오 → 채점 결과만 반환
```

### 8-2. `award` 소유권


| 호출 위치              | `award` | 보상 책임                         |
|----------------------------|--------:|---------------------------------------|
| 정규 코드 문제       | `true`  | `/code/submit`                        |
| 훈련                     | `false` | 보상 없음 또는 훈련 시스템 |
| 미니보스 코드 문제 | `false` | 미니보스 클리어 API            |
| 유닛보스 코드 문제 | `false` | 유닛보스 클리어 흐름         |
| 엔드보스 코드 문제 | `false` | 엔드보스 클리어 흐름         |


같은 코드 정답으로 코드 라우터와 보스 라우터가 이중 보상을 지급하지 않도록 소유권을 분리합니다.

### 8-3. 배틀 연결

```text
/code/submit  
  ↓  
is_correct 반환  
  ↓  
프론트가 code_is_correct 전달  
  ↓  
/boss/miniboss/answer  
또는 /boss/answer  
또는 /boss/endboss/answer  
  ↓  
배틀 세션 정답·오답 누적
```

### 8-4. 현재 한계

현재 Python 코드는 브라우저 Pyodide에서 실행됩니다. FastAPI 서버가 동일 코드를 샌드박스에서 독립적으로 재실행하지 않습니다.

따라서:

- 서버는 `question_id`와 원본 문제를 검증합니다.
- 서버는 제출된 코드와 브라우저가 보낸 출력·오류를 평가합니다.
- 하지만 악성 클라이언트가 `output`을 조작하는 위협을 완전히 제거하는 구조는 아닙니다.
- 고신뢰 코드 채점이 필요해지면 격리된 서버 실행기 또는 제출 코드 기반 테스트 실행이 필요합니다.

이 항목은 현재 구현 설명이며, 완료된 서버 샌드박스 기능으로 발표하면 안 됩니다.

---

## 9. 스테이지 완료·진행도 파이프라인

### 9-1. 통과 기준

```text
스테이지 퀴즈 출제 수 계산  
↓  
Set A가 있으면 Set A 크기 기준  
↓  
최대 10문제  
↓  
필요 정답 = ceil(출제 수 × 0.8)
```

기본 통과 기준은 \*\*80%\*\*입니다.

### 9-2. 완료 요청

```text
프론트 POST /progress/  
  body:  
    unit  
    stage  
    score  
    is_completed  
    checkpoint  
    answered_questions  
  ↓  
서버가 선행 스테이지 접근 권한 확인  
  ↓  
해당 stage의 attempts 조회  
  ↓  
question_id별 가장 이른 기록만 선택  
  ↓  
첫 기록이 정답인 distinct 문제 수 계산  
  ↓  
필요 정답 수 이상?  
  ├─ 아니오 → 403  
  └─ 예 → progress 저장  
  ↓  
최초 완료 여부 확인  
  ↓  
보상 지급  
  ↓  
다음 스테이지·유닛 상태 계산
```

### 9-3. 네트워크 유실 fallback

attempt 저장이 누락됐지만 사용자가 정상적으로 문제를 푼 경우 영구 잠금이 발생하지 않도록 `answered_questions`를 함께 보낼 수 있습니다.

```text
attempts 기준 정답 부족  
↓  
answered_questions 존재?  
├─ 아니오 → 완료 거부  
└─ 예  
↓  
서버가 user_answer 재채점  
↓  
이미 attempt가 있는 question_id는 제외  
↓  
누락 문제만 보충  
↓  
필요 정답 수 충족 시 완료
```

클라이언트가 보낸 `is_correct`는 사용하지 않습니다.

### 9-4. 스테이지 보상

최초 완료일 때만:

```text
grant_reward(  
  coin_delta=2000,  
  ranking_score_delta=2000,  
  gp_delta=2000  
)
```

GP는 `evolution_stage >= 3`인 사용자만 실제 지급됩니다.

---

## 10. 스테이지 미니보스 파이프라인

### 10-1. 시작

```text
POST /boss/miniboss/start  
query:  
unit  
stage  
attempt  
↓  
로그인 사용자 확인  
↓  
스테이지 접근 권한 확인  
↓  
course_level 문제 파일 로드  
↓  
stage 필터  
↓  
attempt 세트 선택  
↓  
seen_questions 기준 미출제 문제 선택  
↓  
최대 5문제 선택  
↓  
서명된 battle_token 발급  
↓  
사용자 battle_sessions에 서버 세션 생성  
↓  
정답 필드 제거 후 문제 반환
```

### 10-2. 승패


| 항목              | 규칙         |
|---------------------|----------------|
| 출제              | 최대 5문제 |
| 승리              | 4정답        |
| 패배              | 2오답        |
| 표시용 내 HP    | 900            |
| 표시용 보스 HP | 500            |
| 정답 피해       | 125            |
| 오답 피해       | 450            |


HP는 UI 표시값입니다. 실제 승패 권한은 서버 세션의 `correct`, `wrong`, `status`에 있습니다.

### 10-3. 답안 제출

```text
POST /boss/miniboss/answer  
  ↓  
battle_token 서명·사용자·모드·만료 검증  
  ↓  
question_id 원본 조회  
  ↓  
객관식 → 서버 직접 채점  
코드형 → /code/submit 결과 code_is_correct 사용  
  ↓  
서버 세션에 정답·오답 누적  
  ↓  
won / lost / active 계산  
  ↓  
서버 누적값에서 HP 파생  
  ↓  
응답
```

### 10-4. 클리어

```text
POST /boss/miniboss/clear  
↓  
battle_token 검증  
↓  
세션 status == won 확인  
↓  
세션 일회성 consume  
↓  
miniboss_cleared_stages 중복 확인  
↓  
최초 클리어 보상 500  
↓  
사용자 클리어 이력 원자 저장  
↓  
progress 완료행 저장  
↓  
다음 스테이지 해금
```

사용자 클리어 이력은 원자적 사용자 변경 경로로 저장하지만 `progress`는 별도 저장소입니다. 진행도 저장 실패 시 재시도하고 오류 로그를 남깁니다.

---

## 11. 유닛 보스 파이프라인

### 11-1. 해금

```text
유닛의 일반 스테이지 완료  
  ↓  
각 스테이지 미니보스 클리어  
  ↓  
서버가 유닛 전체 완료 확인  
  ↓  
/boss/:unit 진입 허용
```

유닛을 건너뛰거나 완료되지 않은 유닛의 보스만 직접 도전할 수 없습니다.

### 11-2. 도전 비용

```text
GET /boss/info  
↓  
KST 날짜 확인  
↓  
날짜 변경 시 daily_free_attempts = 2  
↓  
POST /boss/start  
↓  
남은 무료 횟수?  
├─ 있음 → 무료 횟수 차감  
└─ 없음 → 왕관 1개 차감
```

### 11-3. 서버 배틀 세션


| 항목                  | 규칙      |
|-------------------------|-------------|
| 내 HP                  | 1,000       |
| 보스 HP               | 1,000       |
| 승리                  | 정답 5회 |
| 패배                  | 오답 3회 |
| 정답 피해           | 200         |
| 오답 피해           | 334         |
| 힌트                  | 최대 2회 |
| 최초 클리어 보상 | 3,000       |

```text
POST /boss/start  
  ↓  
battle_token + session 생성  
  ↓  
POST /boss/next  
  ↓  
미출제 문제 1개 선택  
  ↓  
POST /boss/answer  
  ↓  
서버 채점  
  ↓  
session 누적  
  ↓  
승리 시 최초 클리어 처리  
  ↓  
다음 Unit 해금
```

### 11-4. 문제 중복 방지

- 신규 배틀 세션은 세션별 출제 목록을 관리합니다.
- 레거시 `/boss/next` 경로도 유닛별 served key를 사용합니다.
- 과거 키의 seen 이력도 읽어 기존 사용자 문제 중복을 완화합니다.
- 사용 가능한 문제가 모두 소진되기 전에는 같은 문제를 다시 내지 않습니다.

---

## 12. 엔드보스 파이프라인

### 12-1. 코스 상태

```text
GET /boss/endboss/info  
↓  
endboss_cleared_levels 확인  
↓  
현재 course_level 확인  
↓  
코스별 상태 계산  
├─ recognized  
├─ current  
├─ cleared  
└─ locked  
↓  
사다리 UI 렌더링
```

### 12-2. 시작

```text
POST /boss/endboss/start  
  body:  
    project  
    target_level?  
  ↓  
대상 코스 접근 권한 확인  
  ↓  
왕관 3개 보유 확인  
  ↓  
왕관 차감  
  ↓  
Phase 1 문제 5개 선택  
  ↓  
Phase 2 문제 4개 선택  
  ↓  
Phase 3 첫 문제 선택  
  ↓  
seen_questions 반영  
  ↓  
battle_token + 서버 세션 생성  
  ↓  
정답 제거 후 반환
```

### 12-3. 페이즈

```text
Phase 1  
└─ 코드 읽기·출력·개념 문제 5개  

Phase 2  
└─ 오류 찾기·코드 완성 문제 4개  

Phase 3  
└─ 결정타 문제  
├─ 정답 → 승리 가능  
└─ 오답 → 새 문제로 최대 3회
```

### 12-4. 클리어

```text
POST /boss/endboss/clear  
  ↓  
서버 세션 승리 확인  
  ↓  
동일 코스 중복 클리어 확인  
  ↓  
코인 15,000  
누적 랭킹점수 15,000  
왕관 15개  
코스 칭호  
  ↓  
evolution_stage 증가  
  ↓  
다음 course_level 승급  
  ↓  
최종 진화면 GP 성장 활성화
```

### 12-5. 밸런스 주의

기존 설계 문서와 현재 라우터 사이에 엔드보스 HP 상수 차이가 있습니다.

- 과거 문서: 보스 HP 1,800
- 현재 코드: 보스 HP 1,400

이 차이는 `ENDBOSS_DESIGN.md` 수정 시 별도 결정해야 합니다. 현재 파이프라인 문서는 승패 권한이 서버 세션에 있다는 구조만 확정하고 HP 밸런스를 제품 정책으로 고정하지 않습니다.

---

## 13. 훈련 파이프라인

### 13-1. 오답 복습

```text
GET /train/review  
query:  
unit  
course_level  
limit  
↓  
wrong_answers + attempts 조회  
↓  
미복습 오답 우선  
↓  
부족한 수량은 해당 유닛 문제 풀에서 보충  
↓  
최대 요청 수 반환  
↓  
사용자 풀이  
↓  
객관식 POST /attempts  
코드형 POST /code/submit award=false  
↓  
POST /train/reviewed  
↓  
복습 완료 상태 저장
```

### 13-2. 랜덤 훈련

```text
GET /train/random  
  ↓  
선택한 코스·유닛 문제 풀  
  ↓  
랜덤 샘플  
  ↓  
풀이 및 attempts 저장
```

### 13-3. 보스 러시

```text
GET /train/boss_rush  
↓  
미니보스 문제 풀 중심 구성  
↓  
연속 풀이  
↓  
훈련 기록 반영
```

### 13-4. 정확도

```text
GET /train/accuracy  
  ↓  
attempts 정오답 집계  
  ↓  
course_level별 정확도 반환
```

훈련은 학습 반복이 목적이며 정규 스테이지나 보스의 클리어 보상을 직접 중복 지급하지 않습니다.

---

## 14. 보상 파이프라인

### 14-1. 공통 흐름

```text
서버가 완료·승리·수령 조건 확인  
↓  
mutate_user_atomic(user_id, mutator)  
↓  
최신 사용자 상태 로드  
↓  
중복 지급 이력 확인  
↓  
grant_reward()  
↓  
coin_balance 증가  
total_coin_earned 증가  
ranking_score 증가  
gp_gate 적용  
↓  
미션 진척·칭호 이벤트 반영  
↓  
버전 충돌 없이 저장  
↓  
reward + user_state 응답
```

### 14-2. GP 게이트

```text
evolution_stage < 3  
  └─ gp_delta를 0으로 변경  
  
evolution_stage >= 3  
  └─ gp_delta 지급  
       ↓  
     GP 기준 추가 레벨 계산
```

- 캐릭터 진화는 XP나 GP 획득으로 발생하지 않습니다.
- 엔드보스 클리어만 `evolution_stage`를 변경합니다.
- 최종 진화 이전의 기존 `lv`는 신규 보상으로 올리지 않습니다.

### 14-3. 하위 호환 필드

일부 응답은 여전히 다음 필드를 반환합니다.

- `xp_awarded`
- `total_xp`
- `xp_reward`

이 필드명은 기존 프론트·테스트 호환을 위한 표현입니다. 신규 소비자는 다음을 우선합니다.

```json
{  
"reward": {  
"coin_delta": 0,  
"gp_delta": 0,  
"ranking_score_delta": 0  
},  
"user_state": {  
"coin_balance": 0,  
"gp": 0,  
"lv": 1,  
"evolution_stage": 0,  
"ranking_score": 0,  
"weekly_ranking_score": 0,  
"crowns": 0  
}  
}
```

---

## 15. 미션 파이프라인

### 15-1. 진척

```text
로그인 / 퀴즈 / 복습 / 보스 / AI 피드백 이벤트  
  ↓  
도메인 로직에서 event_type 전달  
  ↓  
현재 KST 일자·ISO 주차 확인  
  ↓  
missions.daily / missions.weekly 기간 보정  
  ↓  
해당 mission_id progress 증가  
  ↓  
사용자 상태 저장
```

### 15-2. 조회

```text
GET /missions/  
↓  
backend/data/missions.json 정의 로드  
↓  
사용자의 현재 기간 progress·claimed 결합  
↓  
daily + weekly 반환
```

### 15-3. 수령

```text
사용자 수령 버튼  
  ↓  
POST /missions/claim  
  body: mission_id  
  ↓  
미션 정의 조회  
  ↓  
mutate_user_atomic  
  ↓  
이미 claimed?  
  ├─ 예 → already_claimed=true, 보상 0  
  └─ 아니오  
       ↓  
    progress >= goal?  
      ├─ 아니오 → 400  
      └─ 예  
           ↓  
       claimed 배열 추가  
           ↓  
       코인 + 누적 랭킹점수 + 왕관 지급  
           ↓  
       응답
```

모든 미션은 수동 수령 방식입니다. 미션의 `xp` 라벨 보상은 실제로 코인과 누적 랭킹점수로 지급되며 GP는 지급하지 않습니다.

---

## 16. 미니게임 파이프라인

### 16-1. 공통 시작

```text
개별 게임 진입  
↓  
POST /game/start  
body: game_id  
↓  
SUPPORTED_GAME_IDS 검증  
↓  
게임 ID + 사용자 ID + 발급시각 + nonce 서명  
↓  
game_token 반환  
↓  
게임 플레이
```

에이칸은 시작 응답에 정답을 제거한 퍼즐 데이터도 포함합니다.

### 16-2. 공통 클리어

```text
POST /game/clear  
  body:  
    game_id  
    game_token  
    게임별 결과  
  ↓  
토큰 서명 확인  
  ↓  
사용자 소유권 확인  
  ↓  
토큰 만료 확인  
  ↓  
최소 플레이 시간 확인  
  ↓  
게임별 결과 범위 검증  
  ↓  
mutate_user_atomic  
  ↓  
nonce 일회성 소비  
  ↓  
오늘 횟수 확인  
  ↓  
서버 보상 계산  
  ↓  
공통 일일 보상 캡 적용  
  ↓  
coin / ranking / GP 지급  
  ↓  
주간 게임 랭킹 기록  
  ↓  
응답
```

nonce 소비와 보상 지급을 같은 원자 구역에서 처리해 동일 토큰 동시 제출을 차단합니다.

### 16-3. 게임별 결과 검증


| 게임    | 서버가 사용하는 값                       | 일일 인정 횟수 | 보상            |
|-----------|--------------------------------------------------|---------------------:|-------------------|
| 에이팡 | 토큰·최소시간                             | 1                    | 왕관 1개       |
| 에이짝 | `correct_count` 0~8 + 서버 계산 경과시간 | 3                    | 100 / 200 / 300   |
| 에이런 | 거리 0~10,000 + 거리 비례 최소시간     | 5                    | 200 / 350 / 500   |
| 에이밤 | 클리어 수 0~10                               | 3                    | 0 / 50 / 70 / 100 |
| 에이칸 | 퍼즐 ID + 서버 정답 비교                 | 3                    | 100 / 150 / 200   |


### 16-4. 공통 캡

```text
game_rewards.daily_xp  
↓  
날짜가 바뀌면 0  
↓  
게임 보상 합산  
↓  
2,500 초과분 차단
```

변수명은 `daily_xp`이지만 신규 실제 지급은 코인·누적 랭킹점수·GP 후보값입니다.

### 16-5. 에이칸 전용 진행도

현재 두 경로가 병행됩니다.

```text
통합 경로  
POST /game/start  
POST /game/clear  
  
전용 경로  
GET  /game/aicross/progress  
POST /game/aicross/start  
POST /game/aicross/clear
```

- 통합 경로는 공통 게임 보상과 랭킹을 담당합니다.
- 전용 경로는 `completed_sets`, 세트별 `clear_count`, 차등 보상 진행도를 담당합니다.
- 향후 단일 경로로 정리할 때 중복 지급과 프론트 호출 경로를 먼저 검증해야 합니다.

---

## 17. 일일 게임 챌린지

```text
GET /game/challenge/status  
↓  
KST 오늘 날짜  
↓  
game_rewards의 게임별 오늘 횟수 계산  
↓  
목표 합계와 비교  
↓  
완료·수령 상태 반환
```


| 게임    | 목표 |
|-----------|-------:|
| 에이팡 | 1      |
| 에이짝 | 3      |
| 에이런 | 5      |
| 에이밤 | 3      |
| 에이칸 | 3      |

```text
모든 목표 완료  
  ↓  
POST /game/challenge/claim  
  ↓  
mutate_user_atomic  
  ↓  
오늘 이미 수령?  
  ├─ 예 → 거부  
  └─ 아니오 → 왕관 5개 지급
```

---

## 18. 랭킹 파이프라인

### 18-1. 주간 통합 랭킹

```text
게임 보상 지급  
↓  
game_rewards.weekly_ranking[ISO_WEEK][game_id] 누적  
↓  
GET /game/ranking  
↓  
이번 주 게임별 점수 합산  
↓  
가중치 적용  
↓  
점수 내림차순  
↓  
동점자 동순위  
↓  
Top N + 내 순위
```

### 18-2. 게임별 랭킹

```text
GET /game/ranking/by-game  
  ↓  
에이런 / 에이짝 / 에이칸 / 에이밤별 집계  
  ↓  
각 게임 Top N + 내 순위  
  ↓  
이전 ISO 주 통합 우승자 계산
```

에이팡은 왕관 전용이므로 점수 랭킹에서 제외됩니다.

### 18-3. 누적 종합 랭킹

```text
학습·보스·미션·게임  
↓  
ranking_score 누적  
↓  
GET /game/ranking/overall  
↓  
소프트 삭제 사용자 제외  
↓  
누적 점수 기준 Top N + 내 순위
```

### 18-4. 캐시

- TTL: 30초
- 키: 랭킹 종류 + ISO 주차 + limit + 사용자
- 데이터가 없으면 더미 사용자를 만들지 않고 빈 목록을 반환합니다.
- 현재 게임별 가중치는 모두 `1.0`입니다.

---

## 19. 칭호 파이프라인

```text
학습·보스·미션·AI 피드백 이벤트  
  ↓  
사용자 상태 변경  
  ↓  
check_and_award_titles()  
  ↓  
칭호 조건 목록 평가  
  ↓  
이미 획득한 칭호 제외  
  ↓  
titles 배열에 추가  
  ↓  
newly_earned_titles 응답
```

```text
GET /titles  
↓  
보유·장착·미획득 상태 반환  

칭호 장착 요청  
↓  
보유 여부 확인  
↓  
active_title 변경
```

칭호는 표시 보상이며 코인·랭킹·GP와 별도로 관리합니다.

---

## 20. 사용자 상태 저장 파이프라인

### 20-1. Supabase 우선

```text
USE_SUPABASE=true  
  ↓  
Supabase PostgreSQL 조회·저장  
  ↓  
users / progress / wrong_answers / attempts 등 사용
```

### 20-2. JSON fallback

```text
USE_SUPABASE=false  
↓  
backend/data JSON 파일 사용
```

JSON은 다음 용도도 갖습니다.

- 로컬 개발 fallback
- 이전 데이터 호환
- 일일 백업
- 복구 자료

### 20-3. 원자적 사용자 변경

```text
mutate_user_atomic(user_id, mutator)  
  ↓  
최신 사용자 상태 조회  
  ↓  
mutator가 메모리 상태 변경  
  ↓  
보상·미션·nonce·클리어 이력 검증  
  ↓  
버전 기반 또는 잠금 기반 저장  
  ↓  
변경 후 사용자 + mutator 결과 반환
```

반드시 원자 경로를 사용하는 항목:

- 미션 수령
- 게임 nonce 소비
- 게임 일일 횟수
- 보스 클리어 보상
- 미니보스 클리어 이력
- 엔드보스 진화
- 왕관 차감
- 보상 중복 방지
- 미션 진척이 포함된 사용자 상태 변경

### 20-4. 분리 저장 주의

`users`와 `progress`는 별도 저장 단위입니다.

예:

```text
미니보스 승리  
↓  
users.miniboss_cleared_stages 원자 저장  
↓  
progress 완료행 별도 저장
```

두 저장을 하나의 DB 트랜잭션으로 묶지 않는 경로가 존재하므로:

- 저장 재시도
- 서버 권위 클리어 이력 fallback
- 백필 점검
- 오류 로그

가 필요합니다.

---

## 21. API 파이프라인 맵

FastAPI는 다음 prefix를 등록합니다.

```text
/auth  
/user  
/quiz  
/progress  
/boss  
/boss/endboss  
/boss/miniboss  
/code  
/train  
/attempts  
/titles  
/game  
/missions  
/admin  
/guide
```

### 21-1. 인증


| Method | Path                      | 역할                             |
|--------|---------------------------|------------------------------------|
| POST   | `/auth/login`             | 로그인                          |
| POST   | `/auth/register`          | 일반 회원가입                |
| POST   | `/auth/email/send-code`   | 가입 인증코드 발송         |
| POST   | `/auth/email/verify-code` | 인증코드 검증                |
| GET    | `/auth/check-id`          | 아이디 중복 확인            |
| GET    | `/auth/check-email`       | 이메일 중복 확인            |
| GET    | `/auth/check-nickname`    | 닉네임 중복 확인            |
| POST   | `/auth/social/google`     | Google 로그인                   |
| POST   | `/auth/social/naver`      | Naver 로그인                    |
| POST   | `/auth/social/kakao`      | Kakao 로그인                    |
| POST   | `/auth/forgot-password`   | 비밀번호 재설정 시작      |
| POST   | `/auth/reset-password`    | 비밀번호 변경                |
| POST   | `/auth/find-id`           | 아이디 찾기                   |
| POST   | `/auth/level-test/submit` | 레벨 테스트 제출            |
| POST   | `/auth/touch`             | 로그인 활동·스트릭 갱신 |


### 21-2. 사용자


| Method | Path                    | 역할                   |
|--------|-------------------------|--------------------------|
| GET    | `/user/me`              | 내 상태 조회        |
| PATCH  | `/user/me`              | 프로필·설정 변경 |
| POST   | `/user/purchase-theme`  | 테마 구매            |
| DELETE | `/user/me`              | 소프트 삭제         |
| POST   | `/user/change-password` | 비밀번호 변경      |


### 21-3. 레슨·퀴즈·진도


| Method | Path                       | 역할                          |
|--------|----------------------------|---------------------------------|
| GET    | `/quiz/units`              | 유닛 목록                   |
| GET    | `/quiz/units/{unitId}`     | 유닛 상세                   |
| GET    | `/quiz/lessons`            | 브리핑 목록                |
| GET    | `/quiz/lessons/{lessonId}` | 브리핑 상세                |
| GET    | `/quiz/questions`          | 문제 목록                   |
| GET    | `/quiz/questions/{id}`     | 문제 조회                   |
| POST   | `/quiz/ai-feedback`        | AI 오답 설명                |
| POST   | `/attempts`                | 풀이 서버 재채점·기록 |
| GET    | `/progress/`               | 진도 조회                   |
| POST   | `/progress/`               | 진도 완료 검증·저장    |
| GET    | `/progress/stats`          | 진도 통계                   |


### 21-4. 보스


| Method | Path                    | 역할                        |
|--------|-------------------------|-------------------------------|
| GET    | `/boss/info`            | 유닛보스 정보           |
| POST   | `/boss/start`           | 유닛보스 시작           |
| POST   | `/boss/next`            | 다음 유닛보스 문제    |
| POST   | `/boss/answer`          | 유닛보스 답안           |
| POST   | `/boss/hint`            | 유닛보스 힌트           |
| GET    | `/boss/miniboss/info`   | 미니보스 정보           |
| POST   | `/boss/miniboss/start`  | 미니보스 시작           |
| POST   | `/boss/miniboss/answer` | 미니보스 답안           |
| POST   | `/boss/miniboss/clear`  | 미니보스 클리어        |
| GET    | `/boss/endboss/info`    | 코스별 엔드보스 상태 |
| POST   | `/boss/endboss/start`   | 엔드보스 시작           |
| POST   | `/boss/endboss/answer`  | 엔드보스 답안           |
| POST   | `/boss/endboss/clear`   | 엔드보스 클리어        |


### 21-5. 코드·훈련


| Method | Path               | 역할        |
|--------|--------------------|---------------|
| POST   | `/code/submit`     | 코드 채점 |
| POST   | `/code/hint`       | 코드 힌트 |
| GET    | `/train/review`    | 오답 복습 |
| GET    | `/train/random`    | 랜덤 훈련 |
| GET    | `/train/boss_rush` | 보스 러시 |
| GET    | `/train/accuracy`  | 정답률     |
| POST   | `/train/reviewed`  | 복습 처리 |


### 21-6. 게임·랭킹


| Method | Path                     | 역할                             |
|--------|--------------------------|------------------------------------|
| POST   | `/game/start`            | 공통 게임 토큰 발급        |
| POST   | `/game/clear`            | 공통 게임 보상               |
| GET    | `/game/challenge/status` | 챌린지 상태                   |
| POST   | `/game/challenge/claim`  | 챌린지 보상                   |
| GET    | `/game/ranking`          | 주간 통합 랭킹               |
| GET    | `/game/ranking/by-game`  | 게임별 랭킹                   |
| GET    | `/game/ranking/overall`  | 누적 종합 랭킹               |
| GET    | `/game/aicross/progress` | 에이칸 진행도                |
| POST   | `/game/aicross/start`    | 에이칸 세트 시작            |
| POST   | `/game/aicross/clear`    | 에이칸 세트 채점·클리어 |


### 21-7. 미션·기타


| Method | Path              | 역할               |
|--------|-------------------|----------------------|
| GET    | `/missions/`      | 미션 조회        |
| POST   | `/missions/claim` | 미션 보상 수령 |
| GET    | `/guide/faq`      | FAQ                  |
| GET    | `/`               | 백엔드 상태     |
| GET    | `/version`        | 배포 Git 버전    |


---

## 22. AI 서비스 파이프라인

### 22-1. 호출 대상

- 퀴즈 맞춤 오답 설명
- 결정론적으로 판정할 수 없는 코드 문제
- 유닛보스 힌트
- 고급 문제 피드백

### 22-2. 호출 제외

- `multiple_choice`
- `output_select`
- `error_find`
- 직접 비교 가능한 `fill_in_blank`
- `expected_output`이 정확히 일치한 코드 문제
- 슬롯 정답을 직접 비교할 수 있는 `code_multi_input`

### 22-3. 호출 흐름

```text
도메인 라우터  
↓  
입력 길이·Rate Limit 확인  
↓  
레벨별 프롬프트 구성  
↓  
Claude Haiku 4.5 호출  
↓  
JSON 파싱  
↓  
필수 필드 검증  
↓  
성공?  
├─ 예 → 결과 반환  
└─ 아니오 → grading_failed 또는 fallback
```

### 22-4. 실패 정책

- 채점 실패를 오답으로 처리하지 않습니다.
- 보스 HP를 감소시키거나 사용자 HP를 차감하지 않습니다.
- 보상과 진행도를 변경하지 않습니다.
- 사용자에게 재시도 가능한 상태를 반환합니다.
- 객관식은 가능한 한 AI 실패와 무관하게 직접 채점합니다.

---

## 23. 이메일·배치 파이프라인

### 23-1. 가입 인증 메일

```text
POST /auth/email/send-code  
  ↓  
Resend  
  ↓  
5분 인증코드
```

### 23-2. 스트릭 리마인더

```text
매일 18:00 KST  
↓  
last_login == 어제인 사용자 조회  
↓  
이메일 존재 확인  
↓  
SendGrid 발송
```

### 23-3. 데이터 백업

```text
매일 03:00 KST  
  ↓  
Supabase 또는 JSON fallback에서  
users / progress / wrong_answers 조회  
  ↓  
backend/data/backup/YYYY-MM-DD/  
  ↓  
JSON 저장  
  ↓  
7일 이전 백업 디렉터리 삭제
```

### 23-4. 탈퇴 계정 삭제

```text
매일 04:00 KST  
↓  
deleted_at 기준 30일 경과 사용자 조회  
↓  
관련 데이터 영구 삭제
```

### 23-5. 스케줄러 단일 실행 조건

FastAPI lifespan은 `RUN_SCHEDULER=1`인 프로세스에서 Scheduler를 시작합니다.

현재 `main.py` 기준으로:

- 별도 DB advisory lock은 구현되어 있지 않습니다.
- 멀티워커의 모든 프로세스에 `RUN_SCHEDULER=1`을 설정하면 중복 실행 위험이 있습니다.
- 운영에서는 스케줄러 담당 프로세스 1개만 활성화해야 합니다.
- 배포 플랫폼 환경변수와 워커 수를 함께 확인해야 합니다.

---

## 24. 오류·회복 파이프라인

### 24-1. 일반 API 오류

```text
프론트 API 요청  
  ↓  
2xx?  
  ├─ 예 → 상태 반영  
  └─ 아니오  
       ↓  
    인증 오류?  
      ├─ 401 → 토큰 갱신 또는 로그아웃  
      └─ 기타 → 화면 오류 안내
```

### 24-2. Rate Limit

```text
요청 한도 초과  
↓  
SlowAPI RateLimitExceeded  
↓  
HTTP 429  
↓  
"요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
```

### 24-3. AI 채점 실패

```text
Claude 호출 또는 JSON 파싱 실패  
  ↓  
grading_failed=true  
  ↓  
보상 0  
진행도 변경 없음  
배틀 누적 변경 없음  
  ↓  
재시도 안내
```

### 24-4. 진행도 저장 실패

```text
사용자 클리어 이력 저장 성공  
↓  
progress 저장 실패  
↓  
재시도  
↓  
최종 실패 시 error 로그  
↓  
서버 권위 클리어 이력 fallback으로 진입 게이트 보조  
↓  
백필 대상
```

### 24-5. 게임 중복 제출

```text
동일 game_token 재제출  
  ↓  
nonce 이미 소비됨  
  ↓  
보상 거부
```

---

## 25. 보안 경계

### 25-1. 서버가 최종 권한을 갖는 값

- 사용자 인증 상태
- 원본 문제와 정답
- 객관식 정오답
- 스테이지 완료 조건
- 보스 승패
- 보스 HP 파생값
- 게임 보상
- 게임 일일 횟수
- 게임 token nonce
- 미션 완료·수령
- 재화 잔액
- 캐릭터 진화
- 코스 승급
- 랭킹 누적값

### 25-2. 클라이언트 입력을 그대로 신뢰하지 않는 값

- `is_correct`
- `is_completed`
- 보상량
- 누적 HP
- 게임 XP
- 게임 경과시간
- 에이칸 정답
- 미션 완료 여부
- 칭호 획득 여부

### 25-3. 부분적으로 클라이언트 결과를 사용하는 값


| 값                         | 현재 처리                                 | 남은 위험                               |
|-----------------------------|-----------------------------------------------|---------------------------------------------|
| 코드 실행 `output`      | Pyodide 결과를 `/code/submit`으로 전달 | 서버 독립 실행 없음                 |
| 코드형 `code_is_correct` | `/code/submit` 결과를 배틀 API에 전달 | 호출 체인 무결성 강화 여지       |
| 에이짝 `correct_count`   | 범위만 검증, 시간은 서버 계산     | 플레이 자체 완전 재현은 아님    |
| 에이밤 `correct_count`   | 0~10 범위 검증                            | 개별 문제 서버 검증 아님          |
| 에이런 거리            | 상한·최소시간 검증                   | 물리 시뮬레이션 서버 검증 아님 |


게임은 토큰·시간·횟수·범위로 조작 비용을 높인 구조이며, 완전한 서버 시뮬레이션 구조는 아닙니다.

---

## 26. 현재 구현 상태

### 구현 완료

- 5탭 내비게이션
- 일반·소셜 인증 코드 경로
- 이메일 인증
- 레벨 테스트와 하위 코스 인정
- 3코스 × 8유닛
- 브리핑·퀴즈·미니보스·유닛보스
- 코스별 엔드보스
- 객관식 서버 재채점
- 풀이 전수 기록
- 스테이지 완료 서버 게이트
- 보스 서버 배틀 세션
- 코드형 Pyodide + 백엔드 채점
- 오답 복습·랜덤 훈련·보스 러시
- 미션 수동 수령
- 5종 미니게임
- 게임 서명 토큰·nonce
- 일일 게임 챌린지
- 주간 게임 랭킹
- 누적 종합 랭킹
- 코인·랭킹점수·GP 분리
- 엔드보스 기반 캐릭터 진화
- Supabase + JSON fallback
- 일일 백업·스트릭 메일·탈퇴 계정 정리

### 부분 구현 또는 운영 확인 필요

- OAuth 공급자별 운영 승인 상태
- 테마 구매용 신규 DB 컬럼 실제 운영 적용
- GP·코인 신규 컬럼 실제 운영 마이그레이션 적용
- 멀티워커 환경 Scheduler 단일 실행
- PWA 설치·서비스 워커 동작
- 에이칸 통합 API와 전용 API 병행 정리
- 실제 사용자 점수 분포 기반 랭킹 가중치 조정
- 이메일 발신 도메인·배포 URL 운영 검증

### 현재 한계

- 서버 Python 샌드박스 미구현
- 일부 게임 결과는 서버 범위 검증 방식
- 사용자 상태와 progress가 단일 트랜잭션이 아닌 경로 존재
- 스케줄러 분산 락 미구현
- 일부 API 응답에 레거시 `xp_*` 필드명 잔존

### 플레이스홀더

- `/stats` 학습통계 상세 화면
- `/league` 리그 화면

---

## 27. 프로젝트 폴더 구조

```text
ai-mon/  
├─ frontend/  
│  ├─ public/  
│  └─ src/  
│     ├─ api/  
│     │  ├─ client.js  
│     │  └─ index.js  
│     ├─ components/  
│     │  ├─ AppHeader/  
│     │  ├─ NavBar/  
│     │  ├─ QuizCard/  
│     │  └─ loading/  
│     ├─ hooks/  
│     │  └─ useAuthStore  
│     ├─ pages/  
│     │  ├─ Home/  
│     │  ├─ Auth/  
│     │  ├─ Lesson/  
│     │  ├─ Stage/  
│     │  ├─ Boss/  
│     │  ├─ EndBoss/  
│     │  ├─ Train/  
│     │  ├─ Character/  
│     │  ├─ Settings/  
│     │  └─ Game/  
│     │     ├─ Aipang/  
│     │     ├─ AIPair/  
│     │     ├─ AIrun/  
│     │     ├─ AIbomb/  
│     │     └─ AIcross/  
│     └─ App.jsx  
│  
├─ backend/  
│  ├─ main.py  
│  ├─ scheduler.py  
│  ├─ routers/  
│  │  ├─ auth.py  
│  │  ├─ user.py  
│  │  ├─ user_state.py  
│  │  ├─ quiz.py  
│  │  ├─ attempts.py  
│  │  ├─ progress.py  
│  │  ├─ battle_session.py  
│  │  ├─ miniboss.py  
│  │  ├─ boss.py  
│  │  ├─ endboss.py  
│  │  ├─ code.py  
│  │  ├─ train.py  
│  │  ├─ mission.py  
│  │  ├─ missions_core.py  
│  │  ├─ game.py  
│  │  ├─ game_common.py  
│  │  ├─ game_aicross.py  
│  │  ├─ game_ranking.py  
│  │  ├─ titles.py  
│  │  ├─ admin.py  
│  │  ├─ guide.py  
│  │  └─ utils.py  
│  ├─ services/  
│  │  ├─ claude_service.py  
│  │  └─ email_service.py  
│  └─ data/  
│     ├─ schema.sql  
│     ├─ missions.json  
│     ├─ lessons.json  
│     ├─ lessons_intermediate.json  
│     ├─ lessons_advanced.json  
│     ├─ lessons/  
│     ├─ quiz/  
│     ├─ miniboss/  
│     ├─ unitboss/  
│     ├─ endboss/  
│     └─ backup/  
│  
└─ docs/  
├─ design/  
├─ dev/  
└─ ops/
```

---

## 28. 변경 시 회귀 점검

### 인증 변경

- 일반 회원가입
- 이메일 코드 발송·만료
- 아이디·이메일·닉네임 중복
- Google·Kakao·Naver 로그인
- Refresh Token
- 소프트 삭제 계정 로그인 차단
- 레벨 테스트 완료 권한

### 퀴즈 변경

- 정답 필드 사전 노출 여부
- 비로그인 1-1 서버 채점
- 객관식 서버 재채점
- Set A/B/3회차 혼합
- attempts 저장
- 첫 시도 정답 집계
- 80% 완료 게이트
- 오답 복습 연결

### 코드 채점 변경

- Pyodide 출력·오류 전달
- 결정론적 expected_output
- code_multi_input
- Claude fallback
- grading_failed 무패널티
- award=false 무보상
- 보스 code_is_correct 연결
- Rate Limit

### 보스 변경

- 접근 게이트
- 배틀 토큰 사용자 소유권
- 정답 필드 제거
- 서버 세션 누적
- 중복 제출
- 승리 전 clear 거부
- 재도전 비용
- 최초 보상
- seen_questions
- 코스 승급·진화

### 게임 변경

- token 만료
- 최소 플레이 시간
- nonce 재사용
- 일일 횟수
- 일일 공통 캡
- 서버 보상 계산
- 주간 랭킹 기록
- 챌린지 수령
- 에이칸 서버 정답
- 동시 제출

### 보상 변경

- coin_balance
- total_coin_earned
- ranking_score
- weekly_ranking
- GP gate
- crowns
- 중복 지급
- 레거시 xp 응답
- 미션 진척
- 칭호 지급

### 저장 변경

- Supabase 경로
- JSON fallback
- 사용자 원자 변경
- progress 별도 저장 실패
- 소프트 삭제
- 백업
- 신규 컬럼 마이그레이션

---

## 29. 관련 코드

### 프론트엔드

- `frontend/src/App.jsx`
- `frontend/src/api/index.js`
- `frontend/src/api/client.js`
- `frontend/src/components/NavBar/NavBar.jsx`
- `frontend/src/hooks/useAuthStore.js`
- `frontend/src/pages/Stage/Stage.jsx`
- `frontend/src/pages/Boss/Boss.jsx`
- `frontend/src/pages/EndBoss/EndBoss.jsx`
- `frontend/src/pages/Game/gameConstants.js`

### 백엔드

- `backend/main.py`
- `backend/scheduler.py`
- `backend/routers/auth.py`
- `backend/routers/user.py`
- `backend/routers/user_state.py`
- `backend/routers/quiz.py`
- `backend/routers/attempts.py`
- `backend/routers/progress.py`
- `backend/routers/battle_session.py`
- `backend/routers/miniboss.py`
- `backend/routers/boss.py`
- `backend/routers/endboss.py`
- `backend/routers/code.py`
- `backend/routers/train.py`
- `backend/routers/mission.py`
- `backend/routers/game.py`
- `backend/routers/game_aicross.py`
- `backend/routers/game_ranking.py`
- `backend/routers/utils.py`

---

>
> 보안 주의: API 키, JWT 비밀키, Supabase service role 키, 이메일 공급자 키는 환경 변수로 관리하고 GitHub에 커밋하지 않습니다.
>

 
