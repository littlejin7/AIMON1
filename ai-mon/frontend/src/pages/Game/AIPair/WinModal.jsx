import { useNavigate } from 'react-router-dom'
import './AIPair.css'

export default function WinModal({ show, score, timeStr, charSrc, onPlayAgain }) {
  const navigate = useNavigate()
  if (!show) return null

  return (
    <div className="mp-modal-bg">
      <div className="mp-modal">
        <img className="mp-modal-char" src={charSrc} alt="" />
        <div className="mp-modal-title">완벽해요! 🎉</div>
        <div className="mp-modal-sub">모든 짝을 맞췄어요. 당신은 파이썬 마스터!</div>
        <div className="mp-modal-stats">
          <div className="mp-modal-stat">
            <div className="mp-modal-stat-label">최종 점수</div>
            <div className="mp-modal-stat-val">{score}</div>
          </div>
          <div className="mp-modal-stat">
            <div className="mp-modal-stat-label">소요 시간</div>
            <div className="mp-modal-stat-val">{timeStr}</div>
          </div>
        </div>
        <button className="mp-btn-play-again" onClick={onPlayAgain}>
          🚀 다시 도전하기
        </button>
        <button className="mp-btn-to-list" onClick={() => navigate('/game')}>
          ← 목록으로 가기
        </button>
      </div>
    </div>
  )
}
