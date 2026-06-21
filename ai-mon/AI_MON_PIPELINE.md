---
notion_page: https://app.notion.com/p/AI-MON-PIPELINE-373ea473fb45813a8d91cd58551751ab
title: AI MON PIPELINE
---
# AI MON 파이프라인 정리
> 브레인스토밍 기반 실시간 업데이트 문서

---

## 1. 명칭 확정

| 개념 | 명칭 |
|---|---|
| 대분류 레벨 | beginner / intermediate / advanced |
| 대단위 | 유닛 (Unit) |
| 소단위 | 스테이지 (Stage) |
| 스테이지 내 문제 | 퀴즈 |
| 스테이지 마지막 관문 | 스테이지 미니보스 |
| 유닛 마지막 관문 | 유닛 보스 |
| 레벨 마지막 관문 | 엔드보스 (유닛 보스 왕관 착용 최종형) |
| 유닛 완료 후 열리는 복습 | 훈련 |

---

## 2. 전체 구조

```
레슨 카테고리 (MVP: 3탭 / 이후: 4탭)
└ Unit 1
    └ Stage 1-1 · 주제명
         └ 브리핑 (개념 설명 슬라이드 + 터미널 + 팁)
         └ 퀴즈
         └ 미니보스
    └ Stage 1-2 · 주제명
         └ 브리핑
         └ 퀴즈
         └ 미니보스
    └ ...
    └ 유닛 보스 (Stage 1-1~1-7 전부 완료 후)
    └ 훈련 (유닛 보스 클리어 후 열림)
└ Unit 2~8 (동일 구조)
└ 엔드보스 (레벨 전체 완료 시, 3페이즈 배틀)
```

Stage 입장 → 브리핑 슬라이드 넘기기 → 퀴즈 → 다음 스테이지 잠금 해제

- beginner / intermediate / advanced는 **커리큘럼 주제 자체가 다름** (레벨별 독립 콘텐츠)
- beginner: 파이썬 입문 (변수 / 자료구조 / 제어문 / 함수 / 미니 프로젝트), multiple_choice + output_select 위주
- intermediate: 고급 자료구조 / 파일·예외 / OOP / 컴프리헨션 / 모듈, fill_in_blank + output_select 위주
- advanced: API / 정규표현식 / 비동기 / Claude API / AI 에이전트, fill_in_blank + code_input 위주

**네비게이션**
- MVP: 레슨 / 훈련 / 내 캐릭터 (3탭)
- 2단계: 레슨 / 훈련 / 미니게임 / 내 캐릭터 (4탭)

---

## 3. 학습 흐름 파이프라인

### 스테이지 진행
```
레슨 → 스테이지 퀴즈 → 스테이지 미니보스 → 다음 스테이지 잠금 해제
```
유닛 내 모든 스테이지 완료 시 → **유닛 보스** 해금 (유닛별 스테이지 수 상이: 5~7개)
- 유닛 내 스테이지 순서 강제 (스킵 불가)
- 유닛 간 순서 강제 (Unit 2는 Unit 1 완료 후 오픈)
- 유닛 오픈 시 왕관 지급 (유닛 번호 = 왕관 수, 예: Unit 2 오픈 = 왕관 2개)

### 퀴즈 통과 기준
- 스테이지 퀴즈 (개념퀴즈): **60% 이상** 통과 → 미니보스 진입
  - Unit 1~3: 3개 / Unit 4~6: 4개 / Unit 7~8: 5개
- 훈련(복습) 퀴즈: **90% 이상** 통과
  - beginner: 10개 / intermediate: 12개 / advanced: 15개
- 기준 미달 시: 틀린 문제만 재풀이

### 보스 도전
```
유닛 내 모든 스테이지 완료 → 유닛 보스 해금 → 도전
```
- 하루 2번 무료 도전
- 3번째부터 왕관 1개 소모 (이후 실패 시 계속 왕관 1개씩)
- 레슨 스킵 불가, 보스만 도전 불가

### 유닛 보스 전투 구조 (HP 배틀)

