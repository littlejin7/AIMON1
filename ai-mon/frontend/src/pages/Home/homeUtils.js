import slimeIcon      from '../../assets/character_slime.png'
import robotIcon      from '../../assets/character_robot.png'
import speechBubbleIcon from '../../assets/character_bubble.png'
import finalGhostIcon from '../../assets/character_final_ghost.png'

export const EVOLUTION_STAGES = [
  {
    id: 'slime',
    icon: slimeIcon,
    name: '에이몬 슬라임',
    unitRange: 'Lv.1 ~ 9',
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.5)',
    desc: '동글동글한 보라 슬라임 · 왕관 · </> 배지',
  },
  {
    id: 'robot',
    icon: robotIcon,
    name: '에이몬 로봇',
    unitRange: 'Lv.10 ~ 19',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.5)',
    desc: '헤드폰 달린 보라 로봇 · 왕관 · 입체감 UP',
  },
  {
    id: 'speech_bubble',
    icon: speechBubbleIcon,
    name: '에이몬 말풍선',
    unitRange: 'Lv.20 ~ 29',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.5)',
    desc: '말풍선 몸체 · 흰 얼굴 패널 · {} </> 배지',
  },
  {
    id: 'final_ghost',
    icon: finalGhostIcon,
    name: '파이널 에이몬',
    unitRange: 'Lv.30+',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.5)',
    desc: '연보라 반투명 고스트 · AI 배지 · 프리미엄',
  },
]

// 캐릭터 ID → 진화 단계 정보
export function getEvolutionStage(characterId) {
  return EVOLUTION_STAGES.find(s => s.id === characterId) || EVOLUTION_STAGES[0]
}

// XP → { lv, xpInLevel, xpForNext }
export function calcLevel(xp) {
  let lv = 1
  let accumulated = 0

  while (lv < 30) {
    const needed = lv * 1000
    if (xp < accumulated + needed) {
      return { lv, xpInLevel: xp - accumulated, xpForNext: needed }
    }
    accumulated += needed
    lv++
  }

  // Lv.30+ 리미트 해제
  const extraXp  = xp - accumulated
  const extraLv  = Math.floor(extraXp / 30000)
  return { lv: 30 + extraLv, xpInLevel: extraXp % 30000, xpForNext: 30000 }
}
