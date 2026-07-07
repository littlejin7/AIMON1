import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import EmailVerificationStep from './components/EmailVerificationStep'
import { useEmailVerification } from './hooks/useEmailVerification'
import beginnerHappyIcon from '../../assets/character_beginnerhappy.png'
import slimeIcon         from '../../assets/character_slime.png'
import './Auth.css'
import './Register.css'

/* ── 상수 ── */
const LEVEL_OPTIONS = [
  { id: 'beginner',     icon: '🐣', title: '완전 처음이에요',  desc: '코딩이 처음이거나 Python을 한 번도 안 써봤어요' },
  { id: 'elementary',   icon: '🌱', title: '조금 알아요',      desc: '변수, 반복문 정도는 써본 적 있어요' },
  { id: 'intermediate', icon: '🌿', title: '기초는 알아요',    desc: '함수, 리스트, 딕셔너리까지 쓸 수 있어요' },
  { id: 'advanced',     icon: '🌳', title: '중급 이상이에요',  desc: '클래스, 라이브러리, 프로젝트 경험이 있어요' },
]

const GOAL_OPTIONS = [
  { id: 'job',     icon: '💼', label: '취업 · 이직' },
  { id: 'exam',    icon: '🎓', label: '시험 · 자격증' },
  { id: 'ai',      icon: '🤖', label: 'AI · 데이터 활용' },
  { id: 'project', icon: '🏗️', label: '개인 프로젝트' },
  { id: 'kids',    icon: '🧒', label: '자녀 교육' },
  { id: 'fun',     icon: '✨', label: '그냥 재미로' },
]

const DAILY_TIMES = [5, 10, 20, 30]
const NICK_ADJECTIVES = ['반짝', '용감한', '차분한', '빠른', '똑똑한', '새벽', '구름', '루키']
const NICK_NOUNS = ['코더', '디버거', '파이썬', '에이몬', '빌더', '탐험가', '알고봇', '마법사']

function createNickSuggestions() {
  const suggestions = new Set()
  while (suggestions.size < 4) {
    const adj = NICK_ADJECTIVES[Math.floor(Math.random() * NICK_ADJECTIVES.length)]
    const noun = NICK_NOUNS[Math.floor(Math.random() * NICK_NOUNS.length)]
    const suffix = Math.random() > 0.55 ? String(Math.floor(Math.random() * 90) + 10) : ''
    suggestions.add(`${adj}${noun}${suffix}`.slice(0, 10))
  }
  return [...suggestions]
}

function getNicknameCheckErrorMessage(err) {
  const status = err?.response?.status
  const detail = err?.response?.data?.detail

  if (status === 404) {
    return '닉네임 확인 기능을 찾을 수 없습니다. 서버를 재시작해주세요.'
  }
  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }
  return '이미 사용 중인 닉네임입니다.'
}

// 진행도 (step → %)
const PROGRESS   = [0, 20, 40, 60, 80, 90, 95, 100]
const STEP_CHIPS = [null, '1 / 5', '2 / 5', '3 / 5', '4 / 5', '5 / 5', '온보딩', null]

function calcStrength(pw) {
  let s = 0
  if (pw.length >= 8)            s++
  if (/[A-Za-z]/.test(pw))       s++
  if (/[0-9]/.test(pw))          s++
  if (/[^A-Za-z0-9]/.test(pw))   s++
  return s
}