```
내 HP:  1000   (3번 틀리면 -350×3 → 실패)
보스 HP: 1000   (7문제 전부 맞추면 -150×7 → 클리어)

문제 맞추면 → 보스 HP -150 + 보스 피격 애니메이션
문제 틀리면 → 내 HP -350 + 내 캐릭터 피격 애니메이션 + Claude AI 피드백
보스 HP ≤ 0  → 클리어 (XP 3,000 + 레벨업 체크)
내 HP ≤ 0 또는 오답 3번 → 실패 → 왕관 소모 후 재도전
```

**문제 구성**

> 유닛별 커버 범위 및 문제 구성 상세는 `AI_MON_UNITBOSS_QUESTIONS.md` 참고.

**beginner (초급) 유닛 보스 — 10문제 구성**

| 유닛 | 주제 | 문제 유형 구성 |
|---|---|---|
| Unit 1 | 파이썬 첫걸음 | `output_select` ×4, `fill_in_blank` ×4, `error_find` ×2 |
| Unit 2 | 문자열 | `output_select` ×4, `fill_in_blank` ×4, `error_find` ×2 |
| Unit 3 | 조건문 (if/elif/else) | `output_select` ×4, `fill_in_blank` ×4, `error_find` ×2 |
| Unit 4 | 반복문 (for/while) | `output_select` ×4, `fill_in_blank` ×4, `error_find` ×2 |
| Unit 5 | 리스트 & 파일처리 | `output_select` ×4, `fill_in_blank` ×4, `error_find` ×2 |
| Unit 6 | 함수 | `output_select` ×4, `fill_in_blank` ×4, `error_find` ×2 |
| Unit 7 | 딕셔너리 & set | `output_select` ×4, `fill_in_blank` ×4, `error_find` ×2 |
| Unit 8 | 미니 프로젝트 | `output_select` ×4, `fill_in_blank` ×4, `error_find` ×2 |

- 10문제 고정 구성 (내 HP 1000 / 보스 HP 1000 배틀 밸런스 유지)
- 초급 원칙에 따라 직접 타이핑하는 `code_input`은 배제하고, `error_find`를 통해 코드 분석력 검증
- 페이즈 구분 없음 (3페이즈 시스템은 엔드보스 전용)

**intermediate / advanced 유닛 보스**

| 레벨 | 문제 유형 구성 |
|---|---|
| intermediate | `fill_in_blank` ×4, `output_select` ×4, `code_input` ×2 |
| advanced | `code_input` ×6, `fill_in_blank` ×3, `output_select` ×1 |

---

## 4. AI 피드백 파이프라인

```
유저 오답 제출 (multiple_choice or code_input)
    ↓
오답 판정
    ↓
설명 레벨 선택 (설정 기본값, 언제든 변경 가능)
    ↓
beginner / intermediate / advanced
    ↓
Claude API 호출
  system: 레벨별 프롬프트
  user: 문제 + 유저 답 + 정답
    ↓
응답 수신 (MVP: 완성 후 출력 / 이후: SSE 스트리밍 전환)
    ↓
문제 화면 인라인 출력
  - 즉시 열람 가능
  - 힌트(왕관 필요)와 영역 분리
    ↓
재도전 버튼 노출 + 오답노트 자동 큐레이션 저장
```

| 레벨 | 설명 스타일 |
|---|---|
| beginner | 비유 + 일상 예시 + 왜 틀렸는지 설명 |
| intermediate | 개념 + 코드 예시 + 오류 원인 분석 |
| advanced | 원리 + 엣지 케이스 + 최적 해법 제시 |

**확정 사항**
- 설명 레벨: 최초 1회 설정 후 고정, 설정에서 언제든 변경 가능
- API 출력 방식: MVP는 완성 후 출력 → 이후 스트리밍으로 전환
- 정답 시: `explanation` 필드 텍스트 그대로 출력 (API 호출 없음)
- 오답 시: Claude API 호출 → 레벨별 맞춤 설명 (매 스테이지 적용). 프롬프트 구조가 레벨별(beginner/intermediate/advanced) 평가 기준으로 고도화됨.
- 캐싱: `wrong_answers.json`을 통해 오답 AI 피드백 캐싱 구현 및 연동 완료 (동일 오답에 대한 중복 호출 방지)
- API 호출 제한: `slowapi`를 도입하여 Claude API 호출 엔드포인트들에 유저 ID 기준 Rate Limit 적용 (예: 분당 5회, 일당 100회 등 어뷰징 방지)

