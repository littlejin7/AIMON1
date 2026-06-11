---
notion_page: https://app.notion.com/p/AI-MON-SCHEMA-373ea473fb4581968fa1fb9a1ba08a83
title: AI MON SCHEMA
---

# AI MON 데이터 스키마

> 각 JSON 파일의 필드 정의 + 예시. 문제 데이터 제작 및 개발 연동 시 기준 문서.

---

## 1. lessons.json (유닛 목록)

메인 홈 화면의 유닛 리스트에 표시되는 각 레슨의 메타데이터입니다.

| 필드          | 타입   | 필수 | 설명                                            |
| ------------- | ------ | ---- | ----------------------------------------------- |
| `unit_id`     | number | ✅   | 유닛 번호 (예: `1`)                             |
| `title`       | string | ✅   | 유닛 제목 (예: `"파이썬 첫걸음"`)               |
| `description` | string | ✅   | 유닛 설명                                       |
| `stages`      | number | ✅   | 해당 유닛에 속한 스테이지 수 (예: `4`)          |
| `boss_stage`  | number | ✅   | 보스 스테이지 번호 (예: `5`)                    |
| `icon`        | string | ✅   | 카드 아이콘 이모지 (예: `"🖨️"`)                 |
| `keywords`    | array  | ✅   | 해시태그 목록 (예: `["print", "변수"]`)         |
| `evolution`   | string | ✅   | 이 유닛을 깨면 진화하는 펫 단계 (예: `"slime"`) |
| `difficulty`  | string | ✅   | 난이도 라벨 (예: `"입문"`)                      |

---

## 1-1. lessons/ 폴더 (브리핑 슬라이드 데이터)

브리핑 슬라이드 데이터 — 스테이지 × 레벨별 개념 설명

### 📁 파일 관리 구조

```
backend/data/lessons/
├── beginner/
│   ├── unit_1.json   ← 초급 Unit 1의 모든 스테이지 슬라이드
│   ├── unit_2.json
│   └── ...
├── intermediate/
└── advanced/
```

각 파일은 **배열** 형태로, 해당 레벨의 하나의 유닛 내 모든 스테이지 조합을 담아요.  
백엔드가 `lessons/{course_level}/` 폴더 내 파일을 자동으로 읽어 합쳐 서빙합니다.

---

### 필드 정의

| 필드                       | 타입   | 필수 | 설명                                                             |
| -------------------------- | ------ | ---- | ---------------------------------------------------------------- |
| `lesson_id`                | string | ✅   | `"{stage}-{course_level}"` 형식 (예: `"1-1-beginner"`)           |
| `unit`                     | number | ✅   | 유닛 번호 (1~8)                                                  |
| `stage`                    | string | ✅   | 스테이지 번호 (예: `"1-1"`)                                      |
| `course_level`             | string | ✅   | 수강 레벨: `beginner` / `intermediate` / `advanced`              |
| `title`                    | string | ✅   | 스테이지 제목                                                    |
| `villain`                  | string | ✅   | 등장 악당 (`codemmon` / `speechbubble_king` / `interferencemon`) |
| `slides`                   | array  | ✅   | 슬라이드 목록                                                    |
| `slides[].order`           | number | ✅   | 슬라이드 순서                                                    |
| `slides[].text`            | string | ✅   | 개념 설명 텍스트                                                 |
| `slides[].terminal`        | object | ❌   | 터미널 예시 (없을 수도 있음)                                     |
| `slides[].terminal.code`   | array  | ❌   | 코드 라인 배열                                                   |
| `slides[].terminal.output` | array  | ❌   | 실행 결과 배열                                                   |
| `slides[].tip`             | string | ❌   | 하단 팁 텍스트                                                   |

---

### 레벨별 교육 전략

> ⚠️ **커리큘럼 개편 안내 (2026-06-09):** beginner / intermediate / advanced는 더 이상 동일 주제를 다른 난이도로 가르치지 않습니다. **레벨마다 커리큘럼 주제가 완전히 다릅니다.**
> - beginner: 파이썬 입문 (변수·자료구조·제어문·함수·미니 프로젝트)
> - intermediate: 고급 자료구조·파일·예외·OOP·컴프리헨션·모듈
> - advanced: API·정규표현식·비동기·Claude API·AI 에이전트·자동화

아래 표는 **beginner 레벨 내부**에서의 슬라이드 설명 방식 차이를 나타냅니다. (Unit 1 Stage 1-1 기준 예시)

| `course_level` | 교육 전략                         | beginner Unit 1 Stage 1-1 기준 핵심 개념              |
| -------------- | --------------------------------- | ----------------------------------------------------- |
| `beginner`     | 비유 중심, 개념 하나씩, 쉬운 언어 | print() = 스피커 비유, 따옴표 역할, 주석 기초(`#`)    |

> 각 레벨은 독립적인 유닛 구성을 가지므로, `lesson_id`의 `course_level` 필드로 레벨을 구분합니다.

---

### 예시 (unit_1.json 일부)

