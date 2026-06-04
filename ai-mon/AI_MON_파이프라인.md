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
| 유닛 마지막 관문 | 보스 |
| 레벨 마지막 관문 | 파이널 보스 (검정 캐릭터) |
| 유닛 완료 후 열리는 복습 | 훈련 |

---

## 2. 전체 구조

```
레슨 카테고리 (MVP: 3탭 / 이후: 4탭)
└ Unit 1
    └ Stage 1-1 · 주제명
         └ 브리핑 (개념 설명 슬라이드 + 터미널 + 팁)
         └ 퀴즈
    └ Stage 1-2 · 주제명
         └ 브리핑
         └ 퀴즈
    └ ...
    └ 보스
    └ 훈련 (유닛 클리어 후 열림)
└ Unit 2~8 (동일 구조)
└ 파이널 보스 (레벨 전체 완료 시)
```

Stage 입장 → 브리핑 슬라이드 넘기기 → 퀴즈 → 다음 스테이지 잠금 해제

- beginner/intermediate/advanced 커리큘럼 주제 동일, **질문 세트만 난이도별 교체**
- beginner: 개념 이해 위주, multiple_choice
- intermediate: 코드 읽기 + 단순 code_input, multiple_choice + code_input 혼합
- advanced: 코드 작성 + 응용, code_input 위주

**네비게이션**
- MVP: 레슨 / 훈련 / 내 캐릭터 (3탭)
- 2단계: 레슨 / 훈련 / 미니게임 / 내 캐릭터 (4탭)

---

## 3. 학습 흐름 파이프라인

### 스테이지 진행
```
레슨 → 퀴즈 → 다음 스테이지 잠금 해제
```
- 유닛 내 스테이지 순서 강제 (스킵 불가)
- 유닛 간 순서 강제 (Unit 2는 Unit 1 완료 후 오픈)
- 유닛 오픈 시 왕관 지급 (유닛 번호 = 왕관 수, 예: Unit 2 오픈 = 왕관 2개)

### 퀴즈 통과 기준
- 개념확인 퀴즈: **80% 이상** 통과
  - Unit 1~3: 3개 / Unit 4~6: 4개 / Unit 7~8: 5개
- 훈련(복습) 퀴즈: **90% 이상** 통과
  - beginner: 10개 / intermediate: 12개 / advanced: 15개
- 기준 미달 시: 틀린 문제만 재풀이

### 보스 도전
```
유닛 퀴즈 80% 통과 → 보스 해금 → 도전
```
- 하루 2번 무료 도전
- 3번째부터 왕관 1개 소모 (이후 실패 시 계속 왕관 1개씩)
- 레슨 스킵 불가, 보스만 도전 불가

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
- 오답 시: Claude API 호출 → 레벨별 맞춤 설명 (매 스테이지 적용)
- API 호출 제한 없음 (오답 시에만 호출이라 비용 미미)

**미확정**
- [ ] FastAPI SSE Replit 환경 호환 확인 (스트리밍 전환 시)

---

## 5. 코드 실행 파이프라인

- **방식:** Judge0 API (확정)

```
유저 코드 작성
    ↓
FastAPI → Judge0 API 호출
    ↓
실행 결과 반환 (stdout / stderr)
    ↓
프론트 결과 출력
```

---

## 6. 문제 데이터 구조

- **저장 방식:** JSON (MVP) → 이후 DB(SQLite → PostgreSQL) 마이그레이션
- **파일 구성:** lessons.json / questions.json / users.json / progress.json / wrong_answers.json
- **상세 필드 정의 및 예시 →** 📋 AI MON 데이터 스키마 페이지 참고

**힌트 규칙**
- 스테이지: 힌트 없음
- 보스: 힌트 2개 (`hints_used` 0~2로 관리)
- 파이널 보스: 힌트 없음 (필드 없음)
- 파이널 보스: Unit 8 보스 클리어 후 해금

---

## 7. XP & 캐릭터 진화 시스템

- **XP 용도:** 캐릭터 진화 트리거 아님 → 코인(커스텀 아이템 구매)으로만 사용
- **캐릭터 진화:** 유닛 완료 기준으로 트리거

```
Unit 3 완료 → slime → robot
Unit 6 완료 → robot → speech_bubble
Unit 8 완료 → speech_bubble → final_ghost
```

---

## 8. 왕관 로직

**획득**
- 유닛 오픈 시: 유닛 번호만큼 지급 (Unit 2 오픈 = 왕관 2개)
- 훈련 하루치 완료 시: 1개

**소모**
- 보스 3번째 도전부터: 1개씩 소모
- 커스텀 아이템 구매 시: 아이템별 가격 (미확정)

**왕관 0개 시 보스 3번째 도전**
- MVP: 도전 막고 "왕관이 부족합니다" 안내
- 2단계: 미니게임(게임 A / 게임 B) 연결 → 클리어 시 왕관 획득

**미니게임 (MVP 이후)**
- 게임 A: 타임킬링 (애니팡 스타일) → 왕관 획득
- 게임 B: AI 지식 게임 (카드배틀 / OX 등 2~3종) → XP 100~300 획득 (난이도별 차등)
- 카테고리: 레슨 / 훈련 / **미니게임** / 내 캐릭터 (MVP 이후 네비바 4탭으로 확장)

---

## 9. 인증 / 로그인 파이프라인

```
앱 진입 → 비로그인으로 Stage 1-1 체험
    ↓
Stage 1-1 클리어 시 → 회원가입/로그인 모달 노출
    ↓
JWT 발급 → 유저 데이터 저장 시작
```

