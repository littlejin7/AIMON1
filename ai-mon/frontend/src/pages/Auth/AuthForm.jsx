export default function AuthForm({ form, onChange, error, loading, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="auth-form">
      {/* 아이디 */}
      <div className="form-group">
        <label htmlFor="username">아이디</label>
        <input
          id="username"
          name="username"
          type="text"
          className="input"
          placeholder="아이디를 입력하세요"
          value={form.username}
          onChange={onChange}
          required
          autoComplete="username"
        />
      </div>

      {/* 비밀번호 */}
      <div className="form-group">
        <label htmlFor="password">비밀번호</label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          placeholder="비밀번호를 입력하세요"
          value={form.password}
          onChange={onChange}
          required
          autoComplete="current-password"
        />
      </div>

      {/* 에러 */}
      {error && (
        <div className="auth-error animate-fade-in">⚠️ {error}</div>
      )}

      {/* 제출 버튼 */}
      <button
        id="btn-auth-submit"
        type="submit"
        className="btn btn-primary btn-full btn-lg"
        disabled={loading}
      >
        {loading ? (
          <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> 처리 중...</>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            로그인
          </span>
        )}
      </button>
    </form>
  )
}
