# Claude Code 지시서 — 엔드보스 레벨 커플링 해소 (v3, target_level 분리 확정)

> 팀장(Jinny) 결정 반영 (2026-07-05):
> - **엔드보스 = 각 레벨 유닛8 유닛보스 클리어 후 나오는 최종보스** (레벨당 1개). 이 전제 유지.
> - **이슈1·3 → target_level 완전 분리로 진행(확정).**
> - 흐름: **0. git HEAD/index 복구(★최우선) → 0.1 회귀/배포 검증 → 1. 백엔드 구조 수정 → 2. 프론트 배선(터미널 포함) → 3. 회귀 테스트.**
> - v2 문서(`CLAUDE_CODE_ENDBOSS_LEVEL_FIX.md`)는 "디커플링 안 함"으로 닫았으나, 지금 신고된 증상 2·3이 바로 그 미시행분이라 v3에서 뒤집음.

---

## 0. 결론 (근본 원인 1줄 + 파일/위치 + 수정안)

**근본 원인 (1줄):** 엔드보스가 낼 문제 레벨을 "요청에 명시된 도전 레벨"이 아니라 **계정의 단일 가변 필드 `course_level` 하나에 하드커플링**해서 결정한다 — 그래서 `course_level`이 화면에 보이는 도전 레벨과 어긋나면 하위(초급) 문제가 상위 화면에 새고, "지금 어떤 엔드보스를 싸우는가"라는 개념 자체가 없다.

| 이슈 | 근본 원인 | 파일:위치 | 판정 |
|---|---|---|---|
| **1. 중급/고급 개념 부재, course_level 단일 결정** | 문제 파일 결정이 요청 파라미터가 아니라 `user.course_level` | `endboss.py:209, 284` `load_endboss_questions(level=course_level)` / `info` `181` / seen키 `230–244` | 🔴 구조 결함 — 고침 |
| **3. 초급 문제가 중급/고급에 노출** | 이슈1의 직접 결과. 프론트는 `bossData.course_level`로 프로젝트 목록을 그림 + 백엔드도 `course_level`로 로드 → course_level이 실제 도전 레벨과 어긋나면 초급 문제가 그대로 나옴 | 프론트 `EndBossIntro.jsx:26` `const level = bossData?.course_level`, 백엔드 `endboss.py:208–215` | 🔴 라우팅 결함 — 고침 (데이터 오염 아님*) |
| **2. 초급 엔드보스 후 중급 해금 안됨** | **실제 소스 로직은 정상.** `promote_course_level_from_endboss`(`utils.py:656`)가 course_level→intermediate 승격, `derive_unlocked_course_levels`(`utils.py:614`)가 `[beginner,intermediate]` 반환, 프론트도 클리어 후 `getMe`로 갱신(`EndBoss.jsx:207`). → 가장 유력 원인은 **배포본이 워킹트리보다 뒤처짐**(아래 §0.1) | `utils.py:614/656`, `EndBoss.jsx:207` | 🟡 소스 정상 → 배포/새로고침 확인 먼저 |

> *데이터 오염 아님 근거: `beginner/intermediate/advanced.json`은 project·question_id prefix로 레벨이 깨끗이 분리됨 (`endboss_beg_*` account/wordchain/grade/gpa, `endboss_mid_*` todo/contact/weather/log_parser, `endboss_adv_*` ai_agent/async_api/fastapi_server/langchain_bot). 각 48문항, phase 1/2/3 = 20/16/12. **파일은 정상, 문제는 어느 파일을 여느냐(라우팅)다.**

**두 개의 언락 규칙은 충돌 아님(정정):** `is_endboss_unlocked = max_unlocked_unit[level] > 8`(= 유닛8 통과 = 엔드보스 진입)과 `derive_unlocked_course_levels`(= 다음 레벨 커리큘럼 언락)는 **서로 다른 관문**이라 팀장 모델과 일치. 단 target_level 분리 시, 진입 게이트를 `course_level`이 아니라 **요청 레벨** 기준으로 봐야 함(§1.2).

**수정안 (택1 — 권장 A):**
- **A (권장·확정):** `start/answer/clear/info`에 `target_level` 추가, `derive_unlocked_course_levels`로 검증, 로드·채점·seen·진입게이트·클리어 승격을 전부 이 레벨로 통일. 프론트는 `unlocked_course_levels`에서 고른 레벨을 전달.
- **B (미채택):** course_level 커플링 유지 + `/start`에서 `project`가 course_level 파일에 실존하는지만 검증(불일치 403). 누출은 막지만 "지금 도전 레벨" 개념은 여전히 없음.

