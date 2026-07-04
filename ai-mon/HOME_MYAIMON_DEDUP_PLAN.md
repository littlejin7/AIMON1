# 홈 / 내 에이몬 / 미니게임 리더보드 중복 제거 계획

> 상태: **분석 완료 · 수정 착수 전**. 새 UI 설계 아님. 기존 컴포넌트 구조·라우팅·네비게이션바·색상/카드 스타일 유지 전제로 한 정리 작업.

## 0. 목적 / 원칙

- 홈화면: 오늘 할 일, 이어하기, 빠른 진입, 내 에이몬 요약만 유지
- 내 에이몬: 캐릭터 상세, 성장 정보, 기록/통계, 보유 아이템, 계정/설정 유지
- 리더보드: 미니게임 내부에서 진입하는 순위/경쟁 화면으로 유지
- 홈 · 내 에이몬에 같은 상세 정보가 반복되면 → 홈은 요약만, 상세는 내 에이몬으로
- 지난주 우승자 배너는 홈/내 에이몬이 아니라 미니게임 리더보드에만
- 네비게이션바 / 라우팅 / 색상 / 카드 스타일 / 기존 API는 최대한 그대로

## 1. 대상 파일 (실제 확인됨)

| 화면 | 파일 | 라우트 |
|---|---|---|
| 홈(로그인) | `frontend/src/pages/Home/HomeDashboard.jsx` | `/` |
| 홈(비로그인 랜딩, 범위 밖) | `frontend/src/pages/Home/HomeLanding.jsx` | `/` |
| 내 에이몬 | `frontend/src/pages/Character/Character.jsx` | `/character` |
| 미니게임 홈 | `frontend/src/pages/Game/Game.jsx` | `/game` |
| 미니게임 리더보드 | `frontend/src/pages/Game/RankingPage.jsx` | `/game/ranking` |
| 공통 네비게이션바 (수정 안 함) | `frontend/src/components/NavBar/NavBar.jsx` | - |
| 미션 위젯 (홈에서 사용, 그대로) | `frontend/src/components/MissionWidget/MissionWidget.jsx` | - |

## 2. 현재 구조 요약

**HomeDashboard.jsx**
- 스트릭 카드: 연속학습 N일 + 주간 요일 dot
- 히어로 카드: Unit·Stage 배지 / **Lv 배지** / **장착 칭호 배지** / **코스레벨 배지** / 캐릭터 이미지 / **XP 진행바+잔여 XP 문구** / 현재 스테이지명 / 다음 보스 안내 / "지금 학습하기" CTA
- `MissionWidget`: 데일리·위클리 미션

**Character.jsx**
- 히어로: 로고/설정 / **장착 칭호 배지** / **코스레벨 배지** / 닉네임 / 캐릭터 이미지 / **Lv+XP 진행바+잔여 XP 문구**
- 보상 스트립: 왕관 / 연속학습일 / 보스클리어 횟수
- 캐릭터 해금 배너, 학습 스탯 4종, 캐릭터 변경, 칭호 선택, 인증카드, 캐릭터 커스텀, 터미널 테마, 로그아웃

**RankingPage.jsx** (`/game/ranking`, `Game.jsx`의 "전체보기"로 진입)
- 게임별 이번 주 Top3 + 내 순위/점수만 표시
- **지난주 우승자 배너: 코드상 존재하지 않음** (프론트/백엔드 모두 관련 필드 없음, 확인함)

## 3. 중복 항목 및 결정

| 중복 정보 | 위치 | 결론 |
|---|---|---|
| XP/레벨 성장 상세 (Lv, XP 진행바, 잔여 XP 문구) | 홈 히어로 + 내 에이몬 히어로 | **삭제** — 홈은 Lv 배지만 요약으로 남기고 진행바/잔여XP 문구는 제거, 내 에이몬에서만 표시 |
| 장착 칭호 배지 | 홈 히어로 + 내 에이몬 히어로 | **삭제** — 홈에서 완전 제거, 내 에이몬에서만 표시 |
| 코스레벨 배지(초급/중급/고급) | 홈 히어로 + 내 에이몬 히어로 | **삭제** — 홈에서 완전 제거, 내 에이몬에서만 표시 |
| 연속학습 일수 | 홈 스트릭카드(주간 dot) vs 내 에이몬 보상스트립 숫자 | **유지** — 홈은 출석 유도(오늘 할 일), 내 에이몬은 누적 기록으로 역할이 달라 중복 아님 |

## 4. 최소 수정안

| 화면 | 현재 | 수정 |
|---|---|---|
| 홈 히어로카드 | Unit·Stage 배지 + Lv 배지 + 칭호 배지 + 코스레벨 배지 + XP 진행바(수치+잔여XP) + 캐릭터이미지 + 스테이지명 + CTA | Unit·Stage 배지 + Lv 배지 + 캐릭터이미지 + 스테이지명 + CTA만 유지, 칭호/코스레벨 배지·XP 진행바 상세 제거 |
| 홈 스트릭카드 / MissionWidget | 현행 | 변경 없음 |
| 내 에이몬 | 현행 | 변경 없음 (유일한 상세 출처가 됨) |
| 미니게임 리더보드 | 이번 주 랭킹만 | 지난주 우승자 배너 추가는 **보류** (백엔드 필드 확인 후 별도 작업) |

## 5. 건드리지 않는 것
- `NavBar.jsx` (네비게이션바)
- 기존 라우팅 전체 (`/`, `/character`, `/game`, `/game/ranking` 등)
- 기존 색상/카드 톤 (`card-glass`, `hd-*`, `char-*`, `ranking-*` 클래스)
- 기존 API (`progressApi`, `userApi`, `gameApi.ranking`, `gameApi.rankingByGame`)

## 6. 확인 필요했던 사항 → 결정 완료

| 항목 | 제안 | 결정 |
|---|---|---|
| 지난주 우승자 배너 | 백엔드 필드(`last_week` 등) 없음 → 이번 작업과 분리 | **보류.** 백엔드 확인 후 별도 작업으로 진행 |
| 홈 히어로 칭호/코스레벨 배지 삭제 vs 축약 | 완전 삭제가 "요약만" 원칙에 더 부합 | **완전 삭제로 진행** |
| `equipped_title` localStorage 폴백 로직이 `Home`/`Character` 양쪽에 중복 | `characterData.js`에 `getEquippedTitle(user)` util로 추출해 공용화 | **이번 작업에 포함** (순수 로직 정리, UI/라우팅 영향 없음) |
| `/stats`, `/league` placeholder 라우트 | NavBar 미연결, 범위 밖 | **제외** |

## 7. 다음 단계 (아직 미실행)
1. `Home/homeUtils.js` 또는 `Character/characterData.js`에 `getEquippedTitle(user)` 공용 util 추가
2. `HomeDashboard.jsx` 히어로 카드에서 칭호 배지 / 코스레벨 배지 / XP 진행바+잔여XP 문구 제거, Lv 배지만 유지
3. `Home.jsx`/`Character.jsx`에서 중복 폴백 로직을 신규 util 호출로 교체
4. 지난주 우승자 배너는 백엔드 필드 확정 전까지 착수하지 않음
5. 수정 후 홈/내 에이몬/리더보드 화면 diff 및 시각 확인(스크린샷)으로 검증
