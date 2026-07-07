import aipangIconUrl from './AipangPuzzle/assets/aipangicon.png'
import airunIconUrl  from './AIrun/assets/AIRUNicon.png'
import aibombIconUrl from './AIbomb/assets/AIbombicon.png'
import aipairIconUrl from './AIPair/assets/aipairicon.png'
import aiwordIconUrl from './AIcross/AIwordicon.png'

export const GAMES = [
  {
    id: 'aipang',
    icon: aipangIconUrl,
    emoji: '🧩',
    title: '에이팡',
    desc: '우주 속 AI 친구들과 떠나는 퍼즐 모험!',
    reward: '왕관 획득',
    rewardIcon: '👑',
    route: '/game/aipang',
    available: true,
    dailyTarget: 1,
  },
  {
    id: 'pairs',
    icon: aipairIconUrl,
    emoji: '🃏',
    title: '에이짝',
    desc: '반짝이는 카드 속 짝꿍을 찾아라!',
    reward: '코인 100~300',
    rewardIcon: '⚡',
    route: '/game/pairs',
    available: true,
    dailyTarget: 3,
  },
  {
    id: 'runner',
    icon: airunIconUrl,
    emoji: '🏃',
    title: '에이런',
    desc: '달리고! 피하고! 맞혀라!',
    reward: '코인 200~500',
    rewardIcon: '⚡',
    route: '/game/runner',
    available: true,
    dailyTarget: 5,
  },
  {
    id: 'aibomb',
    icon: aibombIconUrl,
    emoji: '💣',
    title: '에이밤',
    desc: '숨어 있는 오타를 찾아 폭탄을 해제하라!',
    reward: '코인 100',
    rewardIcon: '⚡',
    route: '/game/aibomb',
    available: true,
    dailyTarget: 3,
  },
  {
    id: 'aicross',
    icon: aiwordIconUrl,
    title: '에이칸',
    desc: '단어 조각을 모아 십자말을 완성하라!',
    reward: '코인 100~200',
    rewardIcon: '⚡',
    route: '/game/aicross',
    available: true,
    dailyTarget: 3,
  },
]

// 챌린지 대상 게임 (available + dailyTarget 있는 것)
export const CHALLENGE_GAMES = GAMES.filter(g => g.available && g.dailyTarget)

// 챌린지 색상/이미지 메타
export const CHAL_META = {
  aipang:  { color: '#9B94E8', img: aipangIconUrl, rewardLabel: '👑 +2',  rewardColor: '#854F0B' },
  pairs:   { color: '#378ADD', img: aipairIconUrl, rewardLabel: '⚡ +300', rewardColor: '#534AB7' },
  runner:  { color: '#1D9E75', img: airunIconUrl,  rewardLabel: '⚡ +300', rewardColor: '#0F6E56' },
  aibomb:  { color: '#E8944A', img: aibombIconUrl, rewardLabel: '⚡ +300', rewardColor: '#B45309' },
  aicross: { color: '#C2427D', img: aiwordIconUrl, rewardLabel: '⚡ +300', rewardColor: '#9D174D' },
}

// 오늘 날짜 키 (YYYY-MM-DD)
export function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

// localStorage에서 오늘 플레이 카운트 불러오기
export function loadCounts() {
  try {
    const raw = localStorage.getItem('aimon_daily_plays')
    if (!raw) return {}
    const { date, counts } = JSON.parse(raw)
    if (date !== todayKey()) return {}
    return counts || {}
  } catch {
    return {}
  }
}

// localStorage에 오늘 플레이 카운트 증가
export function incrementGamePlay(gameId) {
  try {
    const raw = localStorage.getItem('aimon_daily_plays')
    let counts = {}
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.date === todayKey()) counts = parsed.counts || {}
    }
    counts[gameId] = (counts[gameId] || 0) + 1
    localStorage.setItem('aimon_daily_plays', JSON.stringify({ date: todayKey(), counts }))
  } catch {}
}
