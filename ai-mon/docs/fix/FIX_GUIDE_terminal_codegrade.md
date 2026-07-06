# 코드 터미널 채점 회귀 수정 가이드 (백엔드↔프론트 단절)

> 작성: ai-mon 팀장 / 대상: Claude Code(앱)에 순서대로 붙여넣어 실행
> 대상 흐름: **코드 입력 터미널(Pyodide 실행) → 채점 → XP/진행도** (code_input 문제 타입)
> 진단 근거: 코드 실측(프론트 전체 + backend/routers/code.py)

---

## 0. 추적한 흐름 (백엔드 → 프론트 터미널)

```
[백엔드]  POST /code/submit  (code.py)         ← AI 튜터 관대 채점, is_correct/score, +200 XP, 진행도 저장
          POST /code/hint    (code.py)         ← 레벨별 힌트
                                                  ※ 라우터 prefix "/code" 가정

[프론트 API]  api/index.js:60  codeApi.runCode → POST /code/run   ← (A) 존재하지 않는 경로 + (B) 어디서도 import 안 됨(죽은 코드)

[프론트 터미널]  CodeInput.jsx                  ← textarea + [▶ 실행하기] + 출력박스 + [확인하기]
                 QuizCard.handleCodeSubmit      ← Pyodide runPython → stdout 캡처
                                                  → result.stdout.trim() === answer.trim() (클라 자체 정확일치 채점)
                                                  → 오답 시 /quiz/ai-feedback/stream 만 호출
                                                  → onAnswer()
```

**단절 지점:** 백엔드 `/code/submit`(관대 AI 채점 + 200 XP)이 프론트에서 **한 번도 호출되지 않음.** 코드 문제는 전부 브라우저에서 stdout 문자열 정확일치로 자체 채점됨.

---

## 1. 진단 확정 (근본원인)

| # | 증상 | 근본원인 (1줄) | 위치 | 확신도 |
|---|------|----------------|------|--------|
| ① | "실행하기" 누르면 바로 제출/잠금됨 (미리 돌려보기 불가) | **실행/확인 버튼이 같은 핸들러** `onSubmit`(=handleCodeSubmit)을 호출 → 실행=즉시 채점+revealed 잠금 | `CodeInput.jsx` (두 버튼 모두 `onClick={onSubmit}`) | **상** |
| ② | 로직은 맞는데 오답 처리 / 코드 200 XP 안 들어옴 | 채점이 **클라 stdout 정확일치**(`stdout.trim()===answer.trim()`)로 끝나고 백엔드 `/code/submit` 미사용 → 공백·개행·print 형식 차이에 취약, AI 관대 채점·XP 경로 사장 | `QuizCard.jsx` `handleCodeSubmit` | **상** |
| ③ | 경로 계약 불일치 | `codeApi.runCode`가 `/code/run` 호출 — 백엔드엔 `/submit`·`/hint`만 존재. 게다가 `codeApi`는 어디서도 안 쓰임 | `api/index.js:60` | **상** |

> **한 줄 결론:** 프론트 코드 터미널이 백엔드 채점 API와 단절돼 ⓐ 실행=제출로 묶이고(`CodeInput.jsx`), ⓑ 채점을 클라 정확일치로 자체 처리(`QuizCard.handleCodeSubmit`)하며 ⓒ API 레이어는 죽은 `/code/run`을 가리킴(`api/index.js:60`).

### ⚠️ 별도 확인 (마운트 의심, 근본원인 아님)
`backend/main.py`(72줄 부근), `backend/routers/code.py`(get_code_hint 끝), `quiz.py`, `QuizCard.jsx` 가 파일 끝에서 잘려 보임. 4개 동시 절단이라 동기화 아티팩트로 판단했지만, **실제 디스크에서 끝부분 손상/`code.router` include 여부는 직접 확인**할 것. 만약 진짜 잘렸다면 백엔드가 부팅 자체를 못 함(SyntaxError) → 그게 1순위.

---

## 2. 수정안

