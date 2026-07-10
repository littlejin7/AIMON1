---

## notion_page: [https://app.notion.com/p/AI-MON-SCHEMA-373ea473fb4581968fa1fb9a1ba08a83](https://app.notion.com/p/AI-MON-SCHEMA-373ea473fb4581968fa1fb9a1ba08a83)title: AI MON SCHEMAversion: "2.0"status: currentsource_of_truth: GitHub main branch code, JSON data, and SQL fileslast_verified_commit: 830c0da32a3a2400bfa019e523448a506be74b7clast_verified_at: 2026-07-11

# AI MON 데이터 스키마

>
> AI-MON의 정적 콘텐츠 JSON, PostgreSQL 영속 데이터, 사용자 JSONB 상태,  

> API 요청·응답 계약과 레거시 호환 필드를 구분한 현재 구현 기준 문서
>

---

## 0. 문서 목적

이 문서는 다음 작업의 기준으로 사용합니다.

- 문제·레슨·미션 데이터 제작
- 백엔드 API 구현 및 검수
- Supabase 테이블 생성·마이그레이션
- 프론트엔드 타입 정의
- 보상·진도·배틀 상태 검증
- 기획안과 발표 자료의 데이터 구조 설명

관련 문서:

- 서비스 기획: [`AI_MON_PROPOSAL.md`](./AI_MON_PROPOSAL.md)
- 시스템 흐름: [`AI_MON_PIPELINE.md`](./AI_MON_PIPELINE.md)
- 미션 상세: [`AI_MON_MISSIONS.md`](./AI_MON_MISSIONS.md)
- 엔드보스 상세: [`ENDBOSS_DESIGN.md`](./ENDBOSS_DESIGN.md)

실제 동작이 문서와 충돌하면 GitHub `main` 브랜치의 코드와 데이터가 우선합니다.

---

## 1. 스키마 계층과 단일 진실

AI-MON 데이터는 한 종류의 저장소에만 있지 않습니다.


| 계층                 | 저장 위치                                                | 역할                                        | 단일 진실 |
|------------------------|--------------------------------------------------------------|-----------------------------------------------|---------------|
| 정적 커리큘럼    | `backend/data/lessons*.json`                                 | 코스·유닛 메타데이터                | JSON 파일   |
| 브리핑 슬라이드 | `backend/data/lessons/{level}/unit_*.json`                   | 스테이지 설명                           | JSON 파일   |
| 문제 원본          | `backend/data/quiz`, `miniboss`, `unitboss`, `endboss`       | 문제·정답·해설                        | JSON 파일   |
| 미션 정의          | `backend/data/missions.json`                                 | 목표·이벤트·보상 정의              | JSON 파일   |
| 에이칸 퍼즐       | `backend/data/aicross_puzzles.json`, `aicross_sets.json`     | 퍼즐 레이아웃·정답                   | JSON 파일   |
| 사용자 상태       | Supabase `users`                                             | 인증·재화·보스·미션·게임 상태 | PostgreSQL    |
| 학습 진도          | Supabase `progress`                                          | 스테이지별 완료·점수                | PostgreSQL    |
| 풀이 전수 기록   | Supabase `attempts`                                          | 정오답 로그                              | PostgreSQL    |
| 오답 복습          | Supabase `wrong_answers`                                     | 오답·복습 상태                         | PostgreSQL    |
| 인증 토큰          | `refresh_tokens`, `reset_tokens`, `email_verification_codes` | 인증 보조 데이터                       | PostgreSQL    |
| 로컬 fallback        | `backend/data/*.json`                                        | Supabase 미사용 개발 환경              | JSON          |
| 일일 백업          | `backend/data/backup/YYYY-MM-DD`                             | 복구용 스냅샷                           | JSON          |


### 1-1. 중요한 구분

- 정적 문제 JSON은 Supabase 문제 테이블로 마이그레이션된 구조가 아닙니다.
- Supabase는 사용자와 학습 이력 중심입니다.
- `users`의 여러 복합 상태는 JSONB에 저장됩니다.
- API 응답에는 DB에 저장되지 않고 계산되는 파생 필드가 포함됩니다.
- 일부 신규 재화 필드는 코드가 지원하지만 운영 DB 적용 여부는 Git만으로 확인할 수 없습니다.
- `xp`는 제거되지 않았으며 레거시 호환 필드로 유지됩니다.

---

## 2. 파일 구조

```text
backend/data/  
├─ schema.sql  
├─ migration_gp_coin_additive.sql  
├─ missions.json  
├─ lessons.json  
├─ lessons_intermediate.json  
├─ lessons_advanced.json  
│  
├─ lessons/  
│  ├─ beginner/  
│  │  ├─ unit_1.json  
│  │  └─ ...  
│  ├─ intermediate/  
│  └─ advanced/  
│  
├─ quiz/  
│  ├─ beginner/  
│  ├─ intermediate/  
│  └─ advanced/  
│  
├─ miniboss/  
│  ├─ beginner/  
│  ├─ intermediate/  
│  └─ advanced/  
│  
├─ unitboss/  
│  ├─ beginner/  
│  ├─ intermediate/  
│  └─ advanced/  
│  
├─ endboss/  
│  ├─ beginner.json  
│  ├─ intermediate.json  
│  └─ advanced.json  
│  
├─ aicross_puzzles.json  
├─ aicross_sets.json  
└─ backup/
```

### 2-1. 명칭 주의


| 항목                           | 현재 기준                     |
|----------------------------------|-----------------------------------|
| 실제 엔드보스 디렉터리 | `backend/data/endboss/`           |
| 엔드보스 라우터           | `/boss/endboss`                   |
| 일부 문제의 `quiz_category` | 레거시 값 `final_boss` 유지 |
| 사용자 표시 용어          | 엔드보스                      |
| Python 코드 모드             | `endboss`                         |


즉, 파일 경로와 라우터는 `endboss`이지만 일부 JSON 내부 값은 `final_boss`입니다. 무계획한 일괄 치환을 하면 문제 로더·테스트·콘텐츠 도구에 영향을 줄 수 있습니다.

---

# Part A. 정적 콘텐츠 JSON

---

## 3. 코스·유닛 메타데이터

### 3-1. 파일


| 코스       | 파일                                   |
|--------------|------------------------------------------|
| Beginner     | `backend/data/lessons.json`              |
| Intermediate | `backend/data/lessons_intermediate.json` |
| Advanced     | `backend/data/lessons_advanced.json`     |


각 파일은 유닛 객체 8개의 배열입니다.

### 3-2. 실제 필드


| 필드        | 타입  | 필수 | 설명                                 |
|---------------|---------|-------:|----------------------------------------|
| `unit_id`     | integer | O      | 유닛 번호, 1~8                     |
| `title`       | string  | O      | 유닛 제목                          |
| `icon`        | string  | O      | 화면 아이콘                       |
| `description` | string  | O      | 유닛 설명                          |
| `difficulty`  | string  | O      | `beginner`, `intermediate`, `advanced` |
| `stages`      | integer | O      | 일반 스테이지 수                |
| `boss_stage`  | integer | O      | UI상 보스 스테이지 번호       |


### 3-3. 현재 사용하지 않는 과거 문서 필드

기존 문서에는 다음 필드가 필수로 적혀 있었지만 현재 유닛 메타데이터에는 없습니다.

- `keywords`
- `evolution`

캐릭터 진화는 유닛 메타데이터가 아니라 사용자 `evolution_stage`와 엔드보스 클리어 이력으로 관리합니다.

### 3-4. 예시

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

### 3-5. 검증 규칙

- `unit_id`는 코스 안에서 중복되면 안 됩니다.
- `stages`는 해당 레슨 파일에 실제 존재하는 일반 스테이지 수와 일치해야 합니다.
- 일반 스테이지 ID는 보통 `{unit}-1`부터 `{unit}-{stages}`까지입니다.
- 유닛 보스 진행도 ID는 `{unit}-boss`입니다.
- `boss_stage`는 화면 표시용 번호이며 서버 보스 승패 상수와 무관합니다.

---

## 4. 브리핑 슬라이드

### 4-1. 파일 형태

```text
backend/data/lessons/{course_level}/unit_{unit}.json
```

최상위는 배열입니다.

```json
[  
{  
"lesson_id": "1-1-beginner",  
"unit": 1,  
"stage": "1-1",  
"course_level": "beginner",  
"title": "Hello, Python!",  
"villain": "codemmon",  
"slides": []  
}  
]
```

