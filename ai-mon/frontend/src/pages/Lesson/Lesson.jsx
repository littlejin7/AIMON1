import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quizApi, progressApi } from '../../api/index'
import './Lesson.css'
import { useAuthStore } from '../../hooks/useAuthStore'

const STAGE_ICONS = ['⚡', '🔥', '💎', '👑']

export default function Lesson() {
  const { id } = useParams()
  const user = useAuthStore((s) => s.user)
  const isUnitAwarded = (user?.awarded_crown_units || []).includes(Number(id))
  const navigate = useNavigate()
  const [lesson, setLesson]     = useState(null)
  const [progress, setProgress] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      quizApi.getUnit(id),
      progressApi.getProgress(),
    ]).then(([l, p]) => {
      setLesson(l.data)
      setProgress(p.data.filter((x) => x.unit === Number(id)))
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="lesson-loading"><div className="spinner" /></div>
  if (!lesson) return <div className="lesson-loading"><p>레슨을 찾을 수 없습니다.</p></div>

  const getStageStatus = (stage) => {
  if (isUnitAwarded) return 'completed'
  const stageStr = `${id}-${stage}`
  const p = progress.find((x) => x.stage === stageStr)
  if (!p) return 'locked'
  if (p.is_completed) return 'completed'
  return 'in_progress'
}

  const isStageUnlocked = (stageNum) => {
  if (isUnitAwarded) return true
  if (stageNum === 1) return true
  const prevStr = `${id}-${stageNum - 1}`
  const prev = progress.find((x) => x.stage === prevStr)
  return prev?.is_completed
}

  return (
    <div className="lesson-page">
      <div className="lesson-hero">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          ← 홈으로
        </button>
        <div className="lesson-hero-content">
          <span className="lesson-hero-icon">{lesson.icon}</span>
          <h1 className="lesson-hero-title">{lesson.title}</h1>
          <p className="lesson-hero-desc">{lesson.description}</p>
          <span className="badge badge-cyan">{lesson.difficulty}</span>
        </div>
      </div>

      <div className="container">
        <h2 className="lesson-stages-title">스테이지 선택</h2>

        <div className="stage-list stagger">
          {Array.from({ length: lesson.stages }, (_, i) => i + 1).map((stage) => {
            const status = getStageStatus(stage)
            const unlocked = isStageUnlocked(stage)
            const prog = progress.find((x) => x.stage === `${id}-${stage}`)

            return (
              <button
                key={stage}
                id={`stage-${stage}`}
                className={`stage-item ${status} ${!unlocked ? 'locked-item' : ''} animate-fade-in-up`}
                onClick={() => unlocked && navigate(`/stage/${id}/${stage}`)}
                disabled={!unlocked}
                aria-label={`스테이지 ${stage}`}
              >
                <div className="stage-number-wrap">
                  <span className="stage-icon">{unlocked ? STAGE_ICONS[stage - 1] || '⭐' : '🔒'}</span>
                  <span className="stage-number">Stage {stage}</span>
                </div>
                <div className="stage-info">
                  <div className="stage-status-badge">
                    {status === 'completed' && <span className="badge badge-success">완료 ✅</span>}
                    {status === 'in_progress' && prog?.checkpoint === 'miniboss_ready' && <span className="badge badge-warning">미니보스 대기중</span>}
                    {status === 'in_progress' && prog?.checkpoint !== 'miniboss_ready' && <span className="badge badge-warning">진행 중</span>}
                    {status === 'locked' && !unlocked && <span className="badge">잠김 🔒</span>}
                    {status === 'locked' && unlocked && <span className="badge badge-primary">도전!</span>}
                  </div>
                  {prog && (
                    <div className="stage-score">
                      {prog.is_completed
                        ? `최종 점수: ${prog.score}점`
                        : prog.checkpoint === 'miniboss_ready'
                        ? `개념퀴즈 통과 (${prog.score}점)`
                        : `진행 중: ${prog.score}점`}
                    </div>
                  )}
                </div>
                {unlocked && <span className="stage-arrow">›</span>}
              </button>
            )
          })}

          {/* Boss Stage */}
          <button
            id="stage-boss"
            className={`stage-item boss-stage animate-fade-in-up ${
              progress.filter((p) => p.is_completed).length >= lesson.stages || isUnitAwarded ? '' : 'locked-item'
            }`}
            onClick={() =>
              progress.filter((p) => p.is_completed).length >= lesson.stages || isUnitAwarded &&
              navigate(`/boss/${id}`)
            }
            disabled={progress.filter((p) => p.is_completed).length < lesson.stages && !isUnitAwarded}
          >
            <div className="stage-number-wrap">
        <span className="stage-icon" style={{
          fontWeight: 900,
          fontSize: '1.2rem',
          letterSpacing: '0.15em',
          background: 'var(--grad-boss)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>BOSS</span>              <span className="stage-number">보스 전투</span>
            </div>
            <div className="stage-info">
              <span className="badge badge-danger">최종 보스</span>
              <div className="stage-score" style={{ color: '#fca5a5' }}>
                {progress.filter((p) => p.is_completed).length >= lesson.stages || isUnitAwarded
                  ? '도전 가능!'
                  : `모든 스테이지 완료 후 해금`}
              </div>
            </div>
            <span className="stage-arrow">›</span>
          </button>
        </div>
      </div>
    </div>
  )
}
