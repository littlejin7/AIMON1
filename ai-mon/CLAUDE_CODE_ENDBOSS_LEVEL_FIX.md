# Claude Code 작업 지시서 — 엔드보스 난이도 / 레벨업 (v2, authoritative 트리 기준 정정)

> ⚠️ v1 정정: Cowork bash 마운트가 **옛 스냅샷**을 보여줘 v1이 과장됐음. Claude Code / 실제 워킹트리 기준으로 재검증한 결과가 아래.
> 흐름: **회귀 검증(먼저) → (필요 시) 백엔드 구조 개선 → 프론트 → 회귀 테스트**

---

## 0. 실제 상태 (authoritative 워킹트리 재검증)

| 이슈 | 상태 | 근거(파일:위치) |
|---|---|---|
| **A. 레벨테스트 제출 500** | ✅ 이미 수정됨 | `auth.py:1159` 가 이미 `updated_user, _ = mutate_user_atomic(...)` 로 정상 언패킹. `serialize_user`도 안전. |
| **B-1. 승격 오염/비순차** | ✅ 이미 수정됨 | `utils.py:609–642` `derive_unlocked_course_levels` 에서 progress 기반 확장 루프 제거됨 + 순차 prefix 보장. |
| **B-2. 엔드보스 난이도 = course_level 단일 커플링** | ❌ 열림 | `endboss.py:181, 208` `level = user.get("course_level")` → `load_endboss_questions(level)`. `target_level` 파라미터 없음. |
| **C. 유닛 진행 기반 승격 부재** | ❌ 열림(기획 결정) | `boss.py:431,446` 은 `completed_units`/`max_unlocked_unit` 만 갱신, `course_level` 승격 훅 없음. 승격은 오직 `endboss.py:526` 엔드보스 클리어뿐. |

**결론(1줄):** 원래 신고된 "엔드보스가 초급/중급/고급 문제를 이상하게 냄"의 두 확정 원인(레벨테스트 500, 이력 오염 승격)은 **이미 코드에 반영됨.** 남은 건 순수 구조/기획 항목(B-2, C)뿐.

---

## 1. 먼저 할 일 — 회귀 검증 (코드 수정 전)

> 증상이 이미 사라졌을 가능성이 높음. **배포본이 워킹트리보다 뒤처져 있으면 배포만으로 끝날 수 있음.** 아래부터 확인.

```
아무것도 수정하지 말고 다음을 검증만 해:
1) 현재 배포/실행 중인 백엔드 버전이 워킹트리와 같은지 (auth.py:1159 가 `updated_user, _ = ...` 인지) 확인.
2) 로그인 유저 레벨테스트 제출 → 200 + user.course_level 갱신되는지 (이슈 A 회귀).
3) endboss_cleared_levels/unitboss_cleared_units 가 비어있고 progress 만 상위레벨인 유저로
   derive_unlocked_course_levels() 단위테스트 → ["beginner"] 만 나오는지 (이슈 B-1 오염 제거 확인).
4) 초급 유저 /boss/endboss/start → beginner.json 문제만 나오는지.
결과를 표로 보고하고, 실패 케이스만 짚어줘.
```

**위 4개가 모두 통과하면 → 원래 버그는 해결된 상태. 아래 Step은 "추가 개선"이며 선택.**

---

## 2. (선택) 이슈 B-2 — 엔드보스 난이도 디커플링

> 필요 조건: "이미 상위 레벨인 유저가 하위 엔드보스를 재도전" 하거나 "도전 레벨을 직접 선택" 하게 하고 싶을 때. 그게 아니라면 course_level 커플링 유지도 무방.

```
목표: 엔드보스가 계정 course_level 이 아니라 '지금 도전하는 레벨'의 문제를 로드.
backend/routers/endboss.py:
1) StartRequest / AnswerRequest / ClearRequest 에 target_level: Optional[str] = None 추가.
2) 각 엔드포인트에서 로드 레벨 = target_level or user.course_level (하위호환 폴백).
3) target_level 이 주어지면 반드시 utils.derive_unlocked_course_levels(user) 로
   '해금된 레벨'인지 검증 → 아니면 403.
4) load_endboss_questions / _seen_key / 채점 프롬프트의 level 참조를 모두 이 로드 레벨로 통일.
   info 엔드포인트(181행)도 필요 시 함께 정리.
데이터 파일(beginner/intermediate/advanced.json)은 3개 다 존재 → 추가 불필요.
grep 로 영향 범위 먼저 보고 → diff → 하위호환(파라미터 미지정 호출) 안 깨지는지 설명.
```

