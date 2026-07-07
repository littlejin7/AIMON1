import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { trainApi, progressApi, quizApi, attemptsApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import TrainLocked       from './TrainLocked'
import TrainSession      from './TrainSession'
import TrainResult       from './TrainResult'
import TrainHome         from './TrainHome'
import CodeViewer        from './CodeViewer'
import './Train.css'

export default function Train() {
  const { token, user } = useAuthStore()
  const navigate = useNavigate()

  const [questions, setQuestions]         = useState([])
  const [currentUnit, setCurrentUnit]     = useState(null)          // null = 전체
  const [trainingLevel, setTrainingLevel] = useState(null)          // null → user.course_level
  const [trainSubMode, setTrainSubMode]   = useState('train')       // 'train'|'random'|'boss_rush'
  const [current, setCurrent]             = useState(0)
  const [loading, setLoading]             = useState(false)
  const [mode, setMode]                   = useState('idle')
  const [correctCount, setCorrectCount]   = useState(0)
  const [answers, setAnswers]             = useState({})
  const [checkingLock, setCheckingLock]   = useState(true)
  const [isLocked, setIsLocked]           = useState(false)
  const [showLoginPopup, setShowLoginPopup] = useState(false)
  const [wrongCount, setWrongCount]           = useState(0)
  const [wrongAnswers, setWrongAnswers]       = useState([])
  const [unitAccuracy, setUnitAccuracy]       = useState([])
  const [lessons, setLessons]                 = useState([])
  const [completedStageCount, setCompletedStageCount] = useState(0)

  const activeLevel = trainingLevel || user?.course_level || 'beginner'

  // 잠금 체크 — 로그인 후 1회
  useEffect(() => {
    if (!token) { setCheckingLock(false); return }
    const checkLock = async () => {
      try {
        const [progressRes, lessonsRes] = await Promise.all([
          progressApi.getProgress(user?.course_level || 'beginner'),
          quizApi.getUnits(user?.course_level || 'beginner').catch(() => ({ data: [] })),
        ])
        const prog = progressRes.data || []
        const isUnit1BossCleared = prog.some(p => p.unit === 1 && p.stage === '1-boss' && p.is_completed)
        setIsLocked(!isUnit1BossCleared)
        setCompletedStageCount(prog.filter(p => p.is_completed).length)
        setLessons(lessonsRes.data || [])
        const cacheKey = user?.id ? `is_train_unlocked_${user.id}` : 'is_train_unlocked'
        localStorage.setItem(cacheKey, isUnit1BossCleared ? 'true' : 'false')
      } catch (err) {
        console.error(err)
      } finally {
        setCheckingLock(false)
      }
    }
    checkLock()
  }, [token, user])

  // 오답·정답률 fetch — 레벨 전환 시 재실행
  useEffect(() => {
    if (!token) return
    const fetchStats = async () => {
      try {
        const reviewRes = await trainApi.getReview({
          limit: 50, course_level: activeLevel,
          only_wrong: true,
          ...(currentUnit !== null ? { unit: currentUnit } : {}),
        })
        const wq = reviewRes.data || []
        setWrongCount(wq.length)
        setWrongAnswers(wq.slice(0, 3))
      } catch {}
      try {
        const accRes = await trainApi.getAccuracy(activeLevel)
        const titleByUnit = Object.fromEntries(lessons.map(l => [l.unit_id, l.title]))
        setUnitAccuracy(
          (accRes.data || [])
            .slice(0, 4)
            .map(a => ({ unit_id: a.unit, title: titleByUnit[a.unit] || `Unit ${a.unit}`, pct: a.pct }))
        )
      } catch {}
    }
    fetchStats()
  }, [token, activeLevel, currentUnit, lessons])

  // 레벨 전환 시 유닛 선택 초기화
  const handleLevelChange = (lv) => {
    setTrainingLevel(lv)
    setCurrentUnit(null)
  }

  // 비로그인 시 로그인 팝업을 띄우고 true 반환
  const requireLogin = () => {
    if (!token) { setShowLoginPopup(true); return true }
    return false
  }
  const showCodeViewer = () => {
    if (requireLogin()) return
    setMode('code_viewer')
  }

  const startRandom = async () => {
    if (requireLogin()) return
    setLoading(true)
    try {
      const res = await trainApi.getRandom({ n: 10, course_level: activeLevel })
      if (!res.data || res.data.length === 0) {
        alert('랜덤 훈련을 하려면 먼저 스테이지를 하나 이상 클리어해보세요!')
        return
      }
      setTrainSubMode('random')
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

  const startTraining = async ({ onlyWrong = false, unit = currentUnit } = {}) => {
    if (requireLogin()) return
    setLoading(true)
    try {
      const params = {
        limit: 15,
        only_wrong: onlyWrong,
        course_level: activeLevel,
        ...(unit !== null ? { unit } : {}),
      }
      const res = await trainApi.getReview(params)
      if (onlyWrong && (!res.data || res.data.length === 0)) {
        alert('복습할 오답이 없어요! 먼저 퀴즈를 풀어보세요 🙌')
        return
      }
      setTrainSubMode('train')
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

  const handleAnswer = async ({ userAnswer, retried, clientIsCorrect }) => {
    const q = questions[current]
    const qType = q?.quiz_type || q?.type
    const isCodeType = qType === 'code_input'
    const qid = q?.question_id || q?.id || ''

    // 서버 채점 겸 기록(F): 정답이 클라에 없으므로 서버가 user_answer 를 재채점한다.
    // code_input 은 /code/submit(QuizCard) 결과를 clientIsCorrect 로 중계.
    let correct = isCodeType ? !!clientIsCorrect : false
    let result = { is_correct: correct, feedback: '', hint: '', correct_answer: '' }
    if (token && qid) {
      try {
        const res = await attemptsApi.record({
          question_id: qid,
          unit:        q.unit || currentUnit,
          stage:       null,
          level:       activeLevel,
          mode:        trainSubMode,
          is_correct:  correct,
          user_answer: isCodeType ? undefined : userAnswer,
        })
        const d = res?.data || {}
        correct = !!d.is_correct
        result = { is_correct: correct, feedback: d.feedback || '', hint: d.hint || '', correct_answer: d.correct_answer ?? '' }
      } catch {
        // 채점 호출 실패 → 코드는 clientIsCorrect 유지, 객관식은 오답 처리(보수적)
      }
    }
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
    return result   // QuizCard 가 reveal(정답 하이라이트·피드백)에 사용
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
  }

  //if (!token) return <TrainLocked reason="login" />   // 비로그인 잠금화면

  if (checkingLock && token) {
    return (
      <div className="tr-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (isLocked) return <TrainLocked />


  if (mode === 'code_viewer') {
    return (
      <CodeViewer
        onBack={() => setMode('idle')}
      />
    )
  }
  
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
    <>
      <TrainHome
        currentUnit={currentUnit}
        setCurrentUnit={setCurrentUnit}
        trainingLevel={activeLevel}
        setTrainingLevel={handleLevelChange}
        maxUnit={lessons.length || 8}
        userCourseLevel={user?.course_level || 'beginner'}
        hasCompletedStages={completedStageCount > 0}
        wrongCount={wrongCount}
        wrongAnswers={wrongAnswers}
        unitAccuracy={unitAccuracy}
        loading={loading}
        onStart={startTraining}
        onStartRandom={startRandom}
        onOpenCodeViewer={showCodeViewer}
      />

      {showLoginPopup && (
        <div className="tr-login-overlay" onClick={() => setShowLoginPopup(false)}>
          <div className="tr-login-popup" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
            <h3 className="tr-login-title">로그인이 필요해요</h3>
            <p className="tr-login-desc">훈련을 진행하려면 로그인해주세요.</p>
            <button className="btn btn-primary btn-lg btn-full" onClick={() => navigate('/auth')}>
              로그인하러 가기
            </button>
            <button className="tr-login-close-btn" onClick={() => setShowLoginPopup(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  )
}
