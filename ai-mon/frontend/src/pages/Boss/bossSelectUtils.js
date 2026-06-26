/**
 * 보스 카드 표시 상태를 계산하는 순수 함수.
 *
 * getInfo 응답(boss.py:66)의 free_attempts_per_day·crowns 를 받아
 * 카드가 어떤 상태인지 결정한다. 렌더 로직과 분리되어 독립 테스트 가능.
 *
 *   freeOut   : 오늘 무료 도전 소진 (free_attempts_per_day <= 0)
 *   canCrown  : 왕관으로 진입 가능  (crowns > 0)
 *   isBlocked : 진입 완전 불가      (freeOut && !canCrown)
 */
export function getBossCardState(boss) {
  const freeOut  = boss.free_attempts_per_day <= 0
  const canCrown = (boss.crowns ?? 0) > 0
  return { freeOut, canCrown, isBlocked: freeOut && !canCrown }
}
