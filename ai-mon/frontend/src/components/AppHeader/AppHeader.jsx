import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../hooks/useAuthStore'
import { useSoundStore } from '../../hooks/useSoundStore'
import './AppHeader.css'

function SoundIcon({ muted }) {
  if (muted) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L9 8 7 10H4z" />
        <path d="M18 9l3 3m0-3l-3 3" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L9 8 7 10H4z" />
      <path d="M17 8.5a5 5 0 0 1 0 7" />
      <path d="M19.5 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.1 2.1 0 0 1-2.97 2.97l-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.08 1.65V21.3a2.1 2.1 0 0 1-4.2 0v-.06a1.8 1.8 0 0 0-1.08-1.65 1.8 1.8 0 0 0-1.98.36l-.04.04a2.1 2.1 0 0 1-2.97-2.97l.04-.04A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.65-1.08H2.9a2.1 2.1 0 0 1 0-4.2h.06A1.8 1.8 0 0 0 4.6 8.64a1.8 1.8 0 0 0-.36-1.98l-.04-.04a2.1 2.1 0 0 1 2.97-2.97l.04.04a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 10.27 2.4V2.1a2.1 2.1 0 0 1 4.2 0v.3a1.8 1.8 0 0 0 1.08 1.65 1.8 1.8 0 0 0 1.98-.36l.04-.04a2.1 2.1 0 0 1 2.97 2.97l-.04.04a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.65 1.08h.06a2.1 2.1 0 0 1 0 4.2h-.06A1.8 1.8 0 0 0 19.4 15z" />
    </svg>
  )
}

export function getAppHeaderTitle(pathname) {
  if (pathname === '/') return { title: 'AIMON', compact: true, sound: true, settings: true }
  if (pathname.startsWith('/lesson')) return { title: 'LESSON', compact: true, sound: true, settings: true }
  if (pathname.startsWith('/train')) return { title: 'TRAIN', compact: true, sound: true, settings: true }
  if (pathname === '/game') return { title: 'GAME', compact: true, sound: true, settings: true }
  if (pathname.startsWith('/character')) return { title: 'MY AIMON', compact: true, sound: true, settings: true }
  return null
}

export default function AppHeader() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const bgmVolume = useSoundStore((s) => s.bgmVolume)
  const setBgmVolume = useSoundStore((s) => s.setBgmVolume)
  const lastBgmVolumeRef = useRef(bgmVolume > 0 ? bgmVolume : 0.5)
  const header = getAppHeaderTitle(pathname)

  useEffect(() => {
    if (bgmVolume > 0) lastBgmVolumeRef.current = bgmVolume
  }, [bgmVolume])

  if (!header) return null

  const isMuted = bgmVolume <= 0
  const toggleBgm = () => {
    if (isMuted) {
      setBgmVolume(lastBgmVolumeRef.current || 0.5)
      return
    }
    lastBgmVolumeRef.current = bgmVolume
    setBgmVolume(0)
  }

  return (
    <header className={`app-header${header.compact ? ' app-header--compact' : ''}`} role="banner">
      <div className="app-header-inner">
        {header.sound && (
          <button
            type="button"
            className={`app-header-icon-btn app-header-left${isMuted ? ' is-muted' : ''}`}
            onClick={toggleBgm}
            aria-label={isMuted ? '배경음악 켜기' : '배경음악 끄기'}
          >
            <SoundIcon muted={isMuted} />
          </button>
        )}

        <div className="app-header-title-wrap">
          <h1 className="app-header-title">{header.title}</h1>
          {header.subtitle && <p className="app-header-subtitle">{header.subtitle}</p>}
        </div>

        {header.settings && token && (
          <button
            type="button"
            className="app-header-icon-btn app-header-right"
            onClick={() => navigate('/settings')}
            aria-label="설정"
          >
            <SettingsIcon />
          </button>
        )}
      </div>
    </header>
  )
}