**미확정**
- [ ] FastAPI SSE Replit 환경 호환 확인 (스트리밍 전환 시)

---

## 5. 코드 실행 파이프라인

- **방식:** Pyodide (브라우저 내 Python 실행 — 서버 불필요)

```
유저 코드 작성
    ↓
브라우저 Pyodide 엔진에서 직접 실행 (JS → WASM)
    ↓
실행 결과 반환 (stdout / stderr)
    ↓
프론트 결과 출력 + 정답 비교
```

---

## 6. 문제 데이터 구조

- **저장 방식:** JSON (MVP) → 이후 DB(SQLite → PostgreSQL) 마이그레이션
- **파일 구성:** lessons/ 폴더 / questions/ 폴더 / users.json / progress.json / wrong_answers.json
- **상세 필드 정의 및 예시 →** 📋 AI MON 데이터 스키마 페이지 참고

**힌트 규칙**
- 스테이지 퀴즈: `hint` 필드 있음 (JSON 데이터에 포함)
- 스테이지 미니보스: `hint` 필드 없음
- 유닛 보스: `hint` 필드 없음 / UI 힌트코인 2회 사용 가능 (`hints_used` 0~2로 관리, `POST /boss/hint` 엔드포인트 연동)
- 엔드보스: `hint` 필드 없음, UI 힌트 없음
- 엔드보스: Unit 8 보스 클리어 후 해금 / 재도전 왕관 3개 소모 (무료 없음)

---

## 7. XP & 캐릭터 진화 시스템

### 레벨 구조

| 티어 | 캐릭터 | 레벨 범위 |
|---|---|---|
| 초급 (beginner) | slime | Lv.1 ~ Lv.10 |
| 중급 (intermediate) | robot | Lv.11 ~ Lv.20 |
| 고급 (advanced) | speech_bubble | Lv.21 ~ Lv.30 |
| 리미트 해제 | final_ghost | Lv.30+ (XP 무한 누적) |

### 레벨업 트리거

```
유닛 보스 클리어    → +1 레벨 (Lv.1~8 / 11~18 / 21~28)
엔드보스 클리어     → +2 레벨 (두 단계 순차 표시)
Lv.10 / 20 / 30 달성 → 다음 캐릭터로 진화
```

### XP 획득처

| 활동 | XP |
|---|---|
| 스테이지 퀴즈 클리어 (10문제 세트) | 2,000 XP |
| 스테이지 미니보스 클리어 | 2,500 XP |
| 유닛 보스 클리어 | 3,000 XP |
| 엔드보스 클리어 | 15,000 XP |

> 초급 자연 플레이 총 획득 XP: 약 282,000 XP / Lv.10 달성 필요 XP: 45,000 XP

### 레벨업 필요 XP

```
필요 XP = 현재 레벨 × 1,000
예) Lv.1→2: 1,000 / Lv.10→11: 10,000 / Lv.29→30: 29,000
```

### 리미트 해제 (Lv.30+)

```
고급 엔드보스 클리어 → final_ghost 진화 → Lv.30 달성
→ 레벨 상한 해제 → XP 무한 누적 → 랭킹 시스템 연동 (MVP 이후)
```

### 시작 캐릭터

- 회원가입 시 레벨테스트 결과와 무관하게 **slime (Lv.1)** 으로 시작
- 레벨테스트에서 중급/고급 나와도 슬라임부터 시작, 수강 레벨(course_level)만 다름
- 레벨테스트 후 선택: [초급부터 키우기] [중급부터 시작하기] → course_level만 변경, 캐릭터는 동일

---

## 8. 왕관 로직

**획득**
- 유닛 오픈 시: 유닛 번호만큼 지급 (Unit 2 오픈 = 왕관 2개)
- 훈련 하루치 완료 시: 1개
- 엔드보스 클리어 시: 15개

**소모**
- 보스 3번째 도전부터: 1개씩 소모
- 커스텀 아이템 구매 시: 아이템별 가격 (미확정)

