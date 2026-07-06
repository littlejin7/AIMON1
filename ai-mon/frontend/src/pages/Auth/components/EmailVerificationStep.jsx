function formatSeconds(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')
  return `${mins}:${secs}`
}

export default function EmailVerificationStep({ email, isValidEmail, verification }) {
  const {
    otp,
    otpRefs,
    otpFilled,
    codeSending,
    verifying,
    codeSent,
    verified,
    message,
    resendRemaining,
    codeExpiresIn,
    sendCode,
    verifyCode,
    handleOtpChange,
    handleOtpKeyDown,
  } = verification

  return (
    <div className="reg-body">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '10px', padding: '10px 0' }}>
        <div className="reg-verify-icon">📬</div>
        <div className="reg-page-title">이메일을 확인해주세요</div>
        <div className="reg-page-sub">
          <strong style={{ color: '#534AB7' }}>{email}</strong> 으로<br />
          6자리 인증코드를 보냈어요.
        </div>
      </div>

      <button
        type="button"
        className="reg-btn-primary"
        disabled={!isValidEmail || codeSending || resendRemaining > 0}
        onClick={sendCode}
      >
        {codeSending
          ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> 발송 중...</>
          : resendRemaining > 0
            ? `${resendRemaining}초 후 재발송`
            : codeSent
              ? '인증코드 다시 보내기'
              : '이메일 인증코드 보내기'
        }
      </button>

      {message && (
        <div className="reg-info-box" style={{ background: verified ? '#F0FDF4' : '#F9F8FE', border: '1px solid #E5E2F8', color: verified ? '#15803D' : '#534AB7' }}>
          {message}
        </div>
      )}

      <div className="reg-otp-wrap">
        {otp.map((value, index) => (
          <input
            key={index}
            ref={el => otpRefs.current[index] = el}
            className={`reg-otp-box${value ? ' filled' : ''}`}
            maxLength={1}
            value={value}
            placeholder="·"
            type="text"
            inputMode="numeric"
            onChange={event => handleOtpChange(index, event.target.value)}
            onKeyDown={event => handleOtpKeyDown(index, event)}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <div style={{ fontSize: '13px', color: '#9B96D0' }}>코드 만료까지</div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#7F77DD', fontVariantNumeric: 'tabular-nums' }}>
          {codeSent ? formatSeconds(codeExpiresIn) : '--:--'}
        </div>
      </div>

      {!otpFilled && (
        <div className="reg-info-box" style={{ background: '#FFF9ED', border: '1px solid #FAC775', color: '#8A5500' }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>⌨️</span>
          나머지 {6 - otp.filter(Boolean).length}자리를 입력하면 자동으로 확인해요.
        </div>
      )}

      {otpFilled && (
        <div className="reg-info-box" style={{ background: '#F0FDF4', border: '1px solid #86EFAC', color: '#15803D' }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>✅</span>
          인증코드가 입력됐어요. 아래 버튼을 눌러 확인해주세요.
        </div>
      )}

      <button
        className="reg-btn-primary"
        disabled={!otpFilled || !codeSent || verifying}
        onClick={verifyCode}
      >
        {verifying
          ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> 확인 중...</>
          : '인증 완료'
        }
      </button>

      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '12px', color: '#C4BFEE' }}>코드를 못 받았나요?</span>
        <button type="button"
          disabled={codeSending || resendRemaining > 0}
          onClick={sendCode}
          style={{ fontSize: '12px', color: '#7F77DD', fontWeight: 500, cursor: 'pointer', marginLeft: '6px', background: 'none', border: 'none', fontFamily: 'inherit' }}>
          {resendRemaining > 0 ? `${resendRemaining}초` : '재전송'}
        </button>
      </div>
    </div>
  )
}
