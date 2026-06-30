import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../hooks/useAuthStore'
import { usePairsGame } from './usePairsGame'
import PairsCard from './PairsCard'
import PairsDash from './PairsDash'
import WinModal from './WinModal'
import { GAMES } from './data'
import './AIPair.css'

import charSlime  from '../../../assets/character_slime.png'
import charRobot  from '../../../assets/character_robot.png'
import charBubble from '../../../assets/character_bubble.png'
import charGhost  from '../../../assets/character_final_ghost.png'

const CHARACTER_MAP = {
  slime:         { src: charSlime,  name: '에이몬 슬라임' },
  robot:         { src: charRobot,  name: '에이몬 로봇' },
  speech_bubble: { src: charBubble, name: '에이몬 말풍선' },
  final_ghost:   { src: charGhost,  name: '파이널 에이몬' },
}
const CHAR_LIST = Object.entries(CHARACTER_MAP)

export default function AIPair() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const defaultChar = user?.character && CHARACTER_MAP[user.character]
    ? user.character : 'slime'

  const [charId, setCharId]           = useState(defaultChar)
  const [pickerOpen, setPickerOpen]   = useState(false)
  const [pendingChar, setPendingChar] = useState(charId)

  const charSrc = CHARACTER_MAP[charId]?.src ?? charSlime

  const {
    deck, flippedIds, matchedIds, wrongIds,
    score, timerSec, fmtTime, won, init, onCardClick, matchedCount,
    activeGameId, setActiveGameId,
  } = usePairsGame()

  const openPicker = () => { setPendingChar(charId); setPickerOpen(true) }
  const confirmChar = () => { setCharId(pendingChar); setPickerOpen(false) }

  return (
    <div className="mp-root">
      <button className="mp-back" onClick={() => navigate('/game')}>← 목록</button>

      <div className="mp-hero">
        <img className="mp-hero-char" src={charSrc} alt="캐릭터" onClick={openPicker} />
        <span className="mp-char-hint">👆 탭해서 변경</span>
      </div>

      <div className="mp-game-tabs">
        {GAMES.map((g) => (
          <button
            key={g.gameId}
            className={`mp-game-tab${activeGameId === g.gameId ? ' active' : ''}`}
            onClick={() => setActiveGameId(g.gameId)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <PairsDash score={score} timeStr={fmtTime(timerSec)} matchedCount={matchedCount} onRestart={init} />

      <div className="mp-grid">
        {deck.map((card, idx) => (
          <PairsCard
            key={idx}
            data={card}
            charSrc={charSrc}
            flipped={flippedIds.includes(idx)}
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

      {pickerOpen && (
        <div className="mp-char-modal-bg" onClick={(e) => e.target === e.currentTarget && setPickerOpen(false)}>
          <div className="mp-char-modal">
            <div className="mp-char-modal-title">🎮 캐릭터 선택</div>
            <div className="mp-char-modal-sub">내 프로필 캐릭터를 골라보세요</div>
            <div className="mp-char-grid-pick">
              {CHAR_LIST.map(([id, { src, name }]) => (
                <button key={id} className={`mp-char-option${pendingChar === id ? ' selected' : ''}`} onClick={() => setPendingChar(id)}>
                  <img src={src} alt={name} />
                  <span className="mp-char-option-name">{name}</span>
                </button>
              ))}
            </div>
            <button className="mp-btn-char-confirm" onClick={confirmChar}>✅ 선택 완료</button>
          </div>
        </div>
      )}
    </div>
  )
}
