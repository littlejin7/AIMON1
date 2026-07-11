---
title: AI MON 데이터 스키마
version: "2.1"
status: current
source_of_truth:
  - GitHub main branch code
  - backend/data JSON files
  - backend/data/schema.sql
last_verified_commit: 6683cb7b4a9592aedceb1a6ee8a884d63661b8ef
last_verified_at: 2026-07-11
---

# AI-MON 데이터 스키마

> AI-MON의 정적 콘텐츠, Supabase 영속 데이터, 사용자 JSONB 상태, 브라우저 로컬 상태와 API 계약을 구분한 현재 구현 기준 문서

---

## 0. 문서 목적

이 문서는 다음 작업의 기준으로 사용한다.

- 기획안과 발표 자료의 데이터 구조 설명
- 레슨·문제·미션 데이터 제작
- 백엔드 API 구현 및 검수
- Supabase 테이블 생성·마이그레이션
- 프론트엔드 상태와 API 응답 구조 확인
- 배포 전 데이터 정합성 검증

관련 문서:

- 서비스 기획: [`AI_MON_PROPOSAL.md`](./AI_MON_PROPOSAL.md)
- 시스템 흐름: [`AI_MON_PIPELINE.md`](./AI_MON_PIPELINE.md)
- 미션 상세: [`AI_MON_MISSIONS.md`](./AI_MON_MISSIONS.md)
- 엔드보스 상세: [`ENDBOSS_DESIGN.md`](./ENDBOSS_DESIGN.md)

문서와 구현이 충돌하면 GitHub `main` 브랜치의 코드와 실제 JSON·SQL 파일이 우선한다.

---

## 1. 데이터 계층

AI-MON의 데이터는 한 저장소에만 존재하지 않는다.

| 계층 | 저장 위치 | 역할 | 기준 |
|---|---|---|---|
| 코스·유닛 메타데이터 | `backend/data/lessons*.json` | 유닛 제목, 난이도, 스테이지 수 | JSON |
| 브리핑 슬라이드 | `backend/data/lessons/{level}/unit_*.json` | 개념 설명과 코드 예시 | JSON |
| 일반 퀴즈 | `backend/data/quiz/` | 스테이지 문제·정답·해설 | JSON |
| 미니보스 | `backend/data/miniboss/` | 스테이지 보스 문제 | JSON |
| 유닛보스 | `backend/data/unitboss/` | 유닛 종합 문제 | JSON |
| 엔드보스 | `backend/data/endboss/` | 코스 최종 프로젝트 전투 | JSON |
| 미션 정의 | `backend/data/missions.json` | 목표·이벤트·보상 | JSON |
| 에이칸 퍼즐 | `backend/data/aicross_puzzles.json`, `aicross_sets.json` | 서버 채점 퍼즐 | JSON |
| 사용자 계정·복합 상태 | Supabase `users` | 인증, 재화, 코스, 보스, 미션, 게임 상태 | PostgreSQL + JSONB |
| 학습 진도 | Supabase `progress` | 스테이지별 완료·점수 | PostgreSQL |
| 풀이 기록 | Supabase `attempts` | 문제 제출 기록 | PostgreSQL |
| 오답 복습 | Supabase `wrong_answers` | 오답과 복습 상태 | PostgreSQL |
| 인증 보조 | `refresh_tokens`, `reset_tokens`, `email_verification_codes` | 세션·복구·메일 인증 | PostgreSQL |
| 브라우저 임시 상태 | `localStorage` | 비로그인 체험 진도 등 | 브라우저 |
| 개발 fallback | `backend/data/*.json` | Supabase 미사용 환경 | JSON |
| 일일 백업 | `backend/data/backup/YYYY-MM-DD` | 복구 스냅샷 | JSON |

### 1-1. 핵심 원칙

- 정적 문제 JSON은 사용자 DB 테이블과 분리한다.
- Supabase는 사용자 상태와 학습 이력을 중심으로 저장한다.
- `users`의 복합 상태 일부는 JSONB로 관리한다.
- API 응답에는 DB에 직접 저장되지 않는 계산 필드가 포함될 수 있다.
- `xp`는 제거된 필드가 아니라 레거시 호환과 누적 랭킹점수 용도로 남아 있다.
- 신규 재화나 컬럼은 코드 지원 여부와 운영 DB 적용 여부를 따로 확인한다.
- 브라우저 로컬 상태는 서버 진실값이 아니다.

