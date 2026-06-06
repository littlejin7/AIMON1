---
notion_page: https://app.notion.com/p/AI-MON-SCHEMA-373ea473fb4581968fa1fb9a1ba08a83
title: AI MON SCHEMA
---
# AI MON 데이터 스키마
> 각 JSON 파일의 필드 정의 + 예시. 문제 데이터 제작 및 개발 연동 시 기준 문서.

---

## 1. lessons.json (유닛 목록)

메인 홈 화면의 유닛 리스트에 표시되는 각 레슨의 메타데이터입니다.

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `unit_id` | number | ✅ | 유닛 번호 (예: `1`) |
| `title` | string | ✅ | 유닛 제목 (예: `"파이썬 첫걸음"`) |
| `description` | string | ✅ | 유닛 설명 |
| `stages` | number | ✅ | 해당 유닛에 속한 스테이지 수 (예: `4`) |
| `boss_stage` | number | ✅ | 보스 스테이지 번호 (예: `5`) |
| `icon` | string | ✅ | 카드 아이콘 이모지 (예: `"🖨️"`) |
| `keywords` | array | ✅ | 해시태그 목록 (예: `["print", "변수"]`) |
| `evolution` | string | ✅ | 이 유닛을 깨면 진화하는 펫 단계 (예: `"slime"`) |
| `difficulty` | string | ✅ | 난이도 라벨 (예: `"입문"`) |

---

## 1-1. lessons/ 폴더 (브리핑 슬라이드 데이터)

브리핑 슬라이드 데이터 — 스테이지 × 레벨별 개념 설명

### 📁 파일 관리 구조

```
backend/data/lessons/
├── unit_1.json   ← Unit 1의 모든 스테이지 × 레벨 슬라이드
├── unit_2.json
...
└── unit_8.json
```

각 파일은 **배열** 형태로, 하나의 유닛 내 모든 `stage × course_level` 조합을 담아요.  
백엔드가 `lessons/` 폴더 내 파일을 자동으로 읽어 합쳐 서빙합니다.

---

### 필드 정의

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `lesson_id` | string | ✅ | `"{stage}-{course_level}"` 형식 (예: `"1-1-beginner"`) |
| `unit` | number | ✅ | 유닛 번호 (1~8) |
| `stage` | string | ✅ | 스테이지 번호 (예: `"1-1"`) |
| `course_level` | string | ✅ | 수강 레벨: `beginner` / `intermediate` / `advanced` |
| `title` | string | ✅ | 스테이지 제목 |
| `villain` | string | ✅ | 등장 악당 (`codemmon` / `speechbubble_king` / `interferencemon`) |
| `slides` | array | ✅ | 슬라이드 목록 |
| `slides[].order` | number | ✅ | 슬라이드 순서 |
| `slides[].text` | string | ✅ | 개념 설명 텍스트 |
| `slides[].terminal` | object | ❌ | 터미널 예시 (없을 수도 있음) |
| `slides[].terminal.code` | array | ❌ | 코드 라인 배열 |
| `slides[].terminal.output` | array | ❌ | 실행 결과 배열 |
| `slides[].tip` | string | ❌ | 하단 팁 텍스트 |

---

### 레벨별 교육 전략

| `course_level` | 교육 전략 | Stage 1-1 기준 핵심 개념 |
|---|---|---|
| `beginner` | 비유 중심, 개념 하나씩, 쉬운 언어 | print() = 스피커 비유, 따옴표 역할, 주석 기초(`#`) |
| `intermediate` | 실용적 비교, 차이 중심 | `,` vs `+` 공백 차이, `str()` 타입 변환, 인라인 주석 |
| `advanced` | 파라미터 깊이, Pythonic 패턴 | `sep`/`end` 파라미터, f-string 포맷, `*` 언패킹 |

> 같은 `stage` 내에서 `course_level`만 달라지고, `title`·`villain`은 동일해요.

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


## 2. questions.json

퀴즈 문제 데이터 — 스테이지 퀴즈 + 보스 문제 통합 관리