**왕관 0개 시 보스 3번째 도전**
- MVP: 도전 막고 "왕관이 부족합니다" 안내
- 2단계: 미니게임(게임 A / 게임 B) 연결 → 클리어 시 왕관 획득

**미니게임 (MVP 및 이후 확장)**
- 에이팡 (Aipang), 에이런 (Airun), 에이짝 (Aijjak), 에이bomb 등 다수 추가 완료
- 카테고리: 레슨 / 훈련 / **미니게임** / 내 캐릭터 (네비바 4탭으로 확장 완료)

---

## 9. 인증 / 로그인 파이프라인

### 비로그인 랜딩 흐름

```
앱 진입 (비로그인 랜딩 / 메인)
     │
     ├── 1. [로그인 / 이미 계정이 있어요] ──────────────────────
     │    /auth?mode=login
     │
     └── 2. [레벨 테스트 시작하기 (비회원 클릭 시)] ────────────
          /level-test-info 안내 페이지로 이동
          └─ "회원가입하고 레벨 진단받기" → /auth?mode=register
```

### 로그인 후 대시보드 흐름

```
로그인 완료 (대시보드 진입)
     │
     ├── 레벨 테스트 미완료 (is_level_tested: false)
     │    └─ 중앙에 [내 코딩 레벨 진단하기] 버튼 노출
     │    └─ 클릭 시 → 레벨 테스트 모달 진행 → 완료 후 course_level, is_level_tested 업데이트
     │
     └── 레벨 테스트 완료 (is_level_tested: true)
          └─ 진단 버튼 숨김
          └─ 상단 유저 정보 영역에 현재 레벨 배지(예: intermediate) 노출
```

### Auth 페이지 (/auth)

- URL 파라미터: `?mode=login|register`
- **소셜 로그인**: 구글 / 카카오 / 네이버 OAuth 로그인 연동 완료 (JWT 토큰 발급 및 스트릭 처리 일원화)
- 회원가입 완료 후 대시보드 이동 시 레벨 테스트를 유도

### RegisterRequest 스키마 (백엔드)

```python
class RegisterRequest(BaseModel):
    username: str
    password: str
    nickname: str = ""
    course_level: str = "beginner"
    is_level_tested: bool = False
```

### users.json 저장 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | 자동 생성 |
| `username` | str | 로그인 ID |
| `nickname` | str | 표시 이름 |
| `course_level` | str | beginner / intermediate / advanced |
| `is_level_tested` | bool | 레벨 테스트 완료 여부 |
| `character` | str | "default" |
| `created_at` | ISO 8601 | 가입 시각 |

- 로그인 후: `users.json` / `progress.json` 생성 및 저장 시작

---

## 10. XP 레벨 시스템

**레벨업 XP 기준**
```
필요 XP = 현재 레벨 × 1,000
Lv.1→2:   1,000 XP
Lv.10→11: 10,000 XP  (초급 → 중급 진입)
Lv.20→21: 20,000 XP  (중급 → 고급 진입)
Lv.29→30: 29,000 XP  (엔드보스 클리어 시 달성)
Lv.30+:   리미트 해제, 30,000 XP/레벨 유지
```

**XP 획득처**
```
스테이지 퀴즈 클리어 (10문제 세트): 2,000 XP
스테이지 미니보스 클리어:           2,500 XP
유닛 보스 클리어:                   3,000 XP
엔드보스 클리어:                    15,000 XP
스트릭 3일:                         500 XP + 왕관 1개
스트릭 7일:                         2,000 XP + 왕관 2개
스트릭 14일:                        5,000 XP + 왕관 3개
스트릭 30일:                        10,000 XP + 왕관 5개
```

---

## 11. 스트릭 로직

- 매일 접속 시: streak +1
- 하루 빠지면: streak 0 리셋
- `last_login` 필드로 날짜 체크 (스트릭 및 일일 도전 횟수 갱신 기준을 KST(UTC+9)로 수정하여 한국 자정 기준으로 정상 리셋되도록 보정)

