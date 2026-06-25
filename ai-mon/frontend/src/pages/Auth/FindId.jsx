import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../api/index'
import beginnerHappyIcon from '../../assets/character_beginnerhappy.png'
import './Auth.css'

export default function FindId() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [result, setResult]   = useState(null) // find-id 응답

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await authApi.findId({ email: email.trim() })
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
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
          ← 로그인으로
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
            내 <em>아이디</em>를<br />찾아드릴게요!
          </div>
        </div>

        {/* 폼 패널 */}
        <div className="auth-form-panel">
          {error && (
            <div className="auth-error-banner animate-fade-in">
              <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
              <div>
                <div className="auth-error-banner-title">오류가 발생했어요</div>
                <div className="auth-error-banner-desc">{error}</div>
              </div>
            </div>
          )}

          {/* 결과 표시 */}
          {result && (
            <div className="auth-social-msg animate-fade-in" style={{ textAlign: 'center', lineHeight: 1.6 }}>
              {result.found
                ? (result.is_social
                    ? result.message
                    : (
                        <>
                          회원님의 아이디는<br />
                          <strong style={{ fontSize: '16px', color: '#534AB7' }}>{result.masked_username}</strong><br />
                          입니다. (보안을 위해 일부만 표시돼요)
                        </>
                      ))
                : (result.message || '해당 이메일로 가입된 계정을 찾을 수 없습니다.')}
            </div>
          )}

          <form onSubmit={handleSubmit}>
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
                '아이디 찾기 →'
              )}
            </button>
          </form>

          <div className="auth-link-row" style={{ marginTop: '18px' }}>
            <button type="button" className="auth-link" onClick={() => navigate('/auth')}>
              로그인으로 돌아가기
            </button>
            <span className="auth-link-sep">|</span>
            <button type="button" className="auth-link" onClick={() => navigate('/find-pw')}>
              비밀번호 찾기
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
