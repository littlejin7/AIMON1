import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import './Auth.css'

// 레벨별 표시 정보
const LEVEL_INFO = {
  beginner:     { emoji: '🟣', label: '비기너',        color: '#7c3aed', desc: '처음부터 함께해요!' },
  intermediate: { emoji: '🤖', label: '인터미디에이트', color: '#06b6d4', desc: '실력을 더 키워봐요!' },
  advanced:     { emoji: '👻', label: '어드밴스드',    color: '#f59e0b', desc: '고수의 길로 출발!' },
}

// 소셜 로그인 버튼 설정
const SOCIAL_PROVIDERS = [
  {
    id: 'google',
    label: '구글로 계속하기',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
    bg: '#fff',
    color: '#1a1a2e',
    border: 'rgba(255,255,255,0.2)',
  },
  {
    id: 'kakao',
    label: '카카오로 계속하기',
    icon: <span style={{ fontSize: '1.1rem' }}>💬</span>,
    bg: '#FEE500',
    color: '#1a1a2e',
    border: '#FEE500',
  },
  {
    id: 'naver',
    label: '네이버로 계속하기',
    icon: <span style={{ fontWeight: 900, fontSize: '0.9rem', color: '#fff' }}>N</span>,
    bg: '#03C75A',
    color: '#fff',
    border: '#03C75A',
  },
]

export default function Auth() {
  const [searchParams] = useSearchParams()
  const initialLevel = searchParams.get('level') || 'beginner'
  const initialMode  = searchParams.get('mode') === 'register' ? 'register' : 'login'

  const [mode, setMode]   = useState(initialMode)
  const [form, setForm]   = useState({
    username: '',
    password: '',
    nickname: '',
    course_level: initialLevel,
  })
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [socialMsg, setSocialMsg]   = useState('')
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const levelInfo = LEVEL_INFO[form.course_level] || LEVEL_INFO.beginner

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const fn = mode === 'login' ? authApi.login : authApi.register
      const isLevelTested = !!searchParams.get('level')
      
      // 공백 제거 처리
      const trimmedForm = {
        ...form,
        username: form.username.trim()
      }

      const payload = mode === 'login' ? trimmedForm : { ...trimmedForm, is_level_tested: isLevelTested }
      const res = await fn(payload)
      setAuth(res.data.access_token, res.data.user)
      navigate('/lesson')
    } catch (err) {
      setError(err.response?.data?.detail || '오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleSocial = (provider) => {
    setSocialMsg(`${provider.label.split('로')[0]} 로그인은 곧 지원될 예정이에요! 🛠️`)
    setTimeout(() => setSocialMsg(''), 3000)
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-orb orb-1" />
      <div className="auth-bg-orb orb-2" />

      <div className="auth-container animate-fade-in-up">
        <div className="auth-logo">
          <span className="auth-logo-emoji animate-float">🤖</span>
          <h1 className="auth-title">에이몬</h1>
          <p className="auth-subtitle">코딩을 게임처럼, AI와 함께!</p>
        </div>

        {/* 레벨 배지 (회원가입 & level 파라미터 있을 때만) */}
        {mode === 'register' && searchParams.get('level') && (
          <div className="auth-level-badge animate-fade-in" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '8px', marginBottom: '1.25rem',
            background: levelInfo.color + '18',
            border: `1px solid ${levelInfo.color}44`,
            borderRadius: '999px', padding: '8px 20px',
          }}>
            <span style={{ fontSize: '1.2rem' }}>{levelInfo.emoji}</span>
            <span style={{ color: levelInfo.color, fontWeight: 700, fontSize: '0.9rem' }}>
              {levelInfo.label} 에이몬
            </span>
            <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem' }}>
              — {levelInfo.desc}
            </span>
          </div>
        )}

        {/* 탭 */}
        <div className="auth-tabs">
          <button
            id="tab-login"
            className={`auth-tab${mode === 'login' ? ' active' : ''}`}
            onClick={() => { setMode('login'); setError(''); setSocialMsg('') }}
          >
            로그인
          </button>
          <button
            id="tab-register"
            className={`auth-tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => { setMode('register'); setError(''); setSocialMsg('') }}
          >
            회원가입
          </button>
        </div>

        {/* 소셜 로그인 버튼 */}
        <div className="auth-social-group">
          {SOCIAL_PROVIDERS.map((p) => (
            <button
              key={p.id}
              id={`btn-social-${p.id}`}
              className="auth-social-btn"
              style={{
                background: p.bg,
                color: p.color,
                border: `1px solid ${p.border}`,
              }}
              onClick={() => handleSocial(p)}
              type="button"
            >
              <span className="auth-social-icon">{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>

        {/* 소셜 준비 중 메시지 */}
        {socialMsg && (
          <div className="auth-social-msg animate-fade-in">
            🛠️ {socialMsg}
          </div>
        )}

        {/* 구분선 */}
        <div className="auth-divider">
          <span>또는 이메일로 {mode === 'login' ? '로그인' : '가입'}</span>
        </div>

        {/* 이메일/비밀번호 폼 */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">아이디</label>
            <input
              id="username"
              name="username"
              type="text"
              className="input"
              placeholder="아이디를 입력하세요"
              value={form.username}
              onChange={handleChange}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              placeholder="비밀번호를 입력하세요"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'register' && (
            <div className="form-group animate-fade-in">
              <label htmlFor="nickname">닉네임</label>
              <input
                id="nickname"
                name="nickname"
                type="text"
                className="input"
                placeholder="닉네임 (선택)"
                value={form.nickname}
                onChange={handleChange}
                autoComplete="nickname"
              />
            </div>
          )}

          {error && (
            <div className="auth-error animate-fade-in">
              ⚠️ {error}
            </div>
          )}

          <button
            id="btn-auth-submit"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading
              ? <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> 처리 중...</>
              : mode === 'login' ? '🚀 로그인' : `✨ ${levelInfo.emoji} 에이몬 시작하기`
            }
          </button>
        </form>

        <p className="auth-footer">
          코딩 학습의 새로운 경험을 시작하세요 🎮
        </p>
      </div>
    </div>
  )
}