### 4-2. 레슨 객체


| 필드         | 타입  | 필수 | 설명                                 |
|----------------|---------|-------:|----------------------------------------|
| `lesson_id`    | string  | O      | 권장 형식 `{stage}-{course_level}` |
| `unit`         | integer | O      | 1~8                                    |
| `stage`        | string  | O      | 예: `1-1`                             |
| `course_level` | string  | O      | 코스                                 |
| `title`        | string  | O      | 스테이지 제목                    |
| `villain`      | string  | O      | 악당 리소스 키                   |
| `slides`       | array   | O      | 슬라이드 배열                    |


### 4-3. 슬라이드 객체


| 필드            | 타입   | 필수    | 설명                             |
|-------------------|----------|----------:|------------------------------------|
| `order`           | integer  | O         | 1부터 시작하는 표시 순서 |
| `text`            | string   | O         | 개념 설명                      |
| `terminal`        | object   | 선택    | 코드 예시                      |
| `terminal.code`   | string[] | 조건부 | 코드 줄 배열                  |
| `terminal.output` | string[] | 조건부 | 출력 줄 배열                  |
| `tip`             | string   | 선택    | 하단 학습 팁                  |


### 4-4. 예시

```json
{  
  "order": 1,  
  "text": "print()로 화면에 출력합니다.",  
  "terminal": {  
    "code": [  
      "print('Hello')"  
    ],  
    "output": [  
      "Hello"  
    ]  
  },  
  "tip": "따옴표 안의 글자를 출력해요."  
}
```

### 4-5. 악당 키

현재 데이터에서 사용하는 대표 키:

- `codemmon`
- `speechbubble_king`
- `interferencemon`

표시 이름과 내부 리소스 키는 다를 수 있으므로 콘텐츠 작업 시 한글 이름으로 바꾸지 않습니다.

### 4-6. 검증 규칙

- `lesson_id`, `stage`, `course_level` 조합이 실제 파일 경로와 일치해야 합니다.
- `slides[].order`는 중복되면 안 됩니다.
- `terminal.code`와 `terminal.output`은 항상 같은 길이일 필요는 없습니다.
- 코드 줄은 문자열 배열을 사용합니다.
- Markdown 코드블록이 아니라 순수 코드 줄을 저장합니다.

---

## 5. 문제 데이터 공통 구조

### 5-1. 파일 컨테이너

현재 로더는 두 형식을 모두 허용합니다.

#### 객체 래퍼

```json
{  
"questions": []  
}
```

#### 배열

```json
[  
  {}  
]
```

현재 대표 사용:


| 카테고리 | 대표 형태                           |
|--------------|-----------------------------------------|
| `quiz`       | `{"questions":[]}`                      |
| `miniboss`   | `{"questions":[]}` 또는 배열 허용 |
| `unitboss`   | `{"questions":[]}`                      |
| `endboss`    | 배열                                  |


새 데이터는 해당 카테고리의 기존 파일 형태를 유지합니다.

### 5-2. 공통 필드


| 필드          | 타입              | 필수 수준                 | 설명                                         |
|-----------------|---------------------|------------------------------:|------------------------------------------------|
| `question_id`   | string              | 사실상 필수              | 조회·seen·attempts 키                     |
| `unit`          | integer             | 일반 문제 필수          | 유닛 번호                                  |
| `stage`         | string              | 일반 문제 필수          | 예: `1-1`, `1-boss`, `final`                  |
| `course_level`  | string              | quiz/miniboss/unitboss 필수 | 엔드보스는 파일 경로로 추론 가능 |
| `difficulty`    | string              | 권장                        | `easy`, `medium`, `hard`                       |
| `type`          | string              | 필수                        | 문제 유형                                  |
| `quiz_category` | string              | 권장                        | 데이터 카테고리                         |
| `is_boss`       | boolean             | 권장                        | 표시·분류 메타데이터                 |
| `question`      | string              | 필수                        | 문제 본문                                  |
| `choices`       | array               | 유형별                     | 선택지·코드 조각                       |
| `answer`        | string 또는 array | 필수                        | 서버 정답                                  |
| `hint`          | string              | 선택                        | 힌트                                         |
| `feedback`      | object              | 권장                        | 정오답 피드백                            |
| `explanation`   | string              | 선택                        | 상세 해설                                  |


### 5-3. 서버 비공개 필드

문제 조회 시 다음 필드는 제거됩니다.

- `answer`
- `feedback`
- `hint`
- `explanation`

이 필드는 사용자가 답을 제출한 뒤 채점 응답에서만 필요한 범위로 반환합니다.

### 5-4. `feedback` 허용 키

현재 데이터가 혼용하는 키:

```json
{  
"correct": "정답 피드백",  
"wrong": "오답 피드백",  
"incorrect": "오답 피드백"  
}
```

백엔드는 오답에서 `incorrect`, `wrong`, `explanation`, `hint` 등을 fallback 순서로 사용합니다.

권장 신규 형식:

```json
{  
  "correct": "정답 피드백",  
  "incorrect": "오답 피드백"  
}
```

기존 `wrong`은 호환 때문에 유지할 수 있습니다.

---

## 6. 문제 유형

### 6-1. `multiple_choice`

```json
{  
"type": "multiple_choice",  
"question": "질문",  
"choices": [  
"A. 선택지 1",  
"B. 선택지 2",  
"C. 선택지 3",  
"D. 선택지 4"  
],  
"answer": "B"  
}
```

- 서버 직접 채점 대상입니다.
- `answer`는 문자 또는 전체 선택지 텍스트가 가능합니다.
- 채점기는 대소문자·앞뒤 공백·`A.` 형태를 정규화합니다.

### 6-2. `output_select`

```json
{  
  "type": "output_select",  
  "question": "다음 코드의 출력은?\n\n
```python\nprint('Hello')\n
```",  
  "choices": [  
    "A. Hello",  
    "B. 'Hello'",  
    "C. hello",  
    "D. Error"  
  ],  
  "answer": "A"  
}
```

- 서버 직접 채점합니다.
- 코드블록은 `question` 문자열 안 Markdown으로 저장합니다.

### 6-3. `error_find`

```json
{  
"type": "error_find",  
"question": "오류가 발생하는 줄은?\n\n
```python\n1. x = 1\n2. 3name = 'A'\n
```",  
"answer": "2"  
}
```

- 선택지가 없어도 됩니다.
- 정답은 일반적으로 줄 번호 문자열입니다.
- 문제 본문 줄 표기는 `1.`, `2.` 형식을 권장합니다.
- `1줄:`, `# 3줄:` 같은 혼합 표기는 사용하지 않습니다.

### 6-4. `fill_in_blank`

```json
{  
  "type": "fill_in_blank",  
  "question": "빈칸을 채우세요.\n\n
```python\nname = ____\n
```",  
  "choices": [],  
  "answer": "'Aimon'"  
}
```

- 서버 직접 비교 대상입니다.
- 정답 표현이 여러 개 허용되는 문제는 단일 문자열 비교에 적합하지 않습니다.
- 그런 문제는 `code_input` 또는 별도 정규화 규칙을 사용합니다.

### 6-5. `code_input`

현재 데이터에는 두 패턴이 있습니다.

#### 자유 코드

```json
{  
"type": "code_input",  
"question": "함수를 구현하세요.",  
"answer": "예시 정답 코드",  
"expected_output": "예상 출력\n"  
}
```

#### 코드 조각 조립

```json
{  
  "type": "code_input",  
  "question": "빈칸 코드를 선택하세요.",  
  "choices": [  
    "yield from range(n)",  
    "await",  
    "async"  
  ],  
  "answer": [  
    "yield from range(n)"  
  ],  
  "expected_output": "[0, 1, 2, 3]\n",  
  "code_template": "def gen_range(n):\n    {slot1}\n"  
}
```

필드:


| 필드            | 타입                 | 설명                                      |
|-------------------|------------------------|---------------------------------------------|
| `answer`          | string 또는 string[] | 예시 정답 또는 슬롯 정답          |
| `expected_output` | string                 | 결정론적 출력 비교 기준           |
| `code_template`   | string                 | `{slot1}`, `{slot2}` 자리표시자 포함 |
| `choices`         | string[]               | 선택 가능한 코드 조각              |


