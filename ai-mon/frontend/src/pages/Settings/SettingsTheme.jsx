import { useAuthStore } from '../../hooks/useAuthStore'

const THEMES = [
  { id: 'dark',     label: '🌑 다크',     color: '#7c3aed' },
  { id: 'ocean',    label: '🌊 오션',     color: '#0ea5e9' },
  { id: 'fire',     label: '🔥 파이어',   color: '#ef4444' },
  { id: 'cyber',    label: '💚 사이버',   color: '#10b981' },
  { id: 'cherry',   label: '🌸 체리',     color: '#ec4899' },
  { id: 'midnight', label: '🌙 미드나잇', color: '#3b82f6' },
  { id: 'sunset',   label: '🍊 선셋',     color: '#f97316' },
  { id: 'gold',     label: '💛 골드',     color: '#f59e0b' },
  { id: 'arctic',   label: '🤍 아크틱',   color: '#475569' },
  { id: 'galaxy',   label: '🩵 갤럭시',   color: '#6366f1' },
]

export default function SettingsTheme() {
  const theme    = useAuthStore((s) => s.theme)
  const setTheme = useAuthStore((s) => s.setTheme)

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">테마</h2>
      <div className="settings-card card" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {THEMES.map(({ id, label, color }) => (
          <button
            key={id}
            onClick={() => setTheme(id)}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: theme === id ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.1)',
              background: theme === id ? `${color}22` : 'rgba(255,255,255,0.04)',
              color: theme === id ? color : 'var(--clr-text-muted)',
              fontWeight: theme === id ? 700 : 400,
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  )
}