**스트릭 보상 (디폴트 구간, 자동 지급)**
```
3일  연속 → 500 XP
7일  연속 → 2,000 XP + 왕관 1개
14일 연속 → 5,000 XP + 왕관 2개
30일 연속 → 10,000 XP + 왕관 5개
```

---

## 12. 내 캐릭터 화면

**표시 정보**
- 현재 에이몬 진화 단계 (slime / robot / speech_bubble / final_ghost)
- 현재 Lv + XP 진행 바
- 보유 왕관 수

**커스텀 기능**
- 왕관으로 캐릭터 색상 팔레트 · 이펙트 구매 및 적용
- 터미널 테마 잠금 해제: MVP 이후 기획 예정

**진화 조건 표시**
- 다음 진화까지 남은 유닛 수 표시 (예: "Unit 6 완료 시 진화")

---

## 13. 화면 목록 (MVP 기준)

**메인/네비**
- 홈 (진도 현황 + 오늘의 학습 유도)
- 네비게이션 바 (레슨 / 훈련 / 내 캐릭터)

**레슨 흐름**
- 레슨 홈 (beginner/intermediate/advanced 선택 + 유닛 목록)
- 유닛 상세 (스테이지 목록 + 잠금 상태)
- 브리핑 화면 (개념 설명 슬라이드 + 터미널 + 팁)
- 스테이지 퀴즈 화면 (문제 + 선택지 or code_input)
- 정답 화면 (explanation 출력)
- 오답 화면 (Claude AI 피드백 + 재도전 버튼)
- 로딩 화면 (API 호출 중 표시)
- 보스 도전 화면
- 보스 클리어 화면 (XP 획득 + 왕관 애니메이션 + 인증카드 예고)

**인증**
- 온보딩 — `/stage/1/1` (Stage 1-1 비로그인 선체험, public route)
- 레벨테스트 안내 — `/level-test-info` (비로그인 시 레벨테스트 진입 안내)
- 회원가입 / 로그인 — `/auth`

**내 캐릭터**
- 캐릭터 화면 — `/character` (진화 현황 + XP바 + 왕관 수)

**설정**
- AI 설명 레벨 설정 — `/settings` (beginner / intermediate / advanced)

**엔드보스 및 미니게임**
- 엔드보스 — `/boss/endboss` (Unit 8 완료 시 해금, 3페이즈 배틀 연동 완료)
- 미니게임 — `/game` (에이팡, 에이런, 에이짝, 에이bomb 등 오픈)

---

## 14. API 엔드포인트 (MVP 기준)

**인증**
```
POST /auth/register         회원가입
POST /auth/login            로그인 → JWT 발급
POST /auth/forgot-password  비밀번호 재설정 인증 코드 생성 및 이메일 발송
POST /auth/reset-password   인증 코드 검증 및 비밀번호 변경
```


**유저 및 칭호**
```
GET  /user/me           내 정보 조회 (XP, 왕관, 레벨, 스트릭)
GET  /titles            칭호 정보 조회 및 장착 (check_and_award_titles 연동)
```

**브리핑 / 레슨**
```
GET  /lessons                      전체 레슨 목록
GET  /lessons/{lesson_id}          특정 레슨 조회 (lesson_id: "1-1-beginner" 등)
```

**퀴즈 (Rate Limit 적용)**
```
GET  /quiz/{level}/{unit}/{stage}   스테이지 문제 조회
POST /quiz/submit                   답안 제출 → 정오답 판정
POST /quiz/ai-feedback              오답 시 Claude API 호출 (slowapi Rate Limit 적용됨)
```

**진도**
```
GET  /progress          전체 진도 조회
POST /progress/update   스테이지/유닛 완료 처리
```

**보스 (일부 Rate Limit 적용)**
```
GET  /boss/{unit}       보스 정보 조회
POST /boss/hint         보스 배틀 힌트 제공 (Claude API 활용, slowapi Rate Limit 적용됨)
POST /boss/attempt      보스 도전 시작 (왕관 차감)
POST /boss/answer       보스 문제 채점 (slowapi Rate Limit 적용됨)
POST /boss/clear        보스 클리어 처리 (XP + 왕관 지급 + 진화 체크)
POST /boss/fail         보스 실패 처리 (도전 횟수 업데이트)
```