### 6-6. `code_multi_input`

백엔드가 명시적으로 지원하는 다중 슬롯 유형입니다.

```json
{  
"type": "code_multi_input",  
"answer": [  
"첫 번째 정답",  
"두 번째 정답"  
],  
"code_template": "x = {slot1}\ny = {slot2}"  
}
```

- `answer`는 배열입니다.
- 서버는 템플릿 슬롯을 채운 전체 코드를 공백 제거 후 비교합니다.
- 문제 조회 응답의 `choices`는 정답 배열에서 생성될 수 있습니다.
- 현재 구현은 distractor 없는 정답 토큰 배열을 사용할 수 있으므로 UI 노출 정책을 검토해야 합니다.

### 6-7. 문제 유형 허용값

현재 코드·데이터 기준:

- `multiple_choice`
- `output_select`
- `error_find`
- `fill_in_blank`
- `code_input`
- `code_multi_input`

---

## 7. 카테고리별 문제 스키마

### 7-1. 스테이지 퀴즈

필수·주요 필드:


| 필드          | 값                 |
|-----------------|---------------------|
| `quiz_category` | `stage_quiz`        |
| `is_boss`       | `false`             |
| `quiz_set`      | `A` 또는 `B`      |
| `hint`          | 사용 가능       |
| `stage`         | 일반 스테이지 |
| `course_level`  | 필수              |


예시:

```json
{  
  "question_id": "q001",  
  "unit": 1,  
  "stage": "1-1",  
  "course_level": "beginner",  
  "difficulty": "easy",  
  "type": "output_select",  
  "quiz_category": "stage_quiz",  
  "quiz_set": "A",  
  "question": "문제",  
  "choices": ["A. Hello", "B. Error"],  
  "answer": "A",  
  "feedback": {  
    "correct": "정답입니다.",  
    "wrong": "정답은 A입니다."  
  },  
  "is_boss": false,  
  "hint": "코드를 순서대로 확인하세요."  
}
```

#### `quiz_set`


| attempt  | 문제 풀 |
|---------:|------------|
| 1        | Set A      |
| 2        | Set B      |
| 3 이상 | A+B 혼합 |


Set 정보가 없으면 전체 풀을 fallback으로 사용합니다.

### 7-2. 스테이지 미니보스

대표 필드:


| 필드          | 값                                                       |
|-----------------|-----------------------------------------------------------|
| `quiz_category` | `miniboss`                                                |
| `is_boss`       | `true`                                                    |
| `villain`       | 선택                                                    |
| `pass_score`    | 데이터 메타데이터                                 |
| `quiz_set`      | 일부 데이터에서 사용 가능                      |
| `hint`          | 일반적으로 없음, 코드상 강제 금지는 아님 |


중요:

- 데이터의 `pass_score: 70`은 현재 서버 승패의 단일 진실이 아닙니다.
- 서버는 최대 5문제, 4정답 승리, 2오답 패배 상수를 사용합니다.
- 콘텐츠 데이터의 `pass_score`를 바꿔도 실제 승패 규칙은 바뀌지 않습니다.

### 7-3. 유닛 보스

대표 필드:


| 필드               | 값                               |
|----------------------|-----------------------------------|
| `quiz_category`      | `unit_boss`                       |
| `is_boss`            | `true`                            |
| `stage`              | `{unit}-boss`                     |
| `hint`               | 현재 실제 데이터에 존재 |
| `feedback.correct`   | 사용                            |
| `feedback.incorrect` | 선택                            |


기존 문서의 “유닛보스에는 hint 필드가 없다”는 현재 데이터와 일치하지 않습니다.

힌트 사용 횟수·왕관 처리 여부는 문제 JSON이 아니라 보스 라우터가 관리합니다.

### 7-4. 엔드보스

대표 필드:


| 필드          | 타입              | 설명                            |
|-----------------|---------------------|-----------------------------------|
| `question_id`   | string              | 예: `endboss_beg_account_p1_001` |
| `quiz_category` | string              | 현재 레거시 `final_boss`     |
| `is_boss`       | boolean             | `true`                            |
| `project`       | string              | 프로젝트 분기               |
| `phase`         | integer             | 1, 2, 3                           |
| `stage`         | string              | `final`                           |
| `unit`          | integer             | 현재 대표 데이터는 `9`    |
| `difficulty`    | string              | 난이도                         |
| `type`          | string              | 문제 유형                     |
| `question`      | string              | 문제 본문                     |
| `choices`       | array               | 유형별                         |
| `answer`        | string 또는 array | 서버 정답                     |
| `explanation`   | string              | 상세 해설                     |
| `feedback`      | object              | 정오답 피드백               |


엔드보스 파일은 코스별 파일이므로 각 문제에 `course_level`이 없어도 로더가 파일 경로로 코스를 구분합니다.

### 7-5. `question_id` 정책

현재 데이터에는 여러 세대의 ID가 혼재합니다.

예:

- `q001`
- `mb1_1_1_001`
- `unitboss_beg_os_1_001`
- `endboss_beg_account_p1_001`

새 문제 권장 패턴:

```text
{category}_{level}_{type}_{unit}_{stage}_{sequence}
```

예:

```text
quiz_beg_os_1_1_001  
miniboss_int_fib_2_3_004  
unitboss_adv_ci_6_002  
endboss_adv_agent_p3_003
```

단, 기존 ID는 `attempts`, `wrong_answers`, `seen_questions`에서 참조하므로 일괄 변경하면 안 됩니다.

---

## 8. 미션 정의 스키마

파일:

```text
backend/data/missions.json
```

최상위:

```json
{  
  "daily": [],  
  "weekly": []  
}
```

### 8-1. 미션 정의


| 필드          | 타입  | 필수 | 설명                                      |
|-----------------|---------|-------:|---------------------------------------------|
| `mission_id`    | string  | O      | 고유 ID                                   |
| `title`         | string  | O      | 사용자 표시 제목                     |
| `event`         | string  | O      | 진척 이벤트                            |
| `goal`          | integer | O      | 목표 횟수                               |
| `reward`        | object  | O      | 보상                                      |
| `reward.xp`     | integer | 선택 | 현재 실제 지급은 코인+랭킹점수 |
| `reward.crowns` | integer | 선택 | 왕관                                      |


### 8-2. 현재 이벤트

- `stage_clear`
- `review_done`
- `login`
- `boss_clear`
- `ai_feedback`

### 8-3. 보상 명칭 주의

`missions.json`의 `reward.xp`는 레거시 키입니다.

현재 미션 수령 시:

```text
reward.xp  
→ coin_delta  
→ ranking_score_delta
```

GP는 지급하지 않습니다.

### 8-4. 예시

```json
{  
  "mission_id": "w_boss2",  
  "title": "보스 2회 처치",  
  "event": "boss_clear",  
  "goal": 2,  
  "reward": {  
    "xp": 1500,  
    "crowns": 2  
  }  
}
```

---

## 9. 에이칸 퍼즐 스키마

현재 두 종류의 정적 파일이 병행됩니다.

### 9-1. 레거시 퍼즐

파일:

```text
backend/data/aicross_puzzles.json
```

최상위:

```json
{  
  "set_001": {  
    "set_label": "세트명",  
    "grid": [],  
    "entries": []  
  }  
}
```

퍼즐:


| 필드      | 타입  | 설명                    |
|-------------|---------|---------------------------|
| `set_label` | string  | 세트 표시명          |
| `grid`      | array[] | 격자, `#`는 막힌 칸 |
| `entries`   | array   | 단어 목록             |


entry:


| 필드      | 타입  | 설명               |
|-------------|---------|----------------------|
| `id`        | string  | `A1`, `D1` 등       |
| `direction` | string  | `across`, `down`     |
| `row`       | integer | 시작 행, 0 기반 |
| `col`       | integer | 시작 열, 0 기반 |
| `length`    | integer | 단어 길이        |
| `clue`      | string  | 힌트               |
| `answer`    | string  | 서버 정답        |


공개 응답에서는 `answer`를 제거합니다.

### 9-2. 신규 세트 진행도 퍼즐

파일:

```text
backend/data/aicross_sets.json
```

최상위 배열:

```json
[  
  {  
    "set_index": 0,  
    "set_name": "세트명",  
    "grid_size": {},  
    "entries": []  
  }  
]
```

entry 공개 필드:

