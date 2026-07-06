# 카테고리별 백엔드 점검 (비로그인 / 홈 / 레슨 / 훈련 / 미니게임 / 내 에이몬)

> 작성: ai-mon 팀장 / 대상: Claude Code(앱) 순서대로 실행
> 진단 근거: 실측(backend/routers: quiz, progress, train, game, mission, user, auth, titles, missions_core)
> 형식: 각 항목 = 근본원인 1줄 + 고칠 파일/위치 + 수정안 1~2개 + 위험도

---

## 요약 (위험도 순)

| 위험도 | 카테고리 | 항목 | 위치 |
|--------|----------|------|------|
| 🔴 높음 | 레슨 | is_completed 클라 신뢰 → 해금·보상 위조 | `progress.py:35` |
| 🔴 높음 | 내 에이몬 | update_me 무검증 캐릭터/칭호 장착 + 비원자 | `user.py` update_me |
| 🔴 높음 | 내 에이몬 | purchase-theme 비원자 → 이중구매/XP음수 | `user.py` purchase_theme |
| 🟠 중간 | 비로그인 | /quiz/questions 정답 평문 노출 | `quiz.py:316` get_questions |
| 🟡 낮음 | 홈 | streak 보상 XP가 apply_xp 우회(미션 미연동) | `auth.py` update_login_streak |
| 🟡 낮음 | 비로그인 | 등록 시 course_level/is_level_tested 클라 신뢰 | `auth.py` register |
| 🟢 양호 | 미니게임 | 서버 점수산출·토큰·nonce·캡 적용됨 | `game.py` (개선보단 테스트 보강) |
| 🟢 양호 | 훈련 | 읽기 전용·optional 인증 | `train.py` review |

---

## 1. 레슨 (Lesson) 🔴

**① is_completed 위조로 체인 해금**
- 근본원인: `update_progress`가 클라가 보낸 `is_completed`를 그대로 신뢰 → 공개구간 1-1부터 순차로 위조 제출하면 전 스테이지·유닛 완료·왕관(1)·XP(2000/3000)까지 해금됨. (코드에 TODO 명시)
- 위치: `backend/routers/progress.py:35` `update_progress` (`assert_stage_access`는 '선행조건'만 보고 정답 여부는 안 봄)
- 수정안:
  - A) 스테이지 완료를 **서버 채점 결과로만** 인정 — 해당 (unit,stage) 세션에서 attempts/코드채점 통과 기록이 있을 때만 `is_completed=True` 허용.
  - B) 최소판: stage별 '필요 정답수' 서버 기준을 두고, 클라 is_completed 를 그 검증 통과 시에만 수용.
- 위험: 랭킹/보상 도입 시 정면 악용. 도입 **전** 처리 권장.

## 2. 내 에이몬 (Character) 🔴

**② update_me 무검증 + 비원자**
- 근본원인: `PATCH /user/me` 가 `character`·`equipped_title`·`course_level`·`is_level_tested` 를 **검증 없이** 신뢰하고 `save_user`(delta-merge, 비원자)로 저장.
  - `character`: 진화 단계 무시하고 임의 캐릭터(최종 진화 포함) 장착 가능.
  - `equipped_title`: `user["titles"]` 보유 여부 안 봄 → 미획득 칭호 장착 가능.
  - 비원자: 동시 XP 쓰기와 last-writer-wins 충돌.
- 위치: `backend/routers/user.py` `update_me`
- 수정안:
  - A) `character`는 현재 lv/진화 도달 단계 내에서만 허용, `equipped_title`은 `title_id in user["titles"]` 검증.
  - B) 저장을 `mutate_user_atomic` 로 전환(다른 라우터 규칙과 통일).

**③ purchase-theme 비원자/멱등성 없음**
- 근본원인: 보유체크→XP차감→테마추가를 `save_user`(비원자)로 처리 → 동시요청 시 XP 이중차감/음수 또는 이중구매 경합.
- 위치: `backend/routers/user.py` `purchase_theme`
- 수정안: `mutate_user_atomic` 임계구역 안에서 (보유체크 → cost 차감 → purchased_themes append)를 원자 처리. 이미 보유/잔액부족은 그 안에서 거부.

## 3. 비로그인 UX 🟠

