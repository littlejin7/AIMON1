import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quizApi, progressApi } from '../../api/index'
import QuizCard from '../../components/QuizCard/QuizCard'
import { useAuthStore } from '../../hooks/useAuthStore'
import StageLoading from '../../components/loading/StageLoading'
import villainIcon from '../../assets/boss_midcmorg.png'
import stageClearIcon from '../../assets/boss_midcmlose.png'
import stageFailIcon from '../../assets/boss_midcmorg.png'
import './Stage.css'

export default function Stage({ _lessonId, _stage }) {
  const params = useParams()
  const lessonId = _lessonId || params.lessonId
  const stage = _stage || params.stage
  const navigate = useNavigate()
  const stageNum = parseInt(stage, 10)
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const courseLevel = user?.course_level || 'beginner'

  const [questions, setQuestions] = useState([])
  const [current, setCurrent]     = useState(0)
  const [score, setScore]         = useState(0)
  const [correct, setCorrect]     = useState(0)
  const [finished, setFinished]   = useState(false)
  const [loading, setLoading]     = useState(true)
  const [xpAwarded, setXpAwarded] = useState(0)
  const [unitInfo, setUnitInfo]   = useState(null)
  
  // 비로그인 선체험 완료 후 회원가입/로그인 모달
  const [showAuthModal, setShowAuthModal] = useState(false)
  
  // 브리핑 슬라이드 상태
  const [briefings, setBriefings]         = useState([])
  const [briefingIndex, setBriefingIndex] = useState(0)
  const [showBriefing, setShowBriefing]   = useState(true)

  useEffect(() => {
    const fetchUnit = quizApi.getUnit(lessonId).then((r) => r.data).catch(() => null)
    
    // 브리핑 슬라이드 조회 (예: 1-1-beginner)
    const formattedLessonId = `${lessonId}-${stageNum}-${courseLevel}`
    const fetchSlides = quizApi.getLesson(formattedLessonId)
      .then((r) => r.data)
      .catch(() => null)
    
    // 문제 목록 조회
    const fetchQuestions = quizApi.getQuestions({ 
      unit: lessonId, 
      stage: `${lessonId}-${stageNum}`, 
      course_level: courseLevel, 
      limit: 10 
    }).then((r) => r.data).catch(() => [])

    Promise.all([fetchUnit, fetchSlides, fetchQuestions]).then(([unitData, lessonData, questionsData]) => {
      setUnitInfo(unitData)
      if (lessonData && lessonData.slides && lessonData.slides.length > 0) {
        setBriefings(lessonData.slides)
        setShowBriefing(true)
      } else {
        setBriefings([])
        setShowBriefing(false)
      }
      setQuestions(questionsData)
      setLoading(false)
    })
  }, [lessonId, stageNum, courseLevel])

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
      const res = await progressApi.saveProgress({
        unit: parseInt(lessonId, 10),
        stage: `${lessonId}-${stageNum}`,
        score: totalScore,
        is_completed: totalScore >= 60,
      })
      if (res && res.data) {
        setXpAwarded(res.data.xp_awarded || 0)
      }
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
                  onClick={() => navigate('/auth?mode=register')}
                >
                  ✨ 회원가입하고 계속하기
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

        <div className="result-icon animate-float">
          {passed
            ? <img src={stageClearIcon} alt="클리어" />
            : <img src={stageFailIcon} alt="실패" />
          }
        </div>
        <h2 className="result-title">{passed ? '스테이지 클리어!' : '다시 도전해보세요!'}</h2>
        <div className="result-score" style={{ color: passed ? '#10b981' : '#ef4444' }}>
          {finalScore}점
        </div>
        <p className="result-desc">
          {questions.length}문제 중 {correct}개 정답
        </p>
        {passed && xpAwarded > 0 && (
          <div className="result-reward" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '16px' }}>
            <span>⭐ 스테이지 완료</span>
            <span style={{ color: '#a6e3a1', fontWeight: 'bold' }}>+{xpAwarded} XP 획득!</span>
          </div>
        )}
        {passed && xpAwarded === 0 && (
          <div className="result-reward" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '16px' }}>
            <span>⭐ 스테이지 재완료</span>
            <span style={{ fontSize: '0.9em', color: '#a0a0b0' }}>이미 보상을 획득했습니다.</span>
          </div>
        )}
        <div className="result-actions">
          {passed && unitInfo && (
            <button 
              className="btn btn-primary" 
              onClick={() => {
                if (stageNum < unitInfo.stages) {
                  // 다음 일반 스테이지로 이동
                  navigate(`/stage/${lessonId}/${stageNum + 1}`);
                  window.location.reload(); // 상태 초기화를 위해 새로고침 (간편 라우팅)
                } else {
                  // 보스 스테이지로 이동
                  navigate(`/stage/${lessonId}/boss`);
                }
              }}
            >
              다음 스테이지로 ➔
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => navigate(`/lesson/${lessonId}`)}>
            레슨으로 돌아가기
          </button>
          {!passed && (
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              다시 도전 🔄
            </button>
          )}
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
              <span>📖 브리핑</span>
              <span>{briefingIndex + 1} / {briefings.length}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${((briefingIndex + 1) / briefings.length) * 100}%` }} />
            </div>
          </div>
          <div style={{ width: 32 }} />
        </div>

        <div className="stage-content container">
          <div
            className="briefing-card card-glass animate-fade-in-up"
            key={slide.order}
            style={{ padding: '2rem', textAlign: 'left' }}
          >
            {/* 슬라이드 번호 배지 */}
            <div style={{ marginBottom: '1rem' }}>
              <span style={{
                background: 'var(--grad-primary)', color: '#fff',
                fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em',
                padding: '3px 12px', borderRadius: '999px'
              }}>
                SLIDE {slide.order}
              </span>
            </div>

            {/* 개념 설명 텍스트 */}
            <p style={{
              color: 'var(--clr-text)', lineHeight: 1.85, marginBottom: '1.5rem',
              whiteSpace: 'pre-line', fontSize: '1rem'
            }}>
              {slide.text}
            </p>

            {/* 터미널 블록 */}
            {slide.terminal && (
              <div style={{ marginBottom: '1.5rem', borderRadius: '10px', overflow: 'hidden', border: '1px solid #313244' }}>
                {/* 터미널 헤더 */}
                <div style={{
                  background: '#181825', padding: '8px 14px',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
                  <span style={{ color: '#585b70', fontSize: '0.72rem', marginLeft: 8 }}>Python</span>
                </div>
                {/* 코드 영역 */}
                <div style={{
                  background: '#1e1e2e', padding: '1rem 1.2rem',
                  fontFamily: 'monospace', fontSize: '0.9rem', color: '#cdd6f4',
                  whiteSpace: 'pre', overflowX: 'auto'
                }}>
                  {slide.terminal.code.map((line, i) => (
                    <div key={i} style={{ color: line.startsWith('#') ? '#6c7086' : '#cdd6f4' }}>
                      <span style={{ color: '#585b70', userSelect: 'none', marginRight: 12 }}>&gt;&gt;&gt;</span>
                      {line}
                    </div>
                  ))}
                </div>
                {/* 출력 결과 영역 */}
                {slide.terminal.output?.length > 0 && (
                  <div style={{
                    background: '#181825', padding: '0.75rem 1.2rem',
                    borderTop: '1px solid #313244',
                    fontFamily: 'monospace', fontSize: '0.9rem'
                  }}>
                    {slide.terminal.output.map((line, i) => (
                      <div key={i} style={{ color: '#a6e3a1' }}>{line}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 팁 블록 */}
            {slide.tip && (
              <div style={{
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: '10px', padding: '1rem 1.2rem', marginBottom: '2rem'
              }}>
                <strong style={{ color: '#34d399', display: 'block', marginBottom: '6px', fontSize: '0.85rem' }}>💡 에이몬의 팁</strong>
                <p style={{ margin: 0, color: 'var(--clr-text-muted)', fontSize: '0.88rem', lineHeight: 1.6 }}>
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
  const currentQ = questions[current]
  const isVillain = currentQ?.quiz_category === 'concept_check'

  return (
    <div className={`stage-page ${isVillain ? 'villain-mode' : ''}`}>
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
        {isVillain && (
          <div className="villain-intro animate-fade-in-up">
            <img src={villainIcon} alt="빌런" className="villain-emoji" />
            <div className="villain-speech">
              "엉뚱한 코드로 널 괴롭혀주지! 코드몬 등장!"
            </div>
          </div>
        )}
        <QuizCard
          key={current}
          question={currentQ}
          onAnswer={handleAnswer}
        />
      </div>
    </div>
  )
}
