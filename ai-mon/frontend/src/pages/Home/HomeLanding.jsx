import { useNavigate } from 'react-router-dom'
import { EVOLUTION_STAGES } from './homeUtils'
import slimeIcon from '../../assets/character_slime.png'

const FEATURES = [
  { icon: '🧠', title: 'Claude AI 오답 설명', desc: '틀린 문제를 AI가 비유와 예시로 친절하게 설명해줘요' },
  { icon: '⚔️', title: '보스 클리어 시스템', desc: '유닛 완료 후 보스를 쓰러뜨리면 인증카드가 자동 생성!' },
  { icon: '📈', title: 'XP · 레벨업',       desc: '퀴즈를 풀수록 XP가 쌓이고, 에이몬이 함께 성장해요' },
]

export default function HomeLanding({ onOpenLevelTest }) {
  const navigate = useNavigate()

  return (
    <div className="home-page">
      {/* 히어로 섹션 */}
      <div className="home-hero">
        <div className="home-hero-char animate-float">
          <img src={slimeIcon} alt="에이몬 슬라임" />
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
            id="btn-free-trial"
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/stage/1/1')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.5-1.5 4.5 0 4.5 0 1.5 3 1.5 4.5 0L19 7l-5-5L4.5 16.5z"/>
              <path d="M12 8l-4.5 4.5"/>
              <path d="M20 4l-5 1-1 5"/>
            </svg>
            바로 체험하기
          </button>
          <button
            id="btn-level-test"
            className="btn btn-ghost btn-lg"
            onClick={() => navigate('/level-test-info')}
           style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid rgba(124,58,237,0.45)', color: 'var(--clr-primary-lt)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            내 에이몬 찾기 (레벨 테스트)
          </button>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '8px', fontSize: '0.88rem' }}>
            <button
              id="btn-register-home"
              onClick={() => navigate('/register')}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--clr-primary-lt)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
            >
              회원가입
            </button>
            <span style={{ color: 'var(--clr-text-faint)' }}>|</span>
            <button
              id="btn-login-home"
              onClick={() => navigate('/auth')}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--clr-text-muted)', cursor: 'pointer' }}
            >
              이미 계정이 있어요 (로그인)
            </button>
          </div>
        </div>
      </div>

      {/* 진화 프리뷰 */}
      <div className="home-evo-preview container">
        <h2 className="home-section-title">🌟 에이몬 진화 여정</h2>
        <div className="home-evo-track">
          {EVOLUTION_STAGES.map((stage, i) => (
            <div key={stage.id} className="home-evo-step">
              <div
                className="home-evo-orb"
                style={{ boxShadow: `0 0 20px ${stage.glow}`, borderColor: stage.color }}
              >
                <img src={stage.icon} alt={stage.name} className="home-evo-icon" />
              </div>
              <div className="home-evo-info">
                <span className="home-evo-name" style={{ color: stage.color }}>{stage.name}</span>
                <span className="home-evo-range">{stage.unitRange}</span>
              </div>
              {i < EVOLUTION_STAGES.length - 1 && (
                <div className="home-evo-arrow">→</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 특징 카드 */}
      <div className="home-features container">
        <h2 className="home-section-title">✨ 에이몬만의 특별함</h2>
        <div className="home-feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="home-feature-card card-glass">
              <span className="home-feature-icon">{f.icon}</span>
              <h3 className="home-feature-title">{f.title}</h3>
              <p className="home-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