| 필드 | 타입 | 허용값 | 필수 | 설명 |
|---|---|---|---|---|
| `question_id` | string | - | ✅ | 문제 ID. 스테이지: `q{번호}` / 보스: `boss_{level}_{type}_{unit}_{번호}` |
| `unit` | number | 1~8 | ✅ | 유닛 번호 |
| `stage` | string | - | ✅ | 스테이지 번호 (`"1-1"` ~ `"1-7"`: 스테이지, `"1-boss"`: 유닛 보스, `"final-boss"`: 파이널 보스) |
| `course_level` | string | beginner / intermediate / advanced | ✅ | 수강 레벨 |
| `difficulty` | string | easy / medium / hard | ✅ | 문제 난이도 |
| `type` | string | multiple_choice / output_select / fill_in_blank / code_input | ✅ | 문제 형식 (출력 방식) |
| `quiz_category` | string | stage_quiz / miniboss / unit_boss / final_boss | ✅ | 문제 세트 유형 (흐름상 위치) |
| `is_boss` | boolean | true / false | ✅ | 유닛 보스 / 파이널 보스 여부 (`stage: "1-boss"` 와 함께 사용) |
| `question` | string | - | ✅ | 문제 텍스트 |
| `choices` | array | - | ❌ | 선택지 (multiple_choice / output_select만 해당, fill_in_blank는 빈 배열) |
| `answer` | string | - | ✅ | 정답 |
| `hint` | string | - | ✅ | 힌트 텍스트 |
| `feedback.correct` | string | - | ✅ | 정답 시 출력 텍스트 (API 호출 없음) |
| `feedback.wrong` | string | - | ✅ | 오답 시 기본 텍스트 → Claude API로 대체 |

> `stage: "1-boss"` + `is_boss: true` 조합으로 보스 문제 구분.

### question_id 네이밍 규칙

| 구분 | 패턴 | 예시 |
|---|---|---|
| 스테이지 beginner | `q{세자리}` | `q001`, `q002`, `q003` |
| 스테이지 intermediate | `q{1로 시작 세자리}` | `q101`, `q102`, `q103` |
| 스테이지 advanced | `q{2로 시작 세자리}` | `q201`, `q202`, `q203` |
| 스테이지 미니보스 | `miniboss_{level}_{type}_{unit}_{stage}_{번호}` | `miniboss_beg_mc_1_1_001` |
| 유닛 보스 | `unitboss_{level}_{type}_{unit}_{번호}` | `unitboss_beg_os_1_001` |
| 파이널 보스 | `finalboss_{level}_{type}_{번호}` | `finalboss_beg_fib_001` |

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
      "choices": ["A. 값을 저장한다", "B. 값을 출력한다", "C. 값을 삭제한다", "D. 값을 계산한다"],
      "answer": "B. 값을 출력한다",
      "hint": "화면에 무언가를 보여줄 때 쓰는 함수예요.",
      "feedback": {
        "correct": "맞아요! print()는 화면에 값을 출력합니다.",
        "wrong": "print()는 화면에 글자나 숫자를 보여주기 위해 사용해요."
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
      "choices": ["A. print('에이몬')", "B. # print('에이몬')", "C. print('# 에이몬')", "D. print('에이몬') # 출력"],
      "answer": "B",
      "hint": "줄 맨 앞에 # 이 붙으면 어떻게 될까요?",
      "feedback": {
        "correct": "정답! 줄 맨 앞에 # 이 붙으면 그 줄 전체가 주석이에요.",
        "wrong": "줄 맨 앞에 # 이 붙으면 그 줄 전체가 주석이에요."
      }
    }
  ]
}
```

---

## 3. users.json

유저 정보

| 필드 | 타입 | 허용값 | 필수 | 설명 |
|---|---|---|---|---|
| `user_id` | string | UUID | ✅ | 유저 고유 ID (백엔드 필드명: `id`) |
| `username` | string | - | ✅ | 로그인 ID |
| `nickname` | string | - | ✅ | 표시 이름 |
| `course_level` | string | beginner / intermediate / advanced | ✅ | 수강 레벨 |
| `is_level_tested` | boolean | true / false | ✅ | 레벨 테스트 완료 여부 |
| `character` | string | slime / robot / speech_bubble / final_ghost | ✅ | 현재 캐릭터 (회원가입 시 slime 고정, 레벨테스트 결과 무관) |
| `xp` | number | 0~ | ✅ | 보유 XP |
| `lv` | number | 1~30+ | ✅ | 현재 레벨 (초급 1~10 / 중급 11~20 / 고급 21~30 / 리미트해제 30+) |
| `crowns` | number | 0~ | ✅ | 보유 왕관 수 (기본값: 5) |
| `daily_free_attempts` | number | 0~2 | ✅ | 오늘 남은 보스 무료 도전 횟수 |
| `last_free_attempt_date` | string | YYYY-MM-DD | ✅ | 마지막 보스 도전일 (무료 횟수 리셋 기준) |
| `completed_units` | number | 0~ | ✅ | 완료한 유닛 수 (캐릭터 진화 트리거) |
| `streak` | number | 0~ | 🚧 | 연속 접속일 (미구현) |
| `last_login` | string | YYYY-MM-DD | 🚧 | 마지막 접속일 (미구현) |
| `created_at` | string | ISO 8601 | ✅ | 가입 시각 |

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
  "created_at": "2026-06-01T10:00:00"
}
```

