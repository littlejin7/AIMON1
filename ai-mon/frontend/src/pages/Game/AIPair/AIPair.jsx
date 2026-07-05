import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../hooks/useAuthStore'
import { usePairsGame } from './usePairsGame'
import PairsCard from './PairsCard'
import PairsDash from './PairsDash'
import WinModal from './WinModal'
import './AIPair.css'

import aiPairIcon from './assets/AIpairicon.png'

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
    score, timerSec, fmtTime, won, reward, init, onCardClick, matchedCount,
    isPreview, previewSeconds,
  } = usePairsGame()


  return (
    <div className="mp-root">
      {/* 상단 헤더 영역 */}
      <div className="mp-header">
        <button className="mp-btn-close" onClick={() => navigate('/game')}>✕</button>

        <div className="mp-header-center">
          <div className="mp-logo-wrap">
            <span className="mp-logo-text">AI<span>pair</span></span>
            <span className="mp-logo-star">⭐</span>
          </div>
        </div>

        <button className="mp-btn-settings" onClick={() => alert('설정 기능 준비 중!')}>⚙️</button>

        {/* 좌우 배치 캐릭터 (왕관 쓴 귀여운 에이몬 - 우측은 초록/비유색으로 hue-rotate) */}
        <div className="mp-header-char left">
          <img src={charSrc} alt="캐릭터" />
        </div>
        <div className="mp-header-char right is-green">
          <img src={charSrc} alt="캐릭터" />
        </div>
      </div>

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

      <PairsDash
        score={score}
        timeStr={fmtTime(timerSec)}
        matchedCount={matchedCount}
        onRestart={init}
      />

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
        💡&nbsp;<strong>카드를 두 장씩 뒤집어 파이썬 개념과 비유의 짝을 맞춰보세요!</strong>
      </div>

      <WinModal show={won} score={score} timeStr={fmtTime(timerSec)} charSrc={charSrc} reward={reward} onPlayAgain={init} />
    </div>
  )
}