```json
[
  {
    "lesson_id": "1-1-beginner",
    "unit": 1,
    "stage": "1-1",
    "course_level": "beginner",
    "title": "Hello, Python!",
    "villain": "codemmon",
    "slides": [
      {
        "order": 1,
        "text": "Python에서 화면에 글자를 보여주려면 print()를 사용해요.\n마치 스피커처럼, 괄호 안에 넣은 내용을 소리 내어 출력해줘요.",
        "terminal": {
          "code": ["print('안녕, 에이몬!')"],
          "output": ["안녕, 에이몬!"]
        },
        "tip": "따옴표는 Python에게 '이건 글자야!'라고 알려주는 신호예요."
      }
    ]
  },
  {
    "lesson_id": "1-1-intermediate",
    "unit": 1,
    "stage": "1-1",
    "course_level": "intermediate",
    "title": "Hello, Python!",
    "villain": "codemmon",
    "slides": [ ... ]
  },
  {
    "lesson_id": "1-1-advanced",
    "unit": 1,
    "stage": "1-1",
    "course_level": "advanced",
    "title": "Hello, Python!",
    "villain": "codemmon",
    "slides": [ ... ]
  },
  {
    "lesson_id": "1-2-beginner",
    "unit": 1,
    "stage": "1-2",
    "course_level": "beginner",
    "slides": [ ... ]
  }
]
```

---

## 2. quiz / miniboss / unitboss 폴더

> 현황 (2026-06-11): beginner Unit 1~5 데이터 완료. Unit 6~8 및 intermediate/advanced 제작 예정.

퀴즈 문제 데이터 — 카테고리별 + 레벨별 + 유닛별로 분리 관리

### 📁 파일 관리 구조

```
backend/data/
├── quiz/            ← 스테이지 퀴즈 (stage_quiz)
│   ├── beginner/
│   │   ├── unit_1.json
│   │   └── ...
│   ├── intermediate/
│   └── advanced/
├── miniboss/        ← 스테이지 미니보스
│   ├── beginner/
│   └── ...
└── unitboss/        ← 유닛 보스
    ├── beginner/
    └── ...
```

각 파일은 `{"questions": [...]}` 형태이며, 백엔드에서 `course_level` 파라미터를 이용해 해당 폴더의 파일들을 취합합니다.

| 필드               | 타입    | 허용값                                                       | 필수 | 설명                                                                                            |
| ------------------ | ------- | ------------------------------------------------------------ | ---- | ----------------------------------------------------------------------------------------------- |
| `question_id`      | string  | -                                                            | ✅   | 문제 ID. 스테이지: `q{번호}` / 보스: `boss_{level}_{type}_{unit}_{번호}`                        |
| `unit`             | number  | 1~8                                                          | ✅   | 유닛 번호                                                                                       |
| `stage`            | string  | -                                                            | ✅   | 스테이지 번호 (`"1-1"` ~ `"1-7"`: 스테이지, `"1-boss"`: 유닛 보스, `"final"`: 엔드보스) |
| `course_level`     | string  | beginner / intermediate / advanced                           | ✅   | 수강 레벨                                                                                       |
| `difficulty`       | string  | easy / medium / hard                                         | ✅   | 문제 난이도                                                                                     |
| `type`             | string  | multiple_choice / output_select / fill_in_blank / code_input / error_find | ✅   | 문제 형식 (출력 방식)                                                                           |
| `quiz_category`    | string  | stage_quiz / miniboss / unit_boss / final_boss               | ✅   | 문제 세트 유형 (흐름상 위치)                                                                    |
| `quiz_set`         | string  | A / B                                                        | ❌   | stage_quiz 전용. Set A(1회차) / Set B(2회차) / 없으면 3회차 혼합                                |
| `is_boss`          | boolean | true / false                                                 | ✅   | 유닛 보스 / 엔드보스 여부 (`stage: "1-boss"` 또는 `stage: "final"` 과 함께 사용)               |
| `phase`            | number  | 1 / 2 / 3                                                    | ❌   | 엔드보스 전용. 페이즈 번호 (1=분석전, 2=역전, 3=결정타)                                         |
| `question`         | string  | -                                                            | ✅   | 문제 텍스트                                                                                     |
| `choices`          | array   | -                                                            | ❌   | 선택지 (multiple_choice / output_select / error_find 해당, fill_in_blank는 빈 배열)             |
| `answer`           | string  | -                                                            | ✅   | 정답                                                                                            |
| `hint`             | string  | -                                                            | ❌   | 힌트 텍스트 — **stage_quiz 전용**. miniboss / unitboss 에는 필드 자체 없음                      |
| `feedback.correct` | string  | -                                                            | ✅   | 정답 시 출력 텍스트 (API 호출 없음)                                                             |

> `stage: "1-boss"` + `is_boss: true` 조합으로 보스 문제 구분.

### quiz_set 규칙

| quiz_category | quiz_set 필요 | 값                                | hint 필드 |
| ------------- | ------------- | --------------------------------- | --------- |
| stage_quiz    | ✅            | `"A"` (1회차) 또는 `"B"` (2회차) | ✅ 있음    |
| miniboss      | ❌            | 없음 (필드 자체 제거)             | ❌ 없음    |
| unit_boss     | ❌            | 없음 (필드 자체 제거)             | ❌ 없음    |
| final_boss    | ❌            | 없음 (필드 자체 제거)             | ❌ 없음    |

