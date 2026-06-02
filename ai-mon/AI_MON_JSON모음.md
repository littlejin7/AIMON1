> 에이몬(AI MON) 프로젝트에서 생성한 JSON 파일 전체 목록 및 구조 정리 문서
> 

> 기준: 노션 파이프라인.md v1 | 작성일: 2026-06-02
> 

---

## 📁 기본 데이터 구조 (v2)

파이프라인 섹션 6 기준 4개 핵심 파일

| 파일명 | 설명 |
| --- | --- |
| `questions.json` | 문제 데이터 (question_id / unit / stage / level / type / choices / answer / explanation) |
| `users.json` | 유저 데이터 (user_id / nickname / level / xp / crowns / streak / avatar_stage) |
| `progress.json` | 진도 데이터 (units > stages + boss + training 중첩 구조) |
| `wrong_answers.json` | 오답 데이터 (question_id / user_answer / correct_answer / ai_explanation / wrong_count) |

**핵심 필드 규칙**

- `level` : beginner / intermediate / advanced
- `type` : multiple_choice/code_input
- `choices` : A. B. C. D. 형식 (코드입력은 null)
- `answer` : 알파벳 키 (A / B / C / D) 또는 코드 문자열
- `explanation` : 정답 시 그대로 출력 (API 호출 없음)

---

## 🎯 퀴즈 유형 정의 (파이프라인 섹션 16)

| 유형 | 설명 | Judge0 필요 |
| --- | --- | --- |
| `multiple_choice` | 선택지 중 하나 고르기 | ❌ |
| `output_select` | 코드 실행 결과 선택 | ❌ |
| `fill_in_blank` | 빈칸 채우기 | ❌ |
| `code_input` | 직접 코드 작성 | ✅ |

**화면별 유형 배정**

| 화면 | 초급 | 중급 | 고급 |
| --- | --- | --- | --- |
| 스테이지 레슨 | multiple_choice | multiple_choice + output_select | output_select + fill_in_blank |
| 개념체크 퀴즈 | multiple_choice | fill_in_blank | fill_in_blank + output_select |
| 일반 보스 | multiple_choice + output_select | output_select + fill_in_blank | fill_in_blank + code_input |
| 파이널 보스 | output_select + fill_in_blank | fill_in_blank + code_input | code_input 위주 |

---

## 📂 초급 JSON 파일 목록 (v3)

| 파일명 | 화면 | 퀴즈 유형 | 문제 수 |
| --- | --- | --- | --- |
| `stage_lesson_beginner.json` | 스테이지 레슨 | multiple_choice | 3 |
| `concept_check_beginner.json` | 개념체크 퀴즈 | multiple_choice | 3 |
| `boss_beginner.json` | 일반 보스 | multiple_choice + output_select | 3 |
| `final_boss_beginner.json` | 파이널 보스 | output_select + fill_in_blank | 4 |

---

## 💾 초급 유형별 JSON 코드 (v6)

### stage_lesson_beg_multiple_choice.json

```json
{
  "type": "stage_lesson",
  "level": "beginner",
  "quiz_type": "multiple_choice",
  "unit": 1,
  "stage": "1-1",
  "stage_title": "Hello, Python!",
  "pass_score": 80,
  "questions": [
    {
      "question_id": "sl_beg_mc_1_1_001",
      "type": "multiple_choice",
      "question": "print()의 역할은 무엇인가요?",
      "choices": ["A. 값을 저장한다","B. 값을 출력한다","C. 값을 삭제한다","D. 값을 계산한다"],
      "answer": "B",
      "explanation": "print()는 괄호 안의 값을 화면에 출력하는 함수예요."
    },
    {
      "question_id": "sl_beg_mc_1_1_002",
      "type": "multiple_choice",
      "question": "Python에서 주석을 작성할 때 사용하는 기호는?",
      "choices": ["A. //","B. --","C. #","D. /*"],
      "answer": "C",
      "explanation": "# 뒤에 오는 내용은 Python이 무시해요. 코드 설명을 적을 때 사용해요."
    },
    {
      "question_id": "sl_beg_mc_1_1_003",
      "type": "multiple_choice",
      "question": "다음 중 올바른 print() 사용법은?",
      "choices": ["A. print[Hello]","B. print Hello","C. print('Hello')","D. Print('Hello')"],
      "answer": "C",
      "explanation": "print()는 소문자로 쓰고, 출력할 내용은 괄호 안에 따옴표로 감싸야 해요."
    }
  ]
}
```

### concept_check_beg_multiple_choice.json