---

## 4. progress.json

유저 학습 진도 — **플랫 배열** 구조. 스테이지 완료 시마다 레코드 추가.

| 필드 | 타입 | 허용값 | 필수 | 설명 |
|---|---|---|---|---|
| `id` | string | UUID | ✅ | 레코드 고유 ID (자동 생성) |
| `user_id` | string | UUID | ✅ | 유저 ID |
| `unit` | number | 1~8 | ✅ | 유닛 번호 |
| `stage` | string | - | ✅ | 스테이지 번호 (`"1-1"` ~ `"1-7"`, `"1-boss"` 등) |
| `score` | number | 0~100 | ✅ | 퀴즈 점수 |
| `is_completed` | boolean | true / false | ✅ | 완료 여부 |
| `created_at` | string | ISO 8601 | ✅ | 최초 기록 시각 |
| `updated_at` | string | ISO 8601 | ✅ | 마지막 업데이트 시각 |

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

## 5. wrong_answers.json

오답 노트 (MVP 이후 활성화)

| 필드 | 타입 | 허용값 | 필수 | 설명 |
|---|---|---|---|---|
| `user_id` | string | - | ✅ | 유저 ID |
| `wrong_answers[].question_id` | string | - | ✅ | 문제 ID |
| `wrong_answers[].unit` | number | 1~8 | ✅ | 유닛 번호 |
| `wrong_answers[].stage` | string | - | ✅ | 스테이지 번호 |
| `wrong_answers[].course_level` | string | beginner / intermediate / advanced | ✅ | 수강 레벨 |
| `wrong_answers[].type` | string | multiple_choice / output_select / fill_in_blank / code_input | ✅ | 문제 유형 |
| `wrong_answers[].question` | string | - | ✅ | 문제 텍스트 |
| `wrong_answers[].choices` | array | - | ❌ | 선택지 |
| `wrong_answers[].user_answer` | string | - | ✅ | 유저 답안 |
| `wrong_answers[].correct_answer` | string | - | ✅ | 정답 |
| `wrong_answers[].ai_explanation` | string | - | ❌ | Claude AI 설명 (저장해두면 재호출 불필요) |
| `wrong_answers[].wrong_count` | number | 1~ | ✅ | 틀린 횟수 |
| `wrong_answers[].reviewed` | boolean | true / false | ✅ | 오답노트 재풀이 여부 |
| `wrong_answers[].last_wrong_at` | string | YYYY-MM-DD | ✅ | 마지막으로 틀린 날짜 |
| `wrong_answers[].created_at` | string | YYYY-MM-DD | ✅ | 처음 틀린 날짜 |

```json
{
  "user_id": "u001",
  "wrong_answers": [{
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
  }]
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
  "type": "stage_quiz", "level": "beginner", "quiz_type": "multiple_choice",
  "unit": 1, "stage": "1-1", "pass_score": 80,
  "questions": [
    { "question_id": "sl_beg_mc_1_1_001", "type": "multiple_choice",
      "question": "print()의 역할은 무엇인가요?",
      "choices": ["A. 값을 저장한다","B. 값을 출력한다","C. 값을 삭제한다","D. 값을 계산한다"],
      "answer": "B", "explanation": "print()는 괄호 안의 값을 화면에 출력하는 함수예요." },
    { "question_id": "sl_beg_mc_1_1_002", "type": "multiple_choice",
      "question": "Python에서 주석을 작성할 때 사용하는 기호는?",
      "choices": ["A. //","B. --","C. #","D. /*"],
      "answer": "C", "explanation": "# 뒤에 오는 내용은 Python이 무시해요." },
    { "question_id": "sl_beg_mc_1_1_003", "type": "multiple_choice",
      "question": "다음 중 올바른 print() 사용법은?",
      "choices": ["A. print[Hello]","B. print Hello","C. print('Hello')","D. Print('Hello')"],
      "answer": "C", "explanation": "print()는 소문자, 출력 내용은 괄호 안에 따옴표로 감싸야 해요." }
  ]
}
```

**stage_quiz — multiple_choice**

