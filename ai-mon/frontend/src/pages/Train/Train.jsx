import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { trainApi, userApi, progressApi, quizApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import QuizCard from '../../components/QuizCard/QuizCard'
import './Train.css'

const TRAIN_MODES = [
  {
    id: 'wrong',
    icon: '🔁',
    iconBg: '#FCEBEB',
    name: '오답 복습',
    desc: '틀린 문제만 모아서 다시 풀기',
  },
  {
    id: 'unit',
    icon: '🔄',
    iconBg: '#EEEDFE',
    name: '유닛 반복',
    desc: '완료한 유닛 전체를 다시 훈련',
  },
  {
    id: 'random',
    icon: '⚡',
    iconBg: '#EAF3DE',
    name: '랜덤 퀴즈',
    desc: '전 범위에서 랜덤 10문제',
    reward: '+2,000 XP',
  },
  {
    id: 'boss',
    icon: '🔒',
    iconBg: '#F0EFF8',
    name: '보스 특훈',
    desc: '유닛 보스 패턴 집중 연습',
    locked: true,
    lockHint: 'Unit 2 완료 후 해금',
  },
]

export default function Train() {
  const { token, user, updateUser } = useAuthStore()
  const navigate = useNavigate()

  const [questions, setQuestions]   = useState([])
  const [currentUnit, setCurrentUnit] = useState(1)
  const [current, setCurrent]       = useState(0)
  const [loading, setLoading]       = useState(false)
  const [mode, setMode]             = useState('idle')
  const [correctCount, setCorrectCount] = useState(0)
  const [answers, setAnswers]       = useState({})
  const [checkingLock, setCheckingLock] = useState(true)
  const [isLocked, setIsLocked]     = useState(false)
  const [wrongCount, setWrongCount] = useState(0)
  const [wrongAnswers, setWrongAnswers] = useState([])
  const [unitAccuracy, setUnitAccuracy] = useState([])
  const [lessons, setLessons]       = useState([])
  const [progress, setProgress]     = useState([])

  useEffect(() => {
    if (!token) { setCheckingLock(false); return }

    const init = async () => {
      try {
        const [progressRes, lessonsRes] = await Promise.all([
          progressApi.getProgress(),
          quizApi.getUnits(user?.course_level || 'beginner').catch(() => ({ data: [] })),
        ])
        const prog = progressRes.data || []
        setProgress(prog)

        // 보스 잠금 확인 (Unit1 보스 클리어 여부)
        const isUnit1BossCleared = prog.some(p => p.unit === 1 && p.stage === '1-boss' && p.is_completed)
        setIsLocked(!isUnit1BossCleared)

        // 유닛 목록
        const ls = lessonsRes.data || []
        setLessons(ls)

        // 오답 복습 문제 수 (review API에서 간단히)
        try {
          const reviewRes = await trainApi.getReview({ limit: 50, course_level: user?.course_level || 'beginner' })
          const wq = reviewRes.data || []
          setWrongCount(wq.length)
          setWrongAnswers(wq.slice(0, 3))
        } catch {}

        // 유닛별 정답률 계산
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

  // ── 로딩 / 잠김 ──
  if (checkingLock && token) {
    return (
      <div className="tr-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (isLocked) {
    return (
      <div className="tr-page">
        <div className="tr-locked-card">
          <div className="tr-locked-icon">🔒</div>
          <h2 className="tr-locked-title">훈련장 잠김</h2>
          <p className="tr-locked-desc">
            <strong>Unit 1</strong>을 모두 완료하면 훈련장이 해금됩니다!
          </p>
          <button className="tr-go-btn" onClick={() => navigate('/lesson')}>
            레슨으로 가기
          </button>
        </div>
      </div>
    )
  }

  // ── 훈련 중 ──
  if (mode === 'playing') {
    const q = questions[current]
    return (
      <div className="train-page">
        <div className="train-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setMode('idle')}>✕ 중단하기</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrent(p => Math.max(0, p - 1))} disabled={current === 0}>◀ 이전</button>
            <div className="train-progress">{current + 1} / {questions.length}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              if (current + 1 < questions.length) setCurrent(current + 1)
              else { const fc = Object.values(answers).filter(a => a.isFirstAttemptCorrect).length; finishTraining(fc) }
            }}>
              {current === questions.length - 1 ? '완료 ▶' : '다음 ▶'}
            </button>
          </div>
        </div>
        <div className="container">
          <QuizCard
            key={current} question={q} onAnswer={handleAnswer} onNext={handleNext}
            initialSelected={answers[current]?.selected} initialInput={answers[current]?.input}
            initialRevealed={answers[current]?.revealed} initialAiFeedback={answers[current]?.aiFeedback}
            initialIsCorrectResult={answers[current]?.isCorrectResult}
            onFeedbackUpdate={(text) => setAnswers(prev => ({ ...prev, [current]: { ...(prev[current] || {}), aiFeedback: text } }))}
          />
        </div>
      </div>
    )
  }

  // ── 결과 ──
  if (mode === 'result') {
    const isPerfect = correctCount === questions.length
    return (
      <div className="tr-page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{isPerfect ? '🎉' : '👏'}</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1A1A2E', marginBottom: '0.5rem' }}>
          {isPerfect ? '완벽합니다!' : '훈련 완료!'}
        </h2>
        <p style={{ color: '#7A7A94', marginBottom: '2rem' }}>
          {questions.length}문제 중 {correctCount}개 정답
        </p>
        {isPerfect && (
          <div style={{ background: '#EAF3DE', borderRadius: 12, padding: '1rem', marginBottom: '2rem' }}>
            <strong style={{ color: '#3B6D11' }}>완벽 보상 획득!</strong>
            <p style={{ margin: '0.5rem 0 0', color: '#3B6D11' }}>+100 XP / +1 왕관 👑</p>
          </div>
        )}
        <button className="tr-go-btn" onClick={() => setMode('idle')}>훈련 종료</button>
      </div>
    )
  }

  // ── Idle 홈 화면 ──
  return (
    <div className="tr-page">
      <div className="tr-scroll">

        {/* 오늘의 추천 훈련 */}
        <div className="tr-today-card" onClick={() => startTraining(currentUnit)}>
          <div className="tr-today-text">
            <div className="tr-today-label">오늘의 추천 훈련</div>
            <div className="tr-today-title">오답 복습 · {wrongCount > 0 ? `${wrongCount}문제` : '준비 중'}</div>
            <div className="tr-today-meta">
              Unit {currentUnit} · 틀린 문제 모음
            </div>
          </div>
          <button className="tr-today-btn" disabled={loading}>
            {loading ? '...' : '시작'}
          </button>
        </div>

        {/* 훈련 모드 그리드 */}
        <div className="tr-section-title">훈련 모드</div>
        <div className="tr-grid">
          {TRAIN_MODES.map(m => (
            <div
              key={m.id}
              className={`tr-mode-card ${m.locked ? 'tr-mode-locked' : ''}`}
              onClick={() => !m.locked && startTraining(currentUnit)}
            >
              <div className="tr-mode-icon" style={{ background: m.iconBg }}>
                {m.icon}
              </div>
              <div className="tr-mode-name">{m.name}</div>
              <div className="tr-mode-desc">{m.desc}</div>
              <div className="tr-mode-count">
                {m.locked ? m.lockHint : m.id === 'wrong' ? `${wrongCount}문제 대기 중` : m.reward || ''}
              </div>
            </div>
          ))}
        </div>

        {/* 오답 노트 */}
        {wrongAnswers.length > 0 && (
          <>
            <div className="tr-section-title">오답 노트</div>
            <div className="tr-wrong-card">
              <div className="tr-wrong-header">
                <span className="tr-wrong-title">최근 틀린 문제</span>
                <span className="tr-wrong-more" onClick={() => startTraining(currentUnit)}>전체 보기 →</span>
              </div>
              {wrongAnswers.map((q, i) => (
                <div key={i} className="tr-wrong-row">
                  <span className="tr-wrong-tag">오답</span>
                  <span className="tr-wrong-q">{q.question || q.content || '문제 로딩 중'}</span>
                  <span className="tr-wrong-unit">U{q.unit || '?'}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 유닛별 정답률 */}
        {unitAccuracy.length > 0 && (
          <>
            <div className="tr-section-title">유닛별 정답률</div>
            <div className="tr-accuracy-card">
              {unitAccuracy.map((u, i) => (
                <div key={u.unit_id} className={`tr-accuracy-row ${i > 0 ? 'tr-bordered' : ''}`}>
                  <span className="tr-accuracy-label">Unit {u.unit_id} · {u.title}</span>
                  <div className="tr-accuracy-bar">
                    <div className="tr-accuracy-fill" style={{ width: `${u.pct}%` }} />
                  </div>
                  <span className="tr-accuracy-pct">{u.pct}%</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 유닛 선택 */}
        <div className="tr-section-title">유닛 선택</div>
        <div className="tr-unit-grid">
          {[1,2,3,4,5,6,7,8].map(u => (
            <button
              key={u}
              className={`tr-unit-btn ${currentUnit === u ? 'active' : ''}`}
              onClick={() => setCurrentUnit(u)}
            >
              Unit {u}
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
