import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../hooks/useAuthStore'
import useGameBgm from '../../../hooks/useGameBgm'
import { usePairsGame } from './usePairsGame'
import PairsCard from './PairsCard'
import PairsDash from './PairsDash'
import WinModal from './WinModal'
import aizzakBgm from '../../../assets/bgm/aizzak_bgm.mp3'
import aipairThumb from './assets/AIpairicon.png'
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

  useGameBgm(aizzakBgm, { enabled: started })

  const defaultChar = user?.character && CHARACTER_MAP[user.character]
    ? user.character : 'slime'

  const charSrc = CHARACTER_MAP[defaultChar]?.src ?? charSlime

  const {
    deck, flippedIds, matchedIds, wrongIds,
    score, timerSec, fmtTime, won, reward, init, seed, onCardClick, matchedCount,
    isPreview, previewSeconds,
  } = usePairsGame()

  const [started, setStarted] = useState(false)

  /* 시작 전에도 뒤에 카드 보드가 보이도록 미리 깔아둠 */
  useEffect(() => {
    seed()
  }, [seed])

  const handleStart = () => {
    setStarted(true)
    init()
  }

  return (
    <div className="mp-root">
      <button className="mp-back" onClick={() => navigate('/game')}>✕</button>

      {/* 미리보기 카운트다운 */}
      {isPreview && (
        <div className="mp-countdown-overlay">
          {previewSeconds === 'START' ? (
            /* 마지막 START! 연출: 박스 없이 숫자와 같은 거대 골드 크기로 중앙 정렬 */
            <div key="start-prompt" className="mp-countdown-center-num is-start-text">
              START!
            </div>
          ) : (
            /* 5, 4, 3, 2, 1 카운트다운: 박스 없이 화면 정중앙에 큼직한 골드색 숫자가 연출 */
            <div key={previewSeconds} className="mp-countdown-center-num">
              {previewSeconds}
            </div>
          )}
        </div>
      )}

      <div className="mp-hero">
        <img className="mp-hero-char" src={charSrc} alt="캐릭터" />
      </div>

      <PairsDash score={score} timeStr={fmtTime(timerSec)} matchedCount={matchedCount} onRestart={init} />

      <div className="mp-hint">
        💡&nbsp;<strong>카드를 두 장씩 뒤집어 파이썬 개념과 비유의 짝을 맞춰보세요!</strong>
      </div>

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

      <WinModal show={won} score={score} timeStr={fmtTime(timerSec)} charSrc={charSrc} reward={reward} onPlayAgain={init} />

      {/* 시작 인트로 — 게임 화면 위에 화이트 박스 팝업으로 오버레이 */}
      {!started && (
        <div className="mp-intro-overlay">
          <div className="mp-intro-panel">
            <img className="mp-intro-thumb" src={aipairThumb} alt="에이짝" />

            <h1 className="mp-intro-title">AI Pair</h1>
            <p className="mp-intro-desc">반짝이는 카드 속 짝꿍을 찾아라!</p>

            <div className="mp-intro-rule">
              <div>🃏&nbsp;카드를 두 장씩 뒤집어</div>
              <div>파이썬 <strong>개념</strong>과 <strong>비유</strong>의 짝을 맞추세요!</div>
              <div className="mp-intro-rule-sub">6쌍을 모두 맞추면 클리어 🎉</div>
            </div>

            <div className="mp-intro-reward">⚡ 클리어 보상 · 코인 100~300</div>

            <button className="mp-intro-start" onClick={handleStart}>
              게임시작 ▶
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