---

## 2. 정적 콘텐츠 디렉터리

```text
backend/data/
├─ schema.sql
├─ migration_gp_coin_additive.sql
├─ missions.json
├─ lessons.json
├─ lessons_intermediate.json
├─ lessons_advanced.json
├─ lessons/
│  ├─ beginner/
│  ├─ intermediate/
│  └─ advanced/
├─ quiz/
│  ├─ beginner/
│  ├─ intermediate/
│  └─ advanced/
├─ miniboss/
│  ├─ beginner/
│  ├─ intermediate/
│  └─ advanced/
├─ unitboss/
│  ├─ beginner/
│  ├─ intermediate/
│  └─ advanced/
├─ endboss/
│  ├─ beginner.json
│  ├─ intermediate.json
│  └─ advanced.json
├─ aicross_puzzles.json
├─ aicross_sets.json
└─ backup/
```

### 2-1. 명칭 주의

| 항목 | 현재 기준 |
|---|---|
| 엔드보스 디렉터리 | `backend/data/endboss/` |
| 엔드보스 API | `/boss/endboss` |
| 일부 문제의 레거시 카테고리 | `quiz_category: "final_boss"` |
| 사용자 표시 용어 | 엔드보스 |
| 코드 모드 | `endboss` |

`final_boss`를 일괄 치환하면 문제 로더와 테스트에 영향을 줄 수 있으므로 별도 마이그레이션 없이 변경하지 않는다.

---

# Part A. 정적 콘텐츠 JSON

## 3. 코스·유닛 메타데이터

### 3-1. 파일

| 코스 | 파일 |
|---|---|
| 초급 | `backend/data/lessons.json` |
| 중급 | `backend/data/lessons_intermediate.json` |
| 고급 | `backend/data/lessons_advanced.json` |

각 파일은 코스별 유닛 배열이다.

### 3-2. 유닛 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `unit_id` | integer | 코스 안 유닛 번호 |
| `title` | string | 유닛 제목 |
| `icon` | string | 화면 아이콘 |
| `description` | string | 유닛 설명 |
| `difficulty` | string | `beginner`, `intermediate`, `advanced` |
| `stages` | integer | 일반 스테이지 수 |
| `boss_stage` | integer | UI상 보스 스테이지 번호 |

```json
{
  "unit_id": 1,
  "title": "파이썬 첫걸음 — print & 변수",
  "icon": "🖨️",
  "description": "print(), 변수, 자료형의 기초를 익혀요",
  "difficulty": "beginner",
  "stages": 7,
  "boss_stage": 8
}
```

검증 규칙:

- `unit_id`는 코스 안에서 고유해야 한다.
- `stages`는 실제 레슨·퀴즈 데이터와 일치해야 한다.
- 일반 진행 ID는 보통 `{unit}-{stage}` 형식이다.
- 유닛보스 진행 ID는 `{unit}-boss` 형식을 사용한다.
- `boss_stage`는 표시용이며 서버 전투 상수와 별개다.

---

## 4. 브리핑 슬라이드

파일 형태:

```text
backend/data/lessons/{course_level}/unit_{unit}.json
```

레슨 객체의 핵심 필드:

| 필드 | 타입 | 설명 |
|---|---|---|
| `lesson_id` | string | 레슨 식별자 |
| `unit` | integer | 유닛 번호 |
| `stage` | string | 예: `1-1` |
| `course_level` | string | 코스 |
| `title` | string | 스테이지 제목 |
| `villain` | string | 악당 리소스 키 |
| `slides` | array | 브리핑 슬라이드 |

슬라이드 객체:

| 필드 | 타입 | 설명 |
|---|---|---|
| `order` | integer | 표시 순서 |
| `text` | string | 설명 |
| `terminal` | object | 선택적 코드 예시 |
| `terminal.code` | string[] | 코드 줄 |
| `terminal.output` | string[] | 출력 줄 |
| `tip` | string | 학습 팁 |