```json
{
  "type": "concept_check",
  "level": "beginner",
  "quiz_type": "multiple_choice",
  "unit": 1,
  "stage": "1-1",
  "villain": "codemmon",
  "pass_score": 80,
  "questions": [
    {
      "question_id": "cc_beg_mc_1_1_001",
      "type": "multiple_choice",
      "question": "print('에이몬') 을 실행하면 화면에 무엇이 출력될까요?",
      "choices": ["A. '에이몬'","B. 에이몬","C. print(에이몬)","D. 오류 발생"],
      "answer": "B",
      "explanation": "따옴표는 문자열 표시일 뿐이에요. 화면엔 따옴표 없이 에이몬만 출력돼요."
    },
    {
      "question_id": "cc_beg_mc_1_1_002",
      "type": "multiple_choice",
      "question": "다음 중 주석 처리된 줄은?",
      "choices": ["A. print('Hello')","B. # print('Hello')","C. //print('Hello')","D. --print('Hello')"],
      "answer": "B",
      "explanation": "# 기호가 앞에 붙으면 그 줄 전체가 주석이 돼요. Python이 완전히 무시해요."
    },
    {
      "question_id": "cc_beg_mc_1_1_003",
      "type": "multiple_choice",
      "question": "print()를 두 번 쓰면 출력은 어떻게 될까요?\n\nprint('안녕')\nprint('에이몬')",
      "choices": ["A. 안녕에이몬 (한 줄)","B. 안녕 / 에이몬 (두 줄)","C. 오류 발생","D. 아무것도 출력 안 됨"],
      "answer": "B",
      "explanation": "print()를 한 번 쓸 때마다 줄바꿈이 자동으로 일어나요. 두 번 쓰면 두 줄이 출력돼요."
    }
  ]
}
```

### boss_beg_multiple_choice.json

```json
{
  "type": "boss",
  "level": "beginner",
  "quiz_type": "multiple_choice",
  "unit": 1,
  "boss_name": "코드몬 Unit 1 보스",
  "villain": "boss",
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
      "choices": ["A. print('에이몬')","B. # print('에이몬')","C. print('# 에이몬')","D. print('에이몬') # 출력"],
      "answer": "B",
      "explanation": "줄 맨 앞에 # 이 붙으면 그 줄 전체가 주석이에요. C는 따옴표 안 #이라 문자로 출력되고, D는 # 뒤만 무시돼요."
    },
    {
      "question_id": "boss_beg_mc_1_002",
      "type": "multiple_choice",
      "question": "print() 함수에서 값 사이에 자동으로 공백을 넣어주는 구분 방식은?",
      "choices": ["A. + 기호로 연결","B. 쉼표(,)로 구분","C. 세미콜론(;)으로 구분","D. 슬래시(/)로 구분"],
      "answer": "B",
      "explanation": "쉼표(,)로 값을 구분하면 print()가 각 값 사이에 공백을 자동으로 넣어줘요."
    }
  ]
}
```

### boss_beg_output_select.json

```json
{
  "type": "boss",
  "level": "beginner",
  "quiz_type": "output_select",
  "unit": 1,
  "boss_name": "코드몬 Unit 1 보스",
  "villain": "boss",
  "pass_score": 80,
  "free_attempts_per_day": 2,
  "crown_cost_from_attempt": 3,
  "hints_allowed": 2,
  "xp_reward": 2000,
  "questions": [
    {
      "question_id": "boss_beg_os_1_001",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nprint('코드몬' + '을' + ' 물리쳐라!')\n# print('게임 오버')\nprint('승리!')",
      "choices": ["A. 코드몬을 물리쳐라! / 게임 오버 / 승리!","B. 코드몬을 물리쳐라! / 승리!","C. 코드몬 + 을 + 물리쳐라! / 승리!","D. 오류 발생"],
      "answer": "B",
      "explanation": "+ 는 문자열을 이어붙이고, # 주석 줄은 무시돼요. 출력되는 줄은 2개예요."
    },
    {
      "question_id": "boss_beg_os_1_002",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nprint('XP 획득:', 2000, 'XP')\nprint('레벨업!')",
      "choices": ["A. XP 획득:2000XP / 레벨업!","B. XP 획득: 2000 XP / 레벨업!","C. XP 획득: 2000XP / 레벨업!","D. 오류 발생"],
      "answer": "B",
      "explanation": "쉼표(,)로 구분된 값들은 출력 시 사이에 공백이 자동으로 들어가요."
    }
  ]
}
```

### final_boss_beg_output_select.json

```json
{
  "type": "final_boss",
  "level": "beginner",
  "quiz_type": "output_select",
  "boss_name": "파이널 보스 — 검정 에이몬",
  "villain": "final_boss",
  "unlock_condition": "Unit 8 보스 클리어 후 해금",
  "hints_allowed": 0,
  "xp_reward": 5000,
  "questions": [
    {
      "question_id": "fb_beg_os_001",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nname = '에이몬'\nlevel = 8\nprint(f'{name}이 Lv.{level}로 최종 진화했습니다!')\n# print('슬라임 시절이 그립다')\nprint('축하합니다!')",
      "choices": ["A. 에이몬이 Lv.8로 최종 진화했습니다! / 슬라임 시절이 그립다 / 축하합니다!","B. 에이몬이 Lv.8로 최종 진화했습니다! / 축하합니다!","C. {name}이 Lv.{level}로 최종 진화했습니다! / 축하합니다!","D. 오류 발생"],
      "answer": "B",
      "explanation": "f-string은 {} 안의 변수를 값으로 치환해요. # 주석은 무시되고, 출력은 2줄이에요."
    },
    {
      "question_id": "fb_beg_os_002",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nresult = []\nfor i in range(3):\n    result.append(i * 100)\nprint(result)",
      "choices": ["A. [0, 100, 200]","B. [100, 200, 300]","C. 0 100 200","D. 오류 발생"],
      "answer": "A",
      "explanation": "range(3)은 0, 1, 2를 순서대로 반환해요. 각각 * 100 하면 0, 100, 200이고 리스트로 출력돼요."
    }
  ]
}
```

