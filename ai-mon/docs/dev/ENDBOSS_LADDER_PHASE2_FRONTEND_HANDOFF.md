# 엔드보스 사다리 — Phase 2 프론트 구현 핸드오프 (GPT용, 자체 완결)

> 이 문서 하나로 컨텍스트 없는 AI가 Phase 2를 구현할 수 있게 작성. 백엔드(Phase 1)는 **완료·머지·테스트 그린(345 passed)**. 프론트만 남음.
> 리포지토리: `ai-mon/` (React + Vite). 작업 브랜치: `main`. **실제 파일을 열어 읽고 최소 diff로 수정할 것.**

---

## 0. 배경 (무엇이 이미 끝났나)
- 엔드보스 문제 레벨이 계정 `course_level` 하나에 하드커플링돼, 중급 엔드보스 화면에 초급 문제가 새던 버그가 있었음.
- 백엔드는 이미 **`target_level` 분리 + 레벨 사다리**로 재설계 완료:
  - `resolve_level(user, target_level)`: target 없으면 course_level(게이트 없음/하위호환), 있으면 selectable 검증(403).
  - `endboss_selectable_levels(user)`: 도전 선택 가능한 레벨 목록.
  - `is_endboss_unlocked(user, level)`: 진입 가능 여부(하위티어 직행 True / 현재티어 유닛8 게이트).
  - `endboss_clear`: 클리어한 **요청 레벨**을 기록, 단조 승급(강등 없음).
- **Phase 2 목표:** 프론트 엔드보스 진입 화면을 "레벨 칩 셀렉터" → **"올라가는 사다리 UI"**로 교체. 백엔드가 주는 `info.levels`를 그대로 렌더.

## 1. API 계약 (검증 완료 — 이대로 신뢰)
`GET /boss/endboss/info?target_level=<opt>` 응답(기존 필드 + 신규 `levels`):
```json
{
  "is_unlocked": true,
  "crowns": 10,
  "retry_cost": 3,
  "cleared_levels": ["beginner"],
  "already_cleared": false,
  "course_level": "advanced",
  "unlocked_levels": ["beginner","intermediate","advanced"],
  "levels": [
    {"level": "beginner",     "status": "cleared",    "enterable": false},
    {"level": "intermediate", "status": "recognized", "enterable": true},
    {"level": "advanced",     "status": "current",    "enterable": false}
  ]
}
```
`status` 4종 + 의미(백엔드 검증표 통과):
| status | 뜻 | 진입 |
|---|---|---|
| `cleared` 🏆 | 이미 깸(인증카드 보유) | 재진입 X |
| `recognized` ✓ | 배치보다 낮은 티어 = 직행 인정 | 클릭·Start 가능 |
| `current` 🎯 | 현재 목표 티어 | `enterable`가 true일 때만(유닛8 클리어 시) |
| `locked` 🔒 | 배치보다 높음 | 불가 |

**UI는 `enterable`만 보고 Start 활성/클릭 여부 판정.** status는 뱃지·안내문구용.

검증된 배치별 예시:
- 초급 신규(유닛8 전): beginner=current(enterable:false), intermediate=locked, advanced=locked
- 초급 유닛8 후: beginner=current(enterable:true), 나머지 locked
- 고급 신규: beginner=recognized(true), intermediate=recognized(true), advanced=current(false)
- 고급+초급클리어: beginner=cleared, intermediate=recognized(true), advanced=current(false)

## 2. 관련 프론트 파일 (현재 상태)
| 파일 | 현재 역할 | Phase 2에서 |
|---|---|---|
| `src/api/index.js` | `endbossApi.{getInfo(targetLevel), startBattle(project, targetLevel), submitAnswer(...), clearBoss(project, targetLevel)}` — target_level 배선 **완료** | **변경 없음** |
| `src/pages/EndBoss/EndBoss.jsx` | 상태 컨테이너. `bossData`(getInfo 결과), `endbossState`(전투), `selectedLevel` state, `handleLevelChange`(배틀상태 리셋 + `getInfo(level)` 재조회), `handleStart`, `handleSubmit` | selectedLevel 초기값 = `bossData.course_level`(현재목표). 사다리에서 레벨 클릭 시 `handleLevelChange(level)` 연결 |
| `src/pages/EndBoss/EndBossIntro.jsx` | 진입 화면. 현재 **레벨 칩 셀렉터** + `PROJECTS_BY_LEVEL[selectedLevel]` 프로젝트 목록 + Start(비활성=`!is_unlocked`) | **칩 → 사다리 컴포넌트로 교체(핵심 작업)** |
| `src/pages/EndBoss/EndBossBattle.jsx` | Phase3 code_input = 인라인 textarea + 공용 onSubmit(=EndBoss.jsx handleSubmit) | 변경 없음(터미널 동작 확인만) |

