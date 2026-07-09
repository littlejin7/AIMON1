import { useEffect } from 'react'
import './MiniBossGateModal.css'

// 개념 퀴즈 60% 미만 → 미니보스 도전 불가 안내 팝업.
// 브라우저 alert() 대신 사용. 현재 화면 위에 오버레이로 뜨고,
// 확인 버튼을 누르면 onConfirm(재도전 로직)이 실행된다.
export default function MiniBossGateModal({ onConfirm }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div className="gate-modal-overlay animate-fade-in">
      <div className="gate-modal-card card-glass animate-pop-in">
        <div className="gate-modal-icon animate-float">💪</div>
        <h2 className="gate-modal-header">다시 도전해봐요!</h2>
        <p className="gate-modal-desc">
          개념 퀴즈를 <strong>60% 이상</strong> 맞춰야<br />
          미니보스에 도전할 수 있어요!
        </p>
        <button className="btn btn-primary btn-lg btn-full gate-modal-btn" onClick={onConfirm}>
          확인
        </button>
      </div>
    </div>
  )
}
