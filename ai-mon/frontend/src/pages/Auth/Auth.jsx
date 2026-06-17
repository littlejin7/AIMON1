import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import SocialButtons from './SocialButtons'
import AuthForm      from './AuthForm'
import beginnerHappyIcon from '../../assets/character_beginnerhappy.png'
import slimeIcon         from '../../assets/character_slime.png'
import robotIcon         from '../../assets/character_robot.png'
import finalGhostIcon    from '../../assets/character_final_ghost.png'
import './Auth.css'

const LEVEL_INFO = {
  beginner:     { emoji: '🟣', label: '비기너',        color: '#7c3aed', desc: '처음부터 함께해요!',  icon: slimeIcon },
  intermediate: { emoji: '🤖', label: '인터미디에이트', color: '#06b6d4', desc: '실력을 더 키워봐요!', icon: robotIcon },
  advanced:     { emoji: '👻', label: '어드밴스드',    color: '#f59e0b', desc: '고수의 길로 출발!',   icon: finalGhostIcon },
}

export default function Auth() {
  const [searchParams] = useSearchParams()
  const initialLevel   = searchParams.get('level') || 'beginner'
  const initialMode    = searchParams.get('mode') === 'register' ? 'register' : 'login'

  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState({
    username:     '',
    password:     '',
    nickname:     '',
    course_level: initialLevel,
  })
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [socialMsg,       setSocialMsg]       = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [idChecked,       setIdChecked]       = useState(false)
  const [idCheckMsg,      setIdCheckMsg]      = useState('')

  const setAuth  = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const levelInfo = LEVEL_INFO[form.course_level] || LEVEL_INFO.beginner

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
    if (e.target.name === 'username') { setIdChecked(false); setIdCheckMsg('') }
  }

  const handleIdCheck = async () => {
    const id = form.username.trim()
    if (!id) { setIdCheckMsg('error'); return }
    try {
      await authApi.checkId(id)
      setIdCheckMsg('ok')
      setIdChecked(true)
    } catch (err) {
      const detail = err.response?.data?.detail || ''
      setIdCheckMsg(detail.includes('존재') ? 'dup' : 'error')
      setIdChecked(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (mode === 'register') {
      if (!idChecked) { setError('아이디 중복 확인을 해주세요.'); return }
      if (form.password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }
      if (form.password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    }
    setLoading(true)
    setError('')
    try {
      const fn           = mode === 'login' ? authApi.login : authApi.register
      const isLevelTested = !!searchParams.get('level')
      const trimmedForm  = { ...form, username: form.username.trim() }
      const payload      = mode === 'login' ? trimmedForm : { ...trimmedForm, is_level_tested: isLevelTested }
      const res          = await fn(payload)
      setAuth(res.data.access_token, res.data.user)
      if (res.data.streak_reward) {
        const reward = res.data.streak_reward
        alert(`🔥 ${reward.days}일 연속 로그인 달성!!\n\n⭐ +${reward.xp} XP${reward.crowns > 0 ? `\n👑 +${reward.crowns} 왕관` : ''} 보상을 획득했습니다!`)
      }
      navigate('/lesson')
    } catch (err) {
      setError(err.response?.data?.detail || '오류가 발생했습니다. 다시 시도해주세요.')
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
      // Vite 환경변수 또는 백엔드에 설정된 동일한 NAVER_CLIENT_ID를 아래에 입력하거나 환경변수로 연동합니다.
      const clientId = import.meta.env.VITE_NAVER_CLIENT_ID || '0LAXJWCUUDT5GXPmWzi4'
      const redirectUri = `${window.location.origin}/auth/callback/naver`
      const state = 'naver_state'
      const authUrl = `https://nid.naver.com/oauth2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`
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

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setSocialMsg('')
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-orb orb-1" />
      <div className="auth-bg-orb orb-2" />

      <div className="auth-container animate-fade-in-up">
        {/* 로고 */}
        <div className="auth-logo">
          <img src={beginnerHappyIcon} alt="에이몬" className="auth-logo-emoji animate-float" />
          <h1 className="auth-title">에이몬</h1>
          <p className="auth-subtitle">코딩을 게임처럼, AI와 함께!</p>
        </div>

        {/* 레벨 배지 (회원가입 + level 파라미터) */}
        {mode === 'register' && searchParams.get('level') && (
          <div className="auth-level-badge animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '1.25rem', background: levelInfo.color + '18', border: `1px solid ${levelInfo.color}44`, borderRadius: '999px', padding: '8px 20px' }}>
            <span style={{ fontSize: '1.2rem' }}>{levelInfo.emoji}</span>
            <span style={{ color: levelInfo.color, fontWeight: 700, fontSize: '0.9rem' }}>{levelInfo.label} 에이몬</span>
            <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem' }}>— {levelInfo.desc}</span>
          </div>
        )}

        {/* 로그인/회원가입 탭 */}
        <div className="auth-tabs">
          <button id="tab-login"    className={`auth-tab${mode === 'login'    ? ' active' : ''}`} onClick={() => switchMode('login')}>로그인</button>
          <button id="tab-register" className={`auth-tab${mode === 'register' ? ' active' : ''}`} onClick={() => switchMode('register')}>회원가입</button>
        </div>

        {/* 소셜 로그인 */}
        <SocialButtons onSocial={handleSocial} />

        {socialMsg && (
          <div className="auth-social-msg animate-fade-in">🛠️ {socialMsg}</div>
        )}

        {/* 구분선 */}
        <div className="auth-divider">
          <span>또는 이메일로 {mode === 'login' ? '로그인' : '가입'}</span>
        </div>

        {/* 이메일 폼 */}
        <AuthForm
          mode={mode}
          form={form}
          onChange={handleChange}
          passwordConfirm={passwordConfirm}
          setPasswordConfirm={setPasswordConfirm}
          idChecked={idChecked}
          idCheckMsg={idCheckMsg}
          onIdCheck={handleIdCheck}
          error={error}
          loading={loading}
          onSubmit={handleSubmit}
        />

        <p className="auth-footer">코딩 학습의 새로운 경험을 시작하세요 🎮</p>
      </div>
    </div>
  )
}