- 스테이지별 stage_quiz는 총 20문제 → Set A 10개 / Set B 10개로 분리
- `attempt=1` → Set A만 / `attempt=2` → Set B만 / `attempt=3+` → A+B 혼합 랜덤

### question_id 네이밍 규칙

| 구분                  | 패턴                                            | 예시                      |
| --------------------- | ----------------------------------------------- | ------------------------- |
| 스테이지 beginner     | `q{세자리}`                                     | `q001`, `q002`, `q003`    |
| 스테이지 intermediate | `q{1로 시작 세자리}`                            | `q101`, `q102`, `q103`    |
| 스테이지 advanced     | `q{2로 시작 세자리}`                            | `q201`, `q202`, `q203`    |
| 스테이지 미니보스     | `miniboss_{level}_{type}_{unit}_{stage}_{번호}` | `miniboss_beg_mc_1_1_001` |
| 유닛 보스             | `unitboss_{level}_{type}_{unit}_{번호}`         | `unitboss_beg_os_1_001`   |
| 엔드보스              | `finalboss_{level}_{type}_p{phase}_{번호}`      | `finalboss_beg_fib_p3_001` |

```json
{
  "questions": [
    {
      "question_id": "q001",
      "unit": 1,
      "stage": "1-1",
      "course_level": "beginner",
      "difficulty": "easy",
      "type": "multiple_choice",
      "quiz_category": "stage_quiz",
      "is_boss": false,
      "question": "print()의 역할은 무엇인가요?",
      "choices": [
        "A. 값을 저장한다",
        "B. 값을 출력한다",
        "C. 값을 삭제한다",
        "D. 값을 계산한다"
      ],
      "answer": "B. 값을 출력한다",
      "hint": "화면에 무언가를 보여줄 때 쓰는 함수예요.",
      "feedback": {
        "correct": "맞아요! print()는 화면에 값을 출력합니다.",
      }
    },
    {
      "question_id": "boss_beg_mc_1_001",
      "unit": 1,
      "stage": "1-boss",
      "course_level": "beginner",
      "difficulty": "hard",
      "type": "multiple_choice",
      "quiz_category": "unit_boss",
      "is_boss": true,
      "question": "다음 중 Python에서 실행되지 않는 줄은?",
      "choices": [
        "A. print('에이몬')",
        "B. # print('에이몬')",
        "C. print('# 에이몬')",
        "D. print('에이몬') # 출력"
      ],
      "answer": "B",
      "hint": "줄 맨 앞에 # 이 붙으면 어떻게 될까요?",
      "feedback": {
        "correct": "정답! 줄 맨 앞에 # 이 붙으면 그 줄 전체가 주석이에요."
      }
    }
  ]
}
```

---

## 3. users.json

유저 정보

| 필드                     | 타입    | 허용값                                      | 필수 | 설명                                                             |
| ------------------------ | ------- | ------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `user_id`                | string  | UUID                                        | ✅   | 유저 고유 ID (백엔드 필드명: `id`)                               |
| `username`               | string  | -                                           | ✅   | 로그인 ID                                                        |
| `nickname`               | string  | -                                           | ✅   | 표시 이름                                                        |
| `course_level`           | string  | beginner / intermediate / advanced          | ✅   | 수강 레벨                                                        |
| `is_level_tested`        | boolean | true / false                                | ✅   | 레벨 테스트 완료 여부                                            |
| `character`              | string  | slime / robot / speech_bubble / final_ghost | ✅   | 현재 캐릭터 (회원가입 시 slime 고정, 레벨테스트 결과 무관)       |
| `xp`                     | number  | 0~                                          | ✅   | 보유 XP                                                          |
| `lv`                     | number  | 1~30+                                       | ✅   | 현재 레벨 (초급 1~10 / 중급 11~20 / 고급 21~30 / 리미트해제 30+) |
| `crowns`                 | number  | 0~                                          | ✅   | 보유 왕관 수 (기본값: 5)                                         |
| `daily_free_attempts`    | number  | 0~2                                         | ✅   | 오늘 남은 보스 무료 도전 횟수                                    |
| `last_free_attempt_date` | string  | YYYY-MM-DD                                  | ✅   | 마지막 보스 도전일 (무료 횟수 리셋 기준)                         |
| `completed_units`        | number  | 0~                                          | ✅   | 완료한 유닛 수 (캐릭터 진화 트리거)                              |
| `streak`                 | number  | 0~                                          | ✅   | 연속 접속일 (로그인 시 갱신)                                     |
| `last_login`             | string  | YYYY-MM-DD                                  | ✅   | 마지막 접속일 (streak 리셋 기준)                                 |
| `titles`                 | array   | string[]                                    | ✅   | 획득한 칭호 ID 목록 (기본값: `[]`)                               |
| `ai_feedback_count`      | number  | 0~                                          | ✅   | 오답 AI 피드백 누적 확인 횟수                                    |
| `endboss_cleared_levels` | array   | string[]                                    | ✅   | 클리어한 엔드보스 레벨 목록 — 중복 보상 방지. 예: `["beginner"]` |
| `endboss_seen_questions` | array   | string[]                                    | ✅   | 엔드보스 출제된 question_id — seen 문제 제외. 소진 시 리셋.      |
| `created_at`             | string  | ISO 8601                                    | ✅   | 가입 시각                                                        |

