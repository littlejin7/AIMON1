import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import SocialButtons from './SocialButtons'
import AuthForm      from './AuthForm'
import beginnerHappyIcon from '../../assets/character_beginnerhappy.png'
import './Auth.css'

export default function Auth() {
  const [searchParams] = useSearchParams()
  const [form, setForm]     = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [socialMsg, setSocialMsg] = useState('')

  const setAuth  = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await authApi.login({ username: form.username.trim(), password: form.password })
      setAuth(res.data.access_token, res.data.user, res.data.refresh_token)
      if (res.data.streak_reward) {
        const reward = res.data.streak_reward
        alert(`🔥 ${reward.days}일 연속 로그인 달성!!\n\n⭐ +${reward.xp} XP${reward.crowns > 0 ? `\n👑 +${reward.crowns} 왕관` : ''} 보상을 획득했습니다!`)
      }
      navigate('/lesson')
    } catch (err) {
      setError(err.response?.data?.detail || '아이디 또는 비밀번호를 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleSocial = (provider) => {
    if (provider.id === 'google') {
      const clientId = '351430087231-s44028ntujf7a2r39svls4ol5v37ftte.apps.googleusercontent.com'
      const redirectUri = `${window.location.origin}/auth/callback/google`
      const scope = 'openid email profile'
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=google`
      window.location.href = authUrl
      return
    }
    if (provider.id === 'naver') {
      const clientId = import.meta.env.VITE_NAVER_CLIENT_ID || '0LAXJWCUUDT5GXPmWzi4'
      const redirectUri = `${window.location.origin}/auth/callback/naver`
      const authUrl = `https://nid.naver.com/oauth2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=naver_state`
      window.location.href = authUrl
      return
    }
    if (provider.id === 'kakao') {
      const clientId = import.meta.env.VITE_KAKAO_CLIENT_ID || '7300172418d9267abc7889f60b1602fe'
      const redirectUri = `${window.location.origin}/auth/callback/kakao`
      const authUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`
      window.location.href = authUrl
      return
    }
    setSocialMsg(`${provider.label.split('로')[0]} 로그인은 곧 지원될 예정이에요! 🛠️`)
    setTimeout(() => setSocialMsg(''), 3000)
  }

  const goToRegister = () => {
    const level = searchParams.get('level')
    navigate(level ? `/register?level=${level}` : '/register')
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-orb orb-1" />
      <div className="auth-bg-orb orb-2" />

      <div className="auth-container animate-fade-in-up" style={{ position: 'relative' }}>
        {/* 뒤로가기 버튼 */}
        <button
          onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/')}
          style={{ position: 'absolute', top: '20px', left: '20px', background: 'none', border: 'none', color: 'var(--clr-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.95rem', fontWeight: 500 }}
          aria-label="이전 화면으로"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          뒤로
        </button>

        {/* 로고 */}
        <div className="auth-logo">
          <img src={beginnerHappyIcon} alt="에이몬" className="auth-logo-emoji animate-float" />
          <h1 className="auth-title">에이몬</h1>
          <p className="auth-subtitle">코딩을 게임처럼, AI와 함께!</p>
        </div>

        {/* 소셜 로그인 */}
        <SocialButtons onSocial={handleSocial} />

        {socialMsg && (
          <div className="auth-social-msg animate-fade-in">🛠️ {socialMsg}</div>
        )}

        {/* 구분선 */}
        <div className="auth-divider">
          <span>또는 이메일로 로그인</span>
        </div>

        {/* 로그인 폼 */}
        <AuthForm
          form={form}
          onChange={handleChange}
          error={error}
          loading={loading}
          onSubmit={handleSubmit}
        />

        {/* 회원가입 링크 */}
        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--clr-text-muted)' }}>
          계정이 없으신가요?{' '}
          <button
            type="button"
            onClick={goToRegister}
            style={{ background: 'none', border: 'none', color: 'var(--clr-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            이메일로 가입하기
          </button>
        </p>
      </div>
    </div>
  )
}