### ① 실행 / 확인 버튼 분리 (터미널 정상화)
- **수정:** `CodeInput`에 `onRun`, `onSubmit` 2개 prop. `▶ 실행하기`=`onRun`(Pyodide 실행 → `setCodeRunResult`만, revealed/onAnswer 안 건드림), `확인하기`=`onSubmit`(채점·잠금).
- QuizCard에 `handleCodeRun`(실행 전용) 신설, `handleCodeSubmit`은 채점만.

### ② 채점을 백엔드 /code/submit으로 위임 (택1, 1순위 권장)
- **수정안 A(권장):** `handleCodeSubmit`에서 Pyodide로 실행해 얻은 `code/output/error`를 `/code/submit`에 POST → 백엔드 AI 관대 채점(`is_correct/score`)과 200 XP·진행도 저장을 단일 소스로. 클라 정확일치는 "1차 즉시 통과" 힌트로만 보조.
- **수정안 B(최소):** 백엔드 연동을 보류한다면, 클라 채점을 정확일치 대신 정규화(개행/공백/trailing 정리) 후 비교로 완화하고, 200 XP 적립 경로를 명시적으로 정함. (단 ②의 본질인 단절은 그대로이므로 임시방편)

### ③ API 경로 계약 정리
- `api/index.js`의 `codeApi`를 실제 백엔드와 맞춤: `submitCode → POST /code/submit`, `getHint → POST /code/hint`. 미사용 `runCode`/`/code/run`은 제거하거나 백엔드에 `/code/run`을 신설(실행 전용으로 쓸 거면).

---

## 3. Claude Code 프롬프트 (확인 → ① → ②③ 순)

### 모델
- **사전 확인(파일 절단/라우터 등록) → Sonnet 4.6** (`claude-sonnet-4-6`)
- **① 버튼 분리 → Sonnet 4.6** (국소 UI)
- **②③ 채점 백엔드 위임 + API 계약 → Opus 4.8** (`claude-opus-4-8`, 백엔드↔프론트 교차)

---

**[프롬프트 0 · Sonnet] 사전 무결성 확인**
```
다음을 확인만 하고 보고해(수정 금지):
1) backend/main.py가 끝까지 정상인지, app.include_router(code.router, prefix="/code", ...) 가 실제로 있는지.
   train/titles/game/mission/admin/attempts include 누락도 같이.
2) backend/routers/code.py의 get_code_hint 함수가 끝까지 완성돼 있는지(파일 끝 잘림 여부).
3) `uvicorn`으로 백엔드가 import 에러 없이 기동되는지 py_compile/import 체크.
파일이 잘려 있으면 git status/stash, 최근 커밋과 비교해 손상 범위만 리포트.
```

**[프롬프트 ① · Sonnet] 실행/확인 버튼 분리**
```
frontend/src/components/QuizCard/QuizCard.jsx 의 코드 입력 터미널에서
지금 CodeInput의 [▶ 실행하기]와 [확인하기]가 둘 다 같은 onSubmit(=handleCodeSubmit)을 호출해
'실행'이 곧 제출·채점·잠금(revealed)으로 동작한다. 이를 분리해줘.
- CodeInput.jsx에 onRun, onSubmit 두 prop을 받게 한다. 실행하기=onRun, 확인하기=onSubmit.
- QuizCard에 handleCodeRun을 신설: runPython으로 실행 후 setCodeRunResult만 하고 revealed/onAnswer/fetchAiFeedback은 건드리지 않는다(여러 번 실행 가능).
- handleCodeSubmit은 채점·revealed·onAnswer만 담당.
정답/오답 표시·Ai피드백 동작은 확인하기 경로에서만 그대로 유지. 변경 diff를 보여줘.
```

