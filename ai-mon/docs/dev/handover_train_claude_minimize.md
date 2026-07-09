# 인수인계: 훈련페이지 검증 + Claude 호출 최소화 (다른 계정에서 이어서)

> 이 문서 하나로 맥락 없이 이어받을 수 있게 작성함. 작성일 세션 기준: 훈련(train) 3개 모드 점검 → Claude 토큰 절감 논의 중 크레딧 소진으로 중단.
> 대상 레포: `C:\AIMON1\ai-mon` (backend=FastAPI, frontend=React/Vite). 작업/머지 기준 브랜치: **main**.
> 커밋 메시지에 Claude Co-Authored-By 트레일러 붙이지 말 것.

---

## 1. 이번 세션에서 확인·검증한 것 (완료)

### 1-1. 훈련페이지 3개 모드 에러 점검 → 이상 없음
- 백엔드 목킹 테스트 39개 전부 통과:
  `cd ai-mon/backend && python -m pytest tests/test_train_page_verify.py tests/test_attempts_verify.py -v`
- **실제 문제 데이터 스모크 테스트도 전부 status 200** (목킹 아님, TestClient로 실 엔드포인트 호출):
  - 오답복습 `only_wrong=True`: 기록한 오답만 정확히 반환
  - 유닛반복 `only_wrong=False`: 15문제씩 채움
  - 랜덤퀴즈 `/train/random`: 잠금해제 유닛 있으면 N개, 없으면 빈 목록(폴백 없음)
- 실제 문제 풀 로딩 정상: quiz(beginner 1060/intermediate 864/advanced 860), miniboss(530/430/430), train(120/120/120)

### 1-2. 세 모드의 데이터 출처 (코드 근거 확인 완료)
- **오답복습** (`GET /train/review?only_wrong=true`, `ai-mon/backend/routers/train.py:23-72`)
  = `attempts` 기록 중 mode=quiz/miniboss이면서 **최신 시도가 오답**인 question_id를,
    **quiz+miniboss 원본 풀**에서 매칭해 반환. train 변형문제(u1_q001~)는 절대 안 섞임. 오답 없으면 빈 목록.
- **유닛반복** (`GET /train/review?only_wrong=false`, 같은 파일 `:60-72`)
  = 오답 우선 + **내가 만든 train 변형문항(u1_q001~)으로 15개까지 랜덤 패딩**.
- **랜덤퀴즈** (`GET /train/random`, `ai-mon/backend/routers/train.py:75-138`)
  = 잠금해제(progress에 is_completed=True 스테이지 1개↑ 있는) 유닛의
    ①내가 만든 train 문항 + ②레슨 오답 원본(quiz+miniboss 매칭)을 한 풀에 합쳐 중복제거 후 순수 랜덤 N개.

### 1-3. 오답 해설(피드백)이 Claude냐? → "정적 우선, 미스 시 Claude" 2단계
- **채점 + 기본 해설**: `POST /attempts` 응답의 정적 필드(문제 JSON 내장 `feedback`/`hint`/`explanation`). **Claude 아님.**
  `ai-mon/backend/routers/attempts.py:132-141`. 객관식/단답은 서버가 `grade_objective`로 재채점(어뷰징 방어).
- **AI 피드백 박스(AiFeedback)**: 오답일 때만 `fetchAiFeedback` 실행
  `ai-mon/frontend/src/components/QuizCard/QuizCard.jsx:136-252`
  1. fill_in_blank → 정적 번들 `src/data/fillFeedback/` 조회, 히트 시 **Claude 스킵**
  2. 객관식 → 정적 번들 `src/data/choiceFeedback/` 조회(선택지별 해설), 히트 시 **Claude 스킵**
  3. 번들 미스(코드형·번들 미포함 문항) → `POST /quiz/ai-feedback/stream`으로 **Claude API 스트리밍**
  4. Claude 실패 → 정적 폴백 문구

