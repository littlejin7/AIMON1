import { useSoundStore } from '../../hooks/useSoundStore'

function VolumeIcon({ value }) {
  if (value === 0) return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  )
  if (value < 0.5) return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  )
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  )
}

function MusicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
    </svg>
  )
}

export default function SettingsSound() {
  const bgmVolume    = useSoundStore((s) => s.bgmVolume)
  const sfxVolume    = useSoundStore((s) => s.sfxVolume)
  const setBgmVolume = useSoundStore((s) => s.setBgmVolume)
  const setSfxVolume = useSoundStore((s) => s.setSfxVolume)

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">사운드</h2>
      <div className="settings-card card">

        {/* 배경음악 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)', color: 'var(--clr-text-muted)' }}>
              <MusicIcon />
              배경음악
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--clr-text)', minWidth: 30, textAlign: 'right' }}>
              {Math.round(bgmVolume * 100)}%
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--clr-text-muted)', opacity: bgmVolume === 0 ? 1 : 0.4 }}>
              <VolumeIcon value={0} />
            </span>
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={bgmVolume}
              onChange={(e) => setBgmVolume(Number(e.target.value))}
              style={sliderStyle}
            />
            <span style={{ color: 'var(--clr-text-muted)', opacity: bgmVolume > 0 ? 1 : 0.4 }}>
              <VolumeIcon value={1} />
            </span>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--clr-border)' }} />

        {/* 효과음 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)', color: 'var(--clr-text-muted)' }}>
              <VolumeIcon value={sfxVolume} />
              효과음
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--clr-text)', minWidth: 30, textAlign: 'right' }}>
              {Math.round(sfxVolume * 100)}%
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--clr-text-muted)', opacity: sfxVolume === 0 ? 1 : 0.4 }}>
              <VolumeIcon value={0} />
            </span>
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={sfxVolume}
              onChange={(e) => setSfxVolume(Number(e.target.value))}
              style={sliderStyle}
            />
            <span style={{ color: 'var(--clr-text-muted)', opacity: sfxVolume > 0 ? 1 : 0.4 }}>
              <VolumeIcon value={1} />
            </span>
          </div>
        </div>

      </div>
    </section>
  )
}

const sliderStyle = {
  flex: 1,
  appearance: 'none',
  WebkitAppearance: 'none',
  height: 6,
  borderRadius: 99,
  background: 'var(--clr-border)',
  outline: 'none',
  cursor: 'pointer',
  accentColor: 'var(--clr-primary)',
}
