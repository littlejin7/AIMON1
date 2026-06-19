import beginnerHappyIcon from '../../assets/character_beginnerhappy.png'

export default function AuthForm({
  mode,
  form,
  onChange,
  passwordConfirm,
  setPasswordConfirm,
  idChecked,
  idCheckMsg,
  onIdCheck,
  error,
  loading,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="auth-form">
      {/* 아이디 */}
      <div className="form-group">
        <label htmlFor="username">아이디</label>
        <div style={{ display: 'flex', gap: '8px' }}>
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
            style={{ flex: 1 }}
          />
          {mode === 'register' && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onIdCheck}
              style={{ whiteSpace: 'nowrap', padding: '0 14px' }}
            >
              중복확인
            </button>
          )}
        </div>
        {mode === 'register' && idCheckMsg === 'ok'    && <p style={{ color: '#10b981', fontSize: '0.8rem', marginTop: '4px' }}>✅ 사용 가능한 아이디입니다.</p>}
        {mode === 'register' && idCheckMsg === 'dup'   && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px' }}>❌ 이미 사용 중인 아이디입니다.</p>}
        {mode === 'register' && idCheckMsg === 'error' && <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginTop: '4px' }}>⚠️ 아이디를 입력해주세요.</p>}
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
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
      </div>

      {/* 비밀번호 확인 (회원가입) */}
      {mode === 'register' && (
        <div className="form-group animate-fade-in">
          <label htmlFor="passwordConfirm">비밀번호 확인</label>
          <input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            className="input"
            placeholder="비밀번호를 다시 입력하세요"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            autoComplete="new-password"
            style={{ borderColor: passwordConfirm && form.password !== passwordConfirm ? '#ef4444' : undefined }}
          />
          {passwordConfirm && form.password !== passwordConfirm && (
            <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px' }}>비밀번호가 일치하지 않습니다.</p>
          )}
        </div>
      )}

      {/* 닉네임 (회원가입) */}
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
            onChange={onChange}
            autoComplete="nickname"
          />
        </div>
      )}

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
        ) : mode === 'login' ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            로그인
          </span>
        ) : (
          <><img src={beginnerHappyIcon} alt="에이몬" style={{ width: '50px', height: '50px', objectFit: 'contain', verticalAlign: 'middle' }} /><span> 에이몬 시작하기</span></>
        )}
      </button>
    </form>
  )
}