- Stage 1-1 이전: 진도/XP 저장 없음
- 로그인 후: users.json / progress.json 생성 및 저장 시작

---

## 10. XP 레벨 시스템

**레벨업 XP 기준**
```
Lv 1→5:   레벨당 1,000 XP
Lv 6→15:  레벨당 2,500 XP
Lv 16→25: 레벨당 5,000 XP
Lv 26→35: 레벨당 10,000 XP
Lv 36→40: 레벨당 20,000 XP
```

**XP 획득처**
```
스테이지 퀴즈 클리어:  500 XP
보스 클리어:          2,000 XP
훈련 완료:            1,000 XP
스트릭 3일:           500 XP
스트릭 7일:           2,000 XP + 왕관 1개
스트릭 14일:          5,000 XP + 왕관 2개
스트릭 30일:          10,000 XP + 왕관 5개
```

---

## 11. 스트릭 로직

- 매일 접속 시: streak +1
- 하루 빠지면: streak 0 리셋
- `last_login` 필드로 날짜 체크

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
- 온보딩 (Stage 1-1 비로그인 체험)
- 회원가입 / 로그인 모달

**내 캐릭터**
- 캐릭터 화면 (진화 현황 + XP바 + 왕관 수)

**설정**
- AI 설명 레벨 설정 (beginner / intermediate / advanced)

---

## 14. API 엔드포인트 (MVP 기준)

**인증**
```
POST /auth/register     회원가입
POST /auth/login        로그인 → JWT 발급
```

**유저**
```
GET  /user/me           내 정보 조회 (XP, 왕관, 레벨, 스트릭)
```

**브리핑**
```
GET  /lesson/{unit}/{stage}   브리핑 슬라이드 데이터 조회
```

**퀴즈**
```
GET  /quiz/{level}/{unit}/{stage}   스테이지 문제 조회
POST /quiz/submit                   답안 제출 → 정오답 판정
POST /quiz/ai-feedback              오답 시 Claude API 호출
```

**진도**
```
GET  /progress          전체 진도 조회
POST /progress/update   스테이지/유닛 완료 처리
```

**보스**
```
GET  /boss/{unit}       보스 정보 조회
POST /boss/attempt      보스 도전 시작 (왕관 차감)
POST /boss/clear        보스 클리어 처리 (XP + 왕관 지급 + 진화 체크)
POST /boss/fail         보스 실패 처리 (도전 횟수 업데이트)
```

**코드 실행**
```
POST /code/run          Judge0 API 호출 → 실행 결과 반환
```

**미니게임 (MVP 이후)**
```
GET  /game/list         미니게임 목록
POST /game/clear        게임 클리어 → 왕관/XP 지급
```

---

## 15. 폴더 구조

```
ai-mon/
├── frontend/                 # React + Vite
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── QuizCard/
│   │   │   ├── BossCard/
│   │   │   ├── CharacterDisplay/
│   │   │   └── NavBar/
│   │   ├── pages/
│   │   │   ├── Home/
│   │   │   ├── Lesson/
│   │   │   ├── Stage/
│   │   │   │   ├── BriefingPage/
│   │   │   │   ├── QuizPage/
│   │   │   │   ├── CorrectPage/
│   │   │   │   ├── WrongPage/
│   │   │   │   └── LoadingPage/
│   │   │   ├── Boss/
│   │   │   │   ├── BossPage/
│   │   │   │   ├── BossClearPage/
│   │   │   │   └── LoadingPage/
│   │   │   ├── Character/
│   │   │   ├── Settings/
│   │   │   └── Auth/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── App.jsx
│
├── backend/                  # FastAPI
│   ├── main.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── quiz.py
│   │   ├── boss.py
│   │   ├── progress.py
│   │   ├── user.py
│   │   └── code.py
│   ├── services/
│   │   ├── claude_service.py
│   │   └── judge0_service.py
│   └── data/
│       ├── lessons.json
│       ├── questions.json
│       ├── users.json
│       ├── progress.json
│       └── wrong_answers.json
│
├── .env
└── .gitignore
```

---

## 16. 퀴즈 유형 정의

| 유형 | 설명 | Judge0 필요 |
|---|---|---|
| multiple_choice | 선택지 중 하나 고르기 | ❌ |
| output_select | 코드 실행 결과 선택 | ❌ |
| fill_in_blank | 빈칸 채우기 | ❌ |
| code_input | 직접 코드 작성 | ✅ |

**화면별 퀴즈 유형**

| 화면 | beginner | intermediate | advanced |
|---|---|---|---|
| 스테이지 레슨 | multiple_choice | multiple_choice + output_select | output_select + fill_in_blank |
| 개념체크 퀴즈 | multiple_choice | fill_in_blank | fill_in_blank + output_select |
| 일반 보스 | multiple_choice + output_select | output_select + fill_in_blank | fill_in_blank + code_input |
| 파이널 보스 | output_select + fill_in_blank | fill_in_blank + code_input | code_input 위주 |
| 복습(훈련) | multiple_choice + output_select | fill_in_blank + output_select | fill_in_blank + code_input |

**복습(훈련) 구성**
- 오답 복습: wrong_answers.json 기반 틀렸던 문제 재출제
- 반복 학습: 해당 유닛 전체 랜덤 문제 출제
- 두 가지 섞어서 구성

---

## 17. 미확정 / 논의 필요

- [ ] FastAPI SSE Replit 환경 호환 확인 (스트리밍 전환 시)
- [ ] 커스텀 아이템 가격 책정
- [ ] 2단계 미니게임 기획 (AI 지식 게임 방향)
