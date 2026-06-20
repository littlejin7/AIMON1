import { useState } from 'react'
import beginnerHappyIcon from '../../assets/character_beginnerhappy.png'

export default function RegisterForm({
  form,
  onChange,
  passwordConfirm,
  setPasswordConfirm,
  idChecked,
  idCheckMsg,
  onIdCheck,
  terms,
  onTermChange,
  onTermAll,
  error,
  loading,
  onSubmit,
  canSubmit,
}) {
  const [showPw, setShowPw] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)

  return (
    <form onSubmit={onSubmit} className="auth-form">
      {/* 아이디 */}
      <div className="form-group">
        <label htmlFor="reg-username">아이디</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            id="reg-username"
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
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onIdCheck}
            style={{ whiteSpace: 'nowrap', padding: '0 14px' }}
          >
            중복확인
          </button>
        </div>
        {idCheckMsg === 'ok'    && <p style={{ color: '#10b981', fontSize: '0.8rem', marginTop: '4px' }}>✅ 사용 가능한 아이디입니다.</p>}
        {idCheckMsg === 'dup'   && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px' }}>❌ 이미 사용 중인 아이디입니다.</p>}
        {idCheckMsg === 'error' && <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginTop: '4px' }}>⚠️ 아이디를 입력해주세요.</p>}
      </div>

      {/* 비밀번호 */}
      <div className="form-group">
        <label htmlFor="reg-password">비밀번호</label>
        <div style={{ position: 'relative' }}>
          <input
            id="reg-password"
            name="password"
            type={showPw ? 'text' : 'password'}
            className="input"
            placeholder="6자 이상 입력하세요"
            value={form.password}
            onChange={onChange}
            required
            autoComplete="new-password"
            style={{ width: '100%', paddingRight: '42px', boxSizing: 'border-box' }}
          />
          <button type="button" onClick={() => setShowPw(v => !v)}
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--clr-text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
            {showPw ? '숨기기' : '보기'}
          </button>
        </div>
      </div>

      {/* 비밀번호 확인 */}
      <div className="form-group">
        <label htmlFor="reg-pw-confirm">비밀번호 확인</label>
        <div style={{ position: 'relative' }}>
          <input
            id="reg-pw-confirm"
            name="passwordConfirm"
            type={showPwConfirm ? 'text' : 'password'}
            className="input"
            placeholder="비밀번호를 다시 입력하세요"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            autoComplete="new-password"
            style={{
              width: '100%', paddingRight: '42px', boxSizing: 'border-box',
              borderColor: passwordConfirm && form.password !== passwordConfirm ? '#ef4444' : undefined,
            }}
          />
          <button type="button" onClick={() => setShowPwConfirm(v => !v)}
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--clr-text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
            {showPwConfirm ? '숨기기' : '보기'}
          </button>
        </div>
        {passwordConfirm && form.password !== passwordConfirm && (
          <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px' }}>비밀번호가 일치하지 않습니다.</p>
        )}
      </div>

      {/* 닉네임 */}
      <div className="form-group">
        <label htmlFor="reg-nickname">닉네임 <span style={{ color: 'var(--clr-text-faint)', fontWeight: 400 }}>(선택)</span></label>
        <input
          id="reg-nickname"
          name="nickname"
          type="text"
          className="input"
          placeholder="닉네임"
          value={form.nickname}
          onChange={onChange}
          autoComplete="off"
        />
      </div>

      {/* 이메일 */}
      <div className="form-group">
        <label htmlFor="reg-email">이메일</label>
        <input
          id="reg-email"
          name="email"
          type="email"
          className="input"
          placeholder="example@email.com"
          value={form.email}
          onChange={onChange}
          required
          autoComplete="email"
        />
      </div>

      {/* 약관 동의 */}
      <div style={{ borderTop: '1px solid var(--clr-border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* 전체 동의 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={terms.age && terms.tos && terms.privacy && terms.marketing}
            onChange={onTermAll}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          전체 동의
        </label>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* 만 14세 이상 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input type="checkbox" name="age" checked={terms.age} onChange={onTermChange}
              style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
            <span><span style={{ color: '#a78bfa' }}>[필수]</span> 만 14세 이상입니다</span>
          </label>

          {/* 이용약관 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input type="checkbox" name="tos" checked={terms.tos} onChange={onTermChange}
              style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
            <span style={{ flex: 1 }}><span style={{ color: '#a78bfa' }}>[필수]</span> 이용약관 동의</span>
            <button type="button" style={{ background: 'none', border: 'none', color: 'var(--clr-text-muted)', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}>보기</button>
          </label>

          {/* 개인정보 처리방침 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input type="checkbox" name="privacy" checked={terms.privacy} onChange={onTermChange}
              style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
            <span style={{ flex: 1 }}><span style={{ color: '#a78bfa' }}>[필수]</span> 개인정보 처리방침 동의</span>
            <button type="button" style={{ background: 'none', border: 'none', color: 'var(--clr-text-muted)', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}>보기</button>
          </label>

          {/* 마케팅 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--clr-text-muted)' }}>
            <input type="checkbox" name="marketing" checked={terms.marketing} onChange={onTermChange}
              style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
            <span>[선택] 마케팅 정보 수신 동의</span>
          </label>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className="auth-error animate-fade-in">⚠️ {error}</div>
      )}

      {/* 제출 버튼 */}
      <button
        type="submit"
        className="btn btn-primary btn-full btn-lg"
        disabled={loading || !canSubmit}
        style={{ opacity: canSubmit ? 1 : 0.5 }}
      >
        {loading ? (
          <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> 처리 중...</>
        ) : (
          <><img src={beginnerHappyIcon} alt="에이몬" style={{ width: '36px', height: '36px', objectFit: 'contain', verticalAlign: 'middle' }} /> 에이몬 시작하기</>
        )}
      </button>
    </form>
  )
}