---

## Step 0 — git HEAD/index 손상 복구 (★ 가장 먼저, 다른 작업 전에)

> ⚠️ Cowork bash 마운트가 **잘린 스냅샷**을 보였음(`utils.py:1221` truncated → SyntaxError). 이는 **git HEAD/index 손상 또는 index.lock 잔존** 정황. 이걸 안 고치면 워킹트리 수정(utils.py/auth.py)이 커밋·push·배포에 안 실려서 = **이슈2가 "코드는 맞는데 배포가 옛것"으로 재발.** 반드시 실제 머신(로컬 저장소)에서 Claude Code로 아래를 순서대로 실행.

### 0-A. 백업 먼저 (되돌릴 수 없는 명령 전에 필수)
```
아무것도 파괴하지 말고 먼저 백업:
1) 워킹트리 최신 수정 보존: backend/routers/ 전체를 저장소 밖으로 복사 백업
   (특히 utils.py, auth.py, endboss.py, boss.py). 이게 이번 작업의 자산 — git 복구로 날아가면 안 됨.
2) .git 자체 백업: cp -r .git ../.git.bak (Windows: xcopy /E /I .git ..\.git.bak)
```

### 0-B. 진단 (읽기만, 수정 금지)
```
git 손상 유형을 특정해서 보고:
1) 잠금 잔존: ls .git/*.lock .git/**/*.lock  (index.lock / HEAD.lock / refs/heads/*.lock / config.lock)
2) HEAD 상태: cat .git/HEAD  → 정상은 "ref: refs/heads/<브랜치>". 비었거나 깨졌으면 손상.
3) 저장소 인식: git status  /  git rev-parse --abbrev-ref HEAD  (fatal 나면 HEAD/index 손상)
4) 무결성: git fsck --full  (missing/corrupt object 있는지)
5) 최근 이동 흔적: git reflog -n 20  (마지막 정상 커밋 SHA 확보)
결과를 유형별로 표기: [락 잔존] / [HEAD 깨짐] / [index 깨짐] / [object 손상] 중 무엇인지.
```

### 0-C. 유형별 복구 (해당하는 것만 — 위→아래 순, 매 단계 후 git status 재확인)
```
① 락 잔존만인 경우(가장 흔함):
   rm -f .git/index.lock .git/HEAD.lock .git/config.lock .git/refs/heads/*.lock
   → git status 되면 종료.

② HEAD 깨짐(빈 파일/쓰레기): 브랜치명 확인 후
   git symbolic-ref HEAD refs/heads/<브랜치>   # 예: main
   → 그래도 안 되면 reflog의 정상 SHA로: git update-ref refs/heads/<브랜치> <good-sha>

③ index 깨짐(status는 되는데 파일 상태가 이상/entry 오류):
   rm -f .git/index && git reset --mixed HEAD    # 워킹트리 파일은 보존, index만 HEAD로 재구성
   (또는 git read-tree HEAD)

④ object 손상(fsck에 corrupt/missing):
   git reflog 로 마지막 정상 커밋 확인 → git reset --hard <good-sha> 는 워킹트리 덮어쓰니 주의!
   반드시 0-A 백업 유지. 최악 시: 원격을 새 폴더로 clone → 0-A 로 백업한 워킹트리 수정본만 덮어쓰기 → 커밋.

복구 후 필수 확인:
- git status / git log --oneline -5 정상
- backend/routers/utils.py 를 열어 마지막 줄(≈1226 return)까지 안 잘렸는지, auth.py:1159 가
  `updated_user, _ = mutate_user_atomic(...)` 인지 → 워킹트리 수정이 살아있는지 확인.
- 필요한 수정이 커밋 안 됐으면 지금 커밋. (이게 배포에 실려야 이슈2 해소.)
```

---

## 0.1 그 다음 — 회귀/배포 검증 (코드 수정 전, 확인만)

```
git 복구 후, 아무것도 더 수정하지 말고 검증만 해서 표로 보고:
1) 배포본 == 워킹트리 인지 (배포된 endboss.py 가 load_endboss_questions(course_level) 그대로인지).
2) 초급 유저가 초급 엔드보스 클리어 → GET /user/me 가 course_level="intermediate",
   unlocked_course_levels=["beginner","intermediate"] 반환하는지 (이슈2 회귀).
3) pytest backend/tests/test_endboss_level_unlock.py -q → 그린인지.
실패 케이스만 짚어줘. 2·3이 그린이면 이슈2는 '배포 스테일'이 원인 → 재배포로 해결.
```

