/**
 * SocialButtons
 *
 * variant="compact"  → 로그인 페이지용 가로 3열 버튼 (카카오 / 구글 / 네이버)
 * variant="full"     → 회원가입 페이지용 세로 전체폭 버튼 (기존 디자인)
 */

const SOCIAL_PROVIDERS = [
  {
    id: 'kakao',
    label: '카카오',
    labelFull: '카카오로 계속하기',
    iconBg: '#FEE500',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24">
        <path
          d="M12 3C7.03 3 3 6.14 3 9.98c0 2.43 1.58 4.57 3.96 5.78L6 18l3.37-1.8A9.7 9.7 0 0012 16.97c4.97 0 9-3.12 9-6.99C21 6.14 16.97 3 12 3z"
          fill="#3A1D1D"
        />
      </svg>
    ),
    bg: '#FEE500', color: '#1a1a2e', border: '#FEE500',
  },
  {
    id: 'google',
    label: '구글',
    labelFull: '구글로 계속하기',
    iconBg: 'white',
    iconBorder: '1px solid #E8E5F8',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
    bg: '#fff', color: '#1a1a2e', border: 'rgba(255,255,255,0.2)',
  },
  {
    id: 'naver',
    label: '네이버',
    labelFull: '네이버로 계속하기',
    iconBg: '#03C75A',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24">
        <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z" fill="white"/>
      </svg>
    ),
    bg: '#03C75A', color: '#fff', border: '#03C75A',
  },
]

export default function SocialButtons({ onSocial, variant = 'full' }) {
  // ── 로그인용 가로 3열 ──
  if (variant === 'compact') {
    return (
      <div className="auth-social-btns">
        {SOCIAL_PROVIDERS.map((p) => (
          <button
            key={p.id}
            id={`btn-social-${p.id}`}
            type="button"
            className="auth-social-btn-compact"
            onClick={() => onSocial(p)}
          >
            <div
              className="auth-social-icon-circle"
              style={{
                background: p.iconBg,
                border: p.iconBorder || 'none',
              }}
            >
              {p.icon}
            </div>
            {p.label}
          </button>
        ))}
      </div>
    )
  }

  // ── 회원가입용 세로 전체폭 (기존 디자인) ──
  return (
    <div className="auth-social-group">
      {SOCIAL_PROVIDERS.map((p) => (
        <button
          key={p.id}
          id={`btn-social-${p.id}`}
          type="button"
          className="auth-social-btn"
          style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}
          onClick={() => onSocial(p)}
        >
          <span className="auth-social-icon">{p.icon}</span>
          {p.labelFull}
        </button>
      ))}
    </div>
  )
}