```json
{
  "user_id": "bb2fb53b-403d-4fbc-89b8-9bf4648f2f03",
  "username": "jinny",
  "nickname": "지니",
  "course_level": "beginner",
  "is_level_tested": true,
  "character": "slime",
  "xp": 500,
  "lv": 3,
  "crowns": 5,
  "daily_free_attempts": 2,
  "last_free_attempt_date": "2026-06-06",
  "completed_units": 0,
  "streak": 3,
  "last_login": "2026-06-06",
  "titles": ["first_step", "boss_slayer"],
  "ai_feedback_count": 12,
  "endboss_cleared_levels": [],
  "endboss_seen_questions": [],
  "created_at": "2026-06-01T10:00:00"
}
```

---

## 4. progress.json

유저 학습 진도 — **플랫 배열** 구조. 스테이지 완료 시마다 레코드 추가.

| 필드           | 타입    | 허용값       | 필수 | 설명                                             |
| -------------- | ------- | ------------ | ---- | ------------------------------------------------ |
| `id`           | string  | UUID         | ✅   | 레코드 고유 ID (자동 생성)                       |
| `user_id`      | string  | UUID         | ✅   | 유저 ID                                          |
| `unit`         | number  | 1~8          | ✅   | 유닛 번호                                        |
| `stage`        | string  | -            | ✅   | 스테이지 번호 (`"1-1"` ~ `"1-7"`, `"1-boss"` 등) |
| `score`        | number  | 0~100        | ✅   | 퀴즈 점수                                        |
| `is_completed` | boolean | true / false | ✅   | 완료 여부                                        |
| `checkpoint`   | string  | "miniboss_ready", "done" | ❌ | 스테이지 재진입(Resume)을 위한 중간 저장 지점 |
| `created_at`   | string  | ISO 8601     | ✅   | 최초 기록 시각                                   |
| `updated_at`   | string  | ISO 8601     | ✅   | 마지막 업데이트 시각                             |

> stage가 `"1-boss"`이면 유닛 보스 클리어 기록.

```json
[
  {
    "id": "d867a352-b3f0-46a8-ada3-03a49b657af2",
    "user_id": "bb2fb53b-403d-4fbc-89b8-9bf4648f2f03",
    "unit": 1,
    "stage": "1-1",
    "score": 100,
    "is_completed": true,
    "created_at": "2026-06-05T11:54:42.826289",
    "updated_at": "2026-06-05T11:54:42.826804"
  },
  {
    "id": "e923b123-...",
    "user_id": "bb2fb53b-403d-4fbc-89b8-9bf4648f2f03",
    "unit": 1,
    "stage": "1-boss",
    "score": 85,
    "is_completed": true,
    "created_at": "2026-06-06T09:00:00.000000",
    "updated_at": "2026-06-06T09:00:00.000000"
  }
]
```

---

## 5. BossAnswerRequest (유닛 보스 배틀)

> 유닛별 문제 커버 범위 및 유형 분포 상세: `AI_MON_UNITBOSS_QUESTIONS.md` 참고.
> 유닛 보스는 `error_find` 유형 포함 (beginner 1~7). 유닛 8은 `multiple_choice` 중심.

보스 전투 중 답안 제출 시 프론트에서 백엔드로 전달하는 필드.

| 필드          | 타입   | 기본값 | 설명               |
| ------------- | ------ | ------ | ------------------ |
| `question_id` | string | -      | 문제 ID            |
| `user_answer` | string | -      | 유저 답안          |
| `wrong_count` | number | 0      | 현재까지 틀린 횟수 |
| `my_hp`       | number | 1000   | 현재 내 HP         |
| `boss_hp`     | number | 1000   | 현재 보스 HP       |

**백엔드 응답 추가 필드:**

| 필드          | 타입    | 설명                           |
| ------------- | ------- | ------------------------------ |
| `my_hp`       | number  | 업데이트된 내 HP               |
| `boss_hp`     | number  | 업데이트된 보스 HP             |
| `wrong_count` | number  | 업데이트된 오답 횟수           |
| `is_clear`    | boolean | 보스 HP ≤ 0 → 클리어           |
| `is_fail`     | boolean | 내 HP ≤ 0 또는 오답 3번 → 실패 |

**HP 계산 규칙:**

```
정답: 보스 HP -150 / 내 HP 유지
오답: 내 HP -350 / 보스 HP 유지 / wrong_count +1
클리어 조건: boss_hp ≤ 0 (7문제 전부 정답)
실패 조건: my_hp ≤ 0 OR wrong_count ≥ 3
```

---

## 6. wrong_answers.json

오답 노트 (MVP 이후 활성화)