`PROJECTS_BY_LEVEL`(EndBossIntro.jsx 상단): beginner=account/wordchain/grade/gpa, intermediate=todo/contact/weather/log_parser, advanced=ai_agent/async_api/fastapi_server/langchain_bot. **유지.**

## 3. 구현 할 일
### 3-1. `EndBossIntro.jsx` — 사다리 컴포넌트
- `bossData.levels`를 **위→아래(advanced→beginner 순, 사다리를 올라가는 느낌)** 로 렌더.
- 각 행: 레벨명 + 상태 뱃지(🏆 cleared / ✓ recognized / 🎯 current / 🔒 locked) + 상태 안내문.
  - cleared: "정복 완료" + 인증카드 표시, 클릭·Start 불가.
  - recognized: "직행 도전 가능", 클릭 가능.
  - current + enterable:false: "유닛 8 보스를 먼저 클리어하세요", 클릭·Start 불가.
  - current + enterable:true: "도전 가능", 클릭 가능.
  - locked: "이전 티어를 먼저 정복하세요", 비활성.
- **클릭 가능 = `enterable === true`.** 클릭 시 `onLevelChange(level)`(부모 handleLevelChange).
- 선택된 레벨(`selectedLevel`)에 한해 `PROJECTS_BY_LEVEL[selectedLevel]` 프로젝트 선택 UI + Start 노출.
- Start 활성 = 선택 레벨의 `enterable === true` (levels 배열에서 `selectedLevel` 행의 enterable).
- 3개 전부 `cleared`면 "전부 정복" 상태 카피(중간에 조기 표시 금지).

### 3-2. `EndBoss.jsx` — 배선(대부분 이미 있음)
- `selectedLevel` 초기값 = 첫 `getInfo()`(target 없음) 응답의 `course_level`.
- `handleLevelChange(level)`: 배틀상태(myHp/bossHp/phase/project/currentQuestion/selectedOption/answerInput/aiResult/errorMsg/endbossState) 전부 리셋 + `getInfo(level)` 재조회 후 `selectedLevel=level`. (기존 함수 재사용/확장)
- `startBattle(project, selectedLevel)`, `submitAnswer(..., selectedLevel)`, `clearBoss(project, selectedLevel)` — target_level 전달 유지.
- 클리어 후 `getMe()`→`updateUser()` 유지.

## 4. 가드레일 (절대 하지 말 것)
- `api/index.js` target_level 배선 **재작성 금지**(완료됨). 인자만 전달.
- 백엔드 호출 계약 변경 금지. `info.levels`를 신뢰(백엔드에서 이미 검증).
- `PROJECTS_BY_LEVEL` 레벨↔프로젝트 매핑 변경 금지.
- 레벨 전환 시 이전 레벨 배틀 상태가 새 레벨로 새지 않도록 리셋 누락 금지.

## 5. 검증 (구현 후 반드시)
로컬에서 프론트+백엔드 기동 후:
1. **원래 버그 재현 체크:** 중급 진입 가능한 계정으로 중급 선택 → 시작 → 화면 문제 + Network의 `/boss/endboss/start` 응답 `phase1_questions[].question_id`가 **전부 `endboss_mid_*`, `endboss_beg_*` 0개.**
2. 배치별 사다리 육안: 고급 배치 신규 → 초·중급 ✓recognized 클릭 가능, 고급 🎯 유닛8 전 비활성.
3. cleared 레벨은 클릭·Start 불가(재진입 차단).
4. 레벨 전환 시 HP/문제/입력값 초기화 확인.
5. target_level 없는 기존 경로(직접 진입) 회귀 없는지.
6. `npm run build` + 변경파일 eslint 클린.

## 6. 커밋
```
git add frontend/src/pages/EndBoss/
git commit -m "feat(endboss-front): 레벨 사다리 UI (info.levels 기반, 직행 인정/유닛8 게이트)"
```

## 7. ⚠️ 아직 안 끝난 별개 항목 (Phase 2와 무관, 잊지 말 것)
- **배포:** `git push origin main` → Render/Vercel 재배포.
- **실서버 스모크(이슈2 라이브 확정):** 재배포 후 실서버에서 *초급 엔드보스 클리어 → `GET /user/me`가 `course_level="intermediate"`, `unlocked_course_levels=["beginner","intermediate"]`* 나오는지 + 배포 SHA == HEAD 확인. 이게 그린이어야 원래 3버그가 유저 화면 기준으로도 100% 종료.
