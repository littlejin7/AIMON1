# 레벨테스트 판정 로직 개선 가이드 (Claude Code용)

## 문제 요약
- 화면 점수 = `totalCorrect / total`(10문제 기준). 30점 = 3개 정답.
- 레벨 판정 `calcLevelResult()`는 점수와 무관하게 **고급 정답 개수만** 봄.
  - `advanced >= 2` 이면 초급·중급을 다 틀려도 "고급" 판정.
  - 고급 3문제가 4지선다라 찍어서 2개 이상 맞을 확률 ≈ 16%.
- 결과: 30점인데 고급 추천 = **버그(설계 허점)**.

## 권장 모델
- 전부 **claude-sonnet-4-6 (Sonnet)** 로 충분. 단일 파일 로직 + 가벼운 React 수정이라 Opus 불필요.
- Haiku는 로직 추론 정확도 때문에 비권장.

---

## 프롬프트 1 — 판정 로직 교체 (핵심)

```
frontend/src/components/LevelTestModal/levelTestData.js 의 calcLevelResult를
"누적 게이트" 방식으로 교체해줘. 윗 단계는 아랫 단계를 충분히 맞췄을 때만 인정한다.

기준:
- beginnerOK     = beginner >= 3       (초급 4문제 중 3개)
- intermediateOK = intermediate >= 2   (중급 3문제 중 2개)
- advancedOK     = advanced >= 2       (고급 3문제 중 2개)

판정:
- beginnerOK && intermediateOK && advancedOK → 'advanced'
- beginnerOK && intermediateOK               → 'intermediate'
- 그 외                                       → 'beginner'

파일 상단의 "판정 기준" 주석도 새 로직에 맞게 갱신하고,
함수 위에 각 임계값이 왜 이 숫자인지 한 줄씩 주석을 달아줘.
다른 파일은 건드리지 마.
```

## 프롬프트 2 — 점수·레벨 일관성 점검

```
레벨테스트 결과 화면에서 "점수(score)"와 "레벨 판정(levelKey)"이 서로 모순되지 않는지 확인해줘.
- LevelTestResult.jsx 와 levelTestData.js 를 같이 보고,
- 낮은 점수인데 높은 레벨이 뜨는 케이스가 또 있는지 점검.
또한 라벨 불일치도 정리해줘:
- LEVEL_META 는 초급/중급/고급
- LEVEL_RESULT 는 비기너/인터미디에이트/어드밴스드
둘 중 어느 쪽을 정식 표기로 쓸지 정하고 한쪽으로 통일하되, 화면에 보이는 문구는 그대로 유지되게 해.
바꾸기 전에 어떤 표기로 통일할지 먼저 물어봐.
```

## 프롬프트 3 — 검증 (엣지 케이스 테스트)

```
calcLevelResult에 대한 빠른 검증 스크립트(또는 vitest 테스트)를 만들어서 아래 케이스를 확인해줘:
1. { beginner:0, intermediate:0, advanced:2 }  → 'beginner'  (예전 버그 케이스)
2. { beginner:4, intermediate:3, advanced:3 }  → 'advanced'
3. { beginner:3, intermediate:2, advanced:1 }  → 'intermediate'
4. { beginner:2, intermediate:3, advanced:3 }  → 'beginner'  (초급 게이트 미통과)
5. { beginner:4, intermediate:1, advanced:3 }  → 'beginner'  (중급 게이트 미통과)
모든 케이스가 통과하는지 실행해서 결과를 보여줘.
```

---

## 참고: 대안 설계 (선택)
게이트 방식 대신 가중 점수 방식도 가능. 초급=1, 중급=2, 고급=3점으로 환산해
총점 임계값으로 레벨을 나누는 방법. 단, "초급을 못 맞췄는데 고급" 문제를 막으려면
게이트 방식이 더 직관적이고 확실함. 프롬프트 1을 기본 권장.
```
```
