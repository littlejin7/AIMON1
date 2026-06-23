import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { trainApi, userApi, progressApi, quizApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import QuizCard from '../../components/QuizCard/QuizCard'
import './Train.css'

export default function Train() {
  const { token, user, updateUser } = useAuthStore()
  const navigate = useNavigate()

  const [questions, setQuestions] = useState([])
  const [currentUnit, setCurrentUnit] = useState(1)
  const [current, setCurrent]     = useState(0)
  const [loading, setLoading]     = useState(false)
  const [mode, setMode]           = useState('idle') // idle | playing | result
  const [correctCount, setCorrectCount] = useState(0)
  const [answers, setAnswers]     = useState({})
  const [checkingLock, setCheckingLock] = useState(true)
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    if (!token) {
      setCheckingLock(false)
      setIsLocked(false)
      return
    }

    const checkLockState = async () => {
      try {
        const progressRes = await progressApi.getProgress()
        const progress = progressRes.data || []
        const isUnit1BossCleared = progress.some(p => p.unit === 1 && p.stage === "1-boss" && p.is_completed)
        setIsLocked(!isUnit1BossCleared)
        
        // Cache to localStorage for NavBar visual representation
        const cacheKey = user?.id ? `is_train_unlocked_${user.id}` : 'is_train_unlocked'
        localStorage.setItem(cacheKey, isUnit1BossCleared ? 'true' : 'false')
      } catch (err) {
        console.error('Failed to verify training lock state:', err)
      } finally {
        setCheckingLock(false)
      }
    }

    checkLockState()
  }, [token, navigate, user])

  const startTraining = async () => {
    if (!token) {
      alert('로그인이 필요한 기능입니다.')
      navigate('/auth')
      return
    }
    setLoading(true)
    try {
      const res = await trainApi.getReview({ unit: currentUnit, limit: 15, course_level: user?.course_level || 'beginner' })
      setQuestions(res.data)
      setCurrent(0)
      setAnswers({})
      setCorrectCount(0)
      setMode('playing')
    } catch (err) {
      alert('문제를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = async ({ correct, userAnswer, retried }) => {
    const q = questions[current]
    
    // answers 상태 업데이트
    setAnswers(prev => {
      const existing = prev[current];
      // 기존 제출 기록이 없으면 (첫 시도) correct 값을 첫 시도 결과로 기록
      const isFirstAttemptCorrect = existing ? existing.isFirstAttemptCorrect : correct;
      
      return {
        ...prev,
        [current]: {
          selected: userAnswer,
          input: userAnswer,
          revealed: true,
          isCorrectResult: correct,
          isFirstAttemptCorrect: isFirstAttemptCorrect,
          aiFeedback: existing?.aiFeedback || ''
        }
      }
    })

    if (correct && !retried) {
      if (q && q.question_id) {
        try {
          await trainApi.updateReviewed({ question_id: q.question_id })
        } catch (err) {
          console.error('Failed to update reviewed status:', err)
        }
      }
    }
    
    // 정답인 경우에만 1.2초 후 자동으로 다음 문제로 넘어감.
    // 오답인 경우 AI 피드백을 충분히 읽을 수 있도록 자동 전환을 하지 않음.
    if (correct) {
      setTimeout(() => {
        if (current + 1 < questions.length) {
          setCurrent(current + 1)
        } else {
          setAnswers(prev => {
            const currentObj = prev[current];
            const isFirstAttemptCorrect = currentObj ? currentObj.isFirstAttemptCorrect : correct;
            const tempAnswers = {
              ...prev,
              [current]: {
                selected: userAnswer,
                input: userAnswer,
                revealed: true,
                isCorrectResult: correct,
                isFirstAttemptCorrect: isFirstAttemptCorrect,
                aiFeedback: currentObj?.aiFeedback || ''
              }
            };
            const finalCorrect = Object.values(tempAnswers).filter(ans => ans.isFirstAttemptCorrect).length;
            setTimeout(() => finishTraining(finalCorrect), 0);
            return tempAnswers;
          });
        }
      }, 1200)
    }
  }

  const handleNext = () => {
    if (current + 1 < questions.length) {
      setCurrent(current + 1)
    } else {
      const finalCorrect = Object.values(answers).filter(ans => ans.isFirstAttemptCorrect).length
      finishTraining(finalCorrect)
    }
  }

  const finishTraining = async (finalCorrect) => {
    setCorrectCount(finalCorrect)
    setMode('result')
    // 보상 지급 (예: 다 맞추면 왕관 +1, XP +100)
    if (finalCorrect === questions.length) {
      try {
        const res = await userApi.updateMe({ xp: (user.xp || 0) + 100, crowns: (user.crowns || 0) + 1 })
        updateUser(res.data)
      } catch (e) {
        console.error(e)
      }
    }
  }

  if (checkingLock && token) {
    return (
      <div className="train-page container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
        <p style={{ marginTop: '1rem', color: 'var(--clr-text-muted)', fontWeight: 600 }}>진행도를 확인하고 있습니다...</p>
      </div>
    )
  }

  if (isLocked) {
    return (
      <div className="train-page container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
        <div className="train-card card-glass animate-fade-in-up" style={{ maxWidth: '480px', padding: '3rem 2rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="train-icon" style={{ fontSize: '3.5rem', marginBottom: '1rem', textShadow: '0 0 20px rgba(124,58,237,0.3)' }}>🔒</div>
          <h2 style={{ color: 'var(--clr-text-bright)', marginBottom: '0.8rem', fontSize: '1.75rem', fontWeight: 800 }}>훈련장 잠김</h2>
          <p style={{ color: 'var(--clr-text-muted)', lineHeight: '1.6', marginBottom: '2rem' }}>
            파이썬의 기초를 배우는 <strong>Unit 1</strong>을 모두 완료하면<br />
            실력을 복습하고 성장시킬 수 있는 훈련장이 해금됩니다!
          </p>
          <button className="btn btn-primary btn-lg btn-full" onClick={() => navigate('/lesson')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              레슨으로 가기
            </span>
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'idle') {
    return (
      <div className="train-page container">
        <h1 className="train-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>
            <line x1="13" y1="19" x2="19" y2="13"/>
            <line x1="16" y1="16" x2="20" y2="20"/>
            <line x1="19" y1="21" x2="21" y2="19"/>
          </svg>
          훈련장
        </h1>
        <p className="train-desc">
          오답 노트와 부족한 개념을 복습하고, 추가 <strong>XP</strong>와 <strong>왕관</strong>을 획득하세요!
        </p>
        <div className="train-card card-glass animate-fade-in-up" style={{ textAlign: 'center' }}>
          <div className="train-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <h2>오늘의 복습 훈련</h2>
          <p>내 레벨({user?.course_level})에 맞는 복습 문제 15개가 준비되어 있습니다.</p>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', margin: '1.5rem 0' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(u => (
              <button
                key={u}
                className={`btn btn-sm ${currentUnit === u ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCurrentUnit(u)}
                style={{ flex: '1 1 calc(25% - 8px)', minWidth: '70px' }}
              >
                Unit {u}
              </button>
            ))}
          </div>

          <button 
            className="btn btn-primary btn-lg btn-full mt-2" 
            onClick={startTraining}
            disabled={loading}
          >
            {loading ? '로딩 중...' : '훈련 시작하기'}
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'playing') {
    const q = questions[current]
    return (
      <div className="train-page">
        <div className="train-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setMode('idle')}>✕ 중단하기</button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="btn btn-outline btn-sm" 
              onClick={() => setCurrent(prev => Math.max(0, prev - 1))}
              disabled={current === 0}
              style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem' }}
            >
              ◀ 이전
            </button>
            <div className="train-progress" style={{ minWidth: '60px', textAlign: 'center', fontWeight: 700, fontSize: '0.95rem' }}>
              {current + 1} / {questions.length}
            </div>
            <button 
              className="btn btn-outline btn-sm" 
              onClick={() => {
                if (current + 1 < questions.length) {
                  setCurrent(current + 1)
                } else {
                  const finalCorrect = Object.values(answers).filter(ans => ans.isFirstAttemptCorrect).length
                  finishTraining(finalCorrect)
                }
              }}
              style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem' }}
            >
              {current === questions.length - 1 ? '완료 ▶' : '다음 ▶'}
            </button>
          </div>
        </div>
        <div className="container">
          <QuizCard 
            key={current} 
            question={q} 
            onAnswer={handleAnswer} 
            onNext={handleNext}
            initialSelected={answers[current]?.selected}
            initialInput={answers[current]?.input}
            initialRevealed={answers[current]?.revealed}
            initialAiFeedback={answers[current]?.aiFeedback}
            initialIsCorrectResult={answers[current]?.isCorrectResult}
            onFeedbackUpdate={(text) => {
              setAnswers(prev => ({
                ...prev,
                [current]: {
                  ...(prev[current] || {}),
                  aiFeedback: text
                }
              }))
            }}
          />
        </div>
      </div>
    )
  }

  if (mode === 'result') {
    const isPerfect = correctCount === questions.length
    return (
      <div className="train-page container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div className="result-icon animate-float">{isPerfect ? '🎉' : '👏'}</div>
        <h2 className="result-title">{isPerfect ? '완벽합니다!' : '훈련 완료!'}</h2>
        <p className="result-desc">
          {questions.length}문제 중 {correctCount}개 정답
        </p>
        {isPerfect && (
          <div className="result-reward" style={{ marginTop: '2rem', background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '12px' }}>
            <strong style={{ color: '#10b981' }}>완벽 보상 획득!</strong>
            <p style={{ margin: '0.5rem 0 0', color: '#a6e3a1' }}>+100 XP / +1 왕관 👑</p>
          </div>
        )}
        <div style={{ marginTop: '3rem' }}>
          <button className="btn btn-primary btn-lg" onClick={() => setMode('idle')}>
            훈련 종료
          </button>
        </div>
      </div>
    )
  }
}
