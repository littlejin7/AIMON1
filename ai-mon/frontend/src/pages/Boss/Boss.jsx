import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { bossApi, userApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import './Boss.css'
import bossIcon from '../../assets/boss_finalorg.png'
import bossClearIcon from '../../assets/boss_finalclear.png'
import bossQnaIcon from '../../assets/boss_finalqna.png'
import bossFailIcon from '../../assets/boss_finalfail.png'
import charSlimeIcon from '../../assets/character_slime.png'
import charRobotIcon from '../../assets/character_robot.png'
import charBubbleIcon from '../../assets/character_bubble.png'
import charGhostIcon from '../../assets/character_final_ghost.png'
import endbossIcon from '../../assets/endboss_finalorg.png'
import endbossClearIcon from '../../assets/endboss_finalvic.png'
import endbossQnaIcon from '../../assets/endboss_finalqna.png'
import endbossfailIcon from '../../assets/endboss_finalqna.png'

export default function Boss() {
  const { lessonId } = useParams()
  const isFinalBoss = lessonId === 'final'
  const navigate = useNavigate()

  const user = useAuthStore(s => s.user)
  const updateUser = useAuthStore(s => s.updateUser)

  const [loading, setLoading] = useState(true)
  // 'intro' | 'battle' | 'cleared' | 'failed'
  const [phase, setPhase]     = useState('intro')
  const [bossData, setBossData] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [answerInput, setAnswerInput] = useState('')
  const [aiResult, setAiResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  // HP & Battle States
  const [myHp, setMyHp] = useState(1000)
  const [bossHp, setBossHp] = useState(1000)
  const [wrongCount, setWrongCount] = useState(0)
  const [bossShake, setBossShake] = useState(false)
  const [myShake, setMyShake] = useState(false)
const [bossHit, setBossHit] = useState(false)
const [screenShake, setScreenShake] = useState(false)
const [attackAnim, setAttackAnim] = useState(false)
const [dmgPopup, setDmgPopup] = useState(null)
const quizCardRef = useRef(null)
  const [initialLevel, setInitialLevel] = useState(1)
  const [levelUpMessage, setLevelUpMessage] = useState('')

  useEffect(() => {
    if (user) {
      setInitialLevel(user.lv || 1)
    }
  }, [user])

  useEffect(() => {
    bossApi.getInfo(lessonId).then(res => {
      setBossData(res.data)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [lessonId])

const playAttackEffect = (damage) => {
  setAttackAnim(true)
  setTimeout(() => {
    setBossHit(true)
    setBossShake(true)
    setDmgPopup(damage)
    setTimeout(() => {
      setBossHit(false)
      setBossShake(false)
      setDmgPopup(null)
      setAttackAnim(false)
    }, 600)
  }, 500)
}

const playHitEffect = () => {
  setMyShake(true)
  setScreenShake(true)
  setTimeout(() => {
    setMyShake(false)
    setScreenShake(false)
  }, 600)
}

  const handleStart = async () => {
    setMyHp(1000)
    setBossHp(1000)
    setWrongCount(0)
    setAiResult(null)
    setSelectedOption(null)
    setAnswerInput('')
    setLoading(true)
    try {
      const res = await bossApi.startBattle(lessonId)
      setCurrentQuestion(res.data)
      setPhase('battle')
      setErrorMsg('')
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || '도전 비용이 부족합니다!')
    } finally {
      setLoading(false)
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
        is_code_question: isCodeType,
        wrong_count: wrongCount,
        my_hp: myHp,
        boss_hp: bossHp
      })
      
      const isCorrect = res.data.is_correct
      const nextMyHp = res.data.my_hp
      const nextBossHp = res.data.boss_hp
      const nextWrongCount = res.data.wrong_count
      const isClear = res.data.is_clear
      
      setAiResult(res.data)
      setMyHp(nextMyHp)
      setBossHp(nextBossHp)
      setWrongCount(nextWrongCount)
      
const damage = bossHp - nextBossHp
if (isCorrect) {
  playAttackEffect(damage > 0 ? damage : 150)
        
        if (isClear) {
          // 승리!
          setTimeout(async () => {
            try {
              const userRes = await userApi.getMe()
              const updatedUser = userRes.data
              updateUser(updatedUser)
              const newLevel = updatedUser.lv || 1
              if (newLevel > initialLevel) {
                setLevelUpMessage(`🎉 레벨업 달성! Lv.${initialLevel} ➔ Lv.${newLevel}`)
              }
            } catch (e) {
              console.error("Failed to update user profile:", e)
            }
            setPhase('cleared')
          }, 1500)
        } else {
          // 다음 문제로 자동 전환 (1.5초 후)
          setTimeout(async () => {
            try {
              setLoading(true)
              const nextRes = await bossApi.nextQuestion(lessonId)
              setCurrentQuestion(nextRes.data)
              setAiResult(null)
              setSelectedOption(null)
              setAnswerInput('')
            } catch (err) {
              console.error(err)
              setAiResult(prev => ({ ...prev, autoAdvanceFailed: true }))
            } finally {
              setLoading(false)
            }
          }, 1500)
        }
} else {
  playHitEffect()
}
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleNextQuestion = async () => {
    if (myHp <= 0 || wrongCount >= 3) {
      setPhase('failed')
      return
    }
    
    setLoading(true)
    try {
      const nextRes = await bossApi.nextQuestion(lessonId)
      setCurrentQuestion(nextRes.data)
      setAiResult(null)
      setSelectedOption(null)
      setAnswerInput('')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async () => {
    handleStart()
  }

  if (loading) {
    return <div className="boss-loading"><div className="spinner" /></div>
  }

  return (
    <div className={`boss-page ${screenShake ? 'screen-shake' : ''}`}>
      <div className="boss-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/lesson/${lessonId}`)}>
          도망가기 🏃
        </button>
      </div>

      <div className="boss-container container">
        
        {/* ── 1) 보스 인트로 ── */}
        {phase === 'intro' && (
          <div className="boss-card intro-card card-glass animate-fade-in-up">
            <div className="boss-avatar animate-float">
              <img src={isFinalBoss ? endbossIcon : bossIcon} alt="보스" />
            </div>
            <h1 className="boss-title">{bossData?.boss_name} 출현!</h1>
            <p className="boss-desc">
              Unit {lessonId}의 모든 지식을 시험할 보스가 나타났습니다.<br/>
              물리치면 특별한 인증카드와 <strong>{bossData?.xp_reward} XP</strong>를 얻을 수 있습니다!
            </p>
            
            {errorMsg && (
              <div style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>
                {errorMsg}
              </div>
            )}

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

        {/* ── 2) 전투 화면 ── */}
        {phase === 'battle' && currentQuestion && (
          <div className="boss-card battle-card card-glass animate-fade-in-up">
            {/* Boss HP Bar */}
            <div className="boss-hp-bar">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 'bold', color: '#f38ba8' }}>😈 {bossData?.boss_name}</span>
                <span>{bossHp} / 1000 HP</span>
              </div>
              <div className="hp-bar" style={{ background: '#313244', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                <div className="hp-fill" style={{ width: `${(bossHp / 1000) * 100}%`, background: '#f38ba8', transition: 'width 0.3s ease', height: '100%' }}></div>
              </div>
            </div>

            {/* Boss Avatar */}
<div style={{ position: 'relative', display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
  <img
    src={isFinalBoss ? endbossQnaIcon : bossQnaIcon}
    alt="보스"
    className={`battle-boss-icon ${bossShake ? 'boss-shake' : ''}`}
    style={{ width: '120px', height: '120px', objectFit: 'contain' }}
  />
  {dmgPopup && <div className="dmg-popup">-{dmgPopup}</div>}
</div>

<div ref={quizCardRef} className={`quiz-attack-wrap ${attackAnim ? 'attack-fly' : ''}`}>
            <h2 className="battle-q-title" style={{ whiteSpace: 'pre-line', fontSize: '1.1rem', marginBottom: '8px' }}>{currentQuestion.question}</h2>

            {/* AI Grading result or Choices */}
            {aiResult ? (
              <div style={{ margin: '16px 0' }}>
                {aiResult.is_correct ? (
                  <div style={{ padding: '16px', background: 'rgba(166,227,161,0.15)', border: '1px solid #a6e3a1', borderRadius: '12px', color: '#a6e3a1', fontWeight: 600, textAlign: 'center' }}>
                    🎉 정답입니다! 보스에게 150 데미지를 입혔습니다!
                    {!aiResult.is_clear && (
                      <div style={{ marginTop: '16px' }}>
                        <button className="btn btn-primary btn-full" onClick={handleNextQuestion}>
                          다음 문제 도전 ➔
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'left', background: 'rgba(17, 24, 39, 0.8)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(243, 139, 168, 0.4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.25rem' }}>🤖</span>
                      <span style={{ fontWeight: 700, color: '#cba6f7' }}>Claude AI 분석</span>
                    </div>
                    <p style={{ color: '#cdd6f4', lineHeight: 1.5, fontSize: '0.9rem', margin: 0 }}>
                      {aiResult.feedback}
                    </p>
                    {aiResult.hint && (
                      <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', borderLeft: '3px solid #f9e2af' }}>
                        <span style={{ color: '#f9e2af', fontWeight: 600, display: 'block', marginBottom: '2px', fontSize: '0.8rem' }}>💡 힌트</span>
                        <span style={{ color: '#a0a0b0', fontSize: '0.85rem' }}>{aiResult.hint}</span>
                      </div>
                    )}
                    
                    <div style={{ marginTop: '16px' }}>
                      {myHp <= 0 || wrongCount >= 3 ? (
                        <button className="btn btn-danger btn-full" onClick={() => setPhase('failed')}>
                          결과 보기 (패배) ➔
                        </button>
                      ) : (
                        <button className="btn btn-primary btn-full" onClick={handleNextQuestion}>
                          다음 문제 도전 ➔
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'output_select' || currentQuestion.type === 'error_find' ? (
                  <div className="battle-choices" style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0' }}>
                    {currentQuestion.choices?.map((opt, idx) => {
                      const optionKey = opt.substring(0, 1)
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
                  <div style={{ margin: '16px 0' }}>
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
              </>
            )}
          </div>
            {/* My HP Bar */}
            <div className="my-hp-bar" style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img 
                src={
                  user?.character === 'robot' ? charRobotIcon :
                  user?.character === 'speech_bubble' ? charBubbleIcon :
                  user?.character === 'final_ghost' ? charGhostIcon :
                  charSlimeIcon
                } 
                alt="내 캐릭터" 
                className={`my-avatar ${myShake ? 'my-shake' : ''}`}
                style={{ width: '40px', height: '40px', objectFit: 'contain' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 'bold', color: '#a6e3a1' }}>🟢 내 에이몬</span>
                  <span>{myHp} / 1000 HP (오답 {wrongCount}/3)</span>
                </div>
                <div className="hp-bar" style={{ background: '#313244', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                  <div className="hp-fill" style={{ width: `${(myHp / 1000) * 100}%`, background: '#a6e3a1', transition: 'width 0.3s ease', height: '100%' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 3) 클리어 화면 ── */}
        {phase === 'cleared' && (
          <div className="boss-card result-card card-glass animate-fade-in-up">
            <div className="result-crown animate-float">
              <img src={isFinalBoss ? endbossClearIcon : bossClearIcon} alt="클리어" />
            </div>
            <h1 className="result-title" style={{ color: '#f59e0b' }}>보스 처치 완료!</h1>
            <p className="result-desc">
              훌륭합니다! 보스를 쓰러뜨리고 전리품을 획득했습니다.
            </p>
            
            <div className="result-rewards" style={{ margin: '24px 0', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
              <div className="reward-item" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                <span className="reward-icon">⭐</span>
                <span style={{ fontWeight: 700, color: '#a6e3a1', marginLeft: '8px' }}>+3000 XP 획득!</span>
              </div>
              <div className="reward-item" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                <span className="reward-icon">💳</span>
                <span style={{ fontWeight: 700, color: '#f9e2af', marginLeft: '8px' }}>{isFinalBoss ? 'Level' : `Unit ${lessonId}`} 클리어 인증카드</span>
              </div>
              {levelUpMessage && (
                <div className="reward-item" style={{ fontSize: '1.1rem', marginTop: '12px', padding: '8px', background: 'rgba(166,227,161,0.15)', borderRadius: '8px', border: '1px dashed #a6e3a1' }}>
                  <span style={{ fontWeight: 700, color: '#a6e3a1' }}>{levelUpMessage}</span>
                </div>
              )}
            </div>
            
            <button className="btn btn-primary btn-lg btn-full" onClick={() => navigate('/lesson')}>
              레슨 홈으로 돌아가기
            </button>
          </div>
        )}

        {/* ── 4) 실패 화면 ── */}
        {phase === 'failed' && (
          <div className="boss-card result-card card-glass animate-fade-in-up">
            <div className="result-crown">
              <img src={isFinalBoss ? endbossfailIcon : bossFailIcon} alt="실패" />
            </div>
            <h1 className="result-title" style={{ color: '#f38ba8' }}>보스 처치 실패...</h1>
            <p className="result-desc">
              아쉽네요. 보스의 체력을 다 깎지 못했습니다.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-primary btn-lg btn-full pulse-btn" onClick={handleRetry}>
                👑 왕관 1개를 소모하고 재도전할까요?
              </button>
              <button className="btn btn-secondary btn-full" onClick={() => navigate('/lesson')}>
                포기하기 (레슨으로 돌아가기)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