### final_boss_beg_fill_in_blank.json

```json
{
  "type": "final_boss",
  "level": "beginner",
  "quiz_type": "fill_in_blank",
  "boss_name": "파이널 보스 — 검정 에이몬",
  "villain": "final_boss",
  "unlock_condition": "Unit 8 보스 클리어 후 해금",
  "hints_allowed": 0,
  "xp_reward": 5000,
  "questions": [
    {
      "question_id": "fb_beg_fib_001",
      "type": "fill_in_blank",
      "question": "빈칸을 채워 '에이몬 최종 진화 완료!' 를 출력하세요.\n\n_____('에이몬 최종 진화 완료!')",
      "choices": null,
      "answer": "print",
      "explanation": "print() 함수를 사용하면 괄호 안의 내용을 화면에 출력할 수 있어요."
    },
    {
      "question_id": "fb_beg_fib_002",
      "type": "fill_in_blank",
      "question": "빈칸을 채워 f-string으로 결과를 출력하세요.\n출력 목표: 최종 점수: 9999\n\nscore = 9999\nprint(___'최종 점수: {score}')",
      "choices": null,
      "answer": "f",
      "explanation": "f-string은 문자열 앞에 f를 붙이고, {} 안에 변수를 넣으면 값이 자동으로 삽입돼요."
    }
  ]
}
```

---

## 📂 중급 JSON 파일 목록

### v3 — 화면 단위 통합

| 파일명 | 화면 | 퀴즈 유형 | 문제 수 |
| --- | --- | --- | --- |
| `stage_lesson_intermediate.json` | 스테이지 레슨 | multiple_choice + output_select | 3 |
| `concept_check_intermediate.json` | 개념체크 퀴즈 | fill_in_blank | 3 |
| `boss_intermediate.json` | 일반 보스 | output_select + fill_in_blank | 3 |
| `final_boss_intermediate.json` | 파이널 보스 | fill_in_blank + code_input | 4 |

### v4 — 유형별 분리

| 파일명 | 화면 | 퀴즈 유형 | 문제 수 |
| --- | --- | --- | --- |
| `stage_lesson_mid_multiple_choice.json` | 스테이지 레슨 | multiple_choice | 3 |
| `stage_lesson_mid_output_select.json` | 스테이지 레슨 | output_select | 3 |
| `concept_check_mid_fill_in_blank.json` | 개념체크 퀴즈 | fill_in_blank | 3 |
| `boss_mid_output_select.json` | 일반 보스 | output_select | 3 |
| `boss_mid_fill_in_blank.json` | 일반 보스 | fill_in_blank | 3 |
| `final_boss_mid_fill_in_blank.json` | 파이널 보스 | fill_in_blank | 3 |
| `final_boss_mid_code_input.json` | 파이널 보스 | code_input | 3 |

---

## 💾 중급 유형별 JSON 코드 (v4)

### stage_lesson_mid_multiple_choice.json

```json
{
  "type": "stage_lesson",
  "level": "intermediate",
  "quiz_type": "multiple_choice",
  "unit": 1,
  "stage": "1-1",
  "stage_title": "Hello, Python!",
  "pass_score": 80,
  "questions": [
    {
      "question_id": "sl_mid_mc_1_1_001",
      "type": "multiple_choice",
      "question": "print()에서 쉼표(,)와 + 의 차이로 올바른 것은?",
      "choices": ["A. 둘 다 공백 없이 이어붙인다","B. + 는 공백 추가, 쉼표는 공백 없음","C. 쉼표는 자동 공백 추가, + 는 공백 없이 이어붙임","D. 둘 다 동일하게 동작한다"],
      "answer": "C",
      "explanation": "쉼표(,)로 구분하면 print()가 값 사이에 공백을 자동 삽입합니다. + 는 문자열을 공백 없이 직접 연결해요."
    },
    {
      "question_id": "sl_mid_mc_1_1_002",
      "type": "multiple_choice",
      "question": "숫자를 문자열과 + 로 연결할 때 반드시 필요한 변환 함수는?",
      "choices": ["A. int()","B. str()","C. float()","D. len()"],
      "answer": "B",
      "explanation": "숫자(int, float)를 문자열과 + 로 이어붙이려면 str()로 변환해야 해요. 변환 없이 + 연결 시 TypeError가 발생합니다."
    },
    {
      "question_id": "sl_mid_mc_1_1_003",
      "type": "multiple_choice",
      "question": "f-string에서 {} 안에 넣을 수 없는 것은?",
      "choices": ["A. 변수명","B. 산술 연산식 (x * 2)","C. 함수 호출 (len(name))","D. 여러 줄 주석"],
      "answer": "D",
      "explanation": "f-string의 {} 안에는 변수, 연산식, 함수 호출 모두 가능해요. 하지만 여러 줄 주석(# 포함)은 넣을 수 없어요."
    }
  ]
}
```

### stage_lesson_mid_output_select.json