```json
{
  "type": "stage_quiz", "level": "beginner", "quiz_type": "multiple_choice",
  "unit": 1, "stage": "1-1", "villain": "codemmon", "pass_score": 80,
  "questions": [
    { "question_id": "cc_beg_mc_1_1_001",
      "question": "print('에이몬') 을 실행하면 화면에 무엇이 출력될까요?",
      "choices": ["A. '에이몬'","B. 에이몬","C. print(에이몬)","D. 오류 발생"],
      "answer": "B", "explanation": "따옴표는 문자열 표시일 뿐이에요. 화면엔 따옴표 없이 에이몬만 출력돼요." },
    { "question_id": "cc_beg_mc_1_1_002",
      "question": "다음 중 주석 처리된 줄은?",
      "choices": ["A. print('Hello')","B. # print('Hello')","C. //print('Hello')","D. --print('Hello')"],
      "answer": "B", "explanation": "# 기호가 앞에 붙으면 그 줄 전체가 주석이 돼요." }
  ]
}
```

**boss — multiple_choice + output_select**

```json
{
  "type": "unit_boss", "level": "beginner", "unit": 1, "boss_name": "코드몬 Unit 1 유닛 보스",
  "pass_score": 80, "free_attempts_per_day": 2, "crown_cost_from_attempt": 3,
  "hints_allowed": 2, "xp_reward": 2000,
  "questions": [
    { "question_id": "boss_beg_mc_1_001", "type": "multiple_choice",
      "question": "다음 중 Python에서 실행되지 않는 줄은?",
      "choices": ["A. print('에이몬')","B. # print('에이몬')","C. print('# 에이몬')","D. print('에이몬') # 출력"],
      "answer": "B", "explanation": "줄 맨 앞에 # 이 붙으면 그 줄 전체가 주석이에요." },
    { "question_id": "boss_beg_os_1_001", "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nprint('코드몬' + '을' + ' 물리쳐라!')\n# print('게임 오버')\nprint('승리!')",
      "choices": ["A. 코드몬을 물리쳐라! / 게임 오버 / 승리!","B. 코드몬을 물리쳐라! / 승리!","C. 코드몬 + 을 + 물리쳐라! / 승리!","D. 오류 발생"],
      "answer": "B", "explanation": "+ 는 문자열을 이어붙이고, # 주석 줄은 무시돼요." }
  ]
}
```

**final_boss — output_select + fill_in_blank (hints_allowed: 0)**

```json
{
  "type": "final_boss", "level": "beginner", "boss_name": "파이널 보스 — 검정 에이몬",
  "unlock_condition": "Unit 8 보스 클리어 후 해금", "hints_allowed": 0, "xp_reward": 5000,
  "questions": [
    { "question_id": "fb_beg_os_001", "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nname = '에이몬'\nlevel = 8\nprint(f'{name}이 Lv.{level}로 최종 진화했습니다!')\n# print('슬라임 시절이 그립다')\nprint('축하합니다!')",
      "choices": ["A. 에이몬이 Lv.8로 최종 진화했습니다! / 슬라임 시절이 그립다 / 축하합니다!","B. 에이몬이 Lv.8로 최종 진화했습니다! / 축하합니다!","C. {name}이 Lv.{level}로 최종 진화했습니다! / 축하합니다!","D. 오류 발생"],
      "answer": "B", "explanation": "f-string은 {} 안의 변수를 값으로 치환해요. # 주석은 무시됩니다." },
    { "question_id": "fb_beg_fib_001", "type": "fill_in_blank",
      "question": "빈칸을 채워 '에이몬 최종 진화 완료!' 를 출력하세요.\n\n_____('에이몬 최종 진화 완료!')",
      "answer": "print", "explanation": "print() 함수를 사용하면 괄호 안의 내용을 화면에 출력할 수 있어요." }
  ]
}
```

---

### intermediate

**stage_quiz — multiple_choice + output_select**

```json
{
  "type": "stage_quiz", "level": "intermediate", "quiz_type": "multiple_choice",
  "unit": 1, "stage": "1-1", "pass_score": 80,
  "questions": [
    { "question_id": "sl_mid_mc_1_1_001",
      "question": "print()에서 쉼표(,)와 + 의 차이로 올바른 것은?",
      "choices": ["A. 둘 다 공백 없이 이어붙인다","B. + 는 공백 추가, 쉼표는 공백 없음","C. 쉼표는 자동 공백 추가, + 는 공백 없이 이어붙임","D. 둘 다 동일하게 동작한다"],
      "answer": "C", "explanation": "쉼표(,)로 구분하면 print()가 값 사이에 공백을 자동 삽입합니다." },
    { "question_id": "sl_mid_os_1_1_001", "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nprint('에이몬', 'Lv', 5)\nprint('에이몬' + 'Lv' + str(5))",
      "choices": ["A. 에이몬 Lv 5 / 에이몬Lv5","B. 에이몬Lv5 / 에이몬 Lv 5","C. 에이몬 Lv 5 / 에이몬 Lv 5","D. 오류 발생"],
      "answer": "A", "explanation": "쉼표는 공백 자동 삽입, + 는 공백 없이 연결이에요." }
  ]
}
```

