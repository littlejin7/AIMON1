import { useState } from 'react'
import { LEVEL_TEST_QUESTIONS, calcLevelResult } from './levelTestData'
import LevelTestIntro    from './LevelTestIntro'
import LevelTestQuestion from './LevelTestQuestion'
import LevelTestResult   from './LevelTestResult'

export default function LevelTestModal({ onClose, onFinish, isLoggedIn }) {
  const [step,       setStep]       = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [selected,   setSelected]   = useState(null)
  const [answered,   setAnswered]   = useState(false)
  const [levelKey,   setLevelKey]   = useState(null)

  const handleSelect = (idx) => {
    if (answered) return
    const q = LEVEL_TEST_QUESTIONS[step - 1]
    setSelected(idx)
    setAnswered(true)
    const newWrongCount = wrongCount + (idx !== q.answer ? 1 : 0)
    setTimeout(() => {
      const nextStep = step + 1
      if (nextStep > LEVEL_TEST_QUESTIONS.length) {
        setLevelKey(calcLevelResult(newWrongCount))
        setWrongCount(newWrongCount)
        setStep(LEVEL_TEST_QUESTIONS.length + 1)
      } else {
        setWrongCount(newWrongCount)
        setStep(nextStep)
        setSelected(null)
        setAnswered(false)
      }
    }, 900)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in-up"
        style={{
          background: '#1e1e2e',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '22px', padding: '2rem 1.75rem',
          maxWidth: '420px', width: '100%',
          boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
        }}
      >
        {step === 0 && (
          <LevelTestIntro onStart={() => setStep(1)} onClose={onClose} />
        )}

        {step >= 1 && step <= LEVEL_TEST_QUESTIONS.length && (
          <LevelTestQuestion
            step={step}
            selected={selected}
            answered={answered}
            onSelect={handleSelect}
          />
        )}

        {step === LEVEL_TEST_QUESTIONS.length + 1 && levelKey && (
          <LevelTestResult
            levelKey={levelKey}
            isLoggedIn={isLoggedIn}
            onFinish={onFinish}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
