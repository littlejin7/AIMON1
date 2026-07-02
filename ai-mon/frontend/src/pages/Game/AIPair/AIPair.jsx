import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../hooks/useAuthStore'
import { usePairsGame } from './usePairsGame'
import PairsCard from './PairsCard'
import PairsDash from './PairsDash'
import WinModal from './WinModal'
import './AIPair.css'

import charSlime from '../../../assets/character_slime.png'
import charRobot from '../../../assets/character_robot.png'
import charBubble from '../../../assets/character_bubble.png'
import charGhost from '../../../assets/character_final_ghost.png'

const CHARACTER_MAP = {
  slime: { src: charSlime, name: '에이몬 슬라임' },
  robot: { src: charRobot, name: '에이몬 로봇' },
  speech_bubble: { src: charBubble, name: '에이몬 말풍선' },
  final_ghost: { src: charGhost, name: '파이널 에이몬' },
}
const CHAR_LIST = Object.entries(CHARACTER_MAP)

export default function AIPair() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const defaultChar = user?.character && CHARACTER_MAP[user.character]
    ? user.character : 'slime'

  const charSrc = CHARACTER_MAP[defaultChar]?.src ?? charSlime

  const {
    deck, flippedIds, matchedIds, wrongIds,
    score, timerSec, fmtTime, won, init, onCardClick, matchedCount,
    isPreview,
  } = usePairsGame()


  return (
    <div className="mp-root">
      <button className="mp-back" onClick={() => navigate('/game')}>✕</button>

      <div className="mp-hero">
        <img className="mp-hero-char" src={charSrc} alt="캐릭터" />
      </div>

      <PairsDash score={score} timeStr={fmtTime(timerSec)} matchedCount={matchedCount} onRestart={init} />

      <div className="mp-grid">
        {deck.map((card, idx) => (
          <PairsCard
            key={idx}
            data={card}
            charSrc={charSrc}
            flipped={isPreview || flippedIds.includes(idx)}
            matched={matchedIds.has(idx)}
            wrong={wrongIds.has(idx)}
            onClick={() => onCardClick(idx)}
          />
        ))}
      </div>

      <div className="mp-hint">
        💡&nbsp;<strong>카드를 두 장씩 뒤집어 파이썬 개념과 코드/정의의 짝을 맞춰보세요!</strong>
      </div>

      <WinModal show={won} score={score} timeStr={fmtTime(timerSec)} charSrc={charSrc} onPlayAgain={init} />


    </div>
  )
}
