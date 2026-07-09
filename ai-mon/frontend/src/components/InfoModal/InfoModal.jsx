import { useEffect } from 'react'
import './InfoModal.css'

// 범용 안내 팝업. 브라우저 alert() 대신 사용.
// MiniBossGateModal과 동일한 스타일(흰 카드 + 보라 테두리 + 진한 텍스트 + 보라 버튼).
export default function InfoModal({ icon, message, confirmLabel = '확인', onConfirm }) {
  useEffect(() => {
    if (!message) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [message])

  if (!message) return null

  return (
    <div className="info-modal-overlay animate-fade-in">
      <div className="info-modal-card card-glass animate-pop-in">
        {icon && <div className="info-modal-icon animate-float">{icon}</div>}
        <p className="info-modal-desc">{message}</p>
        <button className="btn btn-primary btn-lg btn-full info-modal-btn" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