- `id`
- `direction`
- `row`
- `col`
- `length`
- `clue`
- `easyClue`
- `letterBank`

`letterBank`는 정답 문자열 자체가 아니라 정답 글자를 섞은 배열입니다.

### 9-3. 서버 진행 상태

`users.game_rewards`에 저장:

```json
{  
"aicross_completed_sets": [0, 1],  
"aicross_best_scores": {  
"0": 100,  
"1": 80  
},  
"aicross_set_clear_counts": {  
"0": 2,  
"1": 1  
},  
"aicross_last_set_index": 1  
}
```

---

# Part B. PostgreSQL 영속 데이터

---

## 10. DB 스키마 상태 분류

### 10-1. 기준 SQL

```text
backend/data/schema.sql
```

이 파일은 기본 테이블을 정의합니다.

### 10-2. 별도 신규 재화 마이그레이션

```text
backend/data/migration_gp_coin_additive.sql
```

이 파일의 헤더에는 다음 상태가 명시돼 있습니다.

```text
DRAFT — 운영 미적용
```

따라서 Git 기준으로 확인 가능한 사실:

- 코드에는 코인·GP·랭킹 필드 지원이 있습니다.
- 마이그레이션 SQL 초안이 있습니다.
- 자동 적용되지 않습니다.
- 실제 운영 Supabase 적용 여부는 DB에서 별도로 확인해야 합니다.

### 10-3. 상태 표기


| 구분          | 의미                                                 |
|-----------------|--------------------------------------------------------|
| Baseline        | `schema.sql`에 포함                                 |
| Draft migration | 별도 SQL에는 있으나 운영 적용 확인 필요 |
| JSONB nested    | 별도 컬럼 없이 JSONB 내부 키                  |
| Derived         | DB에 저장하지 않고 응답 시 계산            |
| Legacy          | 호환을 위해 유지                                |


---

## 11. `users` 테이블

### 11-1. Baseline 컬럼


| 컬럼                     | 타입      | 기본값   | 상태          | 설명                                            |
|----------------------------|-------------|-------------|-----------------|---------------------------------------------------|
| `id`                       | uuid        | 없음      | Baseline        | PK                                                |
| `username`                 | text        | 없음      | Baseline        | 로그인 ID                                      |
| `password`                 | text        | null        | Baseline        | 비밀번호 해시, 소셜 계정은 null 가능 |
| `nickname`                 | text        | null        | Baseline        | 표시명                                         |
| `email`                    | text        | null        | Baseline        | 이메일                                         |
| `role`                     | text        | `student`   | Baseline        | 역할                                            |
| `course_level`             | text        | `beginner`  | Baseline        | 현재 코스                                     |
| `is_level_tested`          | boolean     | false       | Baseline        | 레벨 테스트 완료                           |
| `marketing_agreed`         | boolean     | false       | Baseline        | 마케팅 동의                                  |
| `character`                | text        | `slime`     | Baseline/표시 | 선택 캐릭터                                  |
| `lv`                       | integer     | 1           | Baseline/Legacy | 레벨                                            |
| `xp`                       | integer     | 0           | Legacy          | 레거시 XP                                      |
| `crowns`                   | integer     | 5           | Baseline        | 왕관                                            |
| `streak`                   | integer     | 0           | Baseline        | 연속 로그인                                  |
| `last_login`               | text        | null        | Baseline        | KST 날짜 문자열                              |
| `daily_free_attempts`      | integer     | 2           | Baseline        | 유닛보스 무료 횟수                        |
| `last_free_attempt_date`   | text        | null        | Baseline        | KST 날짜                                        |
| `ai_feedback_count`        | integer     | 0           | Baseline        | AI 피드백 누적                               |
| `token_version`            | integer     | 1           | Baseline        | 토큰 무효화 버전                           |
| `group_id`                 | uuid        | null        | Baseline        | 그룹 확장용                                  |
| `equipped_title`           | text        | null        | Baseline        | 장착 칭호                                     |
| `endboss_cleared_levels`   | jsonb       | `[]`        | Baseline        | 엔드보스 클리어 코스                     |
| `miniboss_cleared_stages`  | jsonb       | `[]`        | Baseline        | 미니보스 클리어                            |
| `unitboss_cleared_units`   | jsonb       | `[]`        | Baseline        | 유닛보스 클리어                            |
| `battle_sessions`          | jsonb       | `{}`        | Baseline        | 서버 배틀 세션                              |
| `seen_questions`           | jsonb       | `{}`        | Baseline        | 출제 이력                                     |
| `max_unlocked_unit`        | jsonb       | 코스별 1 | Baseline        | 코스별 최대 해금 유닛                    |
| `completed_units`          | jsonb       | 코스별 0 | Baseline        | 코스별 완료 유닛 수                       |
| `awarded_crown_units`      | jsonb       | `[]`        | Baseline        | 유닛 왕관 중복 방지                       |
| `earned_streak_milestones` | jsonb       | `[]`        | Baseline        | 스트릭 보상 이력                           |
| `titles`                   | jsonb       | `[]`        | Baseline        | 보유 칭호                                     |
| `game_rewards`             | jsonb       | `{}`        | Baseline        | 게임·랭킹·챌린지 상태                  |
| `version`                  | bigint      | 0           | Baseline        | 낙관적 동시성 제어                        |
| `missions`                 | jsonb       | `{}`        | Baseline        | 미션 상태                                     |
| `purchased_themes`         | jsonb       | `["dark"]`  | Baseline        | 보유 테마                                     |
| `created_at`               | timestamptz | now         | Baseline        | 생성 시각                                     |
| `deleted_at`               | timestamptz | null        | Baseline        | 소프트 삭제 시각                           |


### 11-2. Draft migration 컬럼


| 컬럼                 | 타입  | 기본값 | 상태                              | 설명                          |
|------------------------|---------|-----------|-------------------------------------|---------------------------------|
| `coin_balance`         | integer | 0         | Draft migration                     | 소비 가능한 코인         |
| `total_coin_earned`    | integer | 0         | Draft migration                     | 누적 획득 코인            |
| `gp`                   | integer | 0         | Draft migration                     | 최종 진화 후 성장치     |
| `gp_level_base`        | integer | 0         | Draft migration                     | GP 성장 시작 레벨         |
| `evolution_stage`      | integer | 0         | Draft migration                     | 0~3 진화 단계               |
| `ranking_score`        | integer | 0         | Draft migration                     | 누적 랭킹점수             |
| `weekly_ranking_score` | integer | 0         | Draft migration/미사용 저장값 | 런타임은 JSONB에서 파생 |
| `legacy_xp_snapshot`   | integer | null      | Draft migration                     | 컷오버 감사·롤백용     |


### 11-3. 운영 확인 필수

다음 기능은 Supabase 사용 시 신규 컬럼 존재 여부를 확인해야 합니다.

- 테마 구매
- 코인 보상
- 누적 랭킹
- GP 성장
- 엔드보스 진화 단계 저장

검증 쿼리:

```sql
SELECT  
column_name,  
data_type,  
column_default,  
is_nullable  
FROM information_schema.columns  
WHERE table_schema = 'public'  
AND table_name = 'users'  
AND column_name IN (  
'coin_balance',  
'total_coin_earned',  
'gp',  
'gp_level_base',  
'evolution_stage',  
'ranking_score',  
'weekly_ranking_score',  
'legacy_xp_snapshot'  
)  
ORDER BY column_name;
```

---

## 12. `users` 인덱스와 유일성

### 12-1. 활성 계정 아이디

```sql
CREATE UNIQUE INDEX users_username_active_uq  
ON users (lower(username))  
WHERE deleted_at IS NULL;
```

- 대소문자 무시
- 소프트 삭제 계정 제외
- 탈퇴 후 동일 ID 재사용 가능

### 12-2. 활성 계정 이메일

```sql
CREATE UNIQUE INDEX users_email_active_uq  
ON users (lower(email))  
WHERE deleted_at IS NULL  
AND email IS NOT NULL  
AND email <> '';
```

### 12-3. 닉네임

닉네임 고유 인덱스는 기본 SQL에서 주석 처리돼 있습니다.

현재 중복 검사는 애플리케이션이 수행합니다.

```text
lower(trim(nickname))
```

운영 DB에서 닉네임 중복을 완전히 차단하려면 기존 중복 정리 후 부분 unique index 적용을 검토합니다.

