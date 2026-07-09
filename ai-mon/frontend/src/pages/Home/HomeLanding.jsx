import { useNavigate } from 'react-router-dom'
import slimeIcon from '../../assets/character_slime.png'

const FEATURES = [
  { icon: '🧠', title: 'AI 오답 설명' },
  { icon: '⚔️', title: '엔드보스 인증카드' },
  { icon: '📈', title: '코인 · 레벨업' },
]

export default function HomeLanding() {
  const navigate = useNavigate()

  return (
    <div className="home-page">
      {/* 히어로 섹션 */}
      <div className="home-hero">
        <div className="home-hero-char animate-float">
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

        <div className="home-hero-actions home-orbit-actions animate-fade-in-up">
          <button
            id="btn-login-home"
            className="home-circle-btn home-circle-side"
            onClick={() => navigate('/auth')}
          >
            로그인
          </button>
          <button
            id="btn-free-trial"
            className="home-circle-btn home-circle-main"
            onClick={() => navigate('/stage/1/1')}
          >
            <span>바로<br />체험하기</span>
          </button>
          <button
            id="btn-register-home"
            className="home-circle-btn home-circle-side"
            onClick={() => navigate('/register')}
          >
            회원가입
          </button>
        </div>
      </div>

      {/* 특징 카드 */}
      <div className="home-features container" style={{ marginTop: '30px' }}>
        <h2 className="home-section-title">에이몬만의 특별함</h2>
        <div className="home-feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="home-feature-card card-glass">
              <span className="home-feature-icon">{f.icon}</span>
              <h3 className="home-feature-title">{f.title}</h3>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