**2·3이 그린이면 이슈2는 코드가 아니라 배포 문제.** 아래 §1~2(target_level)는 이슈1·3 해결용으로 그대로 진행.

### ✅ 커밋 체크포인트 0 (git 복구 직후)
```
# 복구로 살아난 워킹트리 수정이 커밋 안 돼 있으면 지금 커밋 (이게 배포에 실려야 이슈2 해소)
git add -A
git commit -m "fix(git): recover HEAD/index + 워킹트리 수정 보존 (utils.py, auth.py)"
git log --oneline -3   # 커밋 반영 확인
# 작업 브랜치 분기 권장 (main 직접 작업 회피)
git checkout -b fix/endboss-target-level
```

---

## 1. 백엔드 — target_level 분리 (`backend/routers/endboss.py`)  · 모델: **claude-opus-4-8**

> 크로스 엔드포인트 일관성 + 하위호환이 걸려 구조 판단 필요 → opus.

```
목표: 엔드보스가 계정 course_level 이 아니라 '요청된 도전 레벨(target_level)'의 문제를 로드/채점/승격하게 한다.
먼저 grep 로 course_level·is_endboss_unlocked·load_endboss_questions·_seen_key 참조 전부 나열하고 diff 로 보여줘.

backend/routers/endboss.py:
1) import 에 derive_unlocked_course_levels 추가 (utils). (이미 promote_course_level_from_endboss 는 import 중.)
2) 헬퍼 추가:
   def resolve_level(user, target_level):
       lvl = target_level or user.get("course_level","beginner")
       if lvl not in ("beginner","intermediate","advanced"):
           raise HTTPException(400, "잘못된 레벨")
       if lvl not in derive_unlocked_course_levels(user):
           raise HTTPException(403, "해금되지 않은 레벨입니다.")
       return lvl
3) is_endboss_unlocked(user) → is_endboss_unlocked(user, level): 내부 course_level 참조를 인자 level 로.
   (max_unlocked_unit[level] > 8 = 그 레벨 유닛8 통과 = 엔드보스 진입. 로직 그대로, 기준 레벨만 인자화.)
4) StartRequest / AnswerRequest / ClearRequest 에 target_level: Optional[str] = None 추가.
5) endboss_start: level = resolve_level(user, req.target_level);
   is_endboss_unlocked(user, level) 로 진입 게이트; load_endboss_questions(level);
   _phase12_seen_key/_seen_key 전부 이 level 로.
6) endboss_answer: level = resolve_level(user, req.target_level) 로 교체(현재 user.course_level 직접 사용부 283).
   load_endboss_questions(level), 채점 프롬프트의 level.upper()/advanced_note/level_instruction,
   save_attempt_item 의 "level" 전부 이 level 로.
7) endboss_clear: level = resolve_level(user, req.target_level).
   ⚠️ 중요: mutator 안에서 cleared 에 append 하는 값을 u["course_level"] 이 아니라 '요청 level' 로 바꾼다.
   (그래야 상위 course_level 유저가 하위/현재 엔드보스를 깨도 정확한 레벨이 기록되고 promote 가 올바르게 순차 승격.)
   CLEAR_TITLES/CLEAR_CHARACTER 조회 키도 이 level. promote_course_level_from_endboss(u) 는 그대로.
8) endboss_info: query param target_level: Optional[str]=None 받아,
   level=resolve_level; is_unlocked=is_endboss_unlocked(user, level); course_level 대신 이 level 로 리턴.
   추가로 unlocked_levels=derive_unlocked_course_levels(user) 를 응답에 포함(프론트 레벨 선택용).

제약:
- 하위호환: target_level 미지정(None) 이면 기존과 100% 동일(=course_level). 기존 프론트/테스트 안 깨져야 함.
- data 파일(beginner/intermediate/advanced.json) 3개 다 존재 → 추가 불필요.
diff 후, target_level 없는 기존 호출이 안 깨지는 근거를 설명해.
```

### ✅ 커밋 체크포인트 1 (백엔드 수정 후, 프론트 들어가기 전)
```
# 백엔드만 먼저 그린 확인 후 커밋 (프론트와 분리해 되돌리기 쉽게)
pytest backend/tests/test_endboss_level_unlock.py -q
git add backend/routers/endboss.py backend/routers/utils.py
git commit -m "feat(endboss): target_level 분리 — 요청 레벨 기준 로드/채점/승격 (하위호환 유지)"
```

