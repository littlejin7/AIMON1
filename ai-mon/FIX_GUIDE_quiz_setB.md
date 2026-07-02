# 퀴즈/미니보스 회귀 수정 가이드 (v2 · 진단 반영)

> 작성: ai-mon 팀장 / 대상: Claude Code(앱)에 순서대로 붙여넣어 실행
> 진행 순서: **① 정답 깜빡임(완료) → ②③ 재도전=다음 세트(통합) + D 데이터 정정(병행)**
> v2 대비 변경: ②③ 통합 — "Set B 경로 없음"이 아니라 "재도전이 attempt를 Set A로 되돌림"으로 재진단

---

## 0. 진단 확정 결과 (코드+데이터 실측)

데이터는 정상 — 모든 스테이지 quiz가 `quiz_category:"stage_quiz"` 100%, Set A 10 / B 10, A∩B 교집합 0.
따라서 v1의 "데이터 보정" 작업은 **불필요**. 폴백(quiz.py:349)도 거의 발동 안 함.

| # | 증상 | 근본원인 (1줄) | 위치 | 확신도 |
|---|------|----------------|------|--------|
| ① | 오답인데 "✅정답!"이 잠깐 뜸 | 배너가 아니라 **AI 피드백 박스**가 Claude 스트리밍 전에 `feedback.wrong` 정적 텍스트("정답은 … 정답!")를 즉시 표시 | `QuizCard.jsx:101` (+catch 폴백), 데이터 `feedback.wrong` 문구 | **상** |
| ②③ | **재도전 시 Set B가 아니라 Set A가 또 나옴** (퀴즈·미니보스 공통) | 재도전 경로들이 attempt를 1(Set A)로 되돌림 — 아래 3개 리셋 지점 | `Stage.jsx:90,218-223`, `quiz.py:345-347` | **상** |

핵심 정정:
- **① 원인은 `shuffleChoices`/판정 로직이 아님**(동기 비교라 깜빡임 불가). 본문 피드백 박스 초기 텍스트가 범인.
- **②와 ③은 같은 버그.** "Set B 경로가 없다"가 아니라 **재도전이 attempt를 Set A로 되돌린다**가 정확한 진단.

### ②③ 재도전이 Set A로 회귀하는 3개 지점
| 범인 | 위치 | 문제 |
|------|------|------|
| `resetStageState()` | `Stage.jsx:90` `setAttempt(1)` | "다시 도전"·"개념 퀴즈부터 다시" 버튼이 호출 → 무조건 Set A |
| `handleMinibossRetry()` | `Stage.jsx:218-223` | 새 fetch 없이 로드된 동일 문제 재생 |
| 백엔드 `attempt≥3` | `quiz.py:345-347` | 전체 셔플 → A 다시 섞여 나옴 |
> 정상 동작은 `handleStageQuizFailure`(182-193)의 `setAttempt(prev+1)`뿐. 단, 결과화면 버튼을 거치면 위 리셋이 덮어씀.

---

## 1. 증상별 수정안

### ① "정답!" 깜빡임
- **원인:** 오답 시 `fetchAiFeedback`가 스트리밍 도착 전에 `setAiFeedback(staticFallback)`로 `feedback.wrong`("정답은 A. Hello예요. 정답!")을 즉시 표시. 사용자가 이를 "정답이에요"로 인지.
- **수정 1(핵심):** 로딩 중엔 비워두기 — `AiFeedback.jsx`가 빈 상태에서 "분석 중..." 배지를 띄우므로, `staticFallback`은 **스트리밍 실패(catch) 때만** 사용.
- **수정 2(선택):** 데이터 `feedback.wrong` 문구가 "…정답!"으로 끝나 폴백 시에도 헷갈림 → 오답 안내 톤으로 정리.

### ②③ 재도전 = 항상 다음 미출제 세트 (퀴즈·미니보스 통합)
- **설계 확정(a):** 재도전(퀴즈 % 미달 / 미니보스 실패) 시 직전과 다른 세트가 나와야 함. 미니보스 실패도 개념 Set B 재학습으로 라우팅.
- **수정 3가지:**
  1. `resetStageState()`(Stage.jsx:89-103)가 `setAttempt(1)`로 고정하는 것을 분리 — **신규 진입만 attempt=1**, **실패 재도전은 attempt를 유지/증가**. 실패용 `retryWithNextSet`(attempt+1, 상태 초기화하되 attempt 보존) 추가하고 결과화면 버튼을 거기에 연결.
  2. `handleMinibossRetry()`(218-223) 동일 문제 재생 제거 → `setAttempt(+1)`로 개념 Set B를 처음부터 재fetch. 서버 `/miniboss/answer`의 `is_fail`/HP 응답을 실제로 받아 실패 판정.
  3. 백엔드 `quiz.py` attempt 분기는 **스펙대로 유지**: attempt 1→A, 2→B, **3+ → A+B 혼합 셔플**(원래 동작). ※ attempt≥3을 교차로 바꾸지 말 것 — 실제 버그는 백엔드가 아니라 프론트의 attempt=1 리셋이었음.
- **부가:** 재도전(attempt>1)일 때 브리핑 스킵(Stage.jsx:170). 정상 클리어/XP/진행도 흐름은 불변.

---

## 2. Claude Code 프롬프트 (① → ③ → ② 순)

### 모델
- **① → Sonnet 4.6** (`claude-sonnet-4-6`) — 국소 수정
- **②③(통합) → Opus 4.8** (`claude-opus-4-8`) — 백엔드↔프론트 재도전 상태머신 교차
- **D(데이터) → Sonnet 4.6**

