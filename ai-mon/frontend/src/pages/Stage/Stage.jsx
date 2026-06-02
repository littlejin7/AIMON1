import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quizApi, progressApi } from '../../api/index'
import QuizCard from '../../components/QuizCard/QuizCard'
import './Stage.css'

export default function Stage() {
  const { lessonId, stage } = useParams()
  const navigate = useNavigate()
  const stageNum = parseInt(stage, 10)

  const [questions, setQuestions] = useState([])
  const [current, setCurrent]     = useState(0)
  const [score, setScore]         = useState(0)
  const [correct, setCorrect]     = useState(0)
  const [finished, setFinished]   = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    quizApi.getQuestions({ lesson_id: lessonId, stage: stageNum, limit: 5 })
      .then((r) => setQuestions(r.data))
      .finally(() => setLoading(false))
  }, [lessonId, stageNum])

  const handleAnswer = async ({ correct: isCorrect }) => {
    const pts = isCorrect ? 20 : 0
    const newScore = score + pts
    const newCorrect = correct + (isCorrect ? 1 : 0)
    setScore(newScore)
    setCorrect(newCorrect)

    await new Promise((r) => setTimeout(r, 1200))

    if (current + 1 >= questions.length) {
      // Save progress
      const totalScore = Math.round((newCorrect / questions.length) * 100)
      await progressApi.saveProgress({
        lesson_id: lessonId,
        stage: stageNum,
        score: totalScore,
        is_completed: totalScore >= 60,
      })
      setFinished(true)
    } else {
      setCurrent(current + 1)
    }
  }

  const finalScore = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0
  const passed = finalScore >= 60

  if (loading) return <div className="stage-loading"><div className="spinner" /></div>

  if (finished) {
    return (
      <div className="stage-result animate-fade-in">
        <div className="result-icon animate-float">{passed ? '🏆' : '😅'}</div>
        <h2 className="result-title">{passed ? '스테이지 클리어!' : '다시 도전해보세요!'}</h2>
        <div className="result-score" style={{ color: passed ? '#10b981' : '#ef4444' }}>
          {finalScore}점
        </div>
        <p className="result-desc">
          {questions.length}문제 중 {correct}개 정답
        </p>
        {passed && (
          <div className="result-reward">
            <span>⭐ 스테이지 완료</span>
            <span>+{finalScore} EXP 획득!</span>
          </div>
        )}
        <div className="result-actions">
          <button className="btn btn-secondary" onClick={() => navigate(`/lesson/${lessonId}`)}>
            레슨으로 돌아가기
          </button>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            다시 도전 🔄
          </button>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="stage-loading">
        <p>문제를 불러올 수 없습니다.</p>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>돌아가기</button>
      </div>
    )
  }

  const progressPct = (current / questions.length) * 100

  return (
    <div className="stage-page">
      <div className="stage-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/lesson/${lessonId}`)}>
          ✕
        </button>
        <div className="stage-progress-section">
          <div className="stage-progress-label">
            <span>Stage {stageNum}</span>
            <span>{current + 1} / {questions.length}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="stage-score-badge">
          ⭐ {score}
        </div>
      </div>

      <div className="stage-content container">
        <QuizCard
          key={current}
          question={questions[current]}
          onAnswer={handleAnswer}
        />
      </div>
    </div>
  )
}