---

## 2. 프론트 — 레벨 선택 배선 + Phase3 터미널 점검 (`frontend`) · 모델: **claude-sonnet-5**

```
frontend:
1) src/api/index.js (71–72 및 answer/clear 래퍼): endboss API 에 targetLevel 인자 추가.
   getInfo(targetLevel) → params {target_level}; startBattle(project, targetLevel) → body 에 target_level;
   answer/clearBoss 도 body 에 target_level 포함.
2) src/pages/EndBoss/EndBossIntro.jsx:26 `const level = bossData?.course_level` 를,
   사용자가 unlocked_course_levels 중에서 고른 레벨(selectedLevel)로 교체. 레벨 칩 UI 추가(초급 항상, 나머지는 unlocked 만).
   PROJECTS_BY_LEVEL[selectedLevel] 로 프로젝트 목록 렌더.
3) src/pages/EndBoss/EndBoss.jsx: selectedLevel 을 state 로 들고 start/answer/clear 호출에 target_level 로 전달.
   클리어 후 이미 getMe→updateUser 함(207–209) → 유지.
4) Phase3 코드입력 '터미널' 점검: src/components/QuizCard/CodeInput.jsx 가 code_input 문제를
   /boss/endboss/answer(target_level 포함) 로 제출 → is_correct/feedback/hint 표시 + 로딩/에러(grading_failed) 처리 확인.
   (v2 기준 이미 동작 — 신규 구현 아니라 target_level 전달만 확인.)
현재 데이터 흐름 요약 보고 → 최소 diff.
```

### ✅ 커밋 체크포인트 2 (프론트 배선 후)
```
# 프론트 빌드/린트 통과 확인 후 커밋
git add frontend/src/api/index.js frontend/src/pages/EndBoss/ frontend/src/components/QuizCard/CodeInput.jsx
git commit -m "feat(endboss-front): 레벨 선택 UI + target_level 배선 + Phase3 터미널 확인"
```

---

## 3. 회귀 테스트 · 모델: **claude-sonnet-5** (검증 리뷰는 opus 권장)

```
backend/tests 에 추가/갱신:
- target_level 미지정 → 기존 course_level 동작 동일(스냅샷).
- 초급 course_level 유저가 target_level="intermediate" 로 start → 해금 안됐으면 403.
- endboss_cleared_levels=["beginner"] 유저가 target_level="intermediate" 로 start →
  intermediate.json(todo/contact/…) 문제만 나오고 초급(account/…) 문제 0개.
- clear(target_level) 시 cleared 에 '요청 level' 이 append 되고 promote 결과가 순차(one step)인지.
- 기존 test_endboss_level_unlock.py 전부 그린 유지.
pytest -q 로 전량 그린 확인.
```

### ✅ 커밋 체크포인트 3 (테스트 그린 후) + 머지
```
pytest -q                      # 전량 그린 재확인
git add backend/tests/
git commit -m "test(endboss): target_level 분리 회귀 + 하위호환 케이스"
# 브랜치 머지 (전 커밋 그린 상태에서만)
git checkout main
git merge --no-ff fix/endboss-target-level -m "merge: endboss target_level 분리 (이슈1·3)"
git push origin main           # 배포 파이프라인 트리거
```

> 💡 커밋 원칙: 각 체크포인트는 **테스트/빌드 그린일 때만** 커밋. 실패하면 커밋하지 말고 그 단계에 머무를 것. 커밋 메시지 접두어 `fix/feat/test`로 구분해 되돌리기(revert) 단위 명확히.

---

## 4. 모델 배정 요약

| 단계 | 작업 | 모델 |
|---|---|---|
| 0 | git HEAD/index 복구 + 배포 회귀 검증 | claude-opus-4-8 |
| 1 | endboss.py 구조 수정 (크로스 엔드포인트) | **claude-opus-4-8** |
| 2 | 프론트 배선 + 터미널 점검 | claude-sonnet-5 |
| 3 | 테스트 작성 | claude-sonnet-5 |
| 3 | 최종 검증 리뷰(회귀·하위호환) | claude-opus-4-8 |

## 5. 실행 순서 한 줄 (커밋 지점 ✅ 표시)
0(git 복구: 백업→진단→복구) **✅커밋0 + 브랜치 분기** → 0.1(검증) → 1(백엔드 target_level) **✅커밋1** → 2(프론트) **✅커밋2** → 3(테스트 그린) **✅커밋3 + main 머지·push** → 배포.