```json
{
  "order": 1,
  "text": "print()로 화면에 출력합니다.",
  "terminal": {
    "code": ["print('Hello')"],
    "output": ["Hello"]
  },
  "tip": "따옴표 안의 글자를 출력해요."
}
```

검증 규칙:

- `lesson_id`, `stage`, `course_level`이 파일 경로와 일치해야 한다.
- `slides[].order`는 중복되면 안 된다.
- 코드와 출력은 화면에서 의도한 줄 단위로 분리한다.
- `villain`은 리소스 키이므로 표시 이름으로 임의 변경하지 않는다.

---

## 5. 문제 공통 스키마

문제 종류별로 필드가 다르지만 공통적으로 다음 구조를 사용한다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `question_id` | string | 전역 고유 문제 ID |
| `quiz_category` | string | 문제 카테고리 |
| `course_level` | string | 코스 |
| `unit` | integer | 유닛 |
| `stage` | string | 스테이지 |
| `difficulty` | string | 난이도 |
| `type` | string | 문제 유형 |
| `question` | string | 문제 본문 |
| `options` | array | 객관식 선택지 |
| `answer` | any | 정답 |
| `explanation` | string | 해설 |
| `is_boss` | boolean | 보스 문제 여부 |

대표 문제 유형:

- `multiple_choice`
- `output_select`
- `error_find`
- `fill_in_blank`
- `code_input`

### 5-1. 문제 본문 표기

코드 줄 번호는 코드블록 안에서 다음처럼 표기한다.

```python
1. import random
2. inventory = []
3. new_item = random.choice('HP포션', '철검')
4. inventory.append(new_item)
```

`1줄:`, `2줄:` 형식과 `1.`, `2.` 형식을 같은 문제 안에서 혼용하지 않는다.

### 5-2. 정답 타입

| 유형 | 권장 정답 |
|---|---|
| `multiple_choice` | 선택지 값 또는 서버가 기대하는 키 |
| `output_select` | 출력 선택지 |
| `error_find` | 줄 번호 |
| `fill_in_blank` | 문자열 또는 허용 답안 배열 |
| `code_input` | 코드 문자열, 테스트 케이스 또는 채점 규칙과 연결 |

클라이언트는 정답 원본을 신뢰 가능한 상태로 보관하면 안 된다. 서버 채점형 문제는 정답을 응답에서 제외하거나 토큰·세션과 연결한다.

---

## 6. 퀴즈·미니보스 재도전 세트

현재 재도전 정책:

```text
1회차 = A 세트
2회차 = B 세트
3회차 이상 = A+B 통합 후 셔플
```

적용 대상:

- 일반 스테이지 퀴즈
- 미니보스

관련 요청 값:

| 필드 | 타입 | 설명 |
|---|---|---|
| `attempt` | integer | 현재 도전 회차 |
| `course_level` | string | 코스 |
| `unit` | integer | 유닛 |
| `stage` | string | 스테이지 |

정책 변경 시 백엔드 문제 선택과 프론트 재진입 경로를 같이 검수한다.

---

## 7. 에이칸 크로스워드

서버 권위 구조:

```text
POST /game/start
  → puzzle_id, grid, entries, max_score
  → 정답은 클라이언트에 공개하지 않음

POST /game/clear
  → puzzle_id + answers
  → 서버 채점
  → 성공 시 보상·기록 처리
```

주요 계약:

| 필드 | 방향 | 설명 |
|---|---|---|
| `puzzle_id` | 서버→클라이언트 | 퍼즐 식별자 |
| `grid` | 서버→클라이언트 | 렌더링 그리드 |
| `entries` | 서버→클라이언트 | 단어 위치와 힌트 |
| `max_score` | 서버→클라이언트 | 최대 점수 |
| `answers` | 클라이언트→서버 | 사용자 입력 |
| `score` | 서버→클라이언트 | 서버 계산 결과 |

클라이언트 로컬 정답 판정은 최종 진실값으로 사용하지 않는다.

---

# Part B. Supabase 영속 데이터

## 8. `users`

