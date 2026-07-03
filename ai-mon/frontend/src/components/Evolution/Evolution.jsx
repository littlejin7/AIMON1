/**
 * EvolutionModal.jsx
 * 포켓몬식 화이트아웃 진화 연출 모달
 *
 * 사용법:
 *   import EvolutionModal from '../../components/EvolutionModal/EvolutionModal'
 *
 *   <EvolutionModal
 *     fromChar="slime"        // 이전 캐릭터 ID
 *     toChar="robot"          // 새 캐릭터 ID
 *     newLevel={10}           // 달성 레벨
 *     onClose={() => ...}     // 닫기 콜백
 *   />
 *
 * 트리거 타이밍 (Home.jsx):
 *   calcLevel(xp) 로 lv 계산 후, 이전 lv과 비교해서
 *   EVOLUTION_LEVELS (10, 20, 30) 을 넘는 순간 setState
 */

import { useState, useEffect } from 'react'
import './Evolution.css'

// 캐릭터 메타 정보
const CHAR_META = {
  slime: {
    icon: '/src/assets/character_slime.png',
    name: '에이원',
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.5)',
  },
  robot: {
    icon: '/src/assets/character_robot.png',
    name: '에이량',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.5)',
  },
  speech_bubble: {
    icon: '/src/assets/character_bubble.png',
    name: '에이훈',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.5)',
  },
  final_ghost: {
    icon: '/src/assets/character_final_ghost.png',
    name: '에이왕',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.5)',
  },
}

// 레벨별 진화 맵
export const EVOLUTION_MAP = {
  10: { from: 'slime',         to: 'robot' },
  20: { from: 'robot',         to: 'speech_bubble' },
  30: { from: 'speech_bubble', to: 'final_ghost' },
}

// XP → 레벨 계산 (Home.jsx의 calcLevel 과 동일)
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
  const extraXp = xp - accumulated
  const extraLv = Math.floor(extraXp / 30000)
  return { lv: 30 + extraLv, xpInLevel: extraXp % 30000, xpForNext: 30000 }
}

export default function EvolutionModal({ fromChar, toChar, newLevel, onClose }) {
  // 'flash' → 1.2s 후 'reveal'
  const [phase, setPhase] = useState('flash')

  const from = CHAR_META[fromChar] || CHAR_META.slime
  const to   = CHAR_META[toChar]   || CHAR_META.robot

  useEffect(() => {
    const timer = setTimeout(() => setPhase('reveal'), 1200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={`evo-modal-overlay phase-${phase}`}>
      <div className="evo-card">
        <p className="evo-title">✨ 진화!</p>

        {/* 캐릭터 무대 */}
        <div className="evo-stage">
          {/* 파티클 (reveal 단계에서만 표시) */}
          {phase === 'reveal' && (
            <div className="evo-particles">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="evo-particle" />
              ))}
            </div>
          )}

          {/* 글로우 링 */}
          <div
            className="evo-glow-ring"
            style={{ background: `radial-gradient(circle, ${to.glow} 0%, transparent 70%)` }}
          />

          {/* 번쩍 오버레이 */}
          <div className="evo-flash-ring" />

          {/* 이전 캐릭터 */}
          <div className="evo-char-old">
            <img src={from.icon} alt={from.name} />
          </div>

          {/* 새 캐릭터 */}
          <div className="evo-char-new">
            <img src={to.icon} alt={to.name} />
          </div>
        </div>

        {/* 새 캐릭터 이름 */}
        <p className="evo-new-name" style={{ color: to.color }}>
          {to.name}
        </p>
        <p className="evo-new-sub">
          Lv.{newLevel} 달성 — 진화 완료!
        </p>

        <button className="evo-close-btn" onClick={onClose}>
          계속하기 →
        </button>
      </div>
    </div>
  )
}