```json
{
  "type": "stage_lesson",
  "level": "intermediate",
  "quiz_type": "output_select",
  "unit": 1,
  "stage": "1-1",
  "pass_score": 80,
  "questions": [
    {
      "question_id": "sl_mid_os_1_1_001",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nprint('에이몬', 'Lv', 5)\nprint('에이몬' + 'Lv' + str(5))",
      "choices": ["A. 에이몬 Lv 5 / 에이몬Lv5","B. 에이몬Lv5 / 에이몬 Lv 5","C. 에이몬 Lv 5 / 에이몬 Lv 5","D. 오류 발생"],
      "answer": "A",
      "explanation": "쉼표는 공백 자동 삽입 → '에이몬 Lv 5', + 는 공백 없이 연결 → '에이몬Lv5'예요."
    },
    {
      "question_id": "sl_mid_os_1_1_002",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nx = 10\nprint(f'결과는 {x * 2}입니다.')",
      "choices": ["A. 결과는 {x * 2}입니다.","B. 결과는 x * 2입니다.","C. 결과는 20입니다.","D. 오류 발생"],
      "answer": "C",
      "explanation": "f-string의 {} 안 연산식은 실행 결과로 치환돼요. x * 2 = 20이 계산되어 출력됩니다."
    },
    {
      "question_id": "sl_mid_os_1_1_003",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nname = '에이몬'\nscore = 99.5\nprint(f'{name} 점수: {score:.1f}점')",
      "choices": ["A. 에이몬 점수: 99.5점","B. 에이몬 점수: 99점","C. 에이몬 점수: 100.0점","D. 오류 발생"],
      "answer": "A",
      "explanation": ":.1f는 소수점 1자리까지 표시해요. 99.5는 이미 소수점 1자리라 그대로 출력돼요."
    }
  ]
}
```

### concept_check_mid_fill_in_blank.json

```json
{
  "type": "concept_check",
  "level": "intermediate",
  "quiz_type": "fill_in_blank",
  "unit": 1,
  "stage": "1-1",
  "villain": "codemmon",
  "pass_score": 80,
  "questions": [
    {
      "question_id": "cc_mid_fib_1_1_001",
      "type": "fill_in_blank",
      "question": "숫자 42를 문자열로 변환하여 + 로 이어붙이는 빈칸을 채우세요.\n\nprint('점수: ' + _____(42))",
      "answer": "str",
      "explanation": "숫자를 문자열과 + 로 연결하려면 str()로 먼저 변환해야 해요."
    },
    {
      "question_id": "cc_mid_fib_1_1_002",
      "type": "fill_in_blank",
      "question": "f-string으로 변수 name과 score를 출력하는 빈칸을 채우세요.\n출력 목표: 에이몬: 100점\n\nname = '에이몬'\nscore = 100\nprint(___'{name}: {score}점')",
      "answer": "f",
      "explanation": "f-string은 문자열 앞에 f를 붙이고 {} 안에 변수명을 넣으면 값이 자동 삽입돼요."
    },
    {
      "question_id": "cc_mid_fib_1_1_003",
      "type": "fill_in_blank",
      "question": "다음 코드의 빈칸을 채워 소수점 2자리로 출력하세요.\n출력 목표: 승률: 87.65%\n\nrate = 87.654\nprint(f'승률: {rate:_____}%')",
      "answer": ".2f",
      "explanation": ":.2f는 소수점 아래 2자리까지 반올림하여 고정 출력하는 f-string 포맷 지정자예요."
    }
  ]
}
```

### boss_mid_output_select.json

```json
{
  "type": "boss",
  "level": "intermediate",
  "quiz_type": "output_select",
  "unit": 1,
  "boss_name": "코드몬 Unit 1 보스",
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
      "choices": ["A. 에이몬의 HP: 100 / 공격 받음! / 남은 HP: 70","B. 에이몬의 HP: 70 / 남은 HP: 70","C. 에이몬의 HP: {hp - 30} / 남은 HP: {hp - 30}","D. 오류 발생"],
      "answer": "B",
      "explanation": "f-string {} 안 연산식이 계산되어 출력돼요. # 주석은 무시되고 2줄만 출력됩니다."
    },
    {
      "question_id": "boss_mid_os_1_002",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nresult = 10 // 3\nprint('몫:', result)\nprint('나머지:', 10 % 3)",
      "choices": ["A. 몫: 3.33 / 나머지: 1","B. 몫: 3 / 나머지: 1","C. 몫: 3 / 나머지: 0","D. 오류 발생"],
      "answer": "B",
      "explanation": "// 는 정수 나누기(몫만), % 는 나머지를 반환해요. 10 // 3 = 3, 10 % 3 = 1이에요."
    },
    {
      "question_id": "boss_mid_os_1_003",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nscores = [90, 80, 70]\nprint(f'최고: {max(scores)}, 최저: {min(scores)}')",
      "choices": ["A. 최고: {max(scores)}, 최저: {min(scores)}","B. 최고: 90, 최저: 70","C. 최고: 70, 최저: 90","D. 오류 발생"],
      "answer": "B",
      "explanation": "f-string {} 안에서 max(), min() 함수 호출도 가능해요. 결과값이 바로 삽입돼요."
    }
  ]
}
```

### boss_mid_fill_in_blank.json

