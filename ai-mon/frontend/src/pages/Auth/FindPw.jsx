import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../api/index'
import beginnerHappyIcon from '../../assets/character_beginnerhappy.png'
import './Auth.css'

export default function FindPw() {
  const navigate = useNavigate()

  // phase: 'request' → 이메일 입력 / 'reset' → 토큰 + 새 비밀번호 입력
  const [phase, setPhase] = useState('request')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [notice, setNotice]   = useState('')

  // (a) 인증 코드 발송 요청
  const handleRequest = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await authApi.forgotPassword({ email: email.trim() })
      // 보안상 백엔드는 계정 존재 여부를 알려주지 않으므로 동일 안내
      setNotice('입력하신 이메일로 인증 코드를 보냈습니다. (가입된 계정인 경우)')
      setPhase('reset')
    } catch (err) {
      setError(err.response?.data?.detail || '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  // (b) 토큰 + 새 비밀번호로 재설정
  const handleReset = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await authApi.resetPassword({
        email: email.trim(),
        token: token.trim(),
        new_password: newPassword,
      })
      alert('비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.')
      navigate('/auth')
    } catch (err) {
      setError(err.response?.data?.detail || '인증 코드가 올바르지 않거나 만료되었습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card animate-fade-in-up">

        {/* 뒤로가기 */}
        <button
          onClick={() => navigate('/auth')}
          style={{
            alignSelf: 'flex-start',
            margin: '14px 0 0 16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            color: '#7F77DD',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: 0,
          }}
        >
          ✕
        </button>

        {/* 히어로 */}
        <div className="auth-hero">
          <div className="auth-brand-pill">🤖 AI MON</div>
          <img
            src={beginnerHappyIcon}
            alt="에이몬 캐릭터"
            className="auth-hero-img animate-float"
          />
          <div className="auth-hero-tagline">
            비밀번호를<br /><em>다시 설정</em>해요!
          </div>
        </div>

        {/* 폼 패널 */}
        <div className="auth-form-panel">
          {notice && (
            <div className="auth-social-msg animate-fade-in">{notice}</div>
          )}

          {error && (
            <div className="auth-error-banner animate-fade-in">
              <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
              <div>
                <div className="auth-error-banner-title">오류가 발생했어요</div>
                <div className="auth-error-banner-desc">{error}</div>
              </div>
            </div>
          )}

          {phase === 'request' ? (
            <form onSubmit={handleRequest}>
              <div className="auth-fields">
                <div className="auth-field-wrap">
                  <label className="auth-field-label">이메일</label>
                  <span className="auth-field-icon">✉️</span>
                  <input
                    name="email"
                    type="email"
                    className="auth-field-input"
                    placeholder="가입한 이메일을 입력하세요"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError('') }}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="auth-btn-main"
                disabled={loading}
                style={{ marginTop: '16px' }}
              >
                {loading ? (
                  <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> 처리 중...</>
                ) : (
                  '인증 코드 받기 →'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset}>
              <div className="auth-fields">
                <div className="auth-field-wrap">
                  <label className="auth-field-label">인증 코드</label>
                  <span className="auth-field-icon">🔑</span>
                  <input
                    name="token"
                    type="text"
                    className="auth-field-input"
                    placeholder="이메일로 받은 코드를 입력하세요"
                    value={token}
                    onChange={(e) => { setToken(e.target.value); setError('') }}
                    required
                    autoComplete="one-time-code"
                  />
                </div>

                <div className="auth-field-wrap">
                  <label className="auth-field-label">새 비밀번호</label>
                  <span className="auth-field-icon">🔒</span>
                  <input
                    name="new_password"
                    type={showPw ? 'text' : 'password'}
                    className="auth-field-input"
                    placeholder="새 비밀번호를 입력하세요"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError('') }}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="auth-field-action"
                    onClick={() => setShowPw(v => !v)}
                  >
                    {showPw ? '숨기기' : '보기'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="auth-btn-main"
                disabled={loading}
                style={{ marginTop: '16px' }}
              >
                {loading ? (
                  <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> 처리 중...</>
                ) : (
                  '비밀번호 변경 →'
                )}
              </button>

              <div className="auth-link-row" style={{ marginTop: '18px' }}>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => { setPhase('request'); setNotice(''); setError('') }}
                >
                  코드를 다시 받기
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}
