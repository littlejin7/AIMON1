import { useEffect } from 'react'
import './StreakRewardModal.css'

// 연속 로그인 보상 모달. 기존 alert() 팝업을 대체.
// reward: { days, coin, crowns }
export default function StreakRewardModal({ reward, onClose }) {
  useEffect(() => {
    if (!reward) return
    // 팝업 열렸을 때 뒷배경 스크롤 막기
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [reward])

  if (!reward) return null

  return (
    <div className="streak-modal-overlay animate-fade-in">
      <div className="streak-modal-card card-glass animate-pop-in">
        <div className="streak-modal-icon animate-float">🔥</div>
        <h2 className="streak-modal-header">{reward.days}일 연속 로그인 달성!!</h2>

        <div className="streak-modal-rewards">
          <div className="streak-modal-reward-row">
            <span className="streak-modal-reward-icon">🪙</span>
            <span className="streak-modal-reward-text">+{reward.coin} 코인</span>
          </div>
          {reward.crowns > 0 && (
            <div className="streak-modal-reward-row">
              <span className="streak-modal-reward-icon">👑</span>
              <span className="streak-modal-reward-text">+{reward.crowns} 왕관</span>
            </div>
          )}
        </div>

        <p className="streak-modal-hint">보상을 획득했습니다!</p>

        <button className="btn btn-primary btn-lg btn-full streak-modal-btn" onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  )
}