**코드 실행**
```
# 백엔드 엔드포인트 없음
# code_input 채점은 프론트 Pyodide가 전담 (브라우저 내 실행)
```

**미니게임 (MVP 이후)**
```
GET  /game/list         미니게임 목록
POST /game/clear        게임 클리어 → 왕관/XP 지급
```

---

## 14-1. 백그라운드 스케줄러 (Batch Job)

**스트릭 리마인더 이메일 발송**
- **실행 시간**: 매일 18:00 KST (Asia/Seoul 기준)
- **로직**:
  - `last_login`이 어제(Yesterday) 날짜인 사용자 중 오늘(Today) 아직 로그인하지 않은 대상을 필터링.
  - 이메일 주소가 등록되어 있고 비어있지 않은 사용자에게 스트릭 리셋 경고 및 로그인 독려 이메일 발송.
  - SendGrid API(`sendgrid` 라이브러리) 및 APScheduler(`BackgroundScheduler`)를 통해 구동.

---

## 15. 폴더 구조

```
ai-mon/
├── frontend/                 # React + Vite
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── QuizCard/
│       │   ├── BossCard/
│       │   ├── CharacterDisplay/
│       │   └── NavBar/
│       ├── pages/
│       │   ├── Home/         # 랜딩 + 로그인 대시보드 (레벨 테스트 모달 포함)
│       │   ├── Lesson/       # 유닛 목록 (LessonHome) + 스테이지 목록 (Lesson)
│       │   ├── Stage/        # 브리핑 + 퀴즈 통합 (Stage.jsx)
│       │   ├── Boss/
│       │   ├── Character/
│       │   ├── Settings/
│       │   └── Auth/
│       ├── data/
│       │   └── mockData.js   # 로컬 개발용 목 데이터 (MOCK_LESSONS, MOCK_QUESTIONS)
│       ├── hooks/
│       ├── api/
│       └── App.jsx
│
├── backend/                  # FastAPI
│   ├── main.py
│   ├── scheduler.py          # APScheduler (스트릭 리마인더 배치 작업)
│   ├── routers/
│   │   ├── auth.py           # POST /auth/register, /auth/login, /auth/forgot-password, /auth/reset-password
│   │   ├── quiz.py           # GET /lessons, /lessons/{id}, /questions, /ai-feedback
│   │   ├── boss.py
│   │   ├── progress.py
│   │   ├── user.py
│   │   └── code.py
│   ├── services/
│   │   ├── claude_service.py
│   │   ├── gemini_service.py
│   │   └── email_service.py  # SendGrid 이메일 전송 서비스
│   └── data/
│       ├── lessons/          ← 레벨/유닛별 브리핑 슬라이드
│       │   ├── beginner/
│       │   │   ├── unit_1.json
│       │   │   └── ...
│       │   └── intermediate/, advanced/
│       ├── quiz/             ← 스테이지 퀴즈 (stage_quiz, hint 필드 포함)
│       │   ├── beginner/
│       │   │   ├── unit_1.json
│       │   │   └── ...
│       │   └── intermediate/, advanced/
│       ├── miniboss/         ← 스테이지 미니보스 (hint 필드 없음)
│       │   ├── beginner/
│       │   └── ...
│       ├── unitboss/         ← 유닛 보스 (hint 필드 없음)
│       │   ├── beginner/
│       │   └── ...
│       ├── finalboss/        ← 엔드보스 (3페이즈, 프로젝트 선택)
│       │   ├── beginner.json
│       │   └── ...
│       ├── users.json        ← 자동 생성 (회원가입 시)
│       ├── progress.json     ← 자동 생성 (진도 저장 시)
│       ├── wrong_answers.json ← 자동 생성 (오답 시)
│       └── reset_tokens.json ← 자동 생성 (비밀번호 재설정용 임시 토큰)
│
├── .env
└── .gitignore
```

---

## 16. 퀴즈 유형 정의

