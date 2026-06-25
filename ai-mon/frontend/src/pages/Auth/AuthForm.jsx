import { useState } from 'react'

export default function AuthForm({
  form,
  onChange,
  error,
  loading,
  onSubmit,
  onGoRegister,
  onGoFindId,
  onGoFindPw,
}) {
  const [showPw,  setShowPw]  = useState(false)
  const [remember, setRemember] = useState(false)

  return (
    <form onSubmit={onSubmit}>

      {/* 에러 배너 */}
      {error && (
        <div className="auth-error-banner animate-fade-in" style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
          <div>
            <div className="auth-error-banner-title">아이디 또는 비밀번호가 틀렸습니다</div>
            <div className="auth-error-banner-desc">{error}</div>
          </div>
        </div>
      )}

      {/* 입력 필드 */}
      <div className="auth-fields">
        {/* 아이디 */}
        <div className="auth-field-wrap">
          <label className="auth-field-label">아이디</label>
          <span className="auth-field-icon">👤</span>
          <input
            id="username"
            name="username"
            type="text"
            className={`auth-field-input${error ? ' error' : ''}`}
            placeholder="아이디를 입력하세요"
            value={form.username}
            onChange={onChange}
            required
            autoComplete="username"
          />
        </div>

        {/* 비밀번호 */}
        <div className="auth-field-wrap">
          <label className="auth-field-label">비밀번호</label>
          <span className="auth-field-icon">🔒</span>
          <input
            id="password"
            name="password"
            type={showPw ? 'text' : 'password'}
            className={`auth-field-input${error ? ' error' : ''}`}
            placeholder="비밀번호를 입력하세요"
            value={form.password}
            onChange={onChange}
            required
            autoComplete="current-password"
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

      {/* 로그인 상태 유지 */}
      <div className="auth-option-row" style={{ marginTop: '10px' }}>
        <label
          className="auth-checkbox-row"
          onClick={() => setRemember(v => !v)}
        >
          <div className={`auth-checkbox${remember ? ' checked' : ''}`}>
            {remember && (
              <svg width="10" height="8" viewBox="0 0 10 8">
                <path
                  d="M1 4L4 7L9 1"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            )}
          </div>
          <span className="auth-checkbox-label">로그인 상태 유지</span>
        </label>
      </div>

      {/* 로그인 버튼 */}
      <button
        id="btn-auth-submit"
        type="submit"
        className={`auth-btn-main${error ? ' error-state' : ''}`}
        disabled={loading}
        style={{ marginTop: '12px' }}
      >
        {loading ? (
          <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> 처리 중...</>
        ) : (
          error ? '다시 시도하기' : '로그인 →'
        )}
      </button>

      {/* 링크 행 */}
      <div className="auth-link-row" style={{ marginTop: '20px' }}>
        <button type="button" className="auth-link" onClick={onGoFindId}>
          아이디 찾기
        </button>
        <span className="auth-link-sep">|</span>
        <button type="button" className="auth-link" onClick={onGoFindPw}>
          비밀번호 찾기
        </button>
        <span className="auth-link-sep">|</span>
        <button type="button" className="auth-link" onClick={onGoRegister}>
          회원가입
        </button>
      </div>

    </form>
  )
}