`users`는 계정 기본 정보와 복합 게임 상태를 저장한다. 실제 컬럼은 `backend/data/schema.sql`과 운영 Supabase를 기준으로 확인한다.

주요 범주:

### 계정·프로필

- 사용자 ID
- 아이디
- 이메일
- 닉네임
- 비밀번호 해시 또는 소셜 로그인 식별 정보
- 활성·탈퇴 상태
- 생성·수정 시각

### 학습 상태

- `course_level`
- 레벨 테스트 완료 여부
- 코스별 최대 해금 유닛
- 진화 단계
- 엔드보스 클리어 코스

### 재화·점수

- 코인
- 왕관
- `xp` 또는 누적 랭킹점수
- 게임별 점수·주간 집계에 필요한 상태

### 복합 JSONB

- 미션 상태
- 배틀 세션
- 보스별 seen 문제
- 게임별 상태
- 칭호·인증 상태
- 기타 기능별 확장 상태

원칙:

- 클라이언트가 보내는 권한성 필드를 그대로 저장하지 않는다.
- 레벨 테스트 완료 여부는 제출 API에서만 신뢰 가능하게 변경한다.
- 닉네임은 저장 직전에 정규화 후 중복 검사한다.
- 소셜 가입 fallback 닉네임도 저장 직전에 재검사한다.
- 계정 삭제는 즉시 UI에서 성공으로 간주하지 않고 서버 결과를 확인한다.

---

## 9. `progress`

스테이지 단위 학습 진도를 저장한다.

권장 핵심 필드:

| 필드 | 설명 |
|---|---|
| 사용자 ID | 소유자 |
| 코스 | 초급·중급·고급 |
| 유닛 | 유닛 번호 |
| 스테이지 ID | 일반 또는 보스 진행 ID |
| 완료 여부 | 클리어 상태 |
| 점수 | 서버 기준 결과 |
| 시도 횟수 | 재도전 정보 |
| 완료 시각 | 최초 또는 최근 완료 |

중복 저장을 막기 위해 사용자·코스·스테이지 조합의 고유성 또는 upsert 정책을 유지한다.

---

## 10. `attempts`

문제 제출의 전수 기록이다.

저장 목적:

- 정오답 분석
- 문제 품질 검수
- 사용자 학습 기록
- 재도전 분석
- 향후 난이도·추천 로직

최소 기록 권장값:

- 사용자
- 문제 ID
- 문제 유형
- 제출 답안
- 정답 여부
- 코스·유닛·스테이지
- 시도 시각
- 배틀 또는 퀴즈 문맥

민감 정보나 전체 프롬프트를 불필요하게 저장하지 않는다.

---

## 11. `wrong_answers`

오답 복습 상태를 저장한다.

주요 상태:

- 문제 ID
- 사용자 ID
- 최초 오답 시각
- 최근 오답 시각
- 오답 횟수
- 복습 완료 여부
- 복습 완료 시각

동일 문제 오답이 반복될 때 새 행을 계속 만드는지, 기존 행을 갱신하는지는 현재 라우터 구현을 기준으로 유지한다.

---

## 12. 인증 보조 테이블

| 테이블 | 역할 |
|---|---|
| `refresh_tokens` | 로그인 세션 갱신 |
| `reset_tokens` | 비밀번호 재설정 |
| `email_verification_codes` | 일반 가입 이메일 인증 |

보안 원칙:

- 토큰 원문 저장 여부는 현재 구현을 따른다.
- 만료 시각을 검증한다.
- 사용 완료 토큰은 재사용을 막는다.
- 이메일 인증 성공 전 계정 활성화 정책을 우회하지 않는다.
- 로그에 인증 코드, 액세스 토큰, 비밀번호를 출력하지 않는다.

---

## 13. 미션 JSONB

미션 정의는 `backend/data/missions.json`, 사용자 진척은 `users.missions` JSONB가 기준이다.

개념 구조:

```json
{
  "daily": {
    "period": "YYYY-MM-DD",
    "progress": {},
    "claimed": [],
    "login_days": []
  },
  "weekly": {
    "period": "YYYY-Www",
    "progress": {},
    "claimed": [],
    "login_days": []
  }
}
```

