import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import './PwaInstallModal.css'

export default function PwaInstallModal({ open, onInstall, onLater }) {
  const titleId = useId()
  const descId = useId()
  const installButtonRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    installButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onLater()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onLater])

  if (!open) return null

  return createPortal(
    <div className="pwa-install-modal-overlay">
      <div
        className="pwa-install-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <img
          src="/aimon-icon-192-v2.png"
          alt=""
          className="pwa-install-modal-icon"
          aria-hidden="true"
        />
        <h2 id={titleId} className="pwa-install-modal-title">
          에이몬을 홈 화면에 추가할까요?
        </h2>
        <p id={descId} className="pwa-install-modal-desc">
          다음부터 브라우저를 열지 않고 바로 학습을 시작할 수 있어요.
        </p>
        <div className="pwa-install-modal-benefits" aria-hidden="true">
          <span>빠른 실행</span>
          <span>앱처럼 사용</span>
          <span>학습 이어가기</span>
        </div>
        <div className="pwa-install-modal-actions">
          <button
            type="button"
            className="pwa-install-modal-primary"
            onClick={onInstall}
            ref={installButtonRef}
          >
            홈 화면에 추가
          </button>
          <button
            type="button"
            className="pwa-install-modal-secondary"
            onClick={onLater}
          >
            나중에
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
