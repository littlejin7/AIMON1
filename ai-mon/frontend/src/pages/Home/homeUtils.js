import slimeIcon      from '../../assets/character_slime.png'
import robotIcon      from '../../assets/character_robot.png'
import speechBubbleIcon from '../../assets/character_bubble.png'
import finalGhostIcon from '../../assets/character_final_ghost.png'

export const EVOLUTION_STAGES = [
  {
    id: 'slime',
    icon: slimeIcon,
    name: '에이원',
    unitRange: 'Lv.1 ~ 9',
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.5)',
    desc: '동글동글한 보라 슬라임 · 왕관 · </> 배지',
  },
  {
    id: 'robot',
    icon: robotIcon,
    name: '에이량',
    unitRange: 'Lv.10 ~ 19',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.5)',
    desc: '헤드폰 달린 보라 로봇 · 왕관 · 입체감 UP',
  },
  {
    id: 'speech_bubble',
    icon: speechBubbleIcon,
    name: '에이훈',
    unitRange: 'Lv.20 ~ 29',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.5)',
    desc: '말풍선 몸체 · 흰 얼굴 패널 · {} </> 배지',
  },
  {
    id: 'final_ghost',
    icon: finalGhostIcon,
    name: '에이왕',
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