| 필드                             | 타입    | 허용값                                                       | 필수 | 설명                                      |
| -------------------------------- | ------- | ------------------------------------------------------------ | ---- | ----------------------------------------- |
| `user_id`                        | string  | -                                                            | ✅   | 유저 ID                                   |
| `wrong_answers[].question_id`    | string  | -                                                            | ✅   | 문제 ID                                   |
| `wrong_answers[].unit`           | number  | 1~8                                                          | ✅   | 유닛 번호                                 |
| `wrong_answers[].stage`          | string  | -                                                            | ✅   | 스테이지 번호                             |
| `wrong_answers[].course_level`   | string  | beginner / intermediate / advanced                           | ✅   | 수강 레벨                                 |
| `wrong_answers[].type`           | string  | multiple_choice / output_select / fill_in_blank / code_input / error_find | ✅   | 문제 유형                                 |
| `wrong_answers[].question`       | string  | -                                                            | ✅   | 문제 텍스트                               |
| `wrong_answers[].choices`        | array   | -                                                            | ❌   | 선택지                                    |
| `wrong_answers[].user_answer`    | string  | -                                                            | ✅   | 유저 답안                                 |
| `wrong_answers[].correct_answer` | string  | -                                                            | ✅   | 정답                                      |
| `wrong_answers[].ai_explanation` | string  | -                                                            | ❌   | Claude AI 설명 (저장해두면 재호출 불필요) |
| `wrong_answers[].wrong_count`    | number  | 1~                                                           | ✅   | 틀린 횟수                                 |
| `wrong_answers[].reviewed`       | boolean | true / false                                                 | ✅   | 오답노트 재풀이 여부                      |
| `wrong_answers[].last_wrong_at`  | string  | YYYY-MM-DD                                                   | ✅   | 마지막으로 틀린 날짜                      |
| `wrong_answers[].created_at`     | string  | YYYY-MM-DD                                                   | ✅   | 처음 틀린 날짜                            |

```json
{
  "user_id": "u001",
  "wrong_answers": [
    {
      "question_id": "q_1_1_easy",
      "unit": 1,
      "stage": "1-1",
      "course_level": "beginner",
      "type": "multiple_choice",
      "question": "print('Hello')를 실행하면 무엇이 출력될까요?",
      "choices": ["Hello", "'Hello'", "print(Hello)", "오류 발생"],
      "user_answer": "'Hello'",
      "correct_answer": "Hello",
      "ai_explanation": "",
      "wrong_count": 1,
      "reviewed": false,
      "last_wrong_at": "2026-06-02",
      "created_at": "2026-06-02"
    }
  ]
}
```

---

## 6. 실제 문제 데이터 (Unit 1 · Stage 1-1)

> Stage 1-1 실제 제작 문제. beginner / intermediate / advanced 레벨별 / 화면별 분리.

---

### beginner

**stage_quiz — multiple_choice**

```json
{
  "type": "stage_quiz",
  "level": "beginner",
  "quiz_type": "multiple_choice",
  "unit": 1,
  "stage": "1-1",
  "pass_score": 80,
  "questions": [
    {
      "question_id": "sl_beg_mc_1_1_001",
      "type": "multiple_choice",
      "question": "print()의 역할은 무엇인가요?",
      "choices": [
        "A. 값을 저장한다",
        "B. 값을 출력한다",
        "C. 값을 삭제한다",
        "D. 값을 계산한다"
      ],
      "answer": "B",
      "explanation": "print()는 괄호 안의 값을 화면에 출력하는 함수예요."
    },
    {
      "question_id": "sl_beg_mc_1_1_002",
      "type": "multiple_choice",
      "question": "Python에서 주석을 작성할 때 사용하는 기호는?",
      "choices": ["A. //", "B. --", "C. #", "D. /*"],
      "answer": "C",
      "explanation": "# 뒤에 오는 내용은 Python이 무시해요."
    },
    {
      "question_id": "sl_beg_mc_1_1_003",
      "type": "multiple_choice",
      "question": "다음 중 올바른 print() 사용법은?",
      "choices": [
        "A. print[Hello]",
        "B. print Hello",
        "C. print('Hello')",
        "D. Print('Hello')"
      ],
      "answer": "C",
      "explanation": "print()는 소문자, 출력 내용은 괄호 안에 따옴표로 감싸야 해요."
    }
  ]
}
```

**stage_quiz — multiple_choice**

```json
{
  "type": "stage_quiz",
  "level": "beginner",
  "quiz_type": "multiple_choice",
  "unit": 1,
  "stage": "1-1",
  "villain": "codemmon",
  "pass_score": 80,
  "questions": [
    {
      "question_id": "cc_beg_mc_1_1_001",
      "question": "print('에이몬') 을 실행하면 화면에 무엇이 출력될까요?",
      "choices": [
        "A. '에이몬'",
        "B. 에이몬",
        "C. print(에이몬)",
        "D. 오류 발생"
      ],
      "answer": "B",
      "explanation": "따옴표는 문자열 표시일 뿐이에요. 화면엔 따옴표 없이 에이몬만 출력돼요."
    },
    {
      "question_id": "cc_beg_mc_1_1_002",
      "question": "다음 중 주석 처리된 줄은?",
      "choices": [
        "A. print('Hello')",
        "B. # print('Hello')",
        "C. //print('Hello')",
        "D. --print('Hello')"
      ],
      "answer": "B",
      "explanation": "# 기호가 앞에 붙으면 그 줄 전체가 주석이 돼요."
    }
  ]
}
```

**boss — multiple_choice + output_select**

