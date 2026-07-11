/**
 * EvolutionModal.jsx
 * 포켓몬식 화이트아웃 진화 연출 모달
 *
 * 사용법:
 *   import EvolutionModal from '../../components/Evolution/Evolution'
 *
 *   <EvolutionModal
 *     fromChar="slime"        // 이전 캐릭터 ID
 *     toChar="robot"          // 새 캐릭터 ID
 *     stage={1}               // 도달한 evolution_stage(1~3)
 *     onClose={() => ...}     // 닫기 콜백
 *   />
 *
 * 트리거 타이밍: 진화는 엔드보스 클리어로만 발생한다(백엔드 evolution_stage 가 단일
 * 소스). 호출부는 백엔드 응답의 evolution.evolved(+from_stage/to_stage) 또는
 * user_state.evolution_stage 변화를 비교해서만 이 모달을 띄운다 — 프론트에서 누적치/lv
 * 를 재계산해 진화 여부를 자체 판정하지 않는다.
 */

import { useState, useEffect } from 'react'
import './Evolution.css'
import slimeIcon from '../../assets/character_slime.png'
import robotIcon from '../../assets/character_robot.png'
import bubbleIcon from '../../assets/character_bubble.png'
import finalGhostIcon from '../../assets/character_final_ghost.png'

// 캐릭터 메타 정보. evolution_stage(0~3) ↔ 캐릭터 매핑은 백엔드
// character_for_stage 와 동일 기준(slime=0/robot=1/speech_bubble=2/final_ghost=3).
export const CHAR_META = {
  slime: {
    icon: slimeIcon,
    name: '에이원',
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.5)',
  },
  robot: {
    icon: robotIcon,
    name: '에이량',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.5)',
  },
  speech_bubble: {
    icon: bubbleIcon,
    name: '에이훈',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.5)',
  },
  final_ghost: {
    icon: finalGhostIcon,
    name: '에이왕',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.5)',
  },
}

// evolution_stage(0~3) → 캐릭터 ID. 백엔드 character_for_stage 와 동일 기준.
export const STAGE_TO_CHAR = { 0: 'slime', 1: 'robot', 2: 'speech_bubble', 3: 'final_ghost' }

export default function EvolutionModal({ fromChar, toChar, stage, onClose }) {
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
          {stage}차 진화 완료!
        </p>

        <button className="evo-close-btn" onClick={onClose}>
          계속하기 →
        </button>
      </div>
    </div>
  )
}