---

**[프롬프트 ① · Sonnet] 정답 깜빡임 수정**
```
frontend/src/components/QuizCard/QuizCard.jsx의 fetchAiFeedback(약 99~150줄)에서
오답 제출 시 Claude 스트리밍이 도착하기 전에 setAiFeedback(staticFallback)로
feedback.wrong("정답은 …예요. 정답!") 텍스트를 즉시 띄우는 게 '정답!'처럼 보이는 원인이다.
수정: 진입 시의 setAiFeedback(staticFallback)을 제거해 로딩 중엔 aiFeedback을 빈 문자열로 둬서
AiFeedback.jsx가 '분석 중...' 배지만 보이게 하고, staticFallback은 스트리밍 실패(catch)와
POST 폴백 실패 시에만 setAiFeedback 하도록 옮겨라. 정답일 때 동작은 건드리지 말고, 변경 diff를 보여줘.
추가로 backend/data의 feedback.wrong 문구가 '…정답!'으로 끝나는 항목 개수만 리포트해줘(수정은 보류).
```

**[프롬프트 ②③ · Opus] 재도전 = 항상 다음 미출제 세트 (퀴즈·미니보스 통합)**
```
ai-mon에서 '재도전하면 Set B가 나와야 하는데 Set A가 또 나오는' 버그를 고쳐줘.
퀴즈(% 미달)와 미니보스(실패) 둘 다 같은 증상이고, 원인은 재도전 경로가 attempt를 Set A(=1)로 되돌리는 것이다.
확정 기획: 재도전 시 직전과 다른 세트, 미니보스 실패도 '개념 Set B 재학습'으로 라우팅.

먼저 디버깅: 각 재도전 시 실제로 백엔드에 전달되는 attempt 값을 콘솔 로깅해서 어느 경로가 attempt=1을 보내는지 확인하고 보고해.
그다음 수정:
(1) frontend/src/pages/Stage/Stage.jsx resetStageState(89-103)의 setAttempt(1)을 분리 —
    신규 스테이지 진입만 attempt=1, 실패 재도전은 attempt를 증가시키는 별도 함수(retryWithNextSet)를 만들어
    StageResult의 '다시 도전'/'개념 퀴즈부터 다시' 버튼을 거기에 연결.
(2) handleMinibossRetry(218-223)는 같은 문제 재생을 제거하고 setAttempt(+1)로 개념 Set B를 처음부터 재fetch.
    handleAnswer(258-270)에서 /miniboss/answer의 my_hp/boss_hp/is_fail/is_clear 응답을 실제로 받아 실패(is_fail) 판정.
    실패 시 체크포인트를 concept_quiz로 되돌려 미니보스 자동 재진입을 막는다.
(3) backend/routers/quiz.py attempt 분기는 스펙대로: 1→A, 2→B, 3+ → A+B 혼합 셔플(원래 동작 유지). 교차로 바꾸지 마.
(4) 재도전(attempt>1)일 때 Stage.jsx:170 브리핑 스킵.
정상 클리어(boss_hp<=0)·XP·진행도 저장 흐름은 불변. 변경 전후 흐름도와 diff를 보여줘.
```

**[프롬프트 D · Sonnet] feedback.wrong "…정답!" 문구 정정 (②③과 병행)**
```
backend/data 전체에서 feedback.wrong 문자열이 '정답!' 또는 '정답!'(전각/반각 느낌표 포함)으로 끝나는 항목 139개를
오답 안내 톤으로 정정해줘. 규칙: 끝에 붙은 '정답!'/'정답!' 군더더기만 제거하고, '정답은 A. Hello예요.'처럼
정답을 알려주는 본문은 유지(오답 시 정답 공개는 의도된 동작). JSON 구조·다른 필드는 절대 건드리지 말고,
스크립트로 일괄 치환하되 변경 전후 샘플 10개와 총 변경 건수를 출력해. feedback.correct는 손대지 마.
```

**[프롬프트 R · Opus] 회귀 검증 (②③+D 후 실행)**
```
위 ②③ + D 수정 후 회귀 검증:
1) backend pytest 전체(특히 test_unitboss_entry, test_gating_fix, test_missions, test_rewards) 결과 보고.
2) 시나리오:
   - 퀴즈 1차→A, 2차→B(교집합 0), 3차+→A+B 혼합 셔플(스펙). 재도전 시 attempt가 1로 안 떨어짐
   - 미니보스 실패 → 개념 Set B 진입(미니보스 자동 재진입 없음) / 정상 클리어 흐름 무변화
   - 결과화면 '다시 도전'·'개념 퀴즈부터 다시' 버튼도 attempt를 증가시킴(=A로 안 돌아감)
   - 통과(80%+) → 다음 스테이지/진화/XP 무변화
   - ① 오답 시 '정답!' 깜빡임 없음 / 오답 피드백 문구에 '정답!' 잔존 없음
3) 비로그인 1-1 체험, 체크포인트(miniboss_ready) 복원, 재도전 시 브리핑 스킵 확인.
4) 변경 파일 git diff 요약 + 남은 위험요소.
```

통과 기준: 재도전 시 **attempt가 1로 리셋되지 않음**(1→A, 2→B 교집합 0, 3+ 혼합 셔플), 미니보스 실패 시 개념 Set B 진입, ① 깜빡임 0, 기존 통과/진화/XP 무변화.
