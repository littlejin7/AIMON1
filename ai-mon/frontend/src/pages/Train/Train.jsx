import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { trainApi, userApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import QuizCard from '../../components/QuizCard/QuizCard'
import './Train.css'

export default function Train() {
  const { token, user, updateUser } = useAuthStore()
  const navigate = useNavigate()

  const [questions, setQuestions] = useState([])
  const [current, setCurrent]     = useState(0)
  const [loading, setLoading]     = useState(true)
  const [mode, setMode]           = useState('idle') // idle | playing | result
  const [correctCount, setCorrectCount] = useState(0)

  useEffect(() => {
    if (!token) {
      navigate('/auth?mode=login')
    }
  }, [token, navigate])

  const startTraining = async () => {
    setLoading(true)
    try {
      const res = await trainApi.getReview({ limit: 5, course_level: user?.course_level || 'beginner' })
      setQuestions(res.data)
      setCurrent(0)
      setCorrectCount(0)
      setMode('playing')
    } catch (err) {
      alert('문제를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = async ({ correct }) => {
    if (correct) {
      setCorrectCount(c => c + 1)
    }
    setTimeout(() => {
      if (current + 1 < questions.length) {
        setCurrent(current + 1)
      } else {
        finishTraining(correct ? correctCount + 1 : correctCount)
      }
    }, 1200)
  }

  const finishTraining = async (finalCorrect) => {
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

  if (mode === 'idle') {
    return (
      <div className="train-page container">
        <h1 className="train-title">⚔️ 훈련장</h1>
        <p className="train-desc">
          오답 노트와 부족한 개념을 복습하고, 추가 <strong>XP</strong>와 <strong>왕관</strong>을 획득하세요!
        </p>
        <div className="train-card card-glass animate-fade-in-up">
          <div className="train-icon">📚</div>
          <h2>오늘의 복습 훈련</h2>
          <p>내 레벨({user?.course_level})에 맞는 복습 문제 5개가 준비되어 있습니다.</p>
          <button 
            className="btn btn-primary btn-lg btn-full mt-4" 
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
        <div className="train-header">
          <button className="btn btn-ghost btn-sm" onClick={() => setMode('idle')}>✕ 중단하기</button>
          <div className="train-progress">
            {current + 1} / {questions.length}
          </div>
        </div>
        <div className="container">
          <QuizCard key={current} question={q} onAnswer={handleAnswer} />
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