| 유형 | 설명 | 채점 방식 |
|---|---|---|
| multiple_choice | 선택지 중 하나 고르기 | 정답 문자열 비교 |
| output_select | 코드 실행 결과 선택 | 정답 문자열 비교 |
| fill_in_blank | 빈칸 채우기 | 정답 문자열 비교 |
| code_input | 직접 코드 작성 | **Pyodide** 브라우저 실행 → stdout 비교 |
| error_find | 오류 줄 번호 선택 | 정답 문자열 비교 (선택지 A/B/C/D) |

**화면별 퀴즈 유형**

| 화면 | beginner | intermediate | advanced |
|---|---|---|---|
| 스테이지 레슨 | multiple_choice | multiple_choice + output_select | output_select + fill_in_blank |
| 스테이지 퀴즈 | multiple_choice + output_select | fill_in_blank + output_select | fill_in_blank + output_select |
| 스테이지 미니보스 | multiple_choice + output_select | output_select + fill_in_blank | fill_in_blank + code_input |
| 유닛 보스 | output_select + fill_in_blank + error_find  | fill_in_blank + output_select + code_input | code_input 위주 |
| 엔드보스 | P1: output_select/mc → P2: error_find → P3: fill_in_blank | P1: output_select/fib → P2: error_find → P3: code_input(함수) | P1: fib/error_find → P2: code_input → P3: code_input(설계) |
| 복습(훈련) | multiple_choice + output_select | fill_in_blank + output_select | fill_in_blank + code_input |

> beginner는 `code_input` 없음. intermediate부터 `code_input` 도입. `error_find`는 beginner 유닛 보스(Unit 1~8) 전체에서 디버깅 역량 검증용으로 사용.

**복습(훈련) 구성**
- 오답 우선: wrong_answers.json 기반 reviewed: false 문제 우선 출제
- 부족하면 해당 유닛 stage_quiz + miniboss 전체에서 랜덤으로 채워 15개 맞춤
- 유닛 선택 UI (Unit 1~8) → 선택한 유닛 문제만 출제
- 엔드포인트: GET /train/review?unit={n}&course_level={level}&limit=15

---

## 17. 문제 데이터 현황 (2026-06-21 기준)

> ⚠️ 신규 커리큘럼 기반으로 beginner뿐만 아니라 intermediate, advanced의 데이터들도 지속해서 추가/업데이트 되었습니다.

**신 커리큘럼 기준 제작 현황 (beginner / intermediate / advanced)**

| 유닛 | stage_quiz | miniboss | unit_boss | 상태 |
|---|---|---|---|---|
| Unit 1~5 | 140개 (Set A/B × 7스테이지) | 70개 | 10개 | ✅ 완료 |
| Unit 6~8 | 140개 (Set A/B × 7스테이지) | 70개 | 10개 | ✅ 완료 |

- **intermediate · advanced 데이터**: `train`, `unitboss`, `miniboss`, `endboss` 및 슬라이드(`lessons_intermediate.json`, `advanced` 폴더) 데이터가 대규모 병합 및 추가 완료되었습니다.

**엔드보스 (finalboss)**

| 프로젝트 | Phase 1 (5문제) | Phase 2 (4문제) | Phase 3 (3문제) | 상태 |
|---|---|---|---|---|
| beginner / intermediate / advanced | ✅ | ✅ | ✅ | ✅ 다수 추가 및 로직 고도화 완료 |

---

## 18. 미확정 / 논의 필요

- [ ] FastAPI SSE Replit 환경 호환 확인 (스트리밍 전환 시)
- [ ] 커스텀 아이템 가격 책정
- [ ] 2단계 미니게임 기획 (AI 지식 게임 방향)

## 19. 별도 논의 필요 (기준 미확정)

- [x] **XP 레벨업 로직** — 확정. 레벨 × 1,000 XP 구조.
- [x] **캐릭터 진화 디테일** — 확정. 초급/중급/고급 엔드보스 클리어 시 진화, Lv.10/20/30 기준.
- [x] **유닛 보스 전투 구조** — 확정. HP 1000, 문제 맞추면 보스 -150, 틀리면 내 HP -350, 3번 틀리면 실패.
- [x] **개념퀴즈 재시도 시스템** — 확정. Set A/B 7문제씩, 60% 통과 기준, 3회차부터 혼합.
