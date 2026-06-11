import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../hooks/useAuthStore'

const APP_INFO = [
  { label: '버전', value: 'v1.0.0 MVP' },
  { label: '개발', value: 'AI MON Team' },
  { label: '문의', value: 'support@aimon.app' },
]

export default function SettingsInfo() {
  const logout   = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  return (
    <>
      <section className="settings-section">
        <h2 className="settings-section-title">앱 정보</h2>
        <div className="settings-card card">
          {APP_INFO.map(({ label, value }) => (
            <div key={label} className="settings-row">
              <span className="settings-row-label">{label}</span>
              <span className="settings-row-value">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <button
          id="btn-logout"
          className="btn btn-danger btn-full"
          onClick={handleLogout}
        >
          🚪 로그아웃
        </button>
      </section>
    </>
  )
}
