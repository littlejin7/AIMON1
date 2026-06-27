import { useState, useEffect, useRef } from 'react'
import { LEVEL_TEST_QUESTIONS, calcLevelResult } from './levelTestData'
import LevelTestIntro    from './LevelTestIntro'
import LevelTestQuestion from './LevelTestQuestion'
import LevelTestLoading  from './LevelTestLoading'
import LevelTestResult   from './LevelTestResult'
import { authApi }       from '../../api'

const TOTAL = LEVEL_TEST_QUESTIONS.length

export default function LevelTestModal({ onClose, onFinish, isLoggedIn, forced = false }) {
  const [step,         setStep]         = useState(0)
  const [selected,     setSelected]     = useState(null)
  const [answered,     setAnswered]     = useState(false)
  const [levelKey,     setLevelKey]     = useState(null)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [skipped,      setSkipped]      = useState(0)
  const [seconds,      setSeconds]      = useState(180)
  const [correctByLevel, setCorrectByLevel] = useState({ beginner: 0, intermediate: 0, advanced: 0 })
  const [categoryPercentages, setCategoryPercentages] = useState({ syntax: 0, structure: 0, control: 0 })
  const [updatedUser, setUpdatedUser] = useState(null)

  // ref로 최신 correctByLevel 즉시 접근 (handleNext에서 async state 문제 방지)
  const cblRef = useRef({ beginner: 0, intermediate: 0, advanced: 0 })
  const answersRef = useRef([])

  // 문제 풀이 중 카운트다운 타이머
  useEffect(() => {
    if (step < 1 || step > TOTAL) return
    const id = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [step])

  const timerLabel = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  const handleStart = () => {
    setSeconds(180)
    setStep(1)
  }

  const handleSelect = (idx) => {
    if (answered) return
    const q = LEVEL_TEST_QUESTIONS[step - 1]
    setSelected(idx)
    setAnswered(true)

    const existingIdx = answersRef.current.findIndex(a => a.questionId === q.id)
    if (existingIdx > -1) {
      answersRef.current[existingIdx] = { questionId: q.id, selectedAnswer: idx }
    } else {
      answersRef.current.push({ questionId: q.id, selectedAnswer: idx })
    }

    const isCorrect = idx === q.answer
    if (isCorrect) {
      cblRef.current = { ...cblRef.current, [q.level]: cblRef.current[q.level] + 1 }
      setCorrectByLevel({ ...cblRef.current })
      setTotalCorrect(c => c + 1)
    }
  }

  const advance = async () => {
    const nextStep = step + 1
    if (nextStep > TOTAL) {
      setStep(TOTAL + 1)                          // 분석 로딩
      try {
        const response = await authApi.submitLevelTest({ answers: answersRef.current })
        const data = response.data
        setLevelKey(data.levelKey)
        setTotalCorrect(data.totalCorrect)
        setCategoryPercentages(data.categoryPercentages)
        if (data.user) {
          setUpdatedUser(data.user)
        }
      } catch (err) {
        console.error('Submit level test failed, fallback to local calc', err)
        const lk = calcLevelResult(cblRef.current)
        setLevelKey(lk)
        const localCat = { syntax: 0, structure: 0, control: 0 }
        answersRef.current.forEach(ans => {
          const q = LEVEL_TEST_QUESTIONS.find(item => item.id === ans.questionId)
          if (q && ans.selectedAnswer === q.answer) {
            localCat[q.category] = (localCat[q.category] || 0) + 1
          }
        })
        const pct = {
          syntax: Math.round((localCat.syntax / 4) * 100),
          structure: Math.round((localCat.structure / 2) * 100),
          control: Math.round((localCat.control / 4) * 100)
        }
        setCategoryPercentages(pct)
      } finally {
        setTimeout(() => setStep(TOTAL + 2), 2600)  // 결과 화면
      }
    } else {
      setStep(nextStep)
      setSelected(null)
      setAnswered(false)
    }
  }

  const handleNext = () => { if (answered) advance() }
  const handleSkip = () => {
    const q = LEVEL_TEST_QUESTIONS[step - 1]
    const existingIdx = answersRef.current.findIndex(a => a.questionId === q.id)
    if (existingIdx > -1) {
      answersRef.current[existingIdx] = { questionId: q.id, selectedAnswer: -1 }
    } else {
      answersRef.current.push({ questionId: q.id, selectedAnswer: -1 })
    }
    setSkipped(s => s + 1)
    advance()
  }
  const handleBack = () => {
    if (step <= 1) { setStep(0); return }
    setStep(step - 1)
    setSelected(null)
    setAnswered(false)
  }

  return (
    <div
      onClick={forced ? undefined : onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="level-test-modal-inner"
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '100%', maxWidth: '400px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 8px 40px rgba(83,74,183,.28)',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {step === 0 && (
          <LevelTestIntro onStart={handleStart} onClose={forced ? undefined : onClose} />
        )}

        {step >= 1 && step <= TOTAL && (
          <LevelTestQuestion
            step={step}
            total={TOTAL}
            selected={selected}
            answered={answered}
            timer={timerLabel}
            onSelect={handleSelect}
            onNext={handleNext}
            onSkip={handleSkip}
            onBack={handleBack}
          />
        )}

        {step === TOTAL + 1 && (
          <LevelTestLoading />
        )}

        {step === TOTAL + 2 && levelKey && (
          <LevelTestResult
            levelKey={levelKey}
            correctByLevel={correctByLevel}
            categoryPercentages={categoryPercentages}
            totalCorrect={totalCorrect}
            total={TOTAL}
            skipped={skipped}
            isLoggedIn={isLoggedIn}
            updatedUser={updatedUser}
            onFinish={onFinish}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