정확한 키 모양은 현재 미션 라우터 구현을 우선한다.

- 데일리 기간: KST 날짜
- 위클리 기간: KST 기준 ISO 주차
- 초기화: 접근 시 lazy reset
- 보상: 수동 수령
- 중복 방지: 원자적 사용자 갱신

---

## 14. 배틀 세션 JSONB

보스 전투의 서버 권위 상태를 저장한다.

세션에 포함될 수 있는 값:

- 배틀 토큰 또는 세션 키
- 보스 종류
- 코스·유닛·프로젝트
- 현재 페이즈
- 플레이어 HP
- 보스 HP
- 출제 문제
- 제출 이력
- 상태: 진행·승리·패배·소비 완료
- 생성·만료 시각

원칙:

- 승리 보상은 서버 세션의 승리 상태를 확인한 뒤 지급한다.
- 이미 소비된 세션은 다시 보상하지 않는다.
- 만료·종료 세션은 메모리에서 정리한 뒤 전체 상태를 저장한다.
- JSONB merge만으로 삭제를 표현하지 않는다.
- 구형 `battle_token` 경로는 명시된 호환 범위에서만 유지한다.

---

# Part C. 브라우저 상태

## 15. 비로그인 체험 진도

현재 로컬 키:

```text
aimon-guest-trial-progress
```

용도:

- 비로그인 사용자가 공개된 체험 레슨을 완료했는지 저장
- 일반 회원가입 완료 후 서버 진도로 이전
- 이전 성공 후 로컬 상태 삭제

현재 정책:

- 비로그인 체험은 초급 `Stage 1-1`의 개념 퀴즈까지 제공한다.
- 80점 이상이면 로컬 체험 완료 상태를 기록한다.
- 비로그인 상태에서는 미니보스와 서버 보상을 진행하지 않는다.
- 일반 회원가입 흐름은 체험 진도를 서버로 이전한다.
- Google·Kakao 소셜 콜백 흐름은 동일 이전 로직이 아직 연결되지 않은 상태이므로 별도 보완 대상이다.

보안 원칙:

- `localStorage` 값만으로 서버 보상·해금·미션을 지급하지 않는다.
- 서버 이전 API에서 허용된 체험 범위인지 검증한다.
- 조작된 점수와 임의 스테이지 ID를 신뢰하지 않는다.

---

## 16. PWA 관련 브라우저 상태

PWA는 `vite-plugin-pwa` 기반이며 manifest와 서비스 워커를 사용한다.

설치 안내 상태는 브라우저에 저장될 수 있다.

현재 설치 안내 정책:

- 회원가입 완료 뒤 설치 프롬프트 노출
- 첫 거절: 약 7일 후 재안내
- 두 번째 거절: 약 30일 후 재안내
- 세 번째 거절: 안내 비활성화

아이콘 기준:

- 192×192
- 512×512
- maskable 512×512

아이콘 파일을 교체해도 설치된 PWA와 브라우저 캐시에는 이전 아이콘이 남을 수 있다.

---

# Part D. API 데이터 계약

## 17. 인증

### 일반 가입

흐름:

```text
이메일 입력
→ 인증 코드 발송
→ 코드 검증
→ 계정 생성
→ 체험 진도 이전
→ 로그인 또는 완료 화면
```

이메일 발송에 필요한 서버 환경변수:

```text
EMAIL_ENABLED
EMAIL_PROVIDER=resend
EMAIL_FROM
RESEND_API_KEY
```

이 값은 비밀 저장소에만 둔다.

### 소셜 가입

- Google
- Kakao
- Naver는 운영 승인·검수 상태를 별도로 확인

인앱 브라우저에서는 Google OAuth가 제한될 수 있으므로 외부 브라우저 안내를 사용한다.

---

## 18. 학습·보스 상태

클라이언트가 표시할 수 있는 계산 필드 예:

- 현재 코스
- 최대 해금 유닛
- 다음 스테이지
- 보스 해금 여부
- 엔드보스 상태
- 재도전 가능 여부
- 최초 클리어 보상 여부

이 값은 가능하면 서버에서 현재 사용자 상태를 기준으로 계산한다.