**④ 정답 평문 노출**
- 근본원인: `GET /quiz/questions`(및 `/questions/{id}`)가 문제 원본(`answer`, 해설 포함)을 그대로 반환 → 객관식/단답/빈칸은 클라 채점이라 정답이 네트워크로 평문 전송. 비로그인 공개 1-1도 동일.
- 위치: `backend/routers/quiz.py:316` `get_questions`, `:362` `get_question`
- 수정안:
  - A) 직렬화 시 `answer`·정답계열 필드를 strip 하고 채점은 서버(attempts/`/code/submit`)로 일원화.
  - B) 최소판: 비로그인 공개구간 응답에서만이라도 `answer` 제거.
- 비고: 코드문제는 `/code/submit` 서버채점으로 이미 권위 이전됨(1차 가이드). 객관식/단답이 남은 노출면.

**⑤ 등록 시 레벨 클라 신뢰 (낮음)**
- 근본원인: `register` 가 `course_level`·`is_level_tested` 를 클라 값으로 수용(레벨테스트 자체가 클라 계산).
- 위치: `backend/routers/auth.py` `register`(valid_levels 범위검증은 있음)
- 수정안: 자기 레벨 선택이라 영향 낮음 → 현행 유지 + "클라 신뢰 구간" 주석 명시. (보상 연동 없으면 방치 가능)

## 4. 홈 (Home) 🟡

**⑥ streak 보상 XP가 apply_xp 우회**
- 근본원인: streak 마일스톤(3/7/14/30) 보상이 `user["xp"] += ...` 직접 가산 후 `apply_xp(user,0)` 로 레벨만 재계산 → 보상 XP가 미션/이벤트 트리거를 안 탐.
- 위치: `backend/routers/auth.py` `update_login_streak` (호출부는 이미 `mutate_user_atomic` 경유 — 멱등성 OK)
- 수정안: 의도된 분리면 주석으로 명시. XP 미션 연동이 필요하면 `apply_xp(user, reward_xp)` 로 통일(단 streak 이벤트 재진입 루프 주의).

## 5. 훈련 (Train) 🟢
- `GET /train/review` 읽기 전용 + `get_current_user_optional` → 비로그인도 안전. 보상 없음.
- 잔여(낮음): 오답복습이 attempts 최신 1건 기준 → attempts 위조(120/min) 가능하나 보상 없어 영향 미미. 모니터링만.

## 6. 미니게임 (Game) 🟢
- `game.py` 이미 강함: 서버 점수 산출(클라 score/시간/xp 불신), 게임토큰 서명·만료·최소경과시간, nonce 일회성 소비, 일일 캡, distance 상한·비례 floor.
- 개선(보강): 토큰 시크릿 로테이션/만료값 점검, `daily_xp` 공유캡(aizzak↔runner) 분기 복잡 → `test_game_abuse`/`test_aizzak_game` 에 경계 케이스(동시·날짜경계·캡초과) 커버 확인.

---

## Claude Code 프롬프트 (우선순위 순)

### 모델
- ①②③(보상·해금 위변조 핵심, 백↔프 교차) → **Opus 4.8** (`claude-opus-4-8`)
- ④(직렬화 strip + 서버채점 영향) → **Opus 4.8**
- ⑤⑥ 정리·문서화 → **Sonnet 4.6** (`claude-sonnet-4-6`)
- 회귀 R → **Opus 4.8**

---

**[프롬프트 P0 · Sonnet] 현황 확인 (수정 금지)**
```
ai-mon 백엔드에서 아래만 읽고 표로 보고(수정 금지):
1) progress.py update_progress 가 is_completed 를 클라 입력으로 신뢰하는지, assert_stage_access 가 정답 여부를 보는지.
2) user.py update_me 가 character/equipped_title 검증 없이 save_user(비원자) 저장하는지.
3) user.py purchase_theme 가 mutate_user_atomic 없이 XP 차감하는지.
4) quiz.py get_questions/get_question 응답에 answer/해설 필드가 포함돼 클라로 나가는지.
각 항목 악용 시나리오 1줄씩 같이.
```

