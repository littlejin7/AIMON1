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
  emailChecked,
  emailCheckMsg,
  onEmailCheck,
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
  const [activeModal, setActiveModal] = useState(null) // 'tos' | 'privacy' | null

  // 이메일 분할 상태 관리
  const [emailId, setEmailId] = useState(form.email ? form.email.split('@')[0] : '')
  const [emailDomain, setEmailDomain] = useState(
    form.email && form.email.includes('@')
      ? ['naver.com', 'gmail.com', 'daum.net', 'hanmail.net', 'nate.com', 'kakao.com', 'outlook.com', 'icloud.com'].includes(form.email.split('@')[1])
        ? form.email.split('@')[1]
        : 'direct'
      : 'naver.com'
  )
  const [customDomain, setCustomDomain] = useState(
    form.email && form.email.includes('@') && !['naver.com', 'gmail.com', 'daum.net', 'hanmail.net', 'nate.com', 'kakao.com', 'outlook.com', 'icloud.com'].includes(form.email.split('@')[1])
      ? form.email.split('@')[1]
      : ''
  )

  // 부모 form.email 상태 업데이트
  const updateParentEmail = (id, domain) => {
    const fullEmail = `${id.trim()}@${domain.trim()}`
    onChange({ target: { name: 'email', value: fullEmail } })
  }

  const handleEmailIdChange = (e) => {
    const val = e.target.value
    setEmailId(val)
    updateParentEmail(val, emailDomain === 'direct' ? customDomain : emailDomain)
  }

  const handleDomainSelectChange = (e) => {
    const val = e.target.value
    setEmailDomain(val)
    if (val !== 'direct') {
      updateParentEmail(emailId, val)
    } else {
      updateParentEmail(emailId, customDomain)
    }
  }

  const handleCustomDomainChange = (e) => {
    const val = e.target.value
    setCustomDomain(val)
    updateParentEmail(emailId, val)
  }

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
        <label htmlFor="reg-nickname">닉네임</label>
        <input
          id="reg-nickname"
          name="nickname"
          type="text"
          className="input"
          placeholder="닉네임"
          value={form.nickname}
          onChange={onChange}
          required
          autoComplete="off"
        />
      </div>

      {/* 이메일 */}
      <div className="form-group">
        <label htmlFor="reg-email-id">이메일 주소</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            id="reg-email-id"
            type="text"
            className="input"
            placeholder="이메일 아이디"
            value={emailId}
            onChange={handleEmailIdChange}
            required
            style={{ flex: 1 }}
          />
          <span style={{ color: 'var(--clr-text-muted)', fontWeight: 500 }}>@</span>
          {emailDomain !== 'direct' ? (
            <select
              className="input"
              value={emailDomain}
              onChange={handleDomainSelectChange}
              style={{
                flex: 1.2,
                height: '42px',
                background: 'var(--clr-bg-alt, #1e1b4b)',
                color: 'var(--clr-text, #ffffff)',
                border: '1px solid var(--clr-border, #312e81)',
                borderRadius: '8px',
                padding: '0 10px',
                cursor: 'pointer'
              }}
            >
              <option value="naver.com" style={{ background: '#1e1b4b', color: '#ffffff' }}>naver.com</option>
              <option value="gmail.com" style={{ background: '#1e1b4b', color: '#ffffff' }}>gmail.com</option>
              <option value="daum.net" style={{ background: '#1e1b4b', color: '#ffffff' }}>daum.net</option>
              <option value="hanmail.net" style={{ background: '#1e1b4b', color: '#ffffff' }}>hanmail.net</option>
              <option value="kakao.com" style={{ background: '#1e1b4b', color: '#ffffff' }}>kakao.com</option>
              <option value="nate.com" style={{ background: '#1e1b4b', color: '#ffffff' }}>nate.com</option>
              <option value="outlook.com" style={{ background: '#1e1b4b', color: '#ffffff' }}>outlook.com</option>
              <option value="icloud.com" style={{ background: '#1e1b4b', color: '#ffffff' }}>icloud.com</option>
              <option value="direct" style={{ background: '#1e1b4b', color: '#ffffff' }}>직접 입력</option>
            </select>
          ) : (
            <div style={{ display: 'flex', gap: '6px', flex: 1.2 }}>
              <input
                type="text"
                className="input"
                placeholder="도메인 입력"
                value={customDomain}
                onChange={handleCustomDomainChange}
                required
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setEmailDomain('naver.com')
                  const full = `${emailId}@naver.com`
                  onChange({ target: { name: 'email', value: full } })
                }}
                style={{ whiteSpace: 'nowrap', padding: '0 8px', fontSize: '0.72rem' }}
              >
                선택
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn btn-outline btn-full"
          onClick={() => onEmailCheck(`${emailId}@${emailDomain === 'direct' ? customDomain : emailDomain}`)}
          style={{ height: '38px', fontSize: '0.85rem', marginTop: '8px' }}
        >
          이메일 중복확인
        </button>
        {emailCheckMsg === 'ok'    && <p style={{ color: '#10b981', fontSize: '0.8rem', marginTop: '4px' }}>✅ 사용 가능한 이메일입니다.</p>}
        {emailCheckMsg === 'dup'   && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px' }}>❌ 이미 사용 중인 이메일입니다.</p>}
        {emailCheckMsg === 'error' && <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginTop: '4px' }}>⚠️ 올바른 이메일 주소를 입력하고 중복확인을 해주세요.</p>}
        {emailCheckMsg === 'server_error' && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px' }}>⚠️ 서버와 통신할 수 없습니다. 백엔드 서버를 확인해 주세요.</p>}
      </div>

      {/* 약관 동의 */}
      <div style={{ borderTop: '1px solid var(--clr-border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* 전체 동의 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={terms.age && terms.tos && terms.privacy}
            onChange={onTermAll}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          필수 약관 전체 동의
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
            <button
              type="button"
              onClick={() => setActiveModal('tos')}
              style={{ background: 'none', border: 'none', color: 'var(--clr-text-muted)', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              보기
            </button>
          </label>

          {/* 개인정보 처리방침 */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input type="checkbox" name="privacy" checked={terms.privacy} onChange={onTermChange}
              style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
            <span style={{ flex: 1 }}><span style={{ color: '#a78bfa' }}>[필수]</span> 개인정보 처리방침 동의</span>
            <button
              type="button"
              onClick={() => setActiveModal('privacy')}
              style={{ background: 'none', border: 'none', color: 'var(--clr-text-muted)', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              보기
            </button>
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

      {/* 약관 보기 모달 오버레이 */}
      {activeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: 'var(--clr-bg-alt, #151329)',
            border: '1px solid var(--clr-border, rgba(255,255,255,0.08))',
            borderRadius: '16px',
            width: '100%', maxWidth: '480px',
            padding: '24px', position: 'relative',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#ffffff' }}>
              {activeModal === 'tos' ? '이용약관' : '개인정보 처리방침'}
            </h3>
            
            <div style={{
              flex: 1, overflowY: 'auto',
              background: 'rgba(0,0,0,0.2)', padding: '16px',
              borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)',
              fontSize: '0.85rem', lineHeight: 1.6, color: '#d1d5db',
              whiteSpace: 'pre-wrap', marginBottom: '20px'
            }}>
              {activeModal === 'tos' ? (
                `제 1 조 (목적)
이 약관은 에이몬(AI MON)이 제공하는 코딩 학습 플랫폼 서비스의 이용조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.

제 2 조 (회원가입 및 계정)
1. 회원은 본 약관에 동의하고 양식에 맞게 정보를 입력함으로써 가입을 신청합니다.
2. 회원은 개인 정보를 정확하게 유지해야 할 의무가 있으며, 허위 기재로 인한 문제의 책임은 회원에게 있습니다.

제 3 조 (서비스의 제공 및 이용)
1. 에이몬은 회원에게 AI 맞춤형 학습 서비스 및 캐릭터 진화/성장 콘텐츠를 제공합니다.
2. 시스템 점검 또는 기술적 이유로 서비스가 일시 중단될 수 있으며, 사전에 공지합니다.

제 4 조 (회원의 의무)
회원은 타인의 계정을 도용하거나 서비스의 정상적인 운영을 방해하는 행위를 해서는 안 됩니다.`
              ) : (
                `에이몬(AI MON)은 회원의 개인정보를 중요시하며, 정보통신망 이용촉진 및 정보보호 등에 관한 법률을 준수합니다.

1. 수집하는 개인정보 항목
- 필수 항목: 아이디, 비밀번호, 닉네임, 이메일, 학습 레벨 정보
- 수집 목적: 회원 가입 서비스 제공, 맞춤형 학습 서비스 진단, 스트릭 및 리워드 지급

2. 개인정보의 보유 및 이용 기간
회원의 개인정보는 회원 탈퇴 시 혹은 목적 달성 후 지체 없이 파기합니다. 단, 법령에 의하여 보존할 필요가 있는 경우 관련 법령에 따릅니다.

3. 동의 거부 권리
귀하는 개인정보 수집 및 이용 동의를 거부할 권리가 있습니다. 단, 필수 정보 수집 동의를 거부하실 경우 서비스 가입 및 이용이 제한됩니다.`
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setActiveModal(null)}
              style={{ width: '100%' }}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
