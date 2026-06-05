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
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [answerInput, setAnswerInput] = useState('')
  const [aiResult, setAiResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  
  useEffect(() => {
    bossApi.getInfo(lessonId).then(res => {
      setBossData(res.data)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [lessonId])

  const handleStart = async () => {
    try {
      const res = await bossApi.startBattle(lessonId)
      setCurrentQuestion(res.data)
      setPhase('battle')
      setErrorMsg('')
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || '도전 비용이 부족합니다!')
    }
  }
  
  const handleSubmit = async () => {
    if (!currentQuestion) return
    const isCodeType = currentQuestion.type === 'code_input' || currentQuestion.type === 'fill_in_blank'
    const userAnswer = isCodeType ? answerInput : selectedOption
    if (!userAnswer) return

    setLoading(true)
    try {
      const res = await bossApi.submitAnswer({
        question_id: currentQuestion.question_id,
        user_answer: userAnswer,
        is_code_question: isCodeType
      })
      setAiResult(res.data)
      if (res.data.is_correct) {
        setPhase('cleared')
      } else {
        setPhase('failed')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
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
            
            {currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'output_select' ? (
              <div className="battle-choices" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', marginBottom: '16px' }}>
                {currentQuestion.choices?.map((opt, idx) => {
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
            ) : (
              <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                <input 
                  type="text" 
                  value={answerInput} 
                  onChange={(e) => setAnswerInput(e.target.value)} 
                  className="input" 
                  placeholder="정답을 입력하세요" 
                  style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                />
              </div>
            )}
            
            <button 
              className="btn btn-primary btn-lg btn-full" 
              onClick={handleSubmit}
              disabled={(!selectedOption && !answerInput.trim()) || loading}
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
            
            <div className="result-rewards" style={{ margin: '24px 0', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
              <div className="reward-item" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                <span className="reward-icon">⭐</span>
                <span style={{ fontWeight: 700, color: '#a6e3a1', marginLeft: '8px' }}>+{bossData?.xp_reward} XP</span>
              </div>
              <div className="reward-item" style={{ fontSize: '1.1rem' }}>
                <span className="reward-icon">💳</span>
                <span style={{ fontWeight: 700, color: '#f9e2af', marginLeft: '8px' }}>Unit {lessonId} 클리어 인증카드</span>
              </div>
            </div>
            
            <button className="btn btn-primary btn-lg btn-full" onClick={() => navigate('/lesson')}>
              레슨 홈으로 돌아가기
            </button>
          </div>
        )}

        {/* ── 4) 실패 화면 & AI 피드백 ── */}
        {phase === 'failed' && (
          <div className="boss-card result-card card-glass animate-fade-in-up">
            <div className="result-crown" style={{ filter: 'grayscale(1)', opacity: 0.8 }}>💀</div>
            <h1 className="result-title" style={{ color: '#f38ba8' }}>보스 처치 실패...</h1>
            <p className="result-desc">
              아쉽네요. 보스의 체력을 다 깎지 못했습니다.
            </p>
            
            {aiResult?.feedback && (
              <div style={{ marginTop: '24px', textAlign: 'left', background: 'rgba(17, 24, 39, 0.7)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(243, 139, 168, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '1.5rem' }}>🤖</span>
                  <span style={{ fontWeight: 700, color: '#cba6f7' }}>Claude AI 분석</span>
                </div>
                <p style={{ color: '#cdd6f4', lineHeight: 1.6, fontSize: '0.95rem' }}>
                  {aiResult.feedback}
                </p>
                {aiResult.hint && (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', borderLeft: '3px solid #f9e2af' }}>
                    <span style={{ color: '#f9e2af', fontWeight: 600, display: 'block', marginBottom: '4px', fontSize: '0.85rem' }}>💡 힌트</span>
                    <span style={{ color: '#a0a0b0', fontSize: '0.9rem' }}>{aiResult.hint}</span>
                  </div>
                )}
              </div>
            )}
            
            <button className="btn btn-primary btn-lg btn-full" style={{ marginTop: '24px' }} onClick={() => window.location.reload()}>
              다시 도전하기 🔄
            </button>
            <button className="btn btn-ghost btn-full" style={{ marginTop: '12px' }} onClick={() => navigate('/lesson')}>
              레슨 홈으로 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