const STRENGTH_LABELS = ['', '약함', '보통', '강함', '매우 강함']
const STRENGTH_COLORS = ['', '#EF4444', '#F59E0B', '#7F77DD', '#22C55E']

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function Register() {
  const [searchParams] = useSearchParams()
  const levelParam = searchParams.get('level')
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    username: '', email: '', password: '', passwordConfirm: '',
    nickname: '', level: (levelParam && ['beginner', 'intermediate', 'advanced'].includes(levelParam)) ? levelParam : 'elementary',
    goals: [], dailyTime: 10,
  })
  const [terms, setTerms] = useState({ tos: false, privacy: false, marketing: false, thirdparty: false })
  const [pwStrength, setPwStrength] = useState(0)
  const [showPw, setShowPw]         = useState(false)
  const [showPwC, setShowPwC]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const [isIdChecked, setIsIdChecked] = useState(false)
  const [idChecking, setIdChecking] = useState(false)
  const [idError, setIdError] = useState('')

  const [isEmailChecked, setIsEmailChecked] = useState(false)
  const [emailChecking, setEmailChecking] = useState(false)
  const [emailError, setEmailError] = useState('')

  const [isNicknameChecked, setIsNicknameChecked] = useState(false)
  const [nicknameChecking, setNicknameChecking] = useState(false)
  const [nicknameError, setNicknameError] = useState('')
  const [nickSuggestions, setNickSuggestions] = useState(() => createNickSuggestions())

  const [emailId, setEmailId] = useState(form.email ? form.email.split('@')[0] : '')
  const [emailDomain, setEmailDomain] = useState(
    form.email && form.email.includes('@')
      ? ['naver.com', 'gmail.com', 'daum.net', 'kakao.com', 'hanmail.net', 'outlook.com'].includes(form.email.split('@')[1])
        ? form.email.split('@')[1]
        : 'direct'
      : 'naver.com'
  )
  const [customDomain, setCustomDomain] = useState(
    form.email && form.email.includes('@') && !['naver.com', 'gmail.com', 'daum.net', 'kakao.com', 'hanmail.net', 'outlook.com'].includes(form.email.split('@')[1])
      ? form.email.split('@')[1]
      : ''
  )

  const setAuth  = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  const isValidEmail = form.email.includes('@') && form.email.split('@')[1]?.length > 1

  const emailVerification = useEmailVerification({
    email: form.email,
    isValidEmail,
    onVerified: () => setStep(3),
    onError: setError,
  })
  const { reset: resetEmailVerification, verified: emailVerified } = emailVerification

  /* ── helpers ── */
  const set = (field) => (e) => { setForm(f => ({ ...f, [field]: e.target.value })); setError('') }

  const updateEmail = (id, domain, custom) => {
    const activeDomain = domain === 'direct' ? custom : domain
    // @ 중복 방지, 한글 및 공백 방지
    const cleanedId = id.toLowerCase().replace(/@/g, '').replace(/\s/g, '').replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '')
    const cleanedDomain = activeDomain.replace(/@/g, '').replace(/\s/g, '').replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '')
    
    let fullEmail = ''
    if (cleanedId) {
      fullEmail = cleanedDomain ? `${cleanedId}@${cleanedDomain}` : `${cleanedId}@`
    }
    setForm(f => ({ ...f, email: fullEmail }))
    setIsEmailChecked(false)
    setEmailError('')
    resetEmailVerification()
    setError('')
  }

  const handleEmailIdChange = (e) => {
    const val = e.target.value.toLowerCase()
    setEmailId(val)
    updateEmail(val, emailDomain, customDomain)
  }

  const handleDomainSelectChange = (e) => {
    const val = e.target.value
    setEmailDomain(val)
    updateEmail(emailId, val, customDomain)
  }

  const handleCustomDomainChange = (e) => {
    const val = e.target.value.toLowerCase()
    setCustomDomain(val)
    updateEmail(emailId, emailDomain, val)
  }

  const handleIdChange = (e) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').trim()
    setForm(f => ({ ...f, username: val }))
    setIsIdChecked(false)
    setIdError('')
    setError('')
  }

  const handleCheckId = async () => {
    const username = form.username.trim()
    if (!username) return
    setIdChecking(true)
    setIdError('')
    try {
      const res = await authApi.checkId(username)
      if (res.data && res.data.ok) {
        setIsIdChecked(true)
        setIdError('')
      }
    } catch (err) {
      setIsIdChecked(false)
      setIdError(err.response?.data?.detail || '이미 사용 중인 아이디입니다.')
    } finally {
      setIdChecking(false)
    }
  }

  const handleCheckEmail = async () => {
    if (!isValidEmail) return
    setEmailChecking(true)
    setEmailError('')
    try {
      const res = await authApi.checkEmail(form.email.trim())
      if (res.data && res.data.ok) {
        setIsEmailChecked(true)
        setEmailError('')
      }
    } catch (err) {
      setIsEmailChecked(false)
      setEmailError(err.response?.data?.detail || '이미 사용 중인 이메일입니다.')
    } finally {
      setEmailChecking(false)
    }
  }

  const handleNicknameChange = (e) => {
    setForm(f => ({ ...f, nickname: e.target.value }))
    setIsNicknameChecked(false)
    setNicknameError('')
    setError('')
  }

  const selectNicknameSuggestion = (nickname) => {
    setForm(f => ({ ...f, nickname }))
    setIsNicknameChecked(false)
    setNicknameError('')
    setError('')
  }

  const refreshNickSuggestions = () => {
    setNickSuggestions(createNickSuggestions())
  }

  const handleCheckNickname = async () => {
    const nickname = form.nickname.trim()
    if (nickname.length < 2) {
      setIsNicknameChecked(false)
      setNicknameError('닉네임은 2자 이상 입력해주세요.')
      return false
    }
    setNicknameChecking(true)
    setNicknameError('')
    try {
      const res = await authApi.checkNickname(nickname)
      if (res.data && res.data.ok) {
        setForm(f => ({ ...f, nickname }))
        setIsNicknameChecked(true)
        setNicknameError('')
        return true
      }
      return false
    } catch (err) {
      setIsNicknameChecked(false)
      setNicknameError(getNicknameCheckErrorMessage(err))
      return false
    } finally {
      setNicknameChecking(false)
    }
  }

  const handlePwChange = (e) => {
    const pw = e.target.value
    setForm(f => ({ ...f, password: pw }))
    setPwStrength(calcStrength(pw))
    setError('')
  }

  const toggleGoal = (id) =>
    setForm(f => ({
      ...f,
      goals: f.goals.includes(id) ? f.goals.filter(g => g !== id) : [...f.goals, id],
    }))

  const toggleAllTerms = () => {
    const allOn = Object.values(terms).every(Boolean)
    setTerms({ tos: !allOn, privacy: !allOn, marketing: !allOn, thirdparty: !allOn })
  }

  /* ── Social OAuth ── */
  const handleSocial = (id) => {
    if (id === 'google') {
      const clientId   = '351430087231-s44028ntujf7a2r39svls4ol5v37ftte.apps.googleusercontent.com'
      const redirectUri = `${window.location.origin}/auth/callback/google`
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('openid email profile')}&state=google`
      return
    }
    if (id === 'kakao') {
      const clientId   = import.meta.env.VITE_KAKAO_CLIENT_ID || '7300172418d9267abc7889f60b1602fe'
      const redirectUri = `${window.location.origin}/auth/callback/kakao`
      window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`
      return
    }
    if (id === 'naver') {
      const clientId   = import.meta.env.VITE_NAVER_CLIENT_ID || '0LAXJWCUUDT5GXPmWzi4'
      const redirectUri = `${window.location.origin}/auth/callback/naver`
      window.location.href = `https://nid.naver.com/oauth2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=naver_state`
      return
    }
  }

  /* ── 최종 제출 (Step 6 → Step 7) ── */
  const handleSubmit = async () => {
    setLoading(true); setError('')
    try {
      if (!emailVerified) {
        const msg = '이메일 인증을 완료해주세요.'
        setStep(2)
        setError(msg)
        return
      }

      const nickname = form.nickname.trim()
      if (nickname.length < 2) {
        const msg = '닉네임은 2자 이상 입력해주세요.'
        setStep(4)
        setIsNicknameChecked(false)
        setNicknameError(msg)
        setError(msg)
        return
      }

      try {
        await authApi.checkNickname(nickname)
        setForm(f => ({ ...f, nickname }))
        setIsNicknameChecked(true)
        setNicknameError('')
      } catch (nickErr) {
        const msg = getNicknameCheckErrorMessage(nickErr)
        setStep(4)
        setIsNicknameChecked(false)
        setNicknameError(msg)
        setError(msg)
        return
      }

      const payload = {
        username:        form.username.trim(), // Use custom username/ID!
        password:        form.password,
        nickname,
        email:           form.email.trim(),
        course_level:    form.level,
        is_level_tested: !!searchParams.get('level'),
        marketing_agreed: terms.marketing,
      }
      const res = await authApi.register(payload)
      setAuth(res.data.access_token, res.data.user, res.data.refresh_token)
      setStep(7)
    } catch (err) {
      setError(err.response?.data?.detail || '오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const allTermsRequired = terms.tos && terms.privacy
  const canGoStep2 = isIdChecked && isEmailChecked && form.email.includes('@') && form.email.split('@')[1]?.length > 1
    && form.password.length >= 8 && form.password === form.passwordConfirm
  const canGoStep5 = isNicknameChecked && form.nickname.trim().length >= 2

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     RENDER
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  return (
    <div className="auth-page">
      <div className="reg-card animate-fade-in-up">

        {/* ── Step 헤더 (1~6) ── */}
        {step >= 1 && step <= 6 && (
          <>
            <div className="reg-header">
              <button className="reg-back-btn" onClick={() => step === 1 ? navigate('/auth') : setStep(s => s - 1)}>✕</button>
              <span className="reg-logo-sm">AI MON</span>
              <span className="reg-step-chip">{STEP_CHIPS[step]}</span>
            </div>
            <div className="reg-prog-wrap">
              <div className="reg-prog-track">
                <div className="reg-prog-fill" style={{ width: `${PROGRESS[step]}%` }} />
              </div>
            </div>
          </>
        )}

        {/* ━━━━━━━━━━━━━━━━━
            Step 0 — 가입 선택
        ━━━━━━━━━━━━━━━━━ */}
        {step === 0 && (
          <>
            <div className="reg-header" style={{ padding: '16px 20px 0' }}>
              <button className="reg-back-btn" onClick={() => navigate(-1)}>✕</button>
              <span className="reg-logo-sm">AI MON</span>
              <span style={{ width: '36px' }} />
            </div>
            <div className="reg-mascot-hero">
              <img src={beginnerHappyIcon} alt="에이몬" className="reg-mascot animate-float" />
              <div>
                <div className="reg-hero-title">에이몬과 함께<br />시작해볼까요?</div>
                <div className="reg-hero-sub">가입하면 학습 기록이 저장되고<br />에이몬이 함께 성장해요 🌱</div>
              </div>
            </div>

            <div className="reg-body">
              <div className="reg-social-list">
                {[
                  { id: 'kakao',  label: '카카오로 시작하기',  iconBg: '#FEE500', icon: <KakaoIcon /> },
                  { id: 'google', label: '구글로 시작하기',    iconBg: '#F4F4F4', icon: <GoogleIcon /> },
                  { id: 'naver',  label: '네이버로 시작하기',  iconBg: '#03C75A', icon: <NaverIcon /> },
                ].map(p => (
                  <button key={p.id} className="reg-social-btn" onClick={() => handleSocial(p.id)}>
                    <div className="reg-social-icon" style={{ background: p.iconBg }}>{p.icon}</div>
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="reg-divider">
                <div className="reg-divider-line" />
                <span className="reg-divider-text">또는 이메일로 가입</span>
                <div className="reg-divider-line" />
              </div>

              <button className="reg-btn-ghost" onClick={() => setStep(1)}>
                📧 가입하기
              </button>

              <div style={{ textAlign: 'center', fontSize: '12px', color: '#C4BFEE' }}>
                이미 계정이 있어요?{' '}
                <button type="button" onClick={() => navigate('/auth')}
                  style={{ background: 'none', border: 'none', color: '#7F77DD', fontWeight: 500, cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
                  로그인
                </button>
              </div>
            </div>
          </>
        )}

        {/* ━━━━━━━━━━━━━━━━━
            Step 1 — 이메일 + 비밀번호
        ━━━━━━━━━━━━━━━━━ */}
        {step === 1 && (
          <div className="reg-body">
            <div>
              <div className="reg-page-title">회원 정보를 입력하세요</div>
              <div className="reg-page-sub">가입에 사용할 아이디, 이메일과<br />비밀번호를 입력해주세요.</div>
            </div>

            <div className="reg-fields">
              {/* 아이디 */}
              <div className="reg-field">
                <div className="reg-field-label"><span className="reg-field-label-icon">👤</span>아이디</div>
                <div className="reg-id-row">
                  <div className={`reg-field-wrap${isIdChecked ? ' ok' : (idError ? ' error' : '')}`} style={{ flex: 1, margin: 0 }}>
                    <input
                      className="reg-field-in"
                      type="text"
                      placeholder="영문, 숫자 포함 4~15자"
                      value={form.username}
                      onChange={handleIdChange}
                      required
                      autoComplete="username"
                    />
                    {isIdChecked && (
                      <span style={{ padding: '0 14px', fontSize: '16px', color: '#4ADE80', flexShrink: 0 }}>✓</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="reg-check-dup-btn"
                    disabled={!form.username || idChecking}
                    onClick={handleCheckId}
                  >
                    {idChecking ? '확인 중...' : '중복확인'}
                  </button>
                </div>
                {idError && (
                  <div className="reg-field-hint err">⚠ {idError}</div>
                )}
                {isIdChecked && (
                  <div className="reg-field-hint ok">✓ 사용 가능한 아이디입니다.</div>
                )}
              </div>

              {/* 이메일 */}
              <div className="reg-field">
                <div className="reg-field-label"><span className="reg-field-label-icon">✉️</span>이메일</div>
                <div className="reg-email-container">
                  <div className={`reg-field-wrap${isEmailChecked ? ' ok' : (emailError ? ' error' : '')}`} style={{ flex: 1, margin: 0 }}>
                    <input
                      className="reg-field-in"
                      type="text"
                      placeholder="이메일 아이디"
                      value={emailId}
                      onChange={handleEmailIdChange}
                      required
                    />
                    <span className="reg-email-at">@</span>
                    <select
                      className="reg-email-select"
                      value={emailDomain}
                      onChange={handleDomainSelectChange}
                    >
                      <option value="direct">직접 입력</option>
                      <option value="gmail.com">gmail.com</option>
                      <option value="naver.com">naver.com</option>
                      <option value="daum.net">daum.net</option>
                      <option value="kakao.com">kakao.com</option>
                      <option value="hanmail.net">hanmail.net</option>
                      <option value="outlook.com">outlook.com</option>
                    </select>
                    {isEmailChecked && (
                      <span style={{ padding: '0 14px', fontSize: '16px', color: '#4ADE80', flexShrink: 0 }}>✓</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="reg-check-dup-btn"
                    disabled={!isValidEmail || emailChecking}
                    onClick={handleCheckEmail}
                  >
                    {emailChecking ? '확인 중...' : '중복확인'}
                  </button>
                </div>
                {emailDomain === 'direct' && (
                  <div className={`reg-field-wrap${emailError ? ' error' : ''}`} style={{ marginTop: '6px' }}>
                    <input
                      className="reg-field-in"
                      type="text"
                      placeholder="도메인 입력 (예: gmail.com)"
                      value={customDomain}
                      onChange={handleCustomDomainChange}
                      required
                    />
                  </div>
                )}
                {emailError && (
                  <div className="reg-field-hint err">⚠ {emailError}</div>
                )}
                {isEmailChecked && (
                  <div className="reg-field-hint ok">✓ 사용 가능한 이메일입니다.</div>
                )}
              </div>

              {/* 비밀번호 */}
              <div className="reg-field">
                <div className="reg-field-label"><span className="reg-field-label-icon">🔒</span>비밀번호</div>
                <div className="reg-field-wrap">
                  <input className="reg-field-in" type={showPw ? 'text' : 'password'}
                    placeholder="8자 이상" value={form.password} onChange={handlePwChange} autoComplete="new-password" />
                  <button type="button" className="reg-field-suffix" onClick={() => setShowPw(v => !v)}>
                    {showPw ? '숨기기' : '보기'}
                  </button>
                </div>
                {form.password.length > 0 && form.password.length >= 8 && (
                  <div className="reg-field-hint ok">✓ 영문, 숫자 포함 8자 이상</div>
                )}
                {form.password.length > 0 && form.password.length < 8 && (
                  <div className="reg-field-hint err">⚠ 8자 이상 입력해주세요 ({form.password.length}/8)</div>
                )}
              </div>

              {/* 비밀번호 확인 */}
              <div className="reg-field">
                <div className="reg-field-label"><span className="reg-field-label-icon">🔒</span>비밀번호 확인</div>
                <div className={`reg-field-wrap${
                  form.passwordConfirm
                    ? form.password === form.passwordConfirm ? ' ok' : ' error'
                    : ''
                }`}>
                  <input className="reg-field-in" type={showPwC ? 'text' : 'password'}
                    placeholder="비밀번호 재입력" value={form.passwordConfirm} onChange={set('passwordConfirm')} autoComplete="new-password" />
                  <button type="button" className="reg-field-suffix" onClick={() => setShowPwC(v => !v)}>
                    {showPwC ? '숨기기' : '보기'}
                  </button>
                </div>
                {form.passwordConfirm && form.password !== form.passwordConfirm && (
                  <div className="reg-field-hint err">⚠ 비밀번호가 일치하지 않아요</div>
                )}
                {form.passwordConfirm && form.password === form.passwordConfirm && (
                  <div className="reg-field-hint ok">✓ 비밀번호가 일치해요</div>
                )}
              </div>
            </div>

            {/* 비밀번호 강도 */}
            {form.password.length > 0 && (
              <div className="reg-strength-box">
                <div style={{ fontSize: '11px', color: '#9B96D0', marginBottom: '7px' }}>비밀번호 강도</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{
                      flex: 1, height: '4px', borderRadius: '99px',
                      background: i <= pwStrength ? STRENGTH_COLORS[pwStrength] : '#E5E2F8',
                      transition: 'background 0.3s',
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: STRENGTH_COLORS[pwStrength] || '#9B96D0', marginTop: '5px', fontWeight: 500 }}>
                  {STRENGTH_LABELS[pwStrength]}
                  {pwStrength < 4 && pwStrength > 0 && ' — 특수문자 추가 시 더 강해져요'}
                </div>
              </div>
            )}

            {error && <div className="reg-error">{error}</div>}

            <button className="reg-btn-primary" disabled={!canGoStep2}
              onClick={() => { setError(''); setStep(2) }}>
              다음 →
            </button>

            <div style={{ textAlign: 'center', fontSize: '11px', color: '#C4BFEE', lineHeight: 1.6 }}>
              가입 시{' '}
              <span style={{ color: '#9B96D0', textDecoration: 'underline', cursor: 'pointer' }}>이용약관</span> 및{' '}
              <span style={{ color: '#9B96D0', textDecoration: 'underline', cursor: 'pointer' }}>개인정보처리방침</span>에<br />
              동의한 것으로 간주됩니다.
            </div>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━
            Step 2 — 이메일 인증
        ━━━━━━━━━━━━━━━━━ */}
        {step === 2 && (
          <EmailVerificationStep
            email={form.email}
            isValidEmail={isValidEmail}
            verification={emailVerification}
          />
        )}

        {/* ━━━━━━━━━━━━━━━━━
            Step 3 — 약관 동의
        ━━━━━━━━━━━━━━━━━ */}
        {step === 3 && (
          <div className="reg-body">
            <div>
              <div className="reg-page-title">약관에 동의해주세요</div>
              <div className="reg-page-sub">서비스 이용을 위해 필요한 항목이에요.</div>
            </div>

            <div className="reg-terms-wrap">
              <div className="reg-terms-all" onClick={toggleAllTerms}>
                <div className={`reg-terms-check${Object.values(terms).every(Boolean) ? ' on' : ''}`}>
                  {Object.values(terms).every(Boolean) && '✓'}
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#26215C', marginLeft: '2px' }}>전체 동의하기</span>
              </div>

              <div className="reg-terms-divider" />

              {[
                { key: 'tos',        label: '[필수] 이용약관 동의',              sub: false },
                { key: 'privacy',    label: '[필수] 개인정보 수집 · 이용 동의',  sub: false },
                { key: 'marketing',  label: '[선택] 마케팅 · 이벤트 알림 수신', sub: true },
                { key: 'thirdparty', label: '[선택] 개인정보 제3자 제공 동의',  sub: true },
              ].map(t => (
                <div key={t.key} className="reg-terms-row"
                  onClick={() => setTerms(prev => ({ ...prev, [t.key]: !prev[t.key] }))}>
                  <div className={`reg-terms-check${terms[t.key] ? ' on' : ''}`}>
                    {terms[t.key] && '✓'}
                  </div>
                  <span className={`reg-terms-text${t.sub ? ' sub' : ''}`}>{t.label}</span>
                  <span className="reg-terms-arrow">›</span>
                </div>
              ))}
            </div>

            <div className="reg-info-box" style={{ background: '#F9F8FE', color: '#9B96D0' }}>
              선택 항목에 동의하지 않아도 서비스를 이용하실 수 있어요. 마케팅 알림은 신규 콘텐츠, 이벤트 정보를 받아보실 수 있어요.
            </div>

            <button className="reg-btn-primary" disabled={!allTermsRequired} onClick={() => setStep(4)}>
              동의하고 계속하기 →
            </button>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━
            Step 4 — 닉네임
        ━━━━━━━━━━━━━━━━━ */}
        {step === 4 && (
          <div className="reg-body">
            <div>
              <div className="reg-page-title">어떻게 불러드릴까요?</div>
              <div className="reg-page-sub">에이몬이 항상 이 이름으로 불러줄 거예요.</div>
            </div>

            <div className="reg-char-preview">
              <img src={slimeIcon} alt="에이몬" style={{ width: '58px', height: '58px', objectFit: 'contain' }} />
              <div>
                <div className="reg-char-name">{form.nickname || '내 에이몬'}</div>
                <div className="reg-char-sub">내 에이몬 · Lv.1 에이원</div>
              </div>
            </div>

            <div className="reg-field">
              <div className="reg-field-label">닉네임</div>
              <div className="reg-id-row">
                <div className={`reg-field-wrap${isNicknameChecked ? ' ok' : (nicknameError ? ' error' : '')}`} style={{ flex: 1, margin: 0 }}>
                  <input className="reg-field-in" type="text"
                    placeholder="2~10자, 한글·영문·숫자"
                    value={form.nickname} onChange={handleNicknameChange} maxLength={10} />
                  {isNicknameChecked && (
                    <span style={{ padding: '0 14px', fontSize: '16px', color: '#4ADE80', flexShrink: 0 }}>✓</span>
                  )}
                </div>
                <button
                  type="button"
                  className="reg-check-dup-btn"
                  disabled={form.nickname.trim().length < 2 || nicknameChecking}
                  onClick={handleCheckNickname}
                >
                  {nicknameChecking ? '확인 중...' : '중복확인'}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {nicknameError
                  ? <div className="reg-field-hint err">⚠ {nicknameError}</div>
                  : isNicknameChecked
                    ? <div className="reg-field-hint ok">✓ 사용 가능한 닉네임이에요</div>
                    : <div className="reg-field-hint" style={{ color: '#C4BFEE' }}>2자 이상 입력 후 중복확인을 눌러주세요</div>
                }
                <div style={{ fontSize: '11px', color: '#C4BFEE' }}>{form.nickname.length} / 10</div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', color: '#9B96D0' }}>추천 닉네임</div>
                <button type="button" className="reg-nick-refresh" onClick={refreshNickSuggestions}>새로고침</button>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {nickSuggestions.map(n => (
                  <span key={n} className="reg-nick-tag"
                    onClick={() => selectNicknameSuggestion(n)}>
                    {n}
                  </span>
                ))}
              </div>
            </div>

            <button className="reg-btn-primary" disabled={!canGoStep5} onClick={() => setStep(5)}>
              다음 →
            </button>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━
            Step 5 — 레벨 선택
        ━━━━━━━━━━━━━━━━━ */}
        {step === 5 && (
          <div className="reg-body">
            <div>
              <div className="reg-page-title">Python 경험이<br />어느 정도예요?</div>
              <div className="reg-page-sub">딱 맞는 레벨에서 시작할 수 있게<br />에이몬이 커리큘럼을 준비할게요.</div>
            </div>

            <div className="reg-select-grid">
              {LEVEL_OPTIONS.map(l => (
                <div key={l.id}
                  className={`reg-sel-card${form.level === l.id ? ' active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, level: l.id }))}>
                  <div className="reg-sel-icon">{l.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div className="reg-sel-title">{l.title}</div>
                    <div className="reg-sel-desc">{l.desc}</div>
                  </div>
                  <div className="reg-sel-radio" />
                </div>
              ))}
            </div>


            <button className="reg-btn-primary" onClick={() => setStep(6)}>다음 →</button>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━
            Step 6 — 학습 목표
        ━━━━━━━━━━━━━━━━━ */}
        {step === 6 && (
          <div className="reg-body">
            <div>
              <div className="reg-page-title">무엇을 목표로<br />공부하나요?</div>
              <div className="reg-page-sub">여러 개 선택해도 괜찮아요 😊</div>
            </div>

            <div className="reg-goal-grid">
              {GOAL_OPTIONS.map(g => (
                <div key={g.id}
                  className={`reg-goal-card${form.goals.includes(g.id) ? ' active' : ''}`}
                  onClick={() => toggleGoal(g.id)}>
                  <div className="reg-goal-icon">{g.icon}</div>
                  <div className="reg-goal-label">{g.label}</div>
                  <div className={`reg-goal-check${form.goals.includes(g.id) ? ' on' : ''}`}>
                    {form.goals.includes(g.id) && '✓'}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#26215C' }}>하루 학습 목표</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {DAILY_TIMES.map(t => (
                  <div key={t}
                    className={`reg-time-btn${form.dailyTime === t ? ' active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, dailyTime: t }))}>
                    {t === 30 ? '30분+' : `${t}분`}
                  </div>
                ))}
              </div>
            </div>

            {error && <div className="reg-error">⚠️ {error}</div>}

            <button className="reg-btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading
                ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> 처리 중...</>
                : '에이몬 만나러 가기 🎉'
              }
            </button>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━
            Step 7 — 완료
        ━━━━━━━━━━━━━━━━━ */}
        {step === 7 && (
          <>
            <div className="reg-complete-hero">
              <img src={beginnerHappyIcon} alt="에이몬" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
              <div style={{ color: 'white', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, opacity: 0.8, marginBottom: '6px' }}>
                  {form.nickname}님,
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1.3 }}>
                  에이몬이<br />준비됐어요! 🎉
                </div>
              </div>
            </div>

            <div className="reg-body">
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#26215C', marginBottom: '10px' }}>🎁 가입 보너스</div>
                <div className="reg-reward-row">
                  {[
                    { icon: '🪙', val: '+1,000', label: '시작 코인' },
                    { icon: '💡', val: '×5',     label: '힌트 코인' },
                    { icon: '👑', val: '+500',   label: '왕관' },
                  ].map(r => (
                    <div key={r.label} className="reg-reward-card">
                      <div className="reg-reward-icon">{r.icon}</div>
                      <div className="reg-reward-val">{r.val}</div>
                      <div className="reg-reward-label">{r.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="reg-summary-box">
                <div className="reg-summary-row">
                  <span className="reg-summary-label">닉네임</span>
                  <span className="reg-summary-val">{form.nickname}</span>
                </div>
                <div className="reg-summary-divider" />
                <div className="reg-summary-row">
                  <span className="reg-summary-label">시작 레벨</span>
                  <span className="reg-summary-val">
                    {LEVEL_OPTIONS.find(l => l.id === form.level)?.icon}{' '}
                    {LEVEL_OPTIONS.find(l => l.id === form.level)?.title}
                  </span>
                </div>
                <div className="reg-summary-divider" />
                <div className="reg-summary-row">
                  <span className="reg-summary-label">학습 목표</span>
                  <span className="reg-summary-val">
                    하루 {form.dailyTime === 30 ? '30분+' : `${form.dailyTime}분`}
                  </span>
                </div>
              </div>

              <button className="reg-btn-primary" onClick={() => navigate('/lesson')}>
                🚀 학습 시작하기
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

/* ── SVG 아이콘 ── */
function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M9 1C4.58 1 1 3.9 1 7.5c0 2.3 1.5 4.3 3.8 5.5l-.96 3.5 4.1-2.7c.34.05.7.07 1.06.07 4.42 0 8-2.9 8-6.5S13.42 1 9 1z" fill="#3C1E1E"/>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.556 15.013 17.64 12.218 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function NaverIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24">
      <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z" fill="white"/>
    </svg>
  )
}