### 12-4. 입력 소문자 정책

현재 일반 회원가입과 중복 확인 API는:

- 아이디 대문자 거부
- 이메일 대문자 거부
- 이메일 정규화

를 수행합니다.

DB 인덱스는 추가로 `lower()`를 사용합니다.

---

## 13. 사용자 JSONB 구조

### 13-1. `max_unlocked_unit`

저장 형태:

```json
{  
"beginner": 3,  
"intermediate": 1,  
"advanced": 1  
}
```

`GET /user/me` 응답에서는 현재 코스 값 하나로 변환될 수 있습니다.

```json
{  
  "max_unlocked_unit": 3  
}
```

### 13-2. `completed_units`

저장:

```json
{  
"beginner": 2,  
"intermediate": 0,  
"advanced": 0  
}
```

응답:

```json
{  
  "completed_units": 2  
}
```

### 13-3. `endboss_cleared_levels`

```json
[  
"beginner",  
"intermediate"  
]
```

- 코스 승급
- 진화
- 엔드보스 중복 보상
- 엔드보스 상태

에 사용합니다.

### 13-4. `miniboss_cleared_stages`

```json
[  
  "1-1",  
  "1-2",  
  "1-3"  
]
```

현재 구현 일부는 코스 문맥과 함께 해석합니다. 코스 간 동일 stage ID 충돌을 방지하려면 장기적으로 `{level}:{stage}` 형태 또는 중첩 맵 정리가 필요합니다.

### 13-5. `unitboss_cleared_units`

현재 코드가 처리하는 대표 형식:

```json
[  
"beginner-1",  
"beginner-2",  
"intermediate-1"  
]
```

### 13-6. `awarded_crown_units`

신규 저장 권장:

```json
[  
  "beginner-1",  
  "beginner-2"  
]
```

레거시 정수 값도 직렬화 시 호환 처리합니다.

### 13-7. `seen_questions`

대표 구조:

```json
{  
"miniboss": {  
"1-1": [  
"mb1_1_1_001",  
"mb1_1_1_002"  
]  
},  
"unitboss_legacy_served_1": [  
"unitboss_beg_os_1_001"  
],  
"endboss": {  
"beginner": [  
"endboss_beg_account_p1_001"  
]  
}  
}
```

키 구조는 모드별로 다를 수 있습니다. 새 기능에서 기존 키를 임의로 재사용하지 않습니다.

### 13-8. `battle_sessions`

```json
{  
  "server-generated-sid": {  
    "sid": "server-generated-sid",  
    "mode": "miniboss",  
    "unit": 1,  
    "stage": "1-1",  
    "required": 4,  
    "max_wrong": 2,  
    "correct_qids": [  
      "mb1_1_1_001"  
    ],  
    "wrong": 0,  
    "status": "active",  
    "exp": 1780000000  
  }  
}
```

허용 `status`:

- `active`
- `won`
- `lost`

세션 수명은 30분입니다. 만료 세션은 접근 시 prune됩니다.

### 13-9. `missions`

```json
{  
"daily": {  
"date": "2026-07-11",  
"progress": {  
"d_quiz3": 2,  
"d_review": 1,  
"d_login": 1  
},  
"claimed": [  
"d_review"  
],  
"login_days": [  
"2026-07-11"  
]  
},  
"weekly": {  
"week": "2026-W28",  
"progress": {  
"w_boss2": 1,  
"w_streak5": 3,  
"w_ai5": 4  
},  
"claimed": [],  
"login_days": [  
"2026-07-09",  
"2026-07-10",  
"2026-07-11"  
]  
}  
}
```

- 날짜·주차 변경 시 lazy reset합니다.
- 모든 보상은 수동 수령입니다.
- `claimed` 중복 추가는 원자 변경 경로에서 차단합니다.

### 13-10. `titles`

```json
[  
  "first_step",  
  "boss_slayer",  
  "python_master"  
]
```

장착 칭호는 별도 `equipped_title` 컬럼입니다.

### 13-11. `purchased_themes`

```json
[  
"dark",  
"ocean"  
]
```

`dark`는 직렬화 시 항상 포함됩니다.

### 13-12. `game_rewards`

이 JSONB는 여러 하위 도메인을 포함합니다.

대표 키:

```json
{  
  "daily_xp": 750,  
  "daily_xp_date": "2026-07-11",  
  
  "aipang_last_date": "2026-07-11",  
  
  "aizzak_last_date": "2026-07-11",  
  "aizzak_today_count": 2,  
  
  "runner_last_date": "2026-07-11",  
  "runner_today_count": 4,  
  
  "aibomb_last_date": "2026-07-11",  
  "aibomb_today_count": 1,  
  
  "aicross_last_date": "2026-07-11",  
  "aicross_today_count": 2,  
  
  "challenge_bonus_date": "2026-07-11",  
  
  "used_nonces": [],  
  
  "weekly_ranking": {  
    "2026-W28": {  
      "runner": 1200,  
      "aizzak": 400,  
      "aibomb": 100,  
      "aicross": 350  
    }  
  },  
  
  "aicross_completed_sets": [0, 1],  
  "aicross_best_scores": {  
    "0": 100,  
    "1": 80  
  },  
  "aicross_set_clear_counts": {  
    "0": 2,  
    "1": 1  
  },  
  "aicross_last_set_index": 1  
}
```

주의:

- `daily_xp`는 레거시 이름이지만 현재 게임 보상 공통 캡 누적값입니다.
- `weekly_ranking_score` 응답은 `weekly_ranking[현재 ISO 주]`를 합산해 계산합니다.
- 에이팡은 랭킹점수가 없어 주간 랭킹 맵에 보통 포함되지 않습니다.
- 과거 중첩형 `game_rewards.aipang`, `game_rewards.runner`는 런타임에 평탄화될 수 있습니다.

---

## 14. 사용자 생성 기본값

일반 회원가입 코드가 만드는 대표 상태:

```json
{  
"id": "uuid",  
"username": "user",  
"password": "password-hash",  
"nickname": "nickname",  
"email": "user@example.com",  
"course_level": "beginner",  
"is_level_tested": false,  
"marketing_agreed": false,  
"group_id": null,  
"role": "student",  
"character": "slime",  
"lv": 1,  
"xp": 0,  
"crowns": 5,  
"daily_free_attempts": 2,  
"last_free_attempt_date": "",  
"streak": 0,  
"last_login": "",  
"titles": [],  
"ai_feedback_count": 0,  
"max_unlocked_unit": {  
"beginner": 1,  
"intermediate": 1,  
"advanced": 1  
},  
"completed_units": {  
"beginner": 0,  
"intermediate": 0,  
"advanced": 0  
},  
"awarded_crown_units": [],  
"earned_streak_milestones": [],  
"game_rewards": {}  
}
```

DB 기본값 또는 직렬화 단계에서 다음이 추가될 수 있습니다.

- `battle_sessions`
- `seen_questions`
- `endboss_cleared_levels`
- `miniboss_cleared_stages`
- `unitboss_cleared_units`
- `missions`
- `purchased_themes`
- 코인·GP·랭킹 필드

---

## 15. `GET /user/me` 응답

`serialize_user()`는 DB 원본을 그대로 반환하지 않습니다.

### 15-1. 제거 필드

- `password`
- `deleted_at`

### 15-2. 파생·변환 필드


| 필드                    | 처리                                       |
|---------------------------|----------------------------------------------|
| `unlocked_course_levels`  | 보스 클리어·현재 코스에서 계산 |
| `endboss_cleared_levels`  | 레벨테스트 하위 인정 포함         |
| `max_unlocked_unit`       | 현재 코스의 정수로 변환            |
| `completed_units`         | 현재 코스의 정수로 변환            |
| `awarded_crown_units`     | 현재 코스 유닛 번호로 필터        |
| `boss_cleared`            | progress + 엔드보스 기록에서 계산  |
| `completed_stages`        | progress에서 계산                        |
| `purchased_themes`        | `dark` 보장                                |
| 코인·GP·랭킹 필드 | 누락 시 런타임 기본값               |
| `weekly_ranking_score`    | 게임 주간 맵에서 파생               |


### 15-3. 응답 예시