---

## 19. 랭킹

랭킹은 주간 점수 집계를 사용한다.

현재 적용 원칙:

- 게임별 raw 점수 스케일 차이를 가중치로 정규화
- 사용자별 주간 점수 맵 계산
- 읽기 경로에 30초 TTL 캐시
- 지난주 우승자도 같은 정규화 기준 적용
- 원본 XP 지급·cap·저장 로직과 랭킹 표시 계산을 분리

정규화 계수는 실제 사용자 점수 분포가 쌓인 뒤 재조정한다.

---

# Part E. 변경·검수 규칙

## 20. 스키마 변경 절차

1. 현재 코드가 읽고 쓰는 필드를 검색한다.
2. `schema.sql`과 운영 Supabase 컬럼을 비교한다.
3. 추가형 마이그레이션을 작성한다.
4. 기존 데이터 기본값과 null 처리 방식을 정한다.
5. 백엔드 읽기·쓰기 호환을 먼저 적용한다.
6. 프론트 표시를 연결한다.
7. 회귀 테스트를 실행한다.
8. 운영 적용 후 실제 컬럼과 샘플 사용자 상태를 확인한다.
9. 문서의 검증 커밋과 날짜를 갱신한다.

금지:

- 운영 테이블을 근거 없이 삭제·재생성
- 사용자 JSONB 전체를 새 기본값으로 덮어쓰기
- 코드 배포 전에 호환되지 않는 컬럼 rename
- 개인정보를 검수 로그에 출력
- 브라우저 로컬 상태를 서버 진실값으로 취급

---

## 21. 배포 전 데이터 체크리스트

### 정적 데이터

- [ ] JSON 문법 오류가 없다.
- [ ] `question_id`가 중복되지 않는다.
- [ ] 코스·유닛·스테이지 값이 경로와 일치한다.
- [ ] 객관식 문제는 선택지와 정답이 일치한다.
- [ ] 코드블록 줄 번호 표기가 통일됐다.
- [ ] 엔드보스 프로젝트별 최소 문제 수를 충족한다.
- [ ] 정답이 공개 API 응답에 포함되지 않는다.

### Supabase

- [ ] 필수 테이블이 존재한다.
- [ ] 코드가 사용하는 컬럼이 존재한다.
- [ ] JSONB 기본값이 null 안전하다.
- [ ] 원자적 갱신 함수·RPC가 운영 DB에 존재한다.
- [ ] scheduler lock RPC가 적용됐다.
- [ ] 개인정보를 출력하지 않고 count·schema만 확인했다.

### 사용자 흐름

- [ ] 일반 가입 이메일 인증이 실제 도메인에서 도착한다.
- [ ] 일반 가입 후 체험 진도가 이전된다.
- [ ] 소셜 가입의 체험 진도 정책이 명확하다.
- [ ] 레벨 테스트 완료 값은 서버 제출로만 변경된다.
- [ ] 닉네임 중복이 저장 직전에 차단된다.
- [ ] 미션 보상은 한 번만 지급된다.
- [ ] 보스 보상은 승리 세션에서 한 번만 지급된다.
- [ ] 탈퇴 완료 후 결과 안내가 표시된다.

---

## 22. 현재 보완 과제

1. Google·Kakao 소셜 가입 콜백에도 비로그인 체험 진도 이전 연결
2. `.env.example`에 Resend 환경변수 예시 추가
3. 프론트 `.env.example`에 Kakao·Naver 공개 클라이언트 설정 키 정리
4. 운영 Supabase 적용 여부를 문서의 고정 숫자가 아니라 검사 쿼리로 관리
5. 실제 점수 분포 확보 후 랭킹 정규화 계수 재검토

---

## 23. 문서 갱신 규칙

다음 변경이 있으면 이 문서를 갱신한다.

- 테이블·컬럼·RPC 추가
- JSON 파일 경로 또는 문제 필드 변경
- 로컬 저장 키 변경
- 체험 진도 이전 정책 변경
- 보스 세션 구조 변경
- 미션 저장 구조 변경
- 랭킹 계산 기준 변경
- 인증 제공자 또는 이메일 제공자 변경
