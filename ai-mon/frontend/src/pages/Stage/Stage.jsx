import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quizApi, progressApi } from '../../api/index'
import QuizCard from '../../components/QuizCard/QuizCard'
import { useAuthStore } from '../../hooks/useAuthStore'
import './Stage.css'

export default function Stage({ _lessonId, _stage }) {
  const params = useParams()
  const lessonId = _lessonId || params.lessonId
  const stage = _stage || params.stage
  const navigate = useNavigate()
  const stageNum = parseInt(stage, 10)
  const token = useAuthStore((s) => s.token)

  const [questions, setQuestions] = useState([])
  const [current, setCurrent]     = useState(0)
  const [score, setScore]         = useState(0)
  const [correct, setCorrect]     = useState(0)
  const [finished, setFinished]   = useState(false)
  const [loading, setLoading]     = useState(true)
  // 비로그인 선체험 완료 후 회원가입/로그인 모달
  const [showAuthModal, setShowAuthModal] = useState(false)
  
  // 브리핑 슬라이드 상태
  const [briefings, setBriefings]         = useState([])
  const [briefingIndex, setBriefingIndex] = useState(0)
  const [showBriefing, setShowBriefing]   = useState(true)

  useEffect(() => {
    // 1-1 스테이지 임시 데이터 (MVP 연동)
    if (String(lessonId) === '1' && stageNum === 1) {
      import('../../data/mockData').then(({ MOCK_BRIEFINGS, MOCK_QUESTIONS }) => {
        setBriefings(MOCK_BRIEFINGS['1-1'])
        setQuestions(MOCK_QUESTIONS)
        setShowBriefing(true)
        setLoading(false)
      })
      return
    }

    quizApi.getQuestions({ lesson_id: lessonId, stage: stageNum, limit: 5 })
      .then((r) => {
        setQuestions(r.data)
        setBriefings([])
        setShowBriefing(false)
      })
      .finally(() => setLoading(false))
  }, [lessonId, stageNum])

  const handleAnswer = async ({ correct: isCorrect, retried }) => {
    // 재도전해서 맞춘 문제는 0점, 한 번에 맞추면 20점
    const pts = (isCorrect && !retried) ? 20 : 0
    const newScore = score + pts
    const newCorrect = correct + ((isCorrect && !retried) ? 1 : 0)
    setScore(newScore)
    setCorrect(newCorrect)

    await new Promise((r) => setTimeout(r, 1200))

    if (current + 1 >= questions.length) {
      // 1-1 스테이지 선체험: 비로그인 시 진행 저장 없이 모달만 표시
      const isFreeTrial = String(lessonId) === '1' && stageNum === 1
      if (isFreeTrial && !token) {
        setFinished(true)
        setShowAuthModal(true)
        return
      }
      // 로그인 상태 또는 일반 스테이지: 진행도 저장 후 완료 처리
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
        {/* 비로그인 회원가입/로그인 모달 */}
        {showAuthModal && (
          <div
            className="auth-modal-overlay"
            onClick={() => setShowAuthModal(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div
              className="auth-modal"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--surface, #1e1e2e)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '20px', padding: '2.5rem 2rem',
                maxWidth: '380px', width: '90%', textAlign: 'center',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎉</div>
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem', fontWeight: 700 }}>
                1-1 스테이지 완료!
              </h2>
              <p style={{ color: 'var(--text-secondary, #a0a0b0)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                다음 스테이지로 이어가려면<br />로그인 또는 회원가입이 필요해요 😊
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => navigate('/auth')}
                >
                  로그인 / 회원가입
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ width: '100%' }}
                  onClick={() => { setShowAuthModal(false); navigate('/') }}
                >
                  홈으로 돌아가기
                </button>
              </div>
            </div>
          </div>
        )}

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

  // ── 1) 브리핑 슬라이드 모드 ──
  if (showBriefing && briefings.length > 0) {
    const slide = briefings[briefingIndex]
    const isLast = briefingIndex === briefings.length - 1

    return (
      <div className="stage-page">
        <div className="stage-header">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/lesson/${lessonId}`)}>✕</button>
          <div className="stage-progress-section">
            <div className="stage-progress-label">
              <span>브리핑</span>
              <span>{briefingIndex + 1} / {briefings.length}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${((briefingIndex + 1) / briefings.length) * 100}%` }} />
            </div>
          </div>
          <div style={{ width: 32 }} />
        </div>
        
        <div className="stage-content container">
          <div className="briefing-card card-glass animate-fade-in-up" key={slide.id} style={{ padding: '2rem', textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--clr-text)' }}>
              {slide.title}
            </h2>
            
            <p style={{ color: 'var(--clr-text-muted)', lineHeight: 1.7, marginBottom: '1.5rem', whiteSpace: 'pre-line' }}>
              {slide.text}
            </p>
            
            {slide.code && (
              <div className="briefing-code" style={{ 
                background: '#1e1e2e', padding: '1rem', borderRadius: '8px', 
                fontFamily: 'monospace', color: '#a6accd', marginBottom: '1.5rem', 
                border: '1px solid #313244', whiteSpace: 'pre', overflowX: 'auto'
              }}>
                {slide.code}
              </div>
            )}
            
            {slide.tip && (
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '2rem' }}>
                <strong style={{ color: '#34d399', display: 'block', marginBottom: '4px' }}>💡 에이몬의 팁</strong>
                <p style={{ margin: 0, color: 'var(--clr-text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {slide.tip}
                </p>
              </div>
            )}
            
            <button
              className="btn btn-primary btn-lg btn-full"
              onClick={() => {
                if (isLast) setShowBriefing(false)
                else setBriefingIndex(b => b + 1)
              }}
            >
              {isLast ? '🚀 퀴즈 시작하기' : '다음 슬라이드 ➔'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 2) 본 퀴즈 모드 ──
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