```json
{
  "type": "unit_boss",
  "level": "beginner",
  "unit": 1,
  "boss_name": "코드몬 Unit 1 유닛 보스",
  "pass_score": 80,
  "free_attempts_per_day": 2,
  "crown_cost_from_attempt": 3,
  "hints_allowed": 2,
  "xp_reward": 2000,
  "questions": [
    {
      "question_id": "boss_beg_mc_1_001",
      "type": "multiple_choice",
      "question": "다음 중 Python에서 실행되지 않는 줄은?",
      "choices": [
        "A. print('에이몬')",
        "B. # print('에이몬')",
        "C. print('# 에이몬')",
        "D. print('에이몬') # 출력"
      ],
      "answer": "B",
      "explanation": "줄 맨 앞에 # 이 붙으면 그 줄 전체가 주석이에요."
    },
    {
      "question_id": "boss_beg_os_1_001",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nprint('코드몬' + '을' + ' 물리쳐라!')\n# print('게임 오버')\nprint('승리!')",
      "choices": [
        "A. 코드몬을 물리쳐라! / 게임 오버 / 승리!",
        "B. 코드몬을 물리쳐라! / 승리!",
        "C. 코드몬 + 을 + 물리쳐라! / 승리!",
        "D. 오류 발생"
      ],
      "answer": "B",
      "explanation": "+ 는 문자열을 이어붙이고, # 주석 줄은 무시돼요."
    }
  ]
}
```

**final_boss — output_select + fill_in_blank (hints_allowed: 0)**

```json
{
  "type": "final_boss",
  "level": "beginner",
  "boss_name": "파이널 보스 — 검정 에이몬",
  "unlock_condition": "Unit 8 보스 클리어 후 해금",
  "hints_allowed": 0,
  "xp_reward": 5000,
  "questions": [
    {
      "question_id": "fb_beg_os_001",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nname = '에이몬'\nlevel = 8\nprint(f'{name}이 Lv.{level}로 최종 진화했습니다!')\n# print('슬라임 시절이 그립다')\nprint('축하합니다!')",
      "choices": [
        "A. 에이몬이 Lv.8로 최종 진화했습니다! / 슬라임 시절이 그립다 / 축하합니다!",
        "B. 에이몬이 Lv.8로 최종 진화했습니다! / 축하합니다!",
        "C. {name}이 Lv.{level}로 최종 진화했습니다! / 축하합니다!",
        "D. 오류 발생"
      ],
      "answer": "B",
      "explanation": "f-string은 {} 안의 변수를 값으로 치환해요. # 주석은 무시됩니다."
    },
    {
      "question_id": "fb_beg_fib_001",
      "type": "fill_in_blank",
      "question": "빈칸을 채워 '에이몬 최종 진화 완료!' 를 출력하세요.\n\n_____('에이몬 최종 진화 완료!')",
      "answer": "print",
      "explanation": "print() 함수를 사용하면 괄호 안의 내용을 화면에 출력할 수 있어요."
    }
  ]
}
```

---

### intermediate

**stage_quiz — multiple_choice + output_select**

```json
{
  "type": "stage_quiz",
  "level": "intermediate",
  "quiz_type": "multiple_choice",
  "unit": 1,
  "stage": "1-1",
  "pass_score": 80,
  "questions": [
    {
      "question_id": "sl_mid_mc_1_1_001",
      "question": "print()에서 쉼표(,)와 + 의 차이로 올바른 것은?",
      "choices": [
        "A. 둘 다 공백 없이 이어붙인다",
        "B. + 는 공백 추가, 쉼표는 공백 없음",
        "C. 쉼표는 자동 공백 추가, + 는 공백 없이 이어붙임",
        "D. 둘 다 동일하게 동작한다"
      ],
      "answer": "C",
      "explanation": "쉼표(,)로 구분하면 print()가 값 사이에 공백을 자동 삽입합니다."
    },
    {
      "question_id": "sl_mid_os_1_1_001",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nprint('에이몬', 'Lv', 5)\nprint('에이몬' + 'Lv' + str(5))",
      "choices": [
        "A. 에이몬 Lv 5 / 에이몬Lv5",
        "B. 에이몬Lv5 / 에이몬 Lv 5",
        "C. 에이몬 Lv 5 / 에이몬 Lv 5",
        "D. 오류 발생"
      ],
      "answer": "A",
      "explanation": "쉼표는 공백 자동 삽입, + 는 공백 없이 연결이에요."
    }
  ]
}
```

**boss — output_select + fill_in_blank**

```json
{
  "type": "boss",
  "level": "intermediate",
  "unit": 1,
  "pass_score": 80,
  "free_attempts_per_day": 2,
  "crown_cost_from_attempt": 3,
  "hints_allowed": 2,
  "xp_reward": 2000,
  "questions": [
    {
      "question_id": "boss_mid_os_1_001",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nname = '에이몬'\nhp = 100\nprint(f'{name}의 HP: {hp - 30}')\n# print('공격 받음!')\nprint(f'남은 HP: {hp - 30}')",
      "choices": [
        "A. 에이몬의 HP: 100 / 공격 받음! / 남은 HP: 70",
        "B. 에이몬의 HP: 70 / 남은 HP: 70",
        "C. 에이몬의 HP: {hp - 30} / 남은 HP: {hp - 30}",
        "D. 오류 발생"
      ],
      "answer": "B",
      "explanation": "f-string {} 안 연산식이 계산되어 출력돼요. # 주석은 무시됩니다."
    },
    {
      "question_id": "boss_mid_fib_1_001",
      "type": "fill_in_blank",
      "question": "빈칸을 채워 f-string으로 출력하세요.\n\nxp = 2000\nprint(___'에이몬 보스 클리어! XP: {xp}')",
      "answer": "f",
      "explanation": "f-string은 문자열 앞에 f를 붙여요."
    }
  ]
}
```

