import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { bossApi } from '../../api/index'
import './Boss.css'

export default function Boss() {
  const { lessonId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  // 'intro' | 'battle' | 'cleared' | 'failed'
  const [phase, setPhase]     = useState('intro')
  const [bossData, setBossData] = useState(null)
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState(null)
  
  // 모의 데이터 (boss_beg_output_select.json)
  useEffect(() => {
    setTimeout(() => {
      setBossData({
        boss_name: "코드몬 Unit 1 보스",
        xp_reward: 2000,
        hints_allowed: 2,
        free_attempts_per_day: 2,
        crown_cost_from_attempt: 3,
        questions: [
          {
            question_id: "boss_beg_os_1_001",
            type: "output_select",
            question: "다음 코드의 출력값을 고르세요.\n\nprint('코드몬' + '을' + ' 물리쳐라!')\n# print('게임 오버')\nprint('승리!')",
            choices: ["A. 코드몬을 물리쳐라! / 게임 오버 / 승리!", "B. 코드몬을 물리쳐라! / 승리!", "C. 코드몬 + 을 + 물리쳐라! / 승리!", "D. 오류 발생"],
            answer: "B",
            explanation: "+ 는 문자열을 이어붙이고, # 주석 줄은 무시돼요. 출력되는 줄은 2개예요."
          }
        ]
      })
      setLoading(false)
    }, 600)
  }, [lessonId])

  const currentQuestion = bossData?.questions[currentQIndex]

  const handleStart = () => setPhase('battle')
  
  const handleSubmit = () => {
    if (!selectedOption) return
    // 정오답 상관없이 현재는 바로 클리어 처리 (뼈대)
    setPhase('cleared')
  }

  if (loading) {
    return <div className="boss-loading"><div className="spinner" /></div>
  }

  return (
    <div className="boss-page">
      <div className="boss-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/lesson/${lessonId}`)}>
          도망가기 🏃
        </button>
      </div>

      <div className="boss-container container">
        
        {/* ── 1) 보스 인트로 ── */}
        {phase === 'intro' && (
          <div className="boss-card intro-card card-glass animate-fade-in-up">
            <div className="boss-avatar animate-float">👾</div>
            <h1 className="boss-title">{bossData?.boss_name} 출현!</h1>
            <p className="boss-desc">
              Unit {lessonId}의 모든 지식을 시험할 보스가 나타났습니다.<br/>
              물리치면 특별한 인증카드와 <strong>{bossData?.xp_reward} XP</strong>를 얻을 수 있습니다!
            </p>
            
            <div style={{ margin: '8px 0 16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.9rem', color: '#a0a0b0', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>도전 비용:</span>
                <span style={{ color: '#34d399' }}>무료 (오늘 {bossData?.free_attempts_per_day}회 남음)</span>
              </div>
              {bossData?.hints_allowed > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>도움말:</span>
                  <span>힌트 {bossData?.hints_allowed}회 사용 가능 (👑 소모)</span>
                </div>
              )}
              {bossData?.hints_allowed === 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>도움말:</span>
                  <span style={{ color: '#ef4444' }}>파이널 보스 (힌트 사용 불가)</span>
                </div>
              )}
            </div>

            <button className="btn btn-primary btn-lg btn-full pulse-btn" onClick={handleStart}>
              전투 시작 ⚔️
            </button>
          </div>
        )}

        {/* ── 2) 전투 화면 (선택지 뼈대) ── */}
        {phase === 'battle' && currentQuestion && (
          <div className="boss-card battle-card card-glass animate-fade-in-up">
            <div className="battle-header">
              <span className="battle-boss-icon">👾</span>
              <div className="battle-boss-hp">
                <div className="hp-bar"><div className="hp-fill" style={{ width: '100%' }}></div></div>
                <span>HP 100%</span>
              </div>
              {bossData?.hints_allowed > 0 && (
                <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', color: '#cdd6f4', border: '1px solid rgba(255,255,255,0.2)' }}>
                  💡 힌트 ({bossData?.hints_allowed})
                </button>
              )}
            </div>
            
            <h2 className="battle-q-title" style={{ whiteSpace: 'pre-line' }}>{currentQuestion.question}</h2>
            
            <div className="battle-choices" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', marginBottom: '16px' }}>
              {currentQuestion.choices.map((opt, idx) => {
                const optionKey = opt.substring(0, 1) // "A", "B", "C", "D"
                return (
                  <button
                    key={idx}
                    className={`btn ${selectedOption === optionKey ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ 
                      textAlign: 'left', 
                      padding: '12px 16px', 
                      justifyContent: 'flex-start',
                      border: selectedOption === optionKey ? '1px solid var(--clr-primary)' : '1px solid rgba(255,255,255,0.1)'
                    }}
                    onClick={() => setSelectedOption(optionKey)}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
            
            <button 
              className="btn btn-primary btn-lg btn-full" 
              onClick={handleSubmit}
              disabled={!selectedOption}
            >
              공격하기 🚀
            </button>
          </div>
        )}

        {/* ── 3) 클리어 화면 ── */}
        {phase === 'cleared' && (
          <div className="boss-card result-card card-glass animate-fade-in-up">
            <div className="result-crown animate-float">👑</div>
            <h1 className="result-title" style={{ color: '#f59e0b' }}>보스 처치 완료!</h1>
            <p className="result-desc">
              훌륭합니다! 보스를 쓰러뜨리고 전리품을 획득했습니다.
            </p>
            
            <div className="result-rewards">
              <div className="reward-item">
                <span className="reward-icon">⭐</span>
                <span>+{bossData?.xp_reward} XP</span>
              </div>
              <div className="reward-item">
                <span className="reward-icon">💳</span>
                <span>클리어 인증카드</span>
              </div>
            </div>
            
            <button className="btn btn-primary btn-lg btn-full" onClick={() => navigate('/lesson')}>
              레슨 홈으로 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
