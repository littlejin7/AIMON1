import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { bossApi, progressApi } from '../../api/index'
import BossCard from '../../components/BossCard/BossCard'
import './Boss.css'

export default function Boss() {
  const { lessonId } = useParams()
  const navigate     = useNavigate()

  const [question, setQuestion]   = useState(null)
  const [answer, setAnswer]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]       = useState(null)
  const [bossHp, setBossHp]       = useState(100)

  useEffect(() => {
    bossApi.getQuestion()
      .then((r) => setQuestion(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lessonId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!answer.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await bossApi.submitAnswer({
        question_id: question.id,
        user_answer: answer,
        is_code_question: question.type === 'code',
      })
      setResult(res.data)
      if (res.data.is_correct) {
        setBossHp(0)
        await progressApi.saveProgress({
          lesson_id: lessonId,
          stage: 99, // boss stage identifier
          score: res.data.score || 100,
          is_completed: true,
        })
      } else {
        setBossHp(Math.max(0, bossHp - (res.data.score || 20)))
      }
    } catch {
      setResult({ is_correct: false, feedback: '서버 오류. 다시 시도해주세요.', hint: '' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="boss-page-loading">
        <div className="spinner" />
        <p>보스를 소환 중...</p>
      </div>
    )
  }

  return (
    <div className="boss-page">
      <div className="boss-page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/lesson/${lessonId}`)}>
          ← 레슨으로
        </button>
      </div>

      <div className="container">
        <BossCard
          bossName="최종 보스 드래곤"
          hp={bossHp}
          maxHp={100}
          phase={bossHp > 60 ? 1 : bossHp > 30 ? 2 : 3}
        />

        {!result ? (
          <div className="boss-challenge animate-fade-in-up">
            <div className="boss-question-box">
              <h2 className="boss-q-title">🧠 보스의 도전!</h2>
              <p className="boss-q-text">{question?.question}</p>
              {question?.type === 'code' && (
                <div className="badge badge-cyan" style={{ marginTop: 'var(--sp-3)' }}>
                  💻 코드 작성 문제
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="boss-answer-form">
              {question?.type === 'code' ? (
                <textarea
                  id="boss-code-answer"
                  className="input boss-textarea"
                  placeholder="파이썬 코드를 작성하세요..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={8}
                  spellCheck={false}
                />
              ) : (
                <input
                  id="boss-text-answer"
                  type="text"
                  className="input"
                  placeholder="정답을 입력하세요"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  autoFocus
                />
              )}
              <button
                id="boss-submit-btn"
                type="submit"
                className="btn btn-danger btn-full btn-lg"
                disabled={!answer.trim() || submitting}
              >
                {submitting
                  ? <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> AI 채점 중...</>
                  : '⚔️ 보스에게 도전!'}
              </button>
            </form>
          </div>
        ) : (
          <div className={`boss-result animate-fade-in-up ${result.is_correct ? 'correct' : 'wrong'}`}>
            <div className="boss-result-icon">{result.is_correct ? '🏆' : '💥'}</div>
            <h2 className="boss-result-title">
              {result.is_correct ? '보스를 물리쳤습니다!' : '아직 더 연습이 필요해요!'}
            </h2>
            <div className="boss-result-score">
              {result.score}점
            </div>
            <div className="boss-result-feedback">
              <p>{result.feedback}</p>
              {result.hint && (
                <div className="boss-hint">
                  <span>💡 힌트:</span> {result.hint}
                </div>
              )}
            </div>
            <div className="boss-result-actions">
              <button className="btn btn-ghost" onClick={() => navigate(`/lesson/${lessonId}`)}>
                레슨으로
              </button>
              {!result.is_correct && (
                <button className="btn btn-danger" onClick={() => { setResult(null); setAnswer('') }}>
                  다시 도전 🔄
                </button>
              )}
              {result.is_correct && (
                <button className="btn btn-primary" onClick={() => navigate('/')}>
                  🏠 홈으로
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
