// ═══════════════════════════════════════════════════════════════
//  bombConfig.js — 폭탄 해체 게임 규칙(설정값)
//  문제 데이터는 bombQuestions.js 참고
// ═══════════════════════════════════════════════════════════════

export const BOMB_CONFIG = {
  intro: {
    title: 'AI Bomb',
    desc: '미션을 해결해서 폭탄을 해체하라!',
    rule: (total, need) => `문제 ${total}개 중\n${need}개 이상 맞히면 해체 성공!`,
    rewardText: '⚡ 클리어 보상 · 코인 최대 100',
    startButton: '게임시작 ▶',
    passRatio: 0.7,                 // 총 문제 중 이 비율 이상 클리어하면 최종 성공 처리(표시용)
  },
  timer: {
    initialTime: 20,                // 스테이지당 제한 시간(초)
    dangerAt: 10,                    // 이 시간 이하면 빨갛게 깜빡임
    penaltySec: 7,                  // 오답 터치 시 차감(초)
  },
  reward: {
    label: '성공 보상',
    coinsPerStage: 10,              // 스테이지 클리어당 코인
    expPerStage: 20,                // 스테이지 클리어당 연출용 점수(실제 코인과 무관)
  },
  result: {
    successTitle: '폭탄 해체 성공!',
    successSub: '모든 오류를 찾아냈어요!',
    gameoverTitle: '펑! 폭발했어요',
    gameoverSub: '다시 도전해 볼까요?',
    stageClearTitle: 'CLEAR!',
    stageClearSub: '해체 성공!\n다음 스테이지로 이동합니다.',
    nextButton: '다음 스테이지 ▶',
    listButton: '스테이지 목록',
    retryButton: '다시 도전',
    exitButton: '나가기',
  },
};
