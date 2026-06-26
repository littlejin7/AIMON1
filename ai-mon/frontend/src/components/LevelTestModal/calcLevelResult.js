// 초급 4문제 중 3개: 기초 개념(출력·반복·슬라이싱·딕셔너리)을 확실히 안다고 볼 수 있는 최소선
const BEGINNER_THRESHOLD = 3
// 중급 3문제 중 2개: lambda·컴프리헨션·예외처리 중 대부분을 이해한 수준
const INTERMEDIATE_THRESHOLD = 2
// 고급 3문제 중 2개: 데코레이터·비동기 개념을 실질적으로 파악한 수준
const ADVANCED_THRESHOLD = 2

/**
 * 누적 게이트 방식으로 레벨 판정 — 윗 단계는 아랫 단계가 OK일 때만 인정
 * @param {Object} correctByLevel  e.g. { beginner: 3, intermediate: 2, advanced: 1 }
 */
export function calcLevelResult(correctByLevel) {
  const { beginner = 0, intermediate = 0, advanced = 0 } = correctByLevel
  const beginnerOK     = beginner     >= BEGINNER_THRESHOLD
  const intermediateOK = intermediate >= INTERMEDIATE_THRESHOLD
  const advancedOK     = advanced     >= ADVANCED_THRESHOLD

  if (beginnerOK && intermediateOK && advancedOK) return 'advanced'
  if (beginnerOK && intermediateOK)               return 'intermediate'
  return 'beginner'
}
