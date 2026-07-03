export const TRAIN_MODES = [
  {
    id: 'wrong',
    icon: '🔁',
    iconBg: '#FCEBEB',
    name: '오답 복습',
    desc: '틀린 문제만 모아서 다시 풀기',
  },
  {
    id: 'unit',
    icon: '🔄',
    iconBg: '#EEEDFE',
    name: '유닛 반복',
    desc: '완료한 유닛 전체를 다시 훈련',
  },
  {
    id: 'random',
    icon: '⚡',
    iconBg: '#EAF3DE',
    name: '랜덤 퀴즈',
    desc: '전 범위에서 랜덤 10문제',
    reward: '+2,000 XP',
  },
  {
    id: 'boss',
    icon: '💻',
    iconBg: '#F0EFF8',
    name: '코드도감',
    desc: '지금 까지 모은 코드를 확인해보세요!',
  },
]
