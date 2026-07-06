# 엔드보스 레벨 사다리 — 기획서 (v1, 백엔드 리뷰 반영)

> 상태: 확정 대기. 이슈1·3(target_level 분리) + 강등 방지 가드는 **이미 머지·테스트 그린(331 passed)**. 이 문서는 그 위에 얹는 **UX 재설계(칩 → 사다리 + 하위 티어 직행 인정)**.
> 흐름: Phase 1 백엔드(하위호환 유지, 그린 커밋) → Phase 2 프론트(사다리 UI + 로컬 재현 검증).

## 1. 한 줄 요약
엔드보스를 "레벨 자유 선택(칩)"에서 **"올라가는 사다리"**로 바꾼다. 레벨테스트는 사다리의 **출발 칸(바닥선)**만 정하고, 하위 티어는 "인정 통과(원하면 직행 도전)", 현재 티어는 유닛 1~8 클리어 후 진입, 상위는 잠김.

## 2. 멘탈 모델 — 두 축 분리
| 축 | 무엇 | 정해지는 방식 | 이번 변경 |
|---|---|---|---|
| 커리큘럼 배치 (`course_level`) | 어느 유닛부터 공부하나 | 레벨테스트 | 그대로 |
| 엔드보스 사다리 | 어느 보스에 도전하나 | `course_level`(바닥선) + 클리어 이력 | 신설 규칙 |

## 3. 레벨 상태 4종
각 레벨 L, 유저의 `course_level` C(인덱스 ci), `endboss_cleared_levels`, `max_unlocked_unit`로 판정.
**판정 순서 고정 — cleared를 항상 먼저.**

| 상태 | 조건 | 진입 | UI |
|---|---|---|---|
| 🏆 클리어 | `L in endboss_cleared_levels` (**최우선, 인덱스 비교 전에 확정**) | 완료(재진입 X) | 인증카드 보유 |
| ✓ 인정 | `idx(L) < ci` 이고 미클리어 | 직행 가능(유닛 생략) | "원하면 카드 도전" |
| 🎯 현재 목표 | `idx(L) == ci` 이고 미클리어 | `max_unlocked_unit[L] > 8`일 때만 | 유닛 8 깨면 진입 |
| 🔒 잠김 | `idx(L) > ci` 이고 미클리어 | 불가 | 잠김 |

## 4. 게이트 2단
- **선택 가능**(칩/사다리 노출 + `resolve_level` 통과) = 클리어 ∪ 인정 ∪ 현재목표
- **진입 가능**(Start 활성) = 인정 OR (현재목표 AND `max_unlocked_unit[L] > 8`)

`endboss_selectable_levels(user)` = "선택 가능", `is_endboss_unlocked(user, level)` = "진입 가능".

## 5. 보상 정책 (확정)
- 하위(인정) 엔보를 **실제로 깨면** → 표준 풀보상(15,000 XP + 왕관 15 + 인증카드 + 칭호 + 진화).
- `endboss_cleared_levels` 가드로 **레벨당 1회** → 파밍 불가, 바운드된 1회 보너스.
- 자동 지급 없음 — 반드시 직접 깨야 받음(카드 가치 유지). `endboss_clear` 무변경.
- ⚠️ **플레이테스트 관찰항목: 왕관 + XP 둘 다.** 고급 배치 신규가 직행으로 최대 45,000 XP·왕관 45를 단시간에 획득 가능(레벨당 1회 내). 과하면 캡.

## 6. 백엔드 변경 — `endboss.py` 3곳 + info

`COURSE_LEVEL_ORDER`를 `utils`에서 import.

### (a) 신규 헬퍼
```python
def endboss_selectable_levels(user: dict) -> list[str]:
    base = set(derive_unlocked_course_levels(user))          # 클리어 이력(불변)
    ci = COURSE_LEVEL_ORDER.index(user.get("course_level", "beginner"))
    return [L for L in COURSE_LEVEL_ORDER
            if L in base or COURSE_LEVEL_ORDER.index(L) <= ci]  # + course_level 바닥선
```
> 📌 **`L in base` 절은 방어용(제거 금지).** 단조 승급 하에선 `base ⊆ {idx≤ci}`라 평소엔 redundant지만, **레벨테스트 재응시(`auth.py:1154`)로 course_level이 상위 클리어 이력보다 낮아진 엣지**에서만 상위 🏆 레벨을 selectable로 유지한다. §10 테스트로 이 시나리오 고정.

### (b) `resolve_level`
403 판정을 `derive_unlocked_course_levels` → `endboss_selectable_levels`로 교체.
> 📌 **must-keep: None-바이패스 보존.** `if not target_level: return user.course_level` (게이트 없음) 분기는 그대로. 교체는 **target_level이 truthy일 때의 403 검사에만** 적용. (§1에서 만든 하위호환 test A 유지.)

