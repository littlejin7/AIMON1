import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { trainApi, userApi, progressApi, quizApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import TrainLocked  from './TrainLocked'
import TrainSession from './TrainSession'
import TrainResult  from './TrainResult'
import TrainHome    from './TrainHome'
import './Train.css'

export default function Train() {
  const { token, user, updateUser } = useAuthStore()
  const navigate = useNavigate()

  const [questions, setQuestions]       = useState([])
  const [currentUnit, setCurrentUnit]   = useState(1)
  const [current, setCurrent]           = useState(0)
  const [loading, setLoading]           = useState(false)
  const [mode, setMode]                 = useState('idle')
  const [correctCount, setCorrectCount] = useState(0)
  const [answers, setAnswers]           = useState({})
  const [checkingLock, setCheckingLock] = useState(true)
  const [isLocked, setIsLocked]         = useState(false)
  const [wrongCount, setWrongCount]     = useState(0)
  const [wrongAnswers, setWrongAnswers] = useState([])
  const [unitAccuracy, setUnitAccuracy] = useState([])
  const [lessons, setLessons]           = useState([])

  useEffect(() => {
    if (!token) { setCheckingLock(false); return }

    const init = async () => {
      try {
        const [progressRes, lessonsRes] = await Promise.all([
          progressApi.getProgress(user?.course_level || 'beginner'),
          quizApi.getUnits(user?.course_level || 'beginner').catch(() => ({ data: [] })),
        ])
        const prog = progressRes.data || []

        const isUnit1BossCleared = prog.some(p => p.unit === 1 && p.stage === '1-boss' && p.is_completed)
        setIsLocked(!isUnit1BossCleared)

        const ls = lessonsRes.data || []
        setLessons(ls)

        try {
          const reviewRes = await trainApi.getReview({ limit: 50, course_level: user?.course_level || 'beginner' })
          const wq = reviewRes.data || []
          setWrongCount(wq.length)
          setWrongAnswers(wq.slice(0, 3))
        } catch {}

        if (ls.length > 0) {
          const accuracy = ls
            .filter((l, i) => i < 2 || prog.some(p => p.unit === l.unit_id && p.is_completed))
            .slice(0, 4)
            .map(l => {
              const unitProg = prog.filter(p => p.unit === l.unit_id)
              const done = unitProg.filter(p => p.is_completed).length
              const total = unitProg.length
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              return { unit_id: l.unit_id, title: l.title, pct }
            })
          setUnitAccuracy(accuracy)
        }

        const cacheKey = user?.id ? `is_train_unlocked_${user.id}` : 'is_train_unlocked'
        localStorage.setItem(cacheKey, isUnit1BossCleared ? 'true' : 'false')
      } catch (err) {
        console.error(err)
      } finally {
        setCheckingLock(false)
      }
    }
    init()
  }, [token, user])

  const startTraining = async (unitNum) => {
    if (!token) { alert('로그인이 필요한 기능입니다.'); navigate('/auth'); return }
    setLoading(true)
    try {
      const res = await trainApi.getReview({ unit: unitNum, limit: 15, course_level: user?.course_level || 'beginner' })
      setQuestions(res.data)
      setCurrent(0)
      setAnswers({})
      setCorrectCount(0)
      setMode('playing')
    } catch {
      alert('문제를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = async ({ correct, userAnswer, retried }) => {
    const q = questions[current]
    setAnswers(prev => {
      const existing = prev[current]
      const isFirstAttemptCorrect = existing ? existing.isFirstAttemptCorrect : correct
      return {
        ...prev,
        [current]: {
          selected: userAnswer, input: userAnswer, revealed: true,
          isCorrectResult: correct, isFirstAttemptCorrect,
          aiFeedback: existing?.aiFeedback || ''
        }
      }
    })
    if (correct && !retried && q?.question_id) {
      try { await trainApi.updateReviewed({ question_id: q.question_id }) } catch {}
    }
    if (correct) {
      setTimeout(() => {
        if (current + 1 < questions.length) {
          setCurrent(current + 1)
        } else {
          setAnswers(prev => {
            const tempAnswers = { ...prev, [current]: { ...prev[current], isFirstAttemptCorrect: correct } }
            const finalCorrect = Object.values(tempAnswers).filter(a => a.isFirstAttemptCorrect).length
            setTimeout(() => finishTraining(finalCorrect), 0)
            return tempAnswers
          })
        }
      }, 1200)
    }
  }

  const handleNext = () => {
    if (current + 1 < questions.length) {
      setCurrent(current + 1)
    } else {
      const finalCorrect = Object.values(answers).filter(a => a.isFirstAttemptCorrect).length
      finishTraining(finalCorrect)
    }
  }

  const finishTraining = async (finalCorrect) => {
    setCorrectCount(finalCorrect)
    setMode('result')
    if (finalCorrect === questions.length) {
      try {
        const res = await userApi.updateMe({ xp: (user.xp || 0) + 100, crowns: (user.crowns || 0) + 1 })
        updateUser(res.data)
      } catch {}
    }
  }

  // ── 로딩 스피너 ──
  if (checkingLock && token) {
    return (
      <div className="tr-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (isLocked) return <TrainLocked />

  if (mode === 'playing') {
    return (
      <TrainSession
        questions={questions}
        current={current}
        answers={answers}
        onStop={() => setMode('idle')}
        onPrev={() => setCurrent(p => Math.max(0, p - 1))}
        onNext={handleNext}
        onAnswer={handleAnswer}
        onFeedbackUpdate={(idx, text) => setAnswers(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), aiFeedback: text } }))}
        finishTraining={finishTraining}
      />
    )
  }

  if (mode === 'result') {
    return (
      <TrainResult
        correctCount={correctCount}
        total={questions.length}
        onDone={() => setMode('idle')}
      />
    )
  }

  return (
    <TrainHome
      currentUnit={currentUnit}
      setCurrentUnit={setCurrentUnit}
      wrongCount={wrongCount}
      wrongAnswers={wrongAnswers}
      unitAccuracy={unitAccuracy}
      loading={loading}
      onStart={startTraining}
    />
  )
}
