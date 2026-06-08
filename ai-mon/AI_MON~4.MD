# AI_MON_UNITBOSS_QUESTIONS.md
> 유닛보스 질문 구성 마스터 문서. 레벨별/유닛별 커버 범위와 문제 분포 관리용.
> 중급·고급이 추가되면 이 파일에 섹션 추가.

---

## 공통 구조

| 항목 | 규칙 |
|---|---|
| 문제 수 | 유닛당 10문제 |
| 유형 분포 (비기너 1~7) | `output_select` ×4, `fill_in_blank` ×4, `error_find` ×2 |
| 유형 분포 (비기너 8) | `multiple_choice` ×4, `fill_in_blank` ×4, `output_select` ×2 |
| 난이도 분포 | easy ×2, medium ×4, hard ×4 |
| `quiz_category` | `unit_boss` |
| `is_boss` | `true` |

---

## 비기너 (Beginner)

### Unit 1 — 파이썬 기초 · 변수 · 출력
**커버 범위**: 변수, 자료형(int/str/float/bool), print, f-string, 주석, 연산자(+/-/*///%/比)

| # | 유형 | 주제 | 난이도 |
|---|---|---|---|
| 1 | output_select | 주석 처리된 코드 출력 | easy |
| 2 | fill_in_blank | f-string 앞 `f` 키워드 | easy |
| 3 | output_select | 변수 재할당 누적 | medium |
| 4 | error_find | 문자열 따옴표 누락 | medium |
| 5 | fill_in_blank | 문자열 반복 `*` 연산자 | medium |
| 6 | output_select | `//` 몫, `%` 나머지 | medium |
| 7 | error_find | f-string 중괄호 닫기 누락 | hard |
| 8 | fill_in_blank | 비교 연산자 `>=` | hard |
| 9 | output_select | `*` 우선순위 + `len()` | hard |
| 10 | fill_in_blank | `int()` 형변환 | hard |

---

### Unit 2 — 리스트 & 딕셔너리
**커버 범위**: list 생성/인덱싱/append/len, dict 생성/접근/update/key-value

| # | 유형 | 주제 | 난이도 |
|---|---|---|---|
| 1 | output_select | 리스트 인덱싱 | easy |
| 2 | fill_in_blank | `append()` | easy |
| 3 | output_select | 딕셔너리 키로 값 접근 | medium |
| 4 | error_find | 범위 초과 인덱스 | medium |
| 5 | fill_in_blank | `len()` | medium |
| 6 | output_select | 딕셔너리 값 수정 | medium |
| 7 | error_find | 존재하지 않는 딕셔너리 키 | hard |
| 8 | fill_in_blank | 리스트 슬라이싱 | hard |
| 9 | output_select | 중첩 리스트 인덱싱 | hard |
| 10 | fill_in_blank | `dict.keys()` / `dict.values()` | hard |

---

### Unit 3 — 조건문 & 논리연산
**커버 범위**: if/elif/else, 비교 연산자, and/or/not, 중첩 조건

| # | 유형 | 주제 | 난이도 |
|---|---|---|---|
| 1 | output_select | 단순 if-else 분기 | easy |
| 2 | fill_in_blank | `elif` 키워드 | easy |
| 3 | output_select | `and` 조건 | medium |
| 4 | error_find | 들여쓰기 오류 | medium |
| 5 | fill_in_blank | `or` 조건 | medium |
| 6 | output_select | `not` 논리 반전 | medium |
| 7 | error_find | 조건식 비교 오류 (= vs ==) | hard |
| 8 | fill_in_blank | 중첩 조건 분기 | hard |
| 9 | output_select | 복합 조건 (and + or) | hard |
| 10 | fill_in_blank | 삼항 조건식 | hard |

---

### Unit 4 — 반복문
**커버 범위**: for, while, range, break, continue, 누적합 패턴, 중첩 for

| # | 유형 | 주제 | 난이도 |
|---|---|---|---|
| 1 | output_select | `range(n)` 반복 횟수 | easy |
| 2 | fill_in_blank | `for _ in range()` | easy |
| 3 | output_select | `while` 조건 탈출 | medium |
| 4 | error_find | 무한루프 조건 오류 | medium |
| 5 | fill_in_blank | `break` | medium |
| 6 | output_select | 누적합 패턴 | medium |
| 7 | error_find | `range` 인자 오류 | hard |
| 8 | fill_in_blank | `continue` | hard |
| 9 | output_select | 중첩 `for` 출력 | hard |
| 10 | fill_in_blank | `range(start, stop, step)` | hard |

---

### Unit 5 — 함수
**커버 범위**: def, return, 매개변수, 기본값 인자, 지역/전역변수, 함수 중첩 호출

| # | 유형 | 주제 | 난이도 |
|---|---|---|---|
| 1 | output_select | `def` + 호출 결과 | easy |
| 2 | fill_in_blank | `return` 키워드 | easy |
| 3 | output_select | 매개변수 전달 | medium |
| 4 | error_find | `return` 누락 → `None` 반환 | medium |
| 5 | fill_in_blank | 기본값 인자 | medium |
| 6 | output_select | 지역변수 vs 전역변수 | medium |
| 7 | error_find | 함수 호출 전 정의 순서 오류 | hard |
| 8 | fill_in_blank | `def` 키워드 | hard |
| 9 | output_select | 함수 중첩 호출 | hard |
| 10 | fill_in_blank | 인자 개수 맞추기 | hard |

---

### Unit 6 — 문자열 처리 *(예정)*
> 커버 범위: 슬라이싱, split/join, strip, upper/lower, replace, in 연산자

*질문 확정 후 추가 예정*

---

### Unit 7 — 클래스 & 객체지향 기초 *(예정)*
> 커버 범위: class, __init__, self, 인스턴스 생성, 메서드, 상속 기초

*질문 확정 후 추가 예정*

---

### Unit 8 — AI 에이전트 & 파이썬 응용
**커버 범위**: API 개념, 라이브러리 import, 흐름 설계, AI 에이전트 구조

> `error_find` 미포함 (코드 오류보다 개념 이해 중심)

| # | 유형 | 주제 | 난이도 |
|---|---|---|---|
| 1 | multiple_choice | API란 무엇인가 | easy |
| 2 | fill_in_blank | `import` 키워드 | easy |
| 3 | multiple_choice | 라이브러리 역할 | medium |
| 4 | fill_in_blank | 함수/API 흐름 설계 | medium |
| 5 | multiple_choice | AI 에이전트 구성 요소 | medium |
| 6 | output_select | 간단한 API 호출 코드 흐름 | medium |
| 7 | multiple_choice | 프롬프트 설계 개념 | hard |
| 8 | fill_in_blank | 조건 분기로 에이전트 흐름 | hard |
| 9 | output_select | 에이전트 루프 흐름 출력 | hard |
| 10 | fill_in_blank | 에이전트 응답 처리 코드 | hard |

---

## 중급 (Intermediate) *(예정)*

> 커버 예정: 파일 입출력, 예외처리, 제너레이터, 데코레이터, 모듈/패키지 등  
> 유닛 구성 및 질문 분포는 추후 결정

---

## 고급 (Advanced) *(예정)*

> 커버 예정: 자료구조/알고리즘, 비동기 처리, OOP 심화, 테스트, 실전 프로젝트 패턴 등  
> 유닛 구성 및 질문 분포는 추후 결정