### (c) `is_endboss_unlocked(user, level)` — early-return 한 줄
```python
def is_endboss_unlocked(user, level):
    course = user.get("course_level", "beginner")
    if COURSE_LEVEL_ORDER.index(level) < COURSE_LEVEL_ORDER.index(course):
        return True                              # 배치보다 낮은 티어 = 직행 인정
    unlocked = user.get("max_unlocked_unit", {}) # 기존 로직 그대로 (level == course)
    ...
```
> 📌 `level == course`엔 early-return 미발동 → 기존 `max_unlocked_unit[level] > 8` 동일. `info(None)`는 `is_endboss_unlocked(user, course_level)` 호출이므로 기존과 완전 동일(하위호환).

### (d) `endboss_info` — 사다리용 상태 배열 추가(기존 필드 유지)
```json
{
  "...기존 필드...": "...",
  "levels": [
    {"level": "beginner",     "status": "recognized", "enterable": true},
    {"level": "intermediate", "status": "recognized", "enterable": true},
    {"level": "advanced",     "status": "current",    "enterable": false}
  ]
}
```
상태 계산 헬퍼 `endboss_level_status(user, L)`: **1) `L in endboss_cleared_levels`→cleared** → 2) 인덱스 비교로 recognized/current/locked → `enterable`은 §4 규칙.

## 7. 프론트 변경
- `api/index.js`: target_level 배선 완료 → **변경 없음**.
- `EndBossIntro.jsx`: 칩 셀렉터 → **사다리 컴포넌트**. `info.levels`를 위→아래(고급→초급) 렌더, 상태 뱃지(🏆/✓/🎯/🔒), `enterable`만 클릭·Start 활성.
- `EndBoss.jsx`: `selectedLevel` 초기값 = 현재 목표(course_level). 레벨 클릭 시 `getInfo(level)` 재조회 + 배틀 상태 리셋(기존 `handleLevelChange` 재사용).
- UI 카피: "전부 정복"은 3개 전부 🏆일 때만(§9). 직행 중간 상태를 "완료"로 오인하게 하지 말 것.

## 8. 절대 안 건드리는 것 (가드레일)
- `derive_unlocked_course_levels` — 순수 클리어 이력 유지. (`test_...ignore_progress_use_boss_clears_only` + 커리큘럼 전환 보존.) 엔보 바닥선은 `endboss_selectable_levels`에서만.
- `promote_course_level_from_endboss` — **이미 단조 승급(강등 방지) 적용됨. 사다리의 선결 조건** — 고급 배치가 초급 엔보 깨도 course_level 안 내려가야 사다리 안 무너짐.
- `endboss_clear` — 보상 무변경.

## 9. 엣지 케이스
| 상황 | 결과 |
|---|---|
| 초급 배치 신규 | 초급=현재목표(유닛8 전 잠김), 중·고급=잠김 → 기존과 동일(회귀 없음) |
| 고급 배치 신규 | 초·중급=인정(직행), 고급=현재목표 |
| 고급 배치가 초급 엔보 클리어 | 풀보상 1회, course_level 고급 유지(단조 승급), 초급→🏆 |
| 3개 다 클리어 | 전부 🏆, "전부 정복" |
| **레벨테스트 재응시로 course_level 하락 + 상위 클리어 이력** | 상위 🏆는 `L in base` 절로 selectable 유지(§6a), 재진입은 cleared 가드로 차단 |

## 10. 테스트 계획 (`test_endboss_target_level.py` 확장)
- `endboss_selectable_levels`: 고급배치→3개 / 초급배치 신규→`[beginner]` / 중급배치→`[beginner,intermediate]`.
- `is_endboss_unlocked`: `L<course`→항상 True / `L==course`→유닛8 필요 / `L>course`→False.
- `resolve_level`: 고급배치가 중급 타겟 통과 / 초급배치가 중급 타겟 403 / **None→course_level, 게이트 없음(하위호환 회귀 방지)**.
- `endboss_info.levels`: 배치별 4상태 정확성 + **cleared 최우선 판정**.
- 통합: 고급배치 초급 클리어 → 풀보상 + 강등 없음 + 상태 전이.
- **엣지: 레벨테스트 재응시로 course_level < 클리어 이력** → selectable/status 정확(§6a `base` 절 커버).
- 회귀: 기존 11 + target_level 10 + derive 테스트 전부 그린.

## 11. 구현 순서 (커밋 2개)
- **Phase 1 — 백엔드:** 헬퍼 2개(`endboss_selectable_levels`, `endboss_level_status`) + `resolve_level`(None 바이패스 보존) + `is_endboss_unlocked` early-return + `info.levels` + 테스트. 프론트 무변경 = 하위호환, 그린 커밋.
- **Phase 2 — 프론트:** 사다리 UI 교체 + 로컬 재현 검증(중급 페이지에 `endboss_mid_*`만).
