import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../hooks/useAuthStore'
import { userApi } from '../../api/index'
import './Settings.css'

export default function Settings() {
  const user      = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const logout    = useAuthStore((s) => s.logout)
  const navigate  = useNavigate()
  const setTheme = useAuthStore((s) => s.setTheme)
  const theme = useAuthStore((s) => s.theme)
  const [nickname, setNickname] = useState(user?.nickname || '')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await userApi.updateMe({ nickname })
      updateUser(res.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">⚙️ 설정</h1>
      </div>

      <div className="container">
        {/* Profile */}
        <section className="settings-section">
          <h2 className="settings-section-title">프로필</h2>
          <div className="settings-card card">
            <div className="settings-profile-info">
              <div className="settings-avatar">
                <span>{user?.character === 'fire' ? '🔥' : user?.character === 'cyber' ? '⚡' : user?.character === 'crystal' ? '💎' : '🤖'}</span>
              </div>
              <div>
                <div className="settings-username">@{user?.username}</div>
                <div className="settings-joined">아이디</div>
              </div>
            </div>
            <div className="divider" />
            <form onSubmit={handleSaveProfile} className="settings-form">
              <div className="form-group">
                <label htmlFor="settings-nickname">닉네임</label>
                <input
                  id="settings-nickname"
                  className="input"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="닉네임을 입력하세요"
                />
              </div>
              <button
                id="btn-save-profile"
                type="submit"
                className="btn btn-primary"
                disabled={saving || nickname === user?.nickname}
              >
                {saved ? '✅ 저장 완료' : saving ? '저장 중...' : '저장하기'}
              </button>
            </form>
          </div>
        </section>

{/* Theme */}
<section className="settings-section">
  <h2 className="settings-section-title">테마</h2>
  <div className="settings-card card" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
    {[
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
    ].map(({ id, label, color }) => (
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

'
'
        {/* App Info */}
        <section className="settings-section">
          <h2 className="settings-section-title">앱 정보</h2>
          <div className="settings-card card">
            {[
              { label: '버전', value: 'v1.0.0 MVP' },
              { label: '개발', value: 'AI MON Team' },
              { label: '문의', value: 'support@aimon.app' },
            ].map(({ label, value }) => (
              <div key={label} className="settings-row">
                <span className="settings-row-label">{label}</span>
                <span className="settings-row-value">{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Logout */}
        <section className="settings-section">
          <button
            id="btn-logout"
            className="btn btn-danger btn-full"
            onClick={handleLogout}
          >
            🚪 로그아웃
          </button>
        </section>
      </div>
    </div>
  )
}