---

## 2. 지금 하려던 것 (미완 — 여기서 이어서 시작)

사용자 질문: **"Claude 호출을 최소화하려면?"**

토큰 절감 계획은 이미 대부분 구현돼 있음(아래 3번 현재 상태 참고). 이어받아 **가장 먼저 할 일**은
내가 실행 직전 차단당한 **번들 커버리지 검증**임. 파일 목록에서 의심 정황 발견:

> `ai-mon/frontend/src/data/fillFeedback/beginner/` 에 **unit_8.json 만 존재**, unit_1~7 없음.
> (intermediate/advanced는 unit_1~8 다 있음. choiceFeedback은 전 레벨/전 유닛 다 있음.)
> 메모엔 "fill 1254/1254 성공"이라 돼 있는데 파일과 불일치 → **beginner fill 번들 갭 의심**.
> beginner는 훈련페이지 기본 레벨이라, 갭이 사실이면 beginner unit1~7의 fill 오답이 전부 Claude로 새고 있음 = 절감 목표 정면 위반.

### 2-1. 실행하려던 검증 스크립트 (그대로 실행하면 됨)
```bash
cd /c/AIMON1/ai-mon && python -c "
import os,json
os.environ.setdefault('SECRET_KEY','test-secret-key-at-least-32-characters-long-xx'); os.environ.setdefault('USE_SUPABASE','false')
import sys; sys.path.insert(0,'backend')
from routers.quiz import load_questions_by_category
CHOICE={'multiple_choice','output_select','error_find'}
for lvl in ['beginner','intermediate','advanced']:
    for u in range(1,9):
        pool=load_questions_by_category('quiz',course_level=lvl,unit=u)+load_questions_by_category('miniboss',course_level=lvl,unit=u)
        fib=sum(1 for q in pool if (q.get('type') or q.get('quiz_type'))=='fill_in_blank')
        ch=sum(1 for q in pool if (q.get('type') or q.get('quiz_type')) in CHOICE)
        code=sum(1 for q in pool if (q.get('type') or q.get('quiz_type'))=='code_input')
        fp=f'frontend/src/data/fillFeedback/{lvl}/unit_{u}.json'
        cp=f'frontend/src/data/choiceFeedback/{lvl}/unit_{u}.json'
        fn=len(json.load(open(fp,encoding='utf-8'))) if os.path.exists(fp) else 'MISSING'
        cn=len(json.load(open(cp,encoding='utf-8'))) if os.path.exists(cp) else 'MISSING'
        flag=''
        if fib>0 and fn in ('MISSING',0): flag+=' <-- FILL번들갭'
        if ch>0 and cn in ('MISSING',0): flag+=' <-- CHOICE번들갭'
        print(f'{lvl:12} u{u}: fib={fib:3} ch={ch:3} code={code:2} | fillbundle={fn} choicebundle={cn}{flag}')
"
```
- **갭이 확인되면**: beginner fill 번들을 재생성. 재생성 스크립트는 무료(로컬 결정론, API 미사용):
  `ai-mon/backend/scripts/generate_fill_feedback.py` (author 필드로 고정 해설 생성 → `frontend/src/data/fillFeedback/{level}/unit_{u}.json` 출력).
  단, 품질 업그레이드판(`generate_fill_feedback_claude.py`)은 Claude 종량과금 호출임 — 크레딧 필요.
  우선 무료 결정론판으로 갭부터 메우는 걸 권장.
- 검증 후 `npm run build`(frontend) + `pytest`(backend)로 회귀 확인.

---

## 3. Claude 절감 계획 현재 상태 (메모 요약, 대부분 구현됨)

문항 분포 총 4918: 객관식계열 3237(66%), fill_in_blank 1505(31%), code_input 176(4%).