```json
{  
  "id": "uuid",  
  "username": "jinny",  
  "nickname": "지니",  
  "email": "user@example.com",  
  "course_level": "intermediate",  
  "unlocked_course_levels": [  
    "beginner",  
    "intermediate"  
  ],  
  "is_level_tested": true,  
  "character": "robot",  
  "evolution_stage": 1,  
  "lv": 1,  
  "xp": 0,  
  "coin_balance": 2500,  
  "total_coin_earned": 4000,  
  "gp": 0,  
  "ranking_score": 4000,  
  "weekly_ranking_score": 900,  
  "crowns": 7,  
  "max_unlocked_unit": 2,  
  "completed_units": 1,  
  "completed_stages": 8,  
  "boss_cleared": 1,  
  "titles": [],  
  "equipped_title": "",  
  "purchased_themes": [  
    "dark"  
  ]  
}
```

---

## 16. `progress` 테이블

```sql
CREATE TABLE progress (  
id uuid PRIMARY KEY,  
user_id uuid REFERENCES users(id) ON DELETE CASCADE,  
unit integer NOT NULL,  
stage text NOT NULL,  
score integer DEFAULT 0,  
is_completed boolean DEFAULT false,  
checkpoint text,  
course_level text DEFAULT 'beginner',  
created_at timestamptz DEFAULT now(),  
updated_at timestamptz DEFAULT now(),  
UNIQUE(user_id, unit, stage, course_level)  
);
```

### 16-1. 필드


| 필드         | 타입      | 설명           |
|----------------|-------------|------------------|
| `id`           | uuid        | PK               |
| `user_id`      | uuid        | 사용자 FK     |
| `unit`         | integer     | 유닛           |
| `stage`        | text        | 스테이지 ID  |
| `score`        | integer     | 최고 점수    |
| `is_completed` | boolean     | 완료           |
| `checkpoint`   | text        | 재진입 위치 |
| `course_level` | text        | 코스           |
| `created_at`   | timestamptz | 생성           |
| `updated_at`   | timestamptz | 갱신           |


### 16-2. stage 값

대표 값:

- `1-1`
- `1-2`
- `1-boss`

미니보스 클리어는 일반 스테이지 ID의 완료로 저장될 수 있습니다.

### 16-3. checkpoint

현재 코드가 수용하는 문자열이며 DB enum은 아닙니다.

대표 값:

- `miniboss_ready`
- `done`

### 16-4. 완료 요청과 저장

요청의 `is_completed`를 바로 신뢰하지 않습니다. 서버가 attempts와 답안을 재검증한 뒤 저장합니다.

---

## 17. `wrong_answers` 테이블

```sql
CREATE TABLE wrong_answers (  
  id uuid PRIMARY KEY,  
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,  
  question_id text,  
  user_answer text,  
  feedback text,  
  ai_explanation text,  
  reviewed boolean DEFAULT false,  
  timestamp text,  
  created_at timestamptz DEFAULT now()  
);
```

### 17-1. 필드


| 필드           | 설명                         |
|------------------|--------------------------------|
| `question_id`    | 문제 ID                      |
| `user_answer`    | 제출 답                     |
| `feedback`       | 피드백                      |
| `ai_explanation` | 레거시 중복 설명 필드 |
| `reviewed`       | 복습 완료                  |
| `timestamp`      | 레거시 ISO 문자열        |
| `created_at`     | DB 생성 시각               |


### 17-2. 주의

- `feedback`과 `ai_explanation`은 의미가 겹칩니다.
- 신규 코드에서는 가능한 한 하나의 표시 우선순위를 정의해야 합니다.
- `timestamp`가 text이므로 정렬·범위 검색에서 파싱 비용이 있습니다.
- 장기적으로 `created_at`을 기준 시각으로 통일하는 것이 적합합니다.

---

## 18. `attempts` 테이블

```sql
CREATE TABLE attempts (  
id uuid PRIMARY KEY,  
user_id uuid REFERENCES users(id) ON DELETE CASCADE,  
question_id text NOT NULL,  
unit integer,  
stage text,  
level text,  
mode text NOT NULL,  
is_correct boolean NOT NULL,  
answered_at timestamptz DEFAULT now(),  
created_at timestamptz DEFAULT now()  
);
```

### 18-1. 필드


| 필드        | 설명                                       |
|---------------|----------------------------------------------|
| `question_id` | 원본 문제 ID                             |
| `unit`        | 유닛                                       |
| `stage`       | 스테이지                                 |
| `level`       | 코스                                       |
| `mode`        | 풀이 모드                                |
| `is_correct`  | 서버 재채점 또는 코드 채점 결과 |
| `answered_at` | 답안 시각                                |
| `created_at`  | 행 생성 시각                            |


### 18-2. 허용 mode

코드 기준:

- `quiz`
- `train`
- `random`
- `boss_rush`
- `miniboss`
- `unitboss`
- `endboss`

### 18-3. 인덱스

- `(user_id)`
- `(user_id, question_id)`
- `(user_id, unit)`

### 18-4. 정오답 신뢰

객관식·단답:

```text
클라이언트 is_correct  
→ 무시  
→ user_answer와 원본 answer 서버 비교  
→ 서버 결과 저장
```

코드형:

```text
/code/submit 결과  
→ attempts 기록에 전달
```

---