---

### advanced

**stage_quiz — output_select + fill_in_blank**

```json
{
  "type": "stage_quiz",
  "level": "advanced",
  "unit": 1,
  "stage": "1-1",
  "pass_score": 80,
  "questions": [
    {
      "question_id": "sl_adv_os_1_1_001",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nfor i in range(3):\n    print(i, end='-')\nprint('끝')",
      "choices": [
        "A. 0-1-2-끝",
        "B. 0 / 1 / 2 / 끝",
        "C. 0-1-2- / 끝",
        "D. 012-끝"
      ],
      "answer": "A",
      "explanation": "end='-'로 줄바꿈 대신 - 가 붙어요."
    },
    {
      "question_id": "sl_adv_fib_1_1_001",
      "type": "fill_in_blank",
      "question": "print()가 여러 값을 | 로 구분해 출력하게 빈칸을 채우세요.\n출력 목표: 에이몬|로봇|고스트\n\nprint('에이몬', '로봇', '고스트', _____='|')",
      "answer": "sep",
      "explanation": "sep 파라미터는 여러 값 사이 구분자를 지정해요."
    }
  ]
}
```

**boss — fill_in_blank + code_input**

```json
{
  "type": "boss",
  "level": "advanced",
  "unit": 1,
  "pass_score": 80,
  "hints_allowed": 2,
  "xp_reward": 2000,
  "pyodide_eval": true,
  "questions": [
    {
      "question_id": "boss_adv_fib_1_001",
      "type": "fill_in_blank",
      "question": "빈칸을 채워 숫자를 소수점 3자리로 포맷해 출력하세요.\n\nscore = 98.7564\nprint(f'스코어: {score:_____}')",
      "answer": ".3f",
      "explanation": ":.3f는 소수점 아래 3자리까지 반올림하여 출력해요."
    },
    {
      "question_id": "boss_adv_ci_1_001",
      "type": "code_input",
      "question": "리스트 [1, 2, 3, 4, 5]를 한 줄에 공백으로 구분 출력. print() 한 번만 사용.\n출력 목표: 1 2 3 4 5",
      "answer": "print(*[1, 2, 3, 4, 5])",
      "pyodide_eval": true
    }
  ]
}
```

**final_boss — code_input 위주 (hints_allowed: 0)**

```json
{
  "type": "final_boss",
  "level": "advanced",
  "hints_allowed": 0,
  "xp_reward": 5000,
  "pyodide_eval": true,
  "questions": [
    {
      "question_id": "fb_adv_ci_001",
      "type": "code_input",
      "question": "함수 show_status(name, level, hp) 정의\nshow_status('에이몬', 40, 9999) 호출\n출력 목표: [ 에이몬 ] Lv.40 | HP: 9999",
      "answer": "def show_status(name, level, hp):\n    print(f'[ {name} ] Lv.{level} | HP: {hp}')\n\nshow_status('에이몬', 40, 9999)",
      "pyodide_eval": true
    },
    {
      "question_id": "fb_adv_ci_002",
      "type": "code_input",
      "question": "scores = [72, 88, 95, 61, 100]에서 80점 이상만 필터링 출력\n출력 목표: 88 / 95 / 100",
      "answer": "scores = [72, 88, 95, 61, 100]\nfor score in scores:\n    if score >= 80:\n        print(score)",
      "pyodide_eval": true
    }
  ]
}
```

---

## 7. 칭호 시스템

유저가 특정 조건을 달성했을 때 획득하는 칭호. `users.json`의 `titles` 배열에 ID로 저장.

### 칭호 목록

#### 일반 칭호

| 칭호 ID        | 이름             | 조건                     | 체크 시점                                                       |
| -------------- | ---------------- | ------------------------ | --------------------------------------------------------------- |
| `first_step`   | 🌱 첫 발걸음     | 첫 스테이지 클리어       | `POST /progress/` — 첫 `is_completed: true` 저장 시             |
| `streak_7`     | 🔥 연속학습자    | 7일 연속 스트릭          | `POST /auth/login` — `streak >= 7` 확인 시                      |
| `boss_slayer`  | ⚔️ 보스슬레이어  | 첫 보스 클리어           | `POST /boss/answer` — `is_clear: true` 최초 시                  |
| `ai_explorer`  | 🧠 AI 탐구자     | 오답 AI 피드백 10회 확인 | `POST /quiz/ai-feedback` — `ai_feedback_count >= 10` 도달 시    |
| `unit_master`  | 👑 유닛 마스터   | 유닛 1개 100% 완료       | `POST /progress/` — 유닛 내 스테이지 1~7 + 보스 전부 완료 시    |
| `aimon_master` | 💎 에이몬 마스터 | Lv.30 달성               | `POST /progress/` 또는 `POST /boss/answer` — `lv >= 30` 확인 시 |

