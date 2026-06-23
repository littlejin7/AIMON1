import { useNavigate } from 'react-router-dom'
import './LevelTestInfo.css'

export default function LevelTestInfo() {
  const navigate = useNavigate()

  return (
    <div className="level-test-info-page">
      <div className="level-test-info-bg-orb orb-1" />
      <div className="level-test-info-bg-orb orb-2" />

      <div className="level-test-info-container animate-fade-in-up">
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 20px rgba(124,58,237,0.6))' }}>🔍</div>
          <h1 className="level-test-info-title">내 에이몬 찾기</h1>
          <div className="level-test-info-badge">회원 전용 서비스 🔐</div>
        </div>

        {/* 안내문구 */}
        <div className="card-glass level-test-info-card">
          <p style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.8, marginBottom: '1.5rem', textAlign: 'center' }}>
            에이몬 레벨 테스트는 <span style={{ color: 'var(--clr-primary-lt)' }}>회원만 이용 가능</span>합니다.
          </p>
          <p style={{ color: 'var(--clr-text-muted)', fontSize: '0.92rem', lineHeight: 1.8, marginBottom: '2rem', textAlign: 'center' }}>
            회원가입 후 단 10문항의 간단한 진단 테스트를 거치면,<br />
            나의 수준에 딱 맞춘 <strong style={{ color: 'var(--clr-text)' }}>학습 커리큘럼</strong>과 귀여운 <strong style={{ color: 'var(--clr-text)' }}>첫 에이몬 캐릭터</strong>가 지급됩니다! 🎮
          </p>

          {/* 혜택 그리드 */}
          <div className="level-test-info-benefits">
            <div className="benefit-item">
              <span className="benefit-icon">📊</span>
              <div>
                <h3 className="benefit-title">1분 만에 끝나는 파이썬 진단</h3>
                <p className="benefit-desc">초급·중급·고급 문제를 골고루 풀며 내 Python 수준을 정확하게 측정해요.</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">👾</span>
              <div>
                <h3 className="benefit-title">나의 파트너 에이몬 분양</h3>
                <p className="benefit-desc">비기너 슬라임부터 고스트까지, 나의 첫 캐릭터가 결정됩니다.</p>
              </div>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">📈</span>
              <div>
                <h3 className="benefit-title">게임하듯 성장하는 커리큘럼</h3>
                <p className="benefit-desc">스테이지를 풀며 에이몬을 진화시키고 보스 인증카드를 얻으세요.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA 버튼 그룹 */}
        <div className="level-test-info-actions">
          <button
            id="btn-register-from-info"
            className="btn btn-primary btn-lg btn-full"
            onClick={() => navigate('/register')}
          >
            ✨ 회원가입하고 시작하기
          </button>
          
          <button
            id="btn-login-from-info"
            className="btn btn-ghost btn-lg btn-full"
            onClick={() => navigate('/auth')}
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            이미 계정이 있어요 (로그인)
          </button>

          <button
            id="btn-back-from-info"
            className="btn btn-ghost"
            onClick={() => navigate('/')}
            style={{ fontSize: '0.85rem', color: 'var(--clr-text-faint)', marginTop: '0.5rem' }}
          >
            뒤로가기
          </button>
        </div>
      </div>
    </div>
  )
}