```json
{
  "type": "boss",
  "level": "intermediate",
  "quiz_type": "fill_in_blank",
  "unit": 1,
  "boss_name": "코드몬 Unit 1 보스",
  "pass_score": 80,
  "free_attempts_per_day": 2,
  "crown_cost_from_attempt": 3,
  "hints_allowed": 2,
  "xp_reward": 2000,
  "questions": [
    {
      "question_id": "boss_mid_fib_1_001",
      "type": "fill_in_blank",
      "question": "빈칸을 채워 '에이몬 보스 클리어! XP: 2000' 을 출력하세요.\n\nxp = 2000\nprint(___'에이몬 보스 클리어! XP: {xp}')",
      "answer": "f",
      "explanation": "f-string은 문자열 앞에 f를 붙여요. {} 안의 변수 xp가 2000으로 치환되어 출력됩니다."
    },
    {
      "question_id": "boss_mid_fib_1_002",
      "type": "fill_in_blank",
      "question": "빈칸을 채워 리스트 길이를 출력하세요.\n출력 목표: 유닛 수: 8\n\nunits = [1, 2, 3, 4, 5, 6, 7, 8]\nprint('유닛 수:', _____(units))",
      "answer": "len",
      "explanation": "len() 함수는 리스트, 문자열 등의 요소 수를 반환해요. len(units) = 8이에요."
    },
    {
      "question_id": "boss_mid_fib_1_003",
      "type": "fill_in_blank",
      "question": "빈칸을 채워 딕셔너리 값에 접근해 출력하세요.\n출력 목표: 에이몬\n\nuser = {'name': '에이몬', 'level': 8}\nprint(user[_____])",
      "answer": "'name'",
      "explanation": "딕셔너리는 user['키'] 형식으로 값에 접근해요. 키는 따옴표로 감싸야 해요."
    }
  ]
}
```

### final_boss_mid_fill_in_blank.json

```json
{
  "type": "final_boss",
  "level": "intermediate",
  "quiz_type": "fill_in_blank",
  "boss_name": "파이널 보스 — 검정 에이몬",
  "unlock_condition": "Unit 8 보스 클리어 후 해금",
  "hints_allowed": 0,
  "xp_reward": 5000,
  "questions": [
    {
      "question_id": "fb_mid_fib_001",
      "type": "fill_in_blank",
      "question": "빈칸을 채워 리스트의 길이를 출력하세요.\n출력 목표: 아이템 수: 4\n\nitems = ['슬라임', '로봇', '말풍선', '고스트']\nprint('아이템 수:', _____(items))",
      "answer": "len",
      "explanation": "len() 함수는 리스트 요소 수를 반환해요. len(items) = 4예요."
    },
    {
      "question_id": "fb_mid_fib_002",
      "type": "fill_in_blank",
      "question": "빈칸을 채워 딕셔너리 값에 접근하세요.\n출력 목표: 에이몬\n\nuser = {'nickname': '에이몬', 'level': 8}\nprint(user[_____])",
      "answer": "'nickname'",
      "explanation": "딕셔너리 키는 따옴표로 감싸야 해요."
    },
    {
      "question_id": "fb_mid_fib_003",
      "type": "fill_in_blank",
      "question": "빈칸을 채워 for문으로 리스트를 순회하세요.\n출력 목표: 1 / 2 / 3\n\nfor item _____ [1, 2, 3]:\n    print(item)",
      "answer": "in",
      "explanation": "for 변수 in 리스트: 구조로 리스트 요소를 순서대로 꺼낼 수 있어요."
    }
  ]
}
```

### final_boss_mid_code_input.json

```json
{
  "type": "final_boss",
  "level": "intermediate",
  "quiz_type": "code_input",
  "boss_name": "파이널 보스 — 검정 에이몬",
  "unlock_condition": "Unit 8 보스 클리어 후 해금",
  "hints_allowed": 0,
  "xp_reward": 5000,
  "judge0_required": true,
  "questions": [
    {
      "question_id": "fb_mid_ci_001",
      "type": "code_input",
      "question": "scores = [80, 95, 70, 100] for문으로 각 점수 순서대로 출력",
      "answer": "scores = [80, 95, 70, 100]\nfor score in scores:\n    print(score)",
      "judge0_required": true
    },
    {
      "question_id": "fb_mid_ci_002",
      "type": "code_input",
      "question": "함수 greet(name) 정의 후 greet('에이몬') 호출\n출력 목표: 에이몬, 최종 진화 완료!",
      "answer": "def greet(name):\n    print(f'{name}, 최종 진화 완료!')\n\ngreet('에이몬')",
      "judge0_required": true
    },
    {
      "question_id": "fb_mid_ci_003",
      "type": "code_input",
      "question": "user = {'name': '에이몬', 'xp': 9999}\n출력 목표: 에이몬 | XP: 9999",
      "answer": "user = {'name': '에이몬', 'xp': 9999}\nprint(f\"{user['name']} | XP: {user['xp']}\")",
      "judge0_required": true
    }
  ]
}
```

---

## 📂 고급 JSON 파일 목록

### v3 — 화면 단위 통합

| 파일명 | 화면 | 퀴즈 유형 | 문제 수 |
| --- | --- | --- | --- |
| `stage_lesson_advanced.json` | 스테이지 레슨 | output_select + fill_in_blank | 3 |
| `concept_check_advanced.json` | 개념체크 퀴즈 | fill_in_blank + output_select | 3 |
| `boss_advanced.json` | 일반 보스 | fill_in_blank + code_input | 3 |
| `final_boss_advanced.json` | 파이널 보스 | code_input 위주 | 4 |

### v5 — 유형별 분리

