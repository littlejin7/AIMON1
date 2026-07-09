import { useNavigate } from 'react-router-dom'
import './AIPair.css'

export default function WinModal({ show, score, timeStr, charSrc, reward, onPlayAgain }) {
  const navigate = useNavigate()
  if (!show) return null
  // 신규 계약: reward.reward.coin_delta/gp_delta(게임 클리어 응답). 구 응답(xp_awarded)·
  // 에러 폴백({xp_awarded:0}) 은 옵셔널 체이닝으로 함께 처리.
  const coinAwarded = reward?.reward?.coin_delta ?? reward?.xp_awarded ?? 0
  const gpAwarded = reward?.reward?.gp_delta ?? 0

  return (
    <div className="mp-modal-bg">
      <div className="mp-modal">
        <img className="mp-modal-char" src={charSrc} alt="" />
        <div className="mp-modal-title">완벽해요! </div>
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
        {reward ? (
          reward.already_claimed
            ? <div className="mp-modal-reward mp-modal-reward--claimed">오늘 보상은 이미 받았어요 (최대 3판)</div>
            : (
              <>
                 <div className="mp-modal-reward">🪙 +{coinAwarded} 코인 획득!</div>
                {gpAwarded > 0 && <div className="mp-modal-reward">💠 +{gpAwarded} GP 획득!</div>}
              </>
            )
        ) : (
          <div className="mp-modal-reward mp-modal-reward--loading">보상 계산 중…</div>
        )}
        <button className="mp-btn-play-again" onClick={onPlayAgain}>
          🚀 다시 도전하기
        </button>
        <button className="mp-btn-to-list" onClick={() => navigate('/game')}>
          메인으로 돌아가기
        </button>
      </div>
    </div>
  )
}