#### 엔드보스 클리어 칭호

| 칭호 ID            | 이름          | 조건                        | 체크 시점                                        |
| ------------------ | ------------- | --------------------------- | ------------------------------------------------ |
| `rookie_coder`     | 코드 ROOKIE   | beginner 엔드보스 클리어    | `POST /boss/endboss/clear` — beginner 최초 클리어 |
| `ace_coder`        | ACE 코더      | intermediate 엔드보스 클리어 | `POST /boss/endboss/clear` — intermediate 최초   |
| `ai_master`        | AI 마스터     | advanced 엔드보스 클리어    | `POST /boss/endboss/clear` — advanced 최초       |

#### 히든 칭호

조건 달성 시 자동 지급. 칭호 목록 UI에는 잠금 상태로만 표시 (조건 미노출).

| 칭호 ID          | 이름           | 조건                                                                    | 구현 위치        |
| ---------------- | -------------- | ----------------------------------------------------------------------- | ---------------- |
| `solo_player`    | Solo Player    | AI 힌트/가이드 한 번도 클릭 안 하고 문제 맞춤                           | 프론트엔드 추적 → 백엔드 플래그 |
| `early_bird`     | Early Bird     | 새벽 5~7시 접속 + 스테이지 퀴즈 완료                                   | 백엔드 (login 시각 + progress 타임스탬프 비교) |
| `weekend_warrior`| Weekend Warrior | 금~일 3일 연속 매일 3개 이상 스테이지 클리어                           | 백엔드 (progress 타임스탬프 분석) |
| `time_traveler`  | Time Traveler  | 한 문제 창 켜둔 채 2시간 이상 고민 후 성공                              | 프론트엔드 추적 (페이지 체류 타이머) |
| `unstoppable`    | Unstoppable    | 하루 안에 유닛 1개 전체 클리어                                          | 백엔드 (progress created_at 날짜 비교) |
| `phoenix`           | Phoenix           | 동일 문제에서 20회 이상 오답 후 성공                             | 프론트엔드 추적 (오답 카운터) |
| `furious_typer`     | Furious Typer     | 백스페이스 고속 연타로 코드를 갈아엎는 행위 감지                  | 프론트엔드 추적 (키보드 이벤트) |
| `whitespace_phobia` | Whitespace Phobia | IndentationError 5회 이상 연속 후 성공                          | 프론트엔드 추적 (Pyodide 에러 타입) |

### 칭호 획득 응답 형식

칭호를 새로 획득한 경우 해당 엔드포인트 응답에 `newly_earned_titles` 필드 포함:

```json
{
  "message": "진행상황이 저장되었습니다.",
  "xp_awarded": 2000,
  "newly_earned_titles": [{ "id": "first_step", "name": "🌱 첫 발걸음" }]
}
```

획득 칭호가 없으면 `newly_earned_titles: []`.

### 칭호 체크 헬퍼 함수 (백엔드 공통)

```python
TITLE_DEFINITIONS = {
    # 일반
    "first_step":       "🌱 첫 발걸음",
    "streak_7":         "🔥 연속학습자",
    "boss_slayer":      "⚔️ 보스슬레이어",
    "ai_explorer":      "🧠 AI 탐구자",
    "unit_master":      "👑 유닛 마스터",
    "aimon_master":     "💎 에이몬 마스터",
    # 엔드보스
    "rookie_coder":     "코드 ROOKIE",
    "ace_coder":        "ACE 코더",
    "ai_master":        "AI 마스터",
    # 히든
    "solo_player":      "Solo Player",
    "early_bird":       "Early Bird",
    "weekend_warrior":  "Weekend Warrior",
    "time_traveler":    "Time Traveler",
    "unstoppable":      "Unstoppable",
    "phoenix":             "Phoenix",
    "furious_typer":       "Furious Typer",
    "whitespace_phobia":   "Whitespace Phobia",
}

def check_and_award_titles(user: dict, context: dict) -> list[dict]:
    """
    user    : users.json의 유저 객체 (이미 최신 상태)
    context : 호출 시점별 힌트 딕셔너리
              - "stage_completed": bool  → first_step 체크
              - "boss_cleared": bool     → boss_slayer 체크
              - "unit_fully_done": bool  → unit_master 체크
    반환: 이번에 새로 획득한 칭호 리스트 [{"id": ..., "name": ...}, ...]
    """
    earned = set(user.get("titles", []))
    newly = []

    def award(title_id):
        if title_id not in earned:
            earned.add(title_id)
            newly.append({"id": title_id, "name": TITLE_DEFINITIONS[title_id]})

    if context.get("stage_completed"):
        award("first_step")

    if user.get("streak", 0) >= 7:
        award("streak_7")

    if context.get("boss_cleared"):
        award("boss_slayer")

    if user.get("ai_feedback_count", 0) >= 10:
        award("ai_explorer")

    if context.get("unit_fully_done"):
        award("unit_master")

    if user.get("lv", 1) >= 30:
        award("aimon_master")

    user["titles"] = list(earned)
    return newly
```
