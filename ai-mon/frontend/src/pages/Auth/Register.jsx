import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import SocialButtons from './SocialButtons'
import RegisterForm from './RegisterForm'
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

export default function Register() {
  const [searchParams] = useSearchParams()
  const initialLevel   = searchParams.get('level') || 'beginner'

  const [form, setForm] = useState({
    username:     '',
    password:     '',
    nickname:     '',
    email:        '',
    course_level: initialLevel,
  })
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [idChecked,       setIdChecked]       = useState(false)
  const [idCheckMsg,      setIdCheckMsg]      = useState('')
  const [emailChecked,    setEmailChecked]    = useState(false)
  const [emailCheckMsg,   setEmailCheckMsg]   = useState('')
  const [terms, setTerms] = useState({ age: false, tos: false, privacy: false })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [socialMsg, setSocialMsg] = useState('')
  const [showEmailForm, setShowEmailForm] = useState(false) // 이메일 가입 폼 전환 상태

  const setAuth  = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const levelInfo = LEVEL_INFO[initialLevel] || LEVEL_INFO.beginner

  const canSubmit = idChecked && emailChecked && terms.age && terms.tos && terms.privacy
    && form.password.length >= 6 && form.password === passwordConfirm
    && form.email.trim() !== ''

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
    if (e.target.name === 'username') { setIdChecked(false); setIdCheckMsg('') }
    if (e.target.name === 'email') { setEmailChecked(false); setEmailCheckMsg('') }
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

  const handleEmailCheck = async (fullEmail) => {
    const email = fullEmail.trim()
    if (!email || !email.includes('@') || email.split('@')[0].trim() === '' || email.split('@')[1].trim() === '') {
      setEmailCheckMsg('error')
      return
    }
    try {
      await authApi.checkEmail(email)
      setEmailCheckMsg('ok')
      setEmailChecked(true)
    } catch (err) {
      setEmailChecked(false)
      if (!err.response) {
        // 서버가 꺼져 있거나 네트워크가 끊겨 응답(response) 자체가 없는 경우
        setEmailCheckMsg('server_error')
      } else {
        const detail = err.response?.data?.detail || ''
        setEmailCheckMsg(detail.includes('존재') ? 'dup' : 'error')
      }
    }
  }

  const handleTermChange = (e) => {
    setTerms({ ...terms, [e.target.name]: e.target.checked })
  }

  const handleTermAll = (e) => {
    const all = e.target.checked
    setTerms({ age: all, tos: all, privacy: all })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!idChecked)                              { setError('아이디 중복 확인을 해주세요.'); return }
    if (form.password.length < 6)               { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    if (form.password !== passwordConfirm)       { setError('비밀번호가 일치하지 않습니다.'); return }
    if (!terms.age || !terms.tos || !terms.privacy) { setError('필수 약관에 모두 동의해주세요.'); return }

    setLoading(true)
    setError('')
    try {
      const isLevelTested = !!searchParams.get('level')
      const payload = {
        username:     form.username.trim(),
        password:     form.password,
        nickname:     form.nickname,
        email:        form.email.trim(),
        course_level: form.course_level,
        is_level_tested: isLevelTested,
        marketing_agreed: false,
      }
      const res = await authApi.register(payload)
      setAuth(res.data.access_token, res.data.user, res.data.refresh_token)
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

  return (
    <div className="auth-page">
      <div className="auth-bg-orb orb-1" />
      <div className="auth-bg-orb orb-2" />

      <div className="auth-container animate-fade-in-up" style={{ position: 'relative' }}>
        {/* 뒤로가기 */}
        <button
          onClick={() => {
            if (showEmailForm) {
              setShowEmailForm(false)
            } else {
              navigate(-1)
            }
          }}
          style={{ position: 'absolute', top: '20px', left: '20px', background: 'none', border: 'none', color: 'var(--clr-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.95rem', fontWeight: 500 }}
          aria-label="이전 화면으로"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          뒤로
        </button>

        {/* 로고 */}
        <div className="auth-logo" style={{ marginBottom: '1rem' }}>
          <img src={beginnerHappyIcon} alt="에이몬" className="auth-logo-emoji animate-float" style={{ width: '70px', height: '70px' }} />
          <h1 className="auth-title" style={{ fontSize: '1.6rem' }}>회원가입</h1>
        </div>

        {/* 레벨 배지 */}
        {searchParams.get('level') && (
          <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '1.25rem', background: levelInfo.color + '18', border: `1px solid ${levelInfo.color}44`, borderRadius: '999px', padding: '8px 20px' }}>
            <span style={{ fontSize: '1.2rem' }}>{levelInfo.emoji}</span>
            <span style={{ color: levelInfo.color, fontWeight: 700, fontSize: '0.9rem' }}>{levelInfo.label} 에이몬</span>
            <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem' }}>— {levelInfo.desc}</span>
          </div>
        )}

        {!showEmailForm ? (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
            {/* 소셜 가입/로그인 */}
            <SocialButtons onSocial={handleSocial} />

            {socialMsg && (
              <div className="auth-social-msg animate-fade-in" style={{ textAlign: 'center' }}>🛠️ {socialMsg}</div>
            )}

            {/* 구분선 */}
            <div className="auth-divider">
              <span>또는</span>
            </div>

            {/* 일반 이메일 회원가입으로 전환 버튼 */}
            <button
              type="button"
              className="btn btn-outline btn-lg"
              onClick={() => setShowEmailForm(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              이메일로 가입하기
            </button>
          </div>
        ) : (
          <div className="animate-fade-in">
            <RegisterForm
              form={form}
              onChange={handleChange}
              passwordConfirm={passwordConfirm}
              setPasswordConfirm={setPasswordConfirm}
              idChecked={idChecked}
              idCheckMsg={idCheckMsg}
              onIdCheck={handleIdCheck}
              emailChecked={emailChecked}
              emailCheckMsg={emailCheckMsg}
              onEmailCheck={handleEmailCheck}
              terms={terms}
              onTermChange={handleTermChange}
              onTermAll={handleTermAll}
              error={error}
              loading={loading}
              onSubmit={handleSubmit}
              canSubmit={canSubmit}
            />
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--clr-text-muted)' }}>
          이미 계정이 있으신가요?{' '}
          <button
            type="button"
            onClick={() => navigate('/auth')}
            style={{ background: 'none', border: 'none', color: 'var(--clr-primary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            로그인
          </button>
        </p>
      </div>
    </div>
  )
}
