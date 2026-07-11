import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './ExternalBrowserGuideModal.css'

function copyWithFallback(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    const copied = document.execCommand('copy')
    if (!copied) throw new Error('Copy command failed')
    return Promise.resolve()
  } finally {
    document.body.removeChild(textarea)
  }
}

export default function ExternalBrowserGuideModal({ open, appName, currentUrl, onClose }) {
  const titleId = useId()
  const descId = useId()
  const timerRef = useRef(null)
  const closeButtonRef = useRef(null)
  const [copyStatus, setCopyStatus] = useState('idle')

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  useEffect(() => () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  if (!open) return null

  const handleCopy = async () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)

    try {
      await copyWithFallback(currentUrl)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }

    timerRef.current = window.setTimeout(() => {
      setCopyStatus('idle')
      timerRef.current = null
    }, 2200)
  }

  return createPortal(
    <div className="external-browser-modal-overlay" onMouseDown={onClose}>
      <div
        className="external-browser-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="external-browser-modal-icon" aria-hidden="true">🔒</div>
        <h2 id={titleId} className="external-browser-modal-title">
          외부 브라우저에서 열어주세요
        </h2>
        <p id={descId} className="external-browser-modal-desc">
          Google 보안 정책상 앱 안 브라우저에서는 구글 로그인을 진행할 수 없습니다.
          <br />
          브라우저 메뉴에서 ‘기본 브라우저로 열기’를 선택하거나,
          <br />
          주소를 복사한 뒤 Chrome 또는 Safari에서 열어주세요.
        </p>
        {appName && (
          <p className="external-browser-modal-app">
            현재 {appName} 앱 브라우저로 열려 있습니다.
          </p>
        )}
        {copyStatus === 'failed' && (
          <p className="external-browser-modal-error">
            주소 복사에 실패했습니다. 주소창의 URL을 직접 복사해주세요.
          </p>
        )}
        <div className="external-browser-modal-actions">
          <button
            type="button"
            className="external-browser-modal-copy"
            onClick={handleCopy}
          >
            {copyStatus === 'copied' ? '복사됨 ✓' : '주소 복사'}
          </button>
          <button
            type="button"
            className="external-browser-modal-close"
            onClick={onClose}
            ref={closeButtonRef}
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
