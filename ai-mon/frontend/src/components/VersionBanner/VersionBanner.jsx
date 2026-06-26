import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/* __APP_VERSION__ 은 vite.config.js의 define 으로 빌드 시 주입된 커밋 SHA */
// eslint-disable-next-line no-undef
const CLIENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

export default function VersionBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/version`)
      .then(r => r.json())
      .then(({ version }) => {
        if (version && version !== 'dev' && CLIENT_VERSION !== 'dev' && version !== CLIENT_VERSION) {
          setShow(true)
        }
      })
      .catch(() => { /* 버전 체크 실패는 무음 처리 — 기능 영향 없음 */ })
  }, [])

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
      color: '#fff', fontSize: '0.85rem', fontWeight: 600,
      padding: '10px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}>
      <span>🔄 새 버전이 있습니다. 새로고침하면 최신 기능을 사용할 수 있어요.</span>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
          color: '#fff', borderRadius: '6px', padding: '4px 12px',
          cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
        }}
      >
        새로고침
      </button>
      <button
        onClick={() => setShow(false)}
        style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '0 4px',
        }}
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  )
}