**boss — output_select + fill_in_blank**

```json
{
  "type": "boss", "level": "intermediate", "unit": 1,
  "pass_score": 80, "free_attempts_per_day": 2, "crown_cost_from_attempt": 3,
  "hints_allowed": 2, "xp_reward": 2000,
  "questions": [
    { "question_id": "boss_mid_os_1_001", "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nname = '에이몬'\nhp = 100\nprint(f'{name}의 HP: {hp - 30}')\n# print('공격 받음!')\nprint(f'남은 HP: {hp - 30}')",
      "choices": ["A. 에이몬의 HP: 100 / 공격 받음! / 남은 HP: 70","B. 에이몬의 HP: 70 / 남은 HP: 70","C. 에이몬의 HP: {hp - 30} / 남은 HP: {hp - 30}","D. 오류 발생"],
      "answer": "B", "explanation": "f-string {} 안 연산식이 계산되어 출력돼요. # 주석은 무시됩니다." },
    { "question_id": "boss_mid_fib_1_001", "type": "fill_in_blank",
      "question": "빈칸을 채워 f-string으로 출력하세요.\n\nxp = 2000\nprint(___'에이몬 보스 클리어! XP: {xp}')",
      "answer": "f", "explanation": "f-string은 문자열 앞에 f를 붙여요." }
  ]
}
```

---

### advanced

**stage_quiz — output_select + fill_in_blank**

```json
{
  "type": "stage_quiz", "level": "advanced", "unit": 1, "stage": "1-1", "pass_score": 80,
  "questions": [
    { "question_id": "sl_adv_os_1_1_001", "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nfor i in range(3):\n    print(i, end='-')\nprint('끝')",
      "choices": ["A. 0-1-2-끝","B. 0 / 1 / 2 / 끝","C. 0-1-2- / 끝","D. 012-끝"],
      "answer": "A", "explanation": "end='-'로 줄바꿈 대신 - 가 붙어요." },
    { "question_id": "sl_adv_fib_1_1_001", "type": "fill_in_blank",
      "question": "print()가 여러 값을 | 로 구분해 출력하게 빈칸을 채우세요.\n출력 목표: 에이몬|로봇|고스트\n\nprint('에이몬', '로봇', '고스트', _____='|')",
      "answer": "sep", "explanation": "sep 파라미터는 여러 값 사이 구분자를 지정해요." }
  ]
}
```

**boss — fill_in_blank + code_input**

```json
{
  "type": "boss", "level": "advanced", "unit": 1,
  "pass_score": 80, "hints_allowed": 2, "xp_reward": 2000, "pyodide_eval": true,
  "questions": [
    { "question_id": "boss_adv_fib_1_001", "type": "fill_in_blank",
      "question": "빈칸을 채워 숫자를 소수점 3자리로 포맷해 출력하세요.\n\nscore = 98.7564\nprint(f'스코어: {score:_____}')",
      "answer": ".3f", "explanation": ":.3f는 소수점 아래 3자리까지 반올림하여 출력해요." },
    { "question_id": "boss_adv_ci_1_001", "type": "code_input",
      "question": "리스트 [1, 2, 3, 4, 5]를 한 줄에 공백으로 구분 출력. print() 한 번만 사용.\n출력 목표: 1 2 3 4 5",
      "answer": "print(*[1, 2, 3, 4, 5])", "pyodide_eval": true }
  ]
}
```

**final_boss — code_input 위주 (hints_allowed: 0)**

```json
{
  "type": "final_boss", "level": "advanced", "hints_allowed": 0, "xp_reward": 5000,
  "pyodide_eval": true,
  "questions": [
    { "question_id": "fb_adv_ci_001", "type": "code_input",
      "question": "함수 show_status(name, level, hp) 정의\nshow_status('에이몬', 40, 9999) 호출\n출력 목표: [ 에이몬 ] Lv.40 | HP: 9999",
      "answer": "def show_status(name, level, hp):\n    print(f'[ {name} ] Lv.{level} | HP: {hp}')\n\nshow_status('에이몬', 40, 9999)", "pyodide_eval": true },
    { "question_id": "fb_adv_ci_002", "type": "code_input",
      "question": "scores = [72, 88, 95, 61, 100]에서 80점 이상만 필터링 출력\n출력 목표: 88 / 95 / 100",
      "answer": "scores = [72, 88, 95, 61, 100]\nfor score in scores:\n    if score >= 80:\n        print(score)", "pyodide_eval": true }
  ]
}
```