- **객관식(66%)** → 정적 번들 `src/data/choiceFeedback/`. 선택지별 해설. 런타임 Claude 0콜. **완료**(문항2840/해설8579·8580).
- **fill_in_blank(31%)** → 정적 번들 `src/data/fillFeedback/`. 문항당 고정 1건. **완료라고 기록됐으나 beginner unit1~7 갭 의심(위 2번 검증 대상).**
- **code_input(4%)** → 결정론 채점 데이터 준비 완료(expected_output 80건 + testcases 10건 = 90/136). **단, 채점 로직(code.py/endboss.py) 연결은 아직 안 함** — 데이터만 채운 상태(별도 승인 후 연결 예정).
  - 나머지 46건(비결정8+실행실패18+API/클래스/DB 20)은 설계상 Claude 채점 영구 유지.

### code_input 토큰 레버 (haiku 기준 재검토 결론)
- 레버1(cache_control)·2(system분리)·3(max_tokens캡)은 **haiku-4-5에선 사실상 무효**
  (haiku 최소 캐시 prefix=4096토큰인데 채점 고정부가 수백~1천 토큰대라 캐싱 안 걸림 등).
- 실효 있는 건 **레버4(거대 stderr/코드 truncate, 소폭)**와 **레버5(결정론 사전판정으로 호출 자체 제거)**뿐.
- 즉 code_input 진짜 절감 = 레버5(위 90/136 데이터를 실제 채점에 연결) + 레버4.

### 남은 작업(우선순위)
1. **[먼저] beginner fill 번들 갭 검증·복구** (위 2번, 무료)
2. code_input expected_output/testcases를 실제 채점 로직에 연결 (레버5, 승인 필요)
3. 레버4(truncate) 적용
4. code 공통해설 Supabase 캐시(`feedback_cache` 테이블) — 객관식/fill은 클라 번들이라 DB 불필요, code에만 필요

### 비용 참고 (Claude Code 크레딧과 무관, .env ANTHROPIC_API_KEY 종량과금, model=claude-haiku-4-5 하드코딩)
- 객관식 전체 재생성 ~$6-10(8580콜), fill 재생성 ~$1.5(1254콜), haiku 입력 $1 / 출력 $5 per 1M.

---

## 4. 관련 파일 빠른 참조
- 백엔드 라우터: `ai-mon/backend/routers/train.py`, `attempts.py`, `quiz.py`(로더 `load_questions_by_category`)
- 프론트 훈련: `ai-mon/frontend/src/pages/Train/Train.jsx`(오케스트레이션), `TrainHome.jsx`, `TrainSession.jsx`, `trainConstants.js`
- 피드백 UI: `ai-mon/frontend/src/components/QuizCard/QuizCard.jsx`(fetchAiFeedback), `AiFeedback.jsx`
- 정적 번들: `ai-mon/frontend/src/data/fillFeedback/`, `choiceFeedback/` (각 `index.js`=lazy 로더)
- 생성 스크립트: `ai-mon/backend/scripts/generate_fill_feedback.py`(무료), `generate_fill_feedback_claude.py`(유료), `generate_choice_feedback.py`(유료), `generate_code_expected_output.py`, `generate_code_testcases.py`
- 테스트: `ai-mon/backend/tests/test_train_page_verify.py`, `test_attempts_verify.py`
- 백엔드 규칙: `ai-mon/backend/CLAUDE.md`(mutate_user_atomic, 컬럼 분류표, limiter)

## 5. 다른 계정 세션에 붙여넣을 시작 프롬프트 (예시)
```
ai-mon 레포에서 Claude API 호출을 최소화하는 작업을 이어서 한다.
handover_train_claude_minimize.md 를 읽고, 2번 "지금 하려던 것"의 번들 커버리지
검증 스크립트를 먼저 실행해서 fillFeedback/beginner unit1~7 갭이 실제인지 확인해줘.
갭이면 무료(결정론) generate_fill_feedback.py 로 복구하고 npm build + pytest 로 회귀 확인.
```