**[프롬프트 ②③ · Opus] 백엔드 채점 위임 + API 계약 정리**
```
ai-mon 코드 문제(code_input) 채점이 프론트에서 stdout 정확일치(result.stdout.trim()===answer.trim())로 자체 처리되고
백엔드 POST /code/submit(AI 관대 채점 + 200 XP + 진행도 저장)이 한 번도 호출되지 않는 단절을 고쳐줘.

기획 확정: 채점의 단일 소스는 백엔드 /code/submit. 클라 Pyodide는 실행/출력 표시 및 1차 즉시통과 보조용.

(1) frontend/src/api/index.js: codeApi를 실제 백엔드와 일치시켜라.
    submitCode -> POST /code/submit (body: question_id, code, output, error, unit, stage, course_level)
    getHint    -> POST /code/hint
    미사용/잘못된 runCode(/code/run)는 제거(또는 백엔드에 실행전용 엔드포인트를 둘지 의사결정 후 결정).
(2) QuizCard.handleCodeSubmit: Pyodide 실행으로 얻은 {stdout->output, stderr->error}와 code를
    codeApi.submitCode로 보내고, 응답의 is_correct/score/xp_awarded/feedback로 정답표시·XP를 처리.
    백엔드 호출 실패(grading_failed 포함) 시에는 HP/XP/진행도 미변경 + 재시도 안내(기존 D-1 버그 방지 규칙 준수).
(3) 200 XP 이중적립 점검: /code/submit의 apply_xp와 일반 quiz 채점 XP가 같은 스테이지에서 겹치지 않는지 확인하고 보고.
변경 전후 흐름도와 diff, 그리고 네트워크 호출 시퀀스를 보여줘.
```

**[프롬프트 R · Opus] 회귀 검증**
```
위 ①②③ 수정 후 회귀 검증:
1) backend pytest 전체(특히 test_grading_failure, test_rewards, test_train_page_verify) 결과 보고.
2) 시나리오:
   - code_input: 실행하기 여러 번 → 출력만 갱신, 잠금/채점 안 됨. 확인하기 → 백엔드 /code/submit 호출(네트워크 확인).
   - 로직 맞고 출력 형식만 다른 코드(공백/개행 차이) → 백엔드 관대 채점으로 정답 인정.
   - 정답 시 200 XP 1회만 적립(재진입·재제출 시 중복적립 없음). grading_failed 시 XP/진행도 무변경.
   - 객관식/단답 등 다른 문제 타입 흐름 무변화.
3) 변경 파일 git diff 요약 + 남은 위험요소(특히 /code/run 제거 영향, codeApi 사용처).
```

통과 기준: 실행≠제출 분리, code_input 채점이 **백엔드 /code/submit 단일 소스**로 처리, 200 XP 1회 적립, grading_failed 무변경, 타 문제 타입 무변화.

---

## 4. 백엔드 담당이 놓치기 쉬운 점 (제안)

- **죽은/불일치 계약:** `/code/run`(프론트가 부르지만 미존재)·미사용 `codeApi`처럼 프론트-백 API 계약이 표류 중. OpenAPI 스키마를 프론트에서 타입/클라이언트로 자동생성하면 이런 단절이 컴파일 단계에서 잡힘.
- **채점 권위(authority):** 지금 코드 채점은 클라가 판정 → 클라 조작으로 XP/진행도 위변조 가능. 점수·XP·진행도는 반드시 서버 채점 결과로만 확정.
- **XP 이중적립/멱등성:** `/code/submit`이 `is_completed` 미설정일 때만 XP를 주지만, 동시요청·재제출 멱등성 테스트(test_concurrency 류)에 code_input 케이스가 포함됐는지 확인.
- **Pyodide 신뢰 경계:** 사용자가 보낸 `output/error`는 신뢰 불가 입력(임의 위조 가능). AI 채점 프롬프트에 그대로 넣으면 프롬프트 인젝션·허위 출력으로 정답 유도 가능 → 길이 제한(이미 4000)에 더해 sanitize/표시 구분 필요.
- **find_question 인덱스 캐시:** `_QUESTION_INDEX`가 모듈 전역 1회 빌드 → 문제 데이터 핫리로드 시 stale. 운영 중 데이터 갱신 경로가 있으면 무효화 훅 필요.
- **파일 무결성/CI:** main.py·code.py 끝 절단 의심 건은, 사실이면 부팅 불가다. `py_compile` + `uvicorn --check`를 CI/pre-commit에 넣어 절단·문법오류를 머지 전에 차단.