| 파일명 | 화면 | 퀴즈 유형 | 문제 수 |
| --- | --- | --- | --- |
| `stage_lesson_adv_output_select.json` | 스테이지 레슨 | output_select | 3 |
| `stage_lesson_adv_fill_in_blank.json` | 스테이지 레슨 | fill_in_blank | 3 |
| `concept_check_adv_fill_in_blank.json` | 개념체크 퀴즈 | fill_in_blank | 3 |
| `concept_check_adv_output_select.json` | 개념체크 퀴즈 | output_select | 3 |
| `boss_adv_fill_in_blank.json` | 일반 보스 | fill_in_blank | 3 |
| `boss_adv_code_input.json` | 일반 보스 | code_input | 2 |
| `final_boss_adv_code_input.json` | 파이널 보스 | code_input | 4 |

---

## 💾 고급 유형별 JSON 코드 (v5)

### stage_lesson_adv_output_select.json

```json
{
  "type": "stage_lesson",
  "level": "advanced",
  "quiz_type": "output_select",
  "unit": 1,
  "stage": "1-1",
  "pass_score": 80,
  "questions": [
    {
      "question_id": "sl_adv_os_1_1_001",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nname = '에이몬'\nprint(f'{name!r} 등장!')\nprint(f'{name!s} 등장!')",
      "choices": ["A. '에이몬' 등장! / 에이몬 등장!","B. 에이몬 등장! / 에이몬 등장!","C. r'에이몬' 등장! / 에이몬 등장!","D. 오류 발생"],
      "answer": "A",
      "explanation": "!r은 repr() 적용 → 따옴표 포함 출력, !s는 str() 적용 → 일반 문자열 출력이에요."
    },
    {
      "question_id": "sl_adv_os_1_1_002",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\npi = 3.14159\nprint(f'{pi:.2f}')\nprint(f'{pi:10.2f}')",
      "choices": ["A. 3.14 / 3.14","B. 3.14 /         3.14","C. 3.14159 / 3.14","D. 오류 발생"],
      "answer": "B",
      "explanation": ":.2f는 소수점 2자리 고정, :10.2f는 전체 너비 10칸에 소수점 2자리로 우측 정렬이에요."
    },
    {
      "question_id": "sl_adv_os_1_1_003",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nfor i in range(3):\n    print(i, end='-')\nprint('끝')",
      "choices": ["A. 0-1-2-끝","B. 0 / 1 / 2 / 끝","C. 0-1-2- / 끝","D. 012-끝"],
      "answer": "A",
      "explanation": "end='-'로 줄바꿈 대신 - 가 붙어요. 마지막 print('끝')은 기본 end='\\n'이에요."
    }
  ]
}
```

### stage_lesson_adv_fill_in_blank.json

```json
{
  "type": "stage_lesson",
  "level": "advanced",
  "quiz_type": "fill_in_blank",
  "unit": 1,
  "stage": "1-1",
  "pass_score": 80,
  "questions": [
    {
      "question_id": "sl_adv_fib_1_1_001",
      "type": "fill_in_blank",
      "question": "print()가 값 출력 후 줄바꿈 대신 공백을 붙이게 빈칸을 채우세요.\n출력 목표: 에이몬 로봇 고스트\n\nprint('에이몬', _____=' ')\nprint('로봇', _____=' ')\nprint('고스트')",
      "answer": "end",
      "explanation": "end 파라미터는 출력 후 붙는 문자를 지정해요. 기본값은 '\\n'(줄바꿈)이에요."
    },
    {
      "question_id": "sl_adv_fib_1_1_002",
      "type": "fill_in_blank",
      "question": "print()가 여러 값을 | 로 구분해 출력하게 빈칸을 채우세요.\n출력 목표: 에이몬|로봇|고스트\n\nprint('에이몬', '로봇', '고스트', _____='|')",
      "answer": "sep",
      "explanation": "sep 파라미터는 여러 값 사이에 들어갈 구분자를 지정해요."
    },
    {
      "question_id": "sl_adv_fib_1_1_003",
      "type": "fill_in_blank",
      "question": "f-string으로 숫자를 소수점 3자리로 포맷하는 빈칸을 채우세요.\n출력 목표: 스코어: 98.765\n\nscore = 98.7654\nprint(f'스코어: {score:_____}')",
      "answer": ".3f",
      "explanation": ":.3f는 소수점 아래 3자리까지 반올림하여 출력하는 f-string 포맷 지정자예요."
    }
  ]
}
```

### concept_check_adv_fill_in_blank.json

