import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import SocialButtons from './SocialButtons'
import AuthForm from './AuthForm'
import beginnerHappyIcon from '../../assets/character_beginnerhappy.png'
import './Auth.css'

export default function Auth() {
  const [searchParams] = useSearchParams()
  const [form, setForm]       = useState({ username: '', password: '' })
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
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || '아이디 또는 비밀번호를 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleSocial = (provider) => {
    if (provider.id === 'google') {
      const clientId  = '351430087231-s44028ntujf7a2r39svls4ol5v37ftte.apps.googleusercontent.com'
      const redirectUri = `${window.location.origin}/auth/callback/google`
      const scope = 'openid email profile'
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=google`
      window.location.href = authUrl
      return
    }
    if (provider.id === 'naver') {
      const clientId  = import.meta.env.VITE_NAVER_CLIENT_ID || '0LAXJWCUUDT5GXPmWzi4'
      const redirectUri = `${window.location.origin}/auth/callback/naver`
      const authUrl = `https://nid.naver.com/oauth2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=naver_state`
      window.location.href = authUrl
      return
    }
    if (provider.id === 'kakao') {
      const clientId  = import.meta.env.VITE_KAKAO_CLIENT_ID || '7300172418d9267abc7889f60b1602fe'
      const redirectUri = `${window.location.origin}/auth/callback/kakao`
      const authUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`
      window.location.href = authUrl
      return
    }
    setSocialMsg(`${provider.label} 로그인은 곧 지원될 예정이에요! 🛠️`)
    setTimeout(() => setSocialMsg(''), 3000)
  }

  const goToRegister = () => {
    const level = searchParams.get('level')
    navigate(level ? `/register?level=${level}` : '/register')
  }

  return (
    <div className="auth-page">
      <div className="auth-card animate-fade-in-up">

        {/* 히어로 */}
        <div className="auth-hero">
          <div className="auth-brand-pill">🤖 AI MON</div>
          <img
            src={beginnerHappyIcon}
            alt="에이몬 캐릭터"
            className="auth-hero-img animate-float"
          />
          <div className="auth-hero-tagline">
            코드를 배우며<br /><em>나만의 에이몬</em>을 키워요!
          </div>
        </div>

        {/* 폼 패널 */}
        <div className="auth-form-panel">
          <AuthForm
            form={form}
            onChange={handleChange}
            error={error}
            loading={loading}
            onSubmit={handleSubmit}
            onGoRegister={goToRegister}
            onGoFindId={() => navigate('/find-id')}
            onGoFindPw={() => navigate('/find-pw')}
          />

          {socialMsg && (
            <div className="auth-social-msg animate-fade-in">{socialMsg}</div>
          )}

          <div className="auth-or-divider">
            <div className="auth-or-line" />
            <span>소셜 로그인</span>
            <div className="auth-or-line" />
          </div>

          <SocialButtons onSocial={handleSocial} variant="compact" />
        </div>

      </div>
    </div>
  )
}