## 19. `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (  
  id uuid PRIMARY KEY,  
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,  
  token text UNIQUE NOT NULL,  
  expires_at timestamptz NOT NULL,  
  created_at timestamptz DEFAULT now()  
);
```

- 로그아웃·계정 삭제 시 사용자 토큰을 제거합니다.
- 사용자 삭제 시 cascade됩니다.
- 실제 저장 토큰의 해시 여부는 인증 구현을 기준으로 추가 검토합니다.

---

## 20. `reset_tokens`

```sql
CREATE TABLE reset_tokens (  
email text PRIMARY KEY,  
token text NOT NULL,  
expires_at timestamptz NOT NULL,  
failed_attempts integer DEFAULT 0,  
send_date text,  
send_count_today integer DEFAULT 0,  
last_sent timestamptz,  
created_at timestamptz DEFAULT now()  
);
```

### 20-1. 보안

- `token`은 원문이 아니라 SHA-256 digest를 저장합니다.
- `failed_attempts`로 반복 실패를 제한합니다.
- `send_date`, `send_count_today`로 일일 발송 제한을 관리합니다.
- `last_sent`는 재발송 cooldown 기준입니다.

---

## 21. `email_verification_codes`

```sql
CREATE TABLE email_verification_codes (  
  email text NOT NULL,  
  purpose text NOT NULL DEFAULT 'register',  
  code_hash text NOT NULL,  
  expires_at timestamptz NOT NULL,  
  attempts integer DEFAULT 0,  
  verified boolean DEFAULT false,  
  last_sent timestamptz,  
  verified_at timestamptz,  
  created_at timestamptz DEFAULT now(),  
  PRIMARY KEY (email, purpose)  
);
```

### 21-1. 실제 저장 구조


| 필드        | 설명                   |
|---------------|--------------------------|
| `email`       | 정규화된 이메일   |
| `purpose`     | 현재 기본 `register` |
| `code_hash`   | HMAC-SHA256              |
| `expires_at`  | 기본 5분              |
| `attempts`    | 오입력 횟수         |
| `verified`    | 인증 완료            |
| `last_sent`   | 재발송 cooldown       |
| `verified_at` | 인증 시각            |


### 21-2. API에 원문 코드 미노출

인증코드는 메일로만 전송하며 API 응답에는 포함하지 않습니다.

---

## 22. `update_user_atomic` RPC

목적:

```text
동시 read-modify-write에서 사용자 상태 유실 방지
```

입력:


| 파라미터       | 타입 | 설명              |
|--------------------|--------|---------------------|
| `p_user_id`        | uuid   | 대상 사용자    |
| `p_numeric_deltas` | jsonb  | 숫자 증가량    |
| `p_jsonb_merges`   | jsonb  | JSONB 병합        |
| `p_other_updates`  | jsonb  | 기타 덮어쓰기 |


보안:

```sql
REVOKE EXECUTE ... FROM public;  
REVOKE EXECUTE ... FROM anon;  
REVOKE EXECUTE ... FROM authenticated;
```

service role 백엔드만 호출해야 합니다.

### 22-1. 중요 한계

PostgreSQL `jsonb ||`는 최상위 병합입니다.

```json
{  
"a": {  
"x": 1,  
"y": 2  
}  
}
```

에 다음을 병합하면:

```json
{  
  "a": {  
    "x": 3  
  }  
}
```

중첩 `y`가 유지되는 deep merge가 아닙니다.

복잡한 JSONB 상태는 애플리케이션에서 최신 전체 객체를 계산해 저장하거나 전용 RPC를 사용해야 합니다.

---

# Part C. API 요청·응답 계약

---

## 23. 회원가입

### 23-1. `RegisterRequest`

```json
{  
"username": "lowercase_id",  
"password": "password",  
"nickname": "닉네임",  
"email": "user@example.com",  
"course_level": "beginner",  
"is_level_tested": false,  
"marketing_agreed": false  
}
```


| 필드             | 타입  | 기본값  |
|--------------------|---------|------------|
| `username`         | string  | 필수     |
| `password`         | string  | 필수     |
| `nickname`         | string  | `""`       |
| `email`            | string  | `""`       |
| `course_level`     | string  | `beginner` |
| `is_level_tested`  | boolean | false      |
| `marketing_agreed` | boolean | false      |


### 23-2. 현재 구현 주의

현재 등록 코드가 `course_level`과 `is_level_tested`를 요청에서 받습니다.

따라서 문서상 현재 계약은 이를 허용하지만, 제품 정책상 레벨 테스트 완료 여부를 서버 전용으로 제한하려면 코드 변경이 필요합니다.

### 23-3. 성공 응답

```json
{  
  "access_token": "jwt",  
  "refresh_token": "token",  
  "token_type": "bearer",  
  "user": {}  
}
```

---

## 24. 이메일 인증

### 24-1. 발송 요청

```json
{  
"email": "user@example.com",  
"purpose": "register"  
}
```

응답:

```json
{  
  "ok": true,  
  "message": "인증코드를 발송했습니다.",  
  "ttl_seconds": 300,  
  "cooldown_seconds": 60  
}
```

### 24-2. 검증 요청

```json
{  
"email": "user@example.com",  
"code": "123456",  
"purpose": "register"  
}
```

응답:

```json
{  
  "ok": true,  
  "message": "이메일 인증이 완료되었습니다."  
}
```

---

## 25. 프로필 변경

### 25-1. `UpdateProfileRequest`

```json
{  
"nickname": "새 닉네임",  
"character": "robot",  
"course_level": "intermediate",  
"is_level_tested": true,  
"equipped_title": "boss_slayer"  
}
```

모든 필드는 선택입니다.

### 25-2. 서버 검증

- 닉네임 중복
- 캐릭터 진화 단계
- 코스 해금
- 보유 칭호
- `course_level` 허용값

### 25-3. 현재 구현 주의

`is_level_tested=true`와 `course_level`을 함께 보내면 레벨 배치 로직을 실행할 수 있습니다.

이 값이 일반 설정 화면에서 노출되지 않더라도 API 계약상 존재합니다. 권한을 강화하려면 레벨 테스트 전용 엔드포인트 외 경로에서 제거하는 방안을 검토해야 합니다.

---

## 26. 진도 저장

요청:

```json
{  
  "unit": 1,  
  "stage": "1-1",  
  "score": 80,  
  "is_completed": true,  
  "checkpoint": "done",  
  "answered_questions": [  
    {  
      "question_id": "q001",  
      "user_answer": "A"  
    }  
  ]  
}
```


| 필드               | 타입      | 설명                  |
|----------------------|-------------|-------------------------|
| `unit`               | integer     | 유닛                  |
| `stage`              | string      | 스테이지            |
| `score`              | integer     | 점수                  |
| `is_completed`       | boolean     | 완료 요청           |
| `checkpoint`         | string/null | 재진입 상태        |
| `answered_questions` | array/null  | attempt 유실 fallback |


서버는 `answered_questions[].is_correct`를 받지 않습니다. `user_answer`를 재채점합니다.

응답의 주요 필드:

```json
{  
"message": "진행상황이 저장되었습니다.",  
"xp_awarded": 2000,  
"crowns_awarded": 0,  
"character": "slime",  
"lv": 1,  
"newly_earned_titles": [],  
"reward": {  
"coin_delta": 2000,  
"gp_delta": 0,  
"ranking_score_delta": 2000  
},  
"user_state": {}  
}
```

`xp_awarded`는 하위 호환 이름입니다.

---

## 27. 풀이 기록

요청:

```json
{  
  "question_id": "q001",  
  "unit": 1,  
  "stage": "1-1",  
  "level": "beginner",  
  "mode": "quiz",  
  "is_correct": true,  
  "user_answer": "A"  
}
```

서버 직접 채점 유형:

- `multiple_choice`
- `output_select`
- `error_find`
- `fill_in_blank`

응답:

```json
{  
"success": true,  
"is_correct": true,  
"feedback": "정답 피드백",  
"hint": "",  
"correct_answer": "A",  
"explanation": ""  
}
```

정답은 제출 후 응답에만 포함됩니다.

---

## 28. 코드 채점

요청:

```json
{  
  "question_id": "unitboss_adv_ci_1_009",  
  "code": "def gen_range(n):\n    yield from range(n)",  
  "output": "[0, 1, 2, 3]\n",  
  "error": "",  
  "unit": 1,  
  "stage": "1-boss",  
  "course_level": "advanced",  
  "award": false  
}
```

응답 주요 필드:

```json
{  
"is_correct": true,  
"score": 100,  
"feedback": "피드백",  
"hint": "",  
"grading_failed": false,  
"xp_awarded": 0,  
"reward": {  
"coin_delta": 0,  
"gp_delta": 0,  
"ranking_score_delta": 0  
}  
}
```

`award=false`는 보상과 진도 저장을 하지 않습니다.

---

## 29. 배틀 토큰

토큰 내부 payload:

```json
{  
  "mode": "miniboss",  
  "unit": 1,  
  "stage": "1-1",  
  "user_id": "uuid",  
  "sid": "nonce",  
  "ts": 1780000000  
}
```

- HMAC-SHA256 서명
- 사용자 소유권 검증
- 모드 검증
- 30분 만료

클라이언트는 payload를 상태 권한으로 사용할 수 없습니다.

---

## 30. 미니보스 답안

요청:

```json
{  
"question_id": "mb1_1_1_001",  
"user_answer": "A",  
"battle_token": "signed-token",  
"unit": 1,  
"stage": "1-1",  
"code_is_correct": null  
}
```

과거 제거 필드:

- `my_hp`
- `boss_hp`
- `wrong_count`

HP는 서버 세션에서 계산합니다.

---

## 31. 유닛보스 답안

요청:

```text
{  
  "question_id": "unitboss_beg_os_1_001",  
  "user_answer": "B",  
  "battle_token": "signed-token",  
  "is_code_question": false,  
  "unit": 1  
}
```

과거 제거 필드:

- `my_hp`
- `boss_hp`
- `wrong_count`

---

## 32. 미션 수령

요청:

```text
{  
"mission_id": "d_quiz3"  
}
```

응답:

```text
{  
  "mission_id": "d_quiz3",  
  "already_claimed": false,  
  "xp_awarded": 300,  
  "crowns_awarded": 0,  
  "reward": {  
    "coin_delta": 300,  
    "gp_delta": 0,  
    "ranking_score_delta": 300  
  },  
  "user_state": {}  
}
```

`xp_awarded`는 레거시 이름입니다.

---

## 33. 게임 시작·클리어

### 33-1. 시작

요청:

```text
{  
"game_id": "runner"  
}
```

응답:

```text
{  
  "game_token": "signed-token"  
}
```

에이칸은 퍼즐 데이터가 추가됩니다.

### 33-2. 공통 클리어 요청

```text
{  
"game_id": "runner",  
"distance": 2500,  
"score": null,  
"puzzle_id": null,  
"answers": null,  
"correct_count": null,  
"game_token": "signed-token"  
}
```

게임별 사용 필드:


| 게임    | 필드                    |
|----------:|--------------------------:|
| `aipang`  | token                     |
| `runner`  | `distance` 또는 `score` |
| `aizzak`  | `correct_count`           |
| `aibomb`  | `correct_count`           |
| `aicross` | `puzzle_id`, `answers`    |


응답:

```text
{  
  "crowns_awarded": 0,  
  "xp_awarded": 350,  
  "score": 2500,  
  "already_claimed": false,  
  "reward": {  
    "coin_delta": 350,  
    "gp_delta": 0,  
    "ranking_score_delta": 350  
  },  
  "user_state": {}  
}
```

---

## 34. 에이칸 전용 API

### 시작

```text
{  
"set_index": 0  
}
```

응답:

```text
{  
  "game_token": "signed-token",  
  "set_index": 0,  
  "set_label": "세트명",  
  "puzzle": {  
    "grid_size": {},  
    "entries": []  
  }  
}
```

### 클리어

```text
{  
"game_token": "signed-token",  
"set_index": 0,  
"answers": {  
"A1": "LIST",  
"D1": "LOOP"  
}  
}
```

정답 문자열은 응답에 포함하지 않습니다.

---

# Part D. 레거시·마이그레이션·검수

---

## 35. 레거시 필드


| 필드                        | 현재 상태                                          |
|------------------------------:|-------------------------------------------------------:|
| `xp`                          | DB와 응답에 유지                                 |
| `xp_awarded`                  | 여러 API 응답에 하위 호환 이름으로 유지 |
| `xp_reward`                   | 보스 정보 응답에 하위 호환 가능           |
| `daily_xp`                    | 게임 일일 보상 캡 상태 키                    |
| `total_xp`                    | 응답 하위 호환                                   |
| `character`                   | 진화 단계 표시·선택 호환                    |
| `lv`                          | 최종 진화 전 동결, 이후 GP 기반             |
| `weekly_ranking_score` 컬럼 | 런타임 SSOT 아님                                  |
| `quiz_category: final_boss`   | 엔드보스 데이터 내부 레거시                |
| `feedback.wrong`              | 기존 문제 호환                                   |
| `ai_explanation`              | wrong_answers 중복 필드                            |


레거시 필드를 제거할 때는 프론트, 테스트, 백업 데이터, Supabase, 마이그레이션을 동시에 점검해야 합니다.

---

## 36. 현재 불일치와 주의사항

### 36-1. 코드와 운영 DB

코드는 신규 재화 필드가 있다고 가정하는 경로가 있습니다. 별도 마이그레이션 파일은 운영 미적용 초안으로 표시돼 있습니다.

결론:

```json
Git 코드 지원 여부 ≠ 운영 DB 컬럼 존재 여부
```

### 36-2. `is_level_tested`

현재 회원가입과 프로필 변경 요청에 포함됩니다. 서버 전용 상태로 만들려면 요청 스키마와 라우터 변경이 필요합니다.

### 36-3. 미니보스 `pass_score`

콘텐츠에 `70`이 있지만 서버 승패는 4정답/2오답 상수입니다.

### 36-4. 유닛보스 hint

과거 문서는 없음으로 적었지만 현재 데이터에는 있습니다.

### 36-5. 엔드보스 명칭

디렉터리·라우터는 `endboss`, JSON 카테고리는 `final_boss`입니다.

### 36-6. 시간 타입


| 데이터                  | 형식                   |
|---------------------------:|-------------------------:|
| `created_at`, `updated_at` | timestamptz 중심       |
| `last_login`               | `YYYY-MM-DD` text        |
| `last_free_attempt_date`   | `YYYY-MM-DD` text        |
| 게임 일자              | `YYYY-MM-DD` JSON string |
| wrong_answers `timestamp`  | ISO text                 |
| 배틀 `exp`               | Unix timestamp integer   |


시간 필드가 통일돼 있지 않으므로 비교 시 KST와 타입을 명시해야 합니다.

### 36-7. 사용자와 progress 트랜잭션

사용자 JSONB와 progress는 별도 저장 단위입니다. 일부 클리어 흐름은 완전한 단일 DB 트랜잭션이 아닙니다.

---

## 37. 콘텐츠 제작 검수

### 레슨

- `lesson_id`와 파일 코스 일치
- `stage`와 `unit` 일치
- `slides.order` 중복 없음
- 코드·출력 배열 타입 확인
- 잘못된 악당 키 없음

### 문제

- `question_id` 전역 충돌 없음
- `unit`, `stage`, 파일 경로 일치
- `type` 허용값
- 선택형 `choices` 존재
- `answer` 형식이 채점기와 일치
- Markdown 코드블록 닫힘
- 오류 찾기 줄 번호 형식 통일
- Set A/B 분배 확인
- 정답·해설 사전 API 노출 없음
- 코드형 `expected_output` 줄바꿈 확인
- `code_template` 슬롯 수와 answer 배열 길이 일치

### 엔드보스

- `phase` 1~3
- `project` 일치
- `question_id`에 코스·프로젝트·페이즈 식별 가능
- P1/P2/P3 유형이 설계와 일치
- `final_boss` 레거시 값 변경 여부 사전 검토

### 미션

- `mission_id` 중복 없음
- `event` 실제 코드 이벤트와 일치
- `goal` 양수
- reward 키 허용
- UI 제목과 실제 조건 일치

---

## 38. DB 적용 검수

### 기본 테이블

- `users`
- `refresh_tokens`
- `reset_tokens`
- `email_verification_codes`
- `progress`
- `wrong_answers`
- `attempts`

### 사용자 컬럼

- soft delete `deleted_at`
- optimistic concurrency `version`
- `battle_sessions`
- `missions`
- `purchased_themes`
- 코인·GP·랭킹 신규 컬럼

### 인덱스

- 활성 username lower unique
- 활성 email lower unique
- attempts user 인덱스
- progress composite unique

### RPC

- `update_user_atomic` 존재
- public/anon/authenticated execute revoke
- service role 호출 확인

### 데이터

- 신규 컬럼 backfill
- `character`와 `evolution_stage` 일치
- `legacy_xp_snapshot` 필요 여부
- JSONB null·잘못된 타입 정리
- 중복 닉네임 현황 확인

---

## 39. API 회귀 검수

- 문제 조회에서 정답 제거
- 제출 후에만 정답 반환
- 객관식 서버 재채점
- 코드 채점 실패 무보상
- battle_token 소유자·만료 검증
- 클라이언트 HP 무시
- 스테이지 완료 서버 게이트
- 미션 중복 수령 차단
- 게임 nonce 중복 사용 차단
- 게임 일일 횟수·캡
- 코인·랭킹·GP 응답 일치
- `GET /user/me`에서 비밀번호 제거
- 소프트 삭제 사용자 제외
- 레거시 필드 프론트 호환

---

## 40. 권장 장기 정리

현재 동작을 깨지 않고 순차적으로 검토할 항목입니다.

1. 문제 컨테이너를 `{"questions":[]}`로 통일
2. 엔드보스 `quiz_category`를 계획된 마이그레이션으로 정리
3. `feedback.wrong`과 `feedback.incorrect` 통일
4. `wrong_answers.feedback`과 `ai_explanation` 통합
5. 시간 필드를 timestamptz 중심으로 정리
6. `miniboss_cleared_stages`에 코스 네임스페이스 추가
7. `game_rewards`를 도메인별 구조 또는 별도 테이블로 분리
8. 코드 채점 서버 샌드박스 도입
9. `is_level_tested` 쓰기 권한을 레벨 테스트 전용 경로로 제한
10. 신규 재화 마이그레이션의 운영 적용 상태를 문서 메타데이터로 관리
11. DB 제약조건으로 course, mode, evolution_stage 범위 보강
12. API 응답의 레거시 `xp_*` 필드 단계적 제거


---

## 41. 주요 소스 파일

### 정적 데이터

- `backend/data/lessons.json`
- `backend/data/lessons_intermediate.json`
- `backend/data/lessons_advanced.json`
- `backend/data/lessons/`
- `backend/data/quiz/`
- `backend/data/miniboss/`
- `backend/data/unitboss/`
- `backend/data/endboss/`
- `backend/data/missions.json`
- `backend/data/aicross_puzzles.json`
- `backend/data/aicross_sets.json`

### DB

- `backend/data/schema.sql`
- `backend/data/migration_gp_coin_additive.sql`
- `backend/scripts/backfill_gp_coin.py`

### 백엔드

- `backend/routers/auth/register.py`
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
- `backend/routers/mission.py`
- `backend/routers/missions_core.py`
- `backend/routers/game.py`
- `backend/routers/game_aicross.py`
- `backend/routers/game_ranking.py`

---

> 
> 보안 주의: 비밀번호 해시, JWT 비밀키, 이메일 인증 원문 코드, Supabase service role 키, Claude API 키는 문서 예시나 GitHub 데이터 파일에 저장하지 않습니다.
> 

 