```json
{
  "type": "concept_check",
  "level": "advanced",
  "quiz_type": "fill_in_blank",
  "unit": 1,
  "stage": "1-1",
  "villain": "codemmon",
  "pass_score": 80,
  "questions": [
    {
      "question_id": "cc_adv_fib_1_1_001",
      "type": "fill_in_blank",
      "question": "리스트를 언패킹해 한 줄에 공백으로 구분 출력하는 빈칸을 채우세요.\n출력 목표: 1 2 3 4 5\n\nprint(_____[1, 2, 3, 4, 5])",
      "answer": "*",
      "explanation": "* (언패킹 연산자)로 리스트를 풀면 print()가 각 요소를 공백으로 구분해 한 줄 출력해요."
    },
    {
      "question_id": "cc_adv_fib_1_1_002",
      "type": "fill_in_blank",
      "question": "f-string에서 변수를 repr() 형식으로 출력하는 변환 플래그를 채우세요.\n출력 목표: '에이몬'\n\nname = '에이몬'\nprint(f'{name!_____}')",
      "answer": "r",
      "explanation": "!r은 repr()을 적용해 따옴표를 포함한 문자열 표현으로 출력해요."
    },
    {
      "question_id": "cc_adv_fib_1_1_003",
      "type": "fill_in_blank",
      "question": "숫자를 우측 정렬 8칸, 소수점 2자리로 출력하는 포맷 지정자를 채우세요.\n\nprint(f'{3.14159:_____}')",
      "answer": "8.2f",
      "explanation": ":8.2f는 전체 너비 8칸에 소수점 2자리 고정, 우측 정렬이에요."
    }
  ]
}
```

### concept_check_adv_output_select.json

```json
{
  "type": "concept_check",
  "level": "advanced",
  "quiz_type": "output_select",
  "unit": 1,
  "stage": "1-1",
  "villain": "codemmon",
  "pass_score": 80,
  "questions": [
    {
      "question_id": "cc_adv_os_1_1_001",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nprint(*range(1, 6), sep='+')",
      "choices": ["A. 1+2+3+4+5","B. [1, 2, 3, 4, 5]","C. 12345","D. 오류 발생"],
      "answer": "A",
      "explanation": "*range(1,6)은 1,2,3,4,5로 언패킹되고, sep='+'로 + 구분자가 삽입돼요."
    },
    {
      "question_id": "cc_adv_os_1_1_002",
      "type": "output_select",
      "question": "다음 코드의 출력값을 고르세요.\n\nx = 255\nprint(f'{x:b}')\nprint(f'{x:x}')",
      "choices": ["A. 11111111 / ff","B. 255 / 255","C. 0b11111111 / 0xff","D. 오류 발생"],
      "answer": "A",
      "explanation": ":b는 2진수, :x는 16진수로 변환해 출력해요. 0b/0x 접두사는 붙지 않아요."
    }
  ]
}
```

### boss_adv_fill_in_blank.json

```json
{
  "type": "boss",
  "level": "advanced",
  "quiz_type": "fill_in_blank",
  "unit": 1,
  "boss_name": "코드몬 Unit 1 보스",
  "pass_score": 80,
  "free_attempts_per_day": 2,
  "crown_cost_from_attempt": 3,
  "hints_allowed": 2,
  "xp_reward": 2000,
  "questions": [
    {
      "question_id": "boss_adv_fib_1_001",
      "type": "fill_in_blank",
      "question": "빈칸을 채워 숫자를 소수점 3자리로 포맷해 출력하세요.\n출력 목표: 스코어: 98.756\n\nscore = 98.7564\nprint(f'스코어: {score:_____}')",
      "answer": ".3f",
      "explanation": ":.3f는 소수점 아래 3자리까지 반올림하여 출력하는 포맷 지정자예요."
    },
    {
      "question_id": "boss_adv_fib_1_002",
      "type": "fill_in_blank",
      "question": "빈칸을 채워 출력 후 줄바꿈 없이 이어붙이게 하세요.\n출력 목표: 에이몬최종진화\n\nprint('에이몬', _____='')\nprint('최종진화')",
      "answer": "end",
      "explanation": "end=''로 설정하면 출력 후 아무 문자도 붙지 않아요."
    },
    {
      "question_id": "boss_adv_fib_1_003",
      "type": "fill_in_blank",
      "question": "빈칸을 채워 리스트를 언패킹해 | 구분자로 출력하세요.\n출력 목표: 슬라임|로봇|고스트\n\nstages = ['슬라임', '로봇', '고스트']\nprint(_____stages, sep='|')",
      "answer": "*",
      "explanation": "* 언패킹 연산자로 리스트를 풀면 print()가 각 요소에 sep 구분자를 삽입해 출력해요."
    }
  ]
}
```

### boss_adv_code_input.json

```json
{
  "type": "boss",
  "level": "advanced",
  "quiz_type": "code_input",
  "unit": 1,
  "boss_name": "코드몬 Unit 1 보스",
  "pass_score": 80,
  "free_attempts_per_day": 2,
  "crown_cost_from_attempt": 3,
  "hints_allowed": 2,
  "xp_reward": 2000,
  "judge0_required": true,
  "questions": [
    {
      "question_id": "boss_adv_ci_1_001",
      "type": "code_input",
      "question": "리스트 [1, 2, 3, 4, 5]를 한 줄에 공백으로 구분 출력. print() 한 번만 사용.\n출력 목표: 1 2 3 4 5",
      "answer": "print(*[1, 2, 3, 4, 5])",
      "judge0_required": true
    },
    {
      "question_id": "boss_adv_ci_1_002",
      "type": "code_input",
      "question": "함수 format_score(name, score) 정의\n이름은 왼쪽 정렬 10칸, 점수는 소수점 1자리\nformat_score('에이몬', 98.765) 호출\n출력 목표: 에이몬       98.8",
      "answer": "def format_score(name, score):\n    print(f'{name:<10}{score:.1f}')\n\nformat_score('에이몬', 98.765)",
      "judge0_required": true
    }
  ]
}
```

### final_boss_adv_code_input.json

