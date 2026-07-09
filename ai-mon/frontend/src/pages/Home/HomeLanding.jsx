import { useNavigate } from 'react-router-dom'
import slimeIcon from '../../assets/character_slime.png'
import aimonExplainMascot from '../../assets/aimon_explain_mascot.png'

const FEATURES = [
  {
    icon: '🧠',
    badge: '핵심 기능',
    title: 'AI 오답 설명',
    desc: '틀린 문제도 걱정 없어요.\n 에이몬이 이해하기 쉽게 바로 설명해줘요.',
    pill: '맞춤형 AI 해설',
    primary: true,
  },
  {
    icon: '⚔️',
    title: '엔드보스 인증카드',
    desc: '보스 클리어 기록을 인증카드로 모아보세요.',
    pill: '카드 컬렉션',
  },
  {
    icon: '📈',
    title: '코인 · 레벨업',
    desc: '학습하고 미션을 완료하면 코인과 경험치를 획득해요.',
    pill: '성장 보상',
  },
]

export default function HomeLanding() {
  const navigate = useNavigate()

  return (
    <div className="home-page">
      {/* 히어로 섹션 */}
      <div className="home-hero">
        <div className="home-hero-char animate-float">
          <span className="home-hero-sparkle sparkle-1" aria-hidden="true">✦</span>
          <span className="home-hero-sparkle sparkle-2" aria-hidden="true">✧</span>
          <span className="home-hero-sparkle sparkle-3" aria-hidden="true">✦</span>
          <span className="home-hero-dot dot-1" aria-hidden="true" />
          <span className="home-hero-dot dot-2" aria-hidden="true" />
          <img src={slimeIcon} alt="에이원" />
        </div>
        <div className="home-hero-badge animate-fade-in">AI MON</div>
        <h1 className="home-hero-title animate-fade-in-up">
          에이몬과 함께<br />
          <span className="home-hero-accent">파이썬을 정복</span>하세요
        </h1>
        <p className="home-hero-sub animate-fade-in-up">
          Python 기초부터 AI 에이전트까지<br />
          게임하듯 재미있는 코딩 학습
        </p>

        <div className="home-hero-actions animate-fade-in-up">
          <button
            id="btn-login-home"
            className="home-hero-action"
            onClick={() => navigate('/auth')}
          >
            <span className="home-hero-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </span>
            <span className="home-hero-action-label">로그인</span>
          </button>
          <button
            id="btn-free-trial"
            className="home-hero-action is-primary"
            onClick={() => navigate('/stage/1/1')}
          >
            <span className="home-hero-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="home-hero-action-label">바로<br />체험하기</span>
          </button>
          <button
            id="btn-register-home"
            className="home-hero-action"
            onClick={() => navigate('/register')}
          >
            <span className="home-hero-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </span>
            <span className="home-hero-action-label">회원가입</span>
          </button>
        </div>
        <p className="home-hero-helper animate-fade-in-up">✦ 로그인 없이 1분 체험 가능</p>
      </div>

      {/* 특징 카드 */}
      <div className="home-features container">
        <h2 className="home-section-title home-feature-section-title">
          <span aria-hidden="true">✧</span>
          에이몬만의 특별함
        </h2>
        <div className="home-feature-grid">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`home-feature-card ${f.primary ? 'is-primary' : 'is-secondary'}`}
            >
              {f.primary ? (
                <>
                  <div className="home-feature-main-copy">
                    <span className="home-feature-badge">{f.badge}</span>
                    <h3 className="home-feature-title">{f.title}</h3>
                    <p className="home-feature-desc">{f.desc}</p>
                    <span className="home-feature-pill">
                      {f.pill}
                    </span>
                  </div>

                  <div className="home-feature-main-visual" aria-hidden="true">
                    <img
                      src={aimonExplainMascot}
                      alt=""
                      className="home-feature-mascot-img"
                    />
                    <div className="home-feature-explain-card">
                      <div className="home-feature-answer-row">❌ 정답: 3</div>
                      <div className="home-feature-ai-row">✦ 에이몬의 설명</div>
                      <p>인덱스는 0부터 시작한다는 점을 기억해요!</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <span className="home-feature-icon" aria-hidden="true">{f.icon}</span>
                  <div className="home-feature-secondary-copy">
                    <h3 className="home-feature-title">{f.title}</h3>
                    <p className="home-feature-desc">{f.desc}</p>
                    <span className="home-feature-pill">
                      {f.pill}
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* 푸터 문구 */}
        <div className="home-landing-footer">
          <span className="home-landing-footer-heart" aria-hidden="true">💜</span>
          <span>에이몬은 여러분의 학습 여정을 함께합니다.</span>
        </div>
      </div>
    </div>
  )
}