## 3. (선택) 이슈 C — 유닛 진행 기반 승격

```
현재: course_level 승격은 엔드보스 클리어(endboss.py:526)에서만 발생. 유닛 8 클리어는 승격 안 함.
'유닛 8(마지막) 클리어 시 다음 레벨 진입'을 원하면:
backend/routers/boss.py 의 유닛보스 클리어 지급부(max_unlocked_unit 갱신, 446행 근처)에서
해당 레벨 마지막 유닛일 때 promote_course_level_from_endboss(u) 와 동일한 순차 승격 훅 호출.
※ 먼저 '엔드보스 클리어로만 승격' vs '유닛 완주로도 승격' 중 현재 기획이 뭔지 확인하고 진행.
```

## 4. (B-2 적용 시) 프론트 — target_level 전달 + Phase3 터미널

```
frontend:
1) src/api/index.js 엔드보스 API 래퍼에 target_level 인자 추가.
2) src/pages/EndBoss/EndBoss.jsx, EndBossBattle.jsx 에서 start/answer/clear 호출 시 target_level 전달.
   (레벨테스트 levelKey 또는 사용자가 고른 도전 레벨)
3) Phase3 코드 입력 '터미널' 점검: src/components/QuizCard/CodeInput.jsx 가 code_input 문제 코드를
   /boss/endboss/answer 로 제출 → is_correct/feedback/hint 표시 + 로딩/에러(grading_failed) 처리하는지.
현재 데이터 흐름 요약 보고 → 최소 diff.
```

## 5. 회귀 테스트

```
pytest 로:
- 레벨테스트 제출 200 + course_level 갱신
- 초급 유저 엔드보스 → beginner 문제만
- beginner clear → intermediate '한 단계만' 승격
- (B-2 적용 시) target_level=beginner 로 상위 유저가 초급 재도전 → 403 아니고 beginner 문제 나옴
- (B-2 미적용 시) 기존 course_level 경로 그대로 통과
```

---

## 6. 모델 추천

- **회귀 검증 + B-2 디커플링 + C 승격(Step 1·2·3·5): `claude-opus-4-8`** — 호출그래프/하위호환/회귀 판단 필요.
- **프론트 배선(Step 4): `claude-sonnet-5`** — 기계적이라 Sonnet 로 충분.
- 한 세션이면 전부 `claude-opus-4-8` 로 두고 Step 4만 Sonnet 로 내려도 됨.

---

## 7. 팀장 최종 결정 (확정 · 2026-07-05)

**레벨업 정책 = A (엔드보스 클리어로만 승격).**
- **Step 3(boss.py 유닛 진행 승격) 폐기** — boss.py 는 건드리지 않음. 엔드보스 클리어(`endboss.py:526`)가 유일한 승격 관문.
- **B-2(target_level 디커플링)는 런칭 스코프에서 제외(defer)** — 버그가 아니라 재도전/레벨선택 UX 개선. B-1 수정으로 course_level 커플링은 정상 동작하므로 출시 무관. 추후 "레벨 재도전" 요구 발생 시 Step 2 재개.
- 따라서 남은 코드 작업 **없음.** 이슈 A·B-1 은 이미 반영·테스트 그린(11 passed).

## 8. 배포 전 순서 (기획안 `AIMON2.6_배포운영_기획안.docx` 연동 · 정책 A)

> ⚠️ 최우선: 기획안 2장의 **"로컬 저장소 HEAD 손상·index.lock"** 이슈가 곧 Cowork bash 가 옛/잘린 파일을 보인 원인. **이걸 먼저 정상화하지 않으면 워킹트리의 수정(auth.py:1159, utils.py:609–642)이 push 에 반영 안 될 수 있음.**

1. **0단계 — git 복구.** HEAD/index.lock 정상화 → `git status`/`git log` 로 auth.py·utils.py 수정이 워킹트리에 살아있고 커밋 대상인지 확인.
2. **1단계 — Supabase.** `battle_sessions(jsonb)` 컬럼 추가(기존 DEPLOY_CHECKLIST §1). USE_SUPABASE=true 에서 엔드보스 승격/언락이 JSON 모드와 동일한지 스모크.
3. **2단계 — push 전 테스트 그린.** 엔드보스/레벨 테스트 11 passed 재확인.
4. **3~4단계 — Render/Vercel.** front·back **동일 릴리스 동시 배포**, `RUN_SCHEDULER=1` 은 워커 1개만.
5. **5단계 — 스모크.** DEPLOY_CHECKLIST §4 + 신설 **§4-1 엔드보스/레벨 스모크**.