**[프롬프트 ①②③ · Opus] 해금·캐릭터·구매 서버권위/원자화**
```
ai-mon 백엔드 보상·해금 위변조 3건을 고쳐줘.
(①) progress.py update_progress: is_completed 를 클라 입력으로 신뢰해 1-1부터 순차 위조하면
    체인 해금·왕관·XP 가 뚫린다. 비보스 스테이지 완료는 '해당 unit-stage 세션에서 서버채점 통과 기록'이
    있을 때만 is_completed=True 를 허용하도록 바꿔라(없으면 stage별 필요정답수 서버검증으로 대체).
    기존 boss/miniboss 전담 라우터 보상 경로는 건드리지 말 것.
(②) user.py update_me: character 는 현재 lv/진화 도달 단계 내에서만, equipped_title 은
    title_id in user["titles"] 일 때만 허용. 저장을 mutate_user_atomic 으로 전환.
(③) user.py purchase_theme: 보유체크→XP차감→purchased_themes append 를 mutate_user_atomic
    임계구역 안에서 원자 처리(동시요청 이중차감·이중구매·XP음수 차단). 잔액부족/중복보유는 그 안에서 거부.
변경 diff + 각 악용 시나리오가 막히는 근거 + 영향받는 응답 필드를 보고.
```

**[프롬프트 ④ · Opus] 정답 노출 차단**
```
quiz.py get_questions/get_question 이 문제 원본(answer·해설 포함)을 그대로 반환해 객관식/단답 정답이
클라에 평문으로 나간다. 직렬화 단계에서 answer 및 정답계열 필드를 strip 하고,
객관식/단답 채점을 서버(attempts 또는 신규 검증 엔드포인트)로 옮길 수 있는지 영향분석과 함께 제안.
우선 비로그인 공개구간(1-1) 응답부터 answer 제거를 적용하고, 전면 적용 시 프론트 클라채점
(handleFillSubmit 등) 변경 범위를 리스트업. 채점 권위가 이미 서버인 code_input 경로와 일관되게.
```

**[프롬프트 ⑤⑥ · Sonnet] 정리·문서화**
```
(⑤) auth.py register: course_level/is_level_tested 가 클라 신뢰 구간임을 주석으로 명시(valid_levels 검증 유지).
(⑥) auth.py update_login_streak: streak 마일스톤 보상 XP 가 apply_xp 를 우회(user["xp"] 직접 가산)하는 게
    의도인지 확인하고, 의도면 주석 명시 / 미션 연동 필요면 apply_xp 로 통일(streak 이벤트 재진입 루프 주의).
변경 diff 보고.
```

**[프롬프트 R · Opus] 회귀 검증**
```
위 수정 후 회귀:
1) pytest 전체(특히 test_gating_fix, test_rewards, test_concurrency, test_derived_counters,
   test_account_delete, test_game_abuse) 결과.
2) 시나리오:
   - 1-1만 통과한 계정이 2-1/보스/타유닛을 is_completed 위조로 해금 시도 → 거부.
   - 미획득 캐릭터/칭호 장착 PATCH → 거부. 정상 보유분만 허용.
   - 테마 동시 2회 구매요청 → 1회만 성공·중복차감 없음·XP 음수 없음.
   - 비로그인/로그인 /quiz/questions 응답에 answer 없음. 정상 풀이/채점 흐름 유지.
   - 미니게임·미션·streak 보상 회귀 없음.
3) 변경 파일 git diff 요약 + 남은 위험.
```

통과 기준: 해금·캐릭터·칭호·구매가 **서버 검증/원자**로만 확정, 정답 비노출, 타 시스템(보스·미니게임·미션·streak) 무회귀.

---

## 공통 제안 (백엔드 담당)
- **클라 입력 신뢰 경계 통일**: is_completed·character·title·level 등 '상태를 바꾸는' 클라 입력은 전부 서버 검증/원자 경로로. 현재 game/mission/progress(보스) 는 원자, user/progress(스테이지)만 예외 → 같은 규칙으로 수렴.
- **save_user 비원자 사용처 감사**: `grep save_user` 로 delta-merge last-writer-wins 위험 지점(update_me, purchase_theme) 일괄 점검.
- **응답 직렬화 화이트리스트**: answer 류 민감필드는 serialize 단계에서 화이트리스트로만 노출.