```json
{
  "type": "final_boss",
  "level": "advanced",
  "quiz_type": "code_input",
  "boss_name": "파이널 보스 — 검정 에이몬",
  "unlock_condition": "Unit 8 보스 클리어 후 해금",
  "hints_allowed": 0,
  "xp_reward": 5000,
  "judge0_required": true,
  "questions": [
    {
      "question_id": "fb_adv_ci_001",
      "type": "code_input",
      "question": "함수 show_status(name, level, hp) 정의\nshow_status('에이몬', 40, 9999) 호출\n출력 목표: [ 에이몬 ] Lv.40 | HP: 9999",
      "answer": "def show_status(name, level, hp):\n    print(f'[ {name} ] Lv.{level} | HP: {hp}')\n\nshow_status('에이몬', 40, 9999)",
      "judge0_required": true
    },
    {
      "question_id": "fb_adv_ci_002",
      "type": "code_input",
      "question": "scores = [72, 88, 95, 61, 100]에서 80점 이상만 필터링 출력\n출력 목표: 88 / 95 / 100",
      "answer": "scores = [72, 88, 95, 61, 100]\nfor score in scores:\n    if score >= 80:\n        print(score)",
      "judge0_required": true
    },
    {
      "question_id": "fb_adv_ci_003",
      "type": "code_input",
      "question": "user = {'name': '에이몬', 'level': 40, 'xp': 99999}\n키와 값을 순회하며 출력\n출력 목표: name: 에이몬 / level: 40 / xp: 99999",
      "answer": "user = {'name': '에이몬', 'level': 40, 'xp': 99999}\nfor key, value in user.items():\n    print(f'{key}: {value}')",
      "judge0_required": true
    },
    {
      "question_id": "fb_adv_ci_004",
      "type": "code_input",
      "question": "함수 boss_clear(unit, xp_reward) 정의, 누적 XP 포함 출력\nboss_clear(1, 2000), boss_clear(2, 2000) 호출\n출력 목표:\nUnit 1 보스 클리어! 획득 XP: 2000 | 누적 XP: 2000\nUnit 2 보스 클리어! 획득 XP: 2000 | 누적 XP: 4000",
      "answer": "total_xp = 0\n\ndef boss_clear(unit, xp_reward):\n    global total_xp\n    total_xp += xp_reward\n    print(f'Unit {unit} 보스 클리어! 획득 XP: {xp_reward} | 누적 XP: {total_xp}')\n\nboss_clear(1, 2000)\nboss_clear(2, 2000)",
      "judge0_required": true
    }
  ]
}
```

---

## 📝 1-1 레벨별 JSON 파일 목록

Stage 1-1 (Hello, Python!) 기준 레벨별 상세 파일

### 문제 세트

| 파일명 | 설명 | 문제 수 |
| --- | --- | --- |
| `lesson_1_1.json` | 1-1 기본 문제 세트 (초기 버전) | 3 |
| `lesson_1_1_by_level.json` | 난이도별 문제 (easy / medium / hard) | 3 |

**난이도 기준**

| 레벨 | 문제 | 핵심 개념 | XP |
| --- | --- | --- | --- |
| beginner | print() 기본 출력 | 따옴표 제거 원리 | 80 |
| intermediate | 주석 무시 동작 | # 처리 이해 | 100 |
| advanced |   • 연결 vs 쉼표(,) | 복합 출력 파악 | 120 |

### 답안 & 해설 세트

| 파일명 | 설명 | API 호출 |
| --- | --- | --- |
| `lesson_1_1_answers.json` | 정답 + 오답 선택지별 개별 해설 (by_option 구조) | ❌ |
| `lesson_1_1_correct_feedback.json` | 정답 시 해설만 분리 (explanation 필드 그대로 출력) | ❌ |
| `lesson_1_1_wrong_feedback.json` | 오답 시 해설만 분리 (선택지별 message + explanation + hint_keyword) | ✅ Claude API |
| `lesson_1_1_full.json` | 문제 + 정답 + 해설 전체 통합 | 오답만 ✅ |

### 노션 파이프라인 기준 v2 해설 (초급 / 중급 / 고급)

| 파일명 | 설명 | 문제 수 |
| --- | --- | --- |
| `v2/lesson_1_1_correct_feedback.json` | 정답 시 해설 — 초급(3) / 중급(2) / 고급(1) 레벨별 | 6 |

**오답 피드백 by_option 구조**

```jsx
wrong_feedback[question_id].by_option[user_selected_option]
  └ message       : 한 줄 요약
  └ explanation   : 이유 설명
  └ hint_keyword  : 복습 키워드

// 프론트 연동
const fb = question.feedback.wrong[user_selected_option]
```

---

## ⚙️ 보스 공통 규칙

- 하루 2회 무료 도전
- 3회차부터 왕관 1개 소모
- 일반 보스: 힌트 최대 2회 (왕관 소모)
- 파이널 보스: 힌트 없음
- 파이널 보스: Unit 8 보스 클리어 후 해금
- 통과 기준: 80% 이상

## ⚙️ AI 피드백 규칙

- 정답 시: `explanation` 필드 텍스트 그대로 출력 (Claude API 호출 없음)
- 오답 시: Claude API 호출 → 레벨별 맞춤 설명
- 설명 레벨: beginner / intermediate / advanced (설정에서 변경 가능)