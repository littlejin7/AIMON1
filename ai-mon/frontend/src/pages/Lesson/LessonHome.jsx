import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { quizApi, progressApi, userApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import LevelTestModal from '../../components/LevelTestModal/LevelTestModal'
import './LessonHome.css'

const LEVEL_MAP = {
  beginner:     { label: '초급', idx: 0 },
  intermediate: { label: '중급', idx: 1 },
  advanced:     { label: '고급', idx: 2 },
}
const LEVELS = ['beginner', 'intermediate', 'advanced']
const LEVEL_LABELS = ['초급', '중급', '고급']

const UNIT_TITLES = [
  'Python 기초 & 변수',
  '함수와 제어 흐름',
  '자료구조 (리스트·딕셔너리)',
  '반복문과 조건문',
  '클래스와 객체',
  '문자열 & 라이브러리',
  '파일·JSON·API',
  'AI 에이전트',
]

export default function LessonHome() {
  const user       = useAuthStore((s) => s.user)
  const token      = useAuthStore((s) => s.token)
  const updateUser = useAuthStore((s) => s.updateUser)
  const navigate   = useNavigate()

  const [showLevelTest, setShowLevelTest] = useState(false)
  const [pendingUnitId, setPendingUnitId] = useState(null)
  const [lessons,  setLessons]  = useState([])
  const [progress, setProgress] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expandedUnit, setExpandedUnit] = useState(null)

  const courseLevel = user?.course_level || 'beginner'
  const activeLevelIdx = LEVEL_MAP[courseLevel]?.idx ?? 0

  useEffect(() => {
    const calls = [quizApi.getUnits(courseLevel)]
    if (token) {
      calls.push(progressApi.getProgress(courseLevel).catch(() => null))
      calls.push(userApi.getMe().catch(() => null))
    }
    Promise.all(calls)
      .then(([l, p, u]) => {
        setLessons(l.data)
        if (p?.data) setProgress(p.data)
        if (u?.data) updateUser(u.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, courseLevel])

  // 레벨 테스트 미완료 시 자동 시작
  useEffect(() => {
    if (!loading && token && user && !user.is_level_tested) {
      setShowLevelTest(true)
    }
  }, [loading, token, user])

  // 진행 중인 유닛 자동 펼치기
  useEffect(() => {
    if (lessons.length === 0) return
    const maxUnlocked = user?.max_unlocked_unit ?? 1
    const currentUnit = lessons.find((l) => {
      if (l.unit_id > maxUnlocked) return false
      const prog = getUnitProgress(l.unit_id)
      return prog.completed < l.stages
    })
    if (currentUnit) setExpandedUnit(currentUnit.unit_id)
  }, [lessons, progress])

  const handleLevelTestFinish = async (levelKey, updatedUser) => {
    try {
      if (updatedUser) {
        updateUser(updatedUser)
      } else {
        const res = await userApi.updateMe({ course_level: levelKey, is_level_tested: true })
        updateUser(res.data)
      }
      if (pendingUnitId) navigate(`/lesson/${pendingUnitId}`)
    } catch {
      alert('레벨 설정 변경에 실패했습니다.')
    } finally {
      setShowLevelTest(false)
      setPendingUnitId(null)
    }
  }

  const getUnitProgress = (unitId) => {
    const items = progress.filter((p) => p.unit === unitId)
    const stageItems = items.filter((p) => p.stage !== `${unitId}-boss` && p.stage !== 'miniboss')
    const completed  = stageItems.filter((p) => p.is_completed).length
   return { completed }
  }
  const isStageComplete = (unitId, stageNum) =>
    progress.some((p) => p.unit === unitId && p.stage === `${unitId}-${stageNum}` && p.is_completed)

  const isBossComplete = (unitId) =>
    progress.some((p) => p.unit === unitId && p.stage === `${unitId}-boss` && p.is_completed)

  const totalStages = lessons.reduce((a, l) => a + (l.stages || 0), 0)
  const doneStages  = progress.filter((p) => {
    const stageNum = parseInt(p.stage)
    return !isNaN(stageNum) && p.is_completed
  }).length
  const overallPct  = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0

  const handleUnitClick = (lesson, unlocked) => {
    if (!unlocked) return
    if (!token && lesson.unit_id === 1) { navigate('/stage/1/1'); return }
    if (!token) { navigate('/auth'); return }
    if (!user?.is_level_tested) { setPendingUnitId(lesson.unit_id); setShowLevelTest(true); return }
    navigate(`/lesson/${lesson.unit_id}`)
  }

  const toggleExpand = (unitId, unlocked) => {
    if (!unlocked) return
    setExpandedUnit(prev => prev === unitId ? null : unitId)
  }

  if (loading) {
    return (
      <div className="lh-loading">
        <div className="spinner" />
        <p>레슨 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="lh-page">
      {showLevelTest && (
        <LevelTestModal
          forced={!user?.is_level_tested}
          onClose={() => { setShowLevelTest(false); setPendingUnitId(null) }}
          onFinish={handleLevelTestFinish}
          isLoggedIn={true}
        />
      )}

      <div className="lh-scroll">

        {/* ── 레벨 탭 ── */}
        <div className="lh-level-tabs">
          {LEVELS.map((lv, i) => {
            const isActive = i === activeLevelIdx
            const isLocked = i > activeLevelIdx
            return (
              <div
                key={lv}
                className={`lh-tab ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
              >
                {isLocked && <span className="lh-tab-lock">🔒</span>}
                {LEVEL_LABELS[i]}
              </div>
            )
          })}
        </div>

        {/* ── 진행률 요약 ── */}
        {token && (
          <div className="lh-progress-card">
            <div className="lh-progress-row">
              <span className="lh-progress-label">{LEVEL_MAP[courseLevel]?.label} 전체 진행률</span>
              <span className="lh-progress-val">
                {overallPct}% · {doneStages}/{totalStages} 스테이지
              </span>
            </div>
            <div className="lh-prog-bar">
              <div className="lh-prog-fill" style={{ width: `${overallPct}%` }} />
            </div>
          </div>
        )}

        {/* ── 유닛 목록 ── */}
        {lessons.map((lesson, idx) => {
          const maxUnlocked = user?.max_unlocked_unit ?? 1
          const unlocked = token ? lesson.unit_id <= maxUnlocked : lesson.unit_id === 1
          const prog = getUnitProgress(lesson.unit_id)
          const done = prog.completed >= lesson.stages && lesson.stages > 0 && isBossComplete(lesson.unit_id)
          const pct  = lesson.stages > 0 ? Math.round((prog.completed / lesson.stages) * 100) : 0
          const isExpanded = expandedUnit === lesson.unit_id && unlocked
          const stageNums  = Array.from({ length: lesson.stages || 0 }, (_, i) => i + 1)
          const title = lesson.title || UNIT_TITLES[idx] || `Unit ${lesson.unit_id}`

          return (
            <div
              key={lesson.unit_id}
              className={`lh-unit-card ${!unlocked ? 'lh-unit-locked' : ''} ${done ? 'lh-unit-done' : ''}`}
            >
              {/* 카드 헤더 */}
              <div
                className="lh-unit-header"
                onClick={() => unlocked && toggleExpand(lesson.unit_id, unlocked)}
              >
                <div className={`lh-unit-badge ${done ? 'done' : !unlocked ? 'locked' : 'current'}`}>
                  {done    ? '✓' : !unlocked ? '🔒' : lesson.unit_id}
                </div>
                <div className="lh-unit-info">
                  <div className={`lh-unit-title ${!unlocked ? 'locked' : ''}`}>
                    Unit {lesson.unit_id} · {title}
                  </div>
                  <div className="lh-unit-meta">
                    {done
                      ? `${lesson.stages}스테이지 완료 · 보스 클리어 ✓`
                      : !unlocked
                      ? `Unit ${idx} 완료 후 해금`
                      : `${prog.completed} / ${lesson.stages} 스테이지 · 진행 중`
                    }
                  </div>
                </div>
                {unlocked && (
                  <span className="lh-unit-chevron">
                    {isExpanded ? '∧' : '∨'}
                  </span>
                )}
              </div>

              {/* 미니 진행 바 */}
              {unlocked && (
                <div className="lh-mini-bar">
                  <div className="lh-mini-fill" style={{ width: `${done ? 100 : pct}%` }} />
                </div>
              )}

              {/* 스테이지 트랙 (펼쳐진 상태) */}
              {isExpanded && (
                <div className="lh-stage-track">
                  <div className="lh-stage-label">스테이지</div>
                  <div className="lh-stage-row">
                    {stageNums.map((s, i) => {
                      const stageDone    = isStageComplete(lesson.unit_id, s)
                      const prevDone     = s === 1 || isStageComplete(lesson.unit_id, s - 1)
                      const isCurrent    = !stageDone && prevDone
                      const stateClass   = stageDone ? 'done' : isCurrent ? 'current' : 'todo'
                      const lineClass    = stageDone ? 'done' : 'todo'
                      return (
                        <div
                          key={s}
                          className={`lh-stage-seg${!prevDone ? ' lh-stage-disabled' : ''}`}
                          onClick={() => {
                            if (!token || !prevDone) return
                            if (!user?.is_level_tested && !(lesson.unit_id === 1 && s === 1)) {
                              setPendingUnitId(lesson.unit_id)
                              setShowLevelTest(true)
                              return
                            }
                            navigate(`/stage/${lesson.unit_id}/${s}`)
                          }}
                        >
                          <div className={`lh-stage-node ${stateClass}`}>
                            {stageDone ? '✓' : s}
                          </div>
                          {i < stageNums.length - 1 && (
                            <div className={`lh-stage-line ${lineClass}`} />
                          )}
                        </div>
                      )
                    })}
                    {/* 선 + 보스 노드 */}
                    <div className={`lh-stage-line ${prog.completed >= lesson.stages ? 'done' : 'todo'}`} />
                    <div
                      className={`lh-boss-node${prog.completed < lesson.stages ? ' lh-stage-disabled' : ''}`}
                      onClick={() => {
                        if (!token || prog.completed < lesson.stages) return
                        if (!user?.is_level_tested) {
                          setPendingUnitId(lesson.unit_id)
                          setShowLevelTest(true)
                          return
                        }
                        navigate(`/boss/${lesson.unit_id}`)
                      }}
                      title="유닛 보스"
                    >
                      ⚔️
                    </div>
                  </div>
                </div>
              )}

            </div>
          )
        })}

        {/* ── 엔드보스 티저 ── */}
        <div className="lh-endboss-teaser" onClick={() => navigate('/boss/endboss')}>
          <div className="lh-endboss-icon">👑</div>
          <div>
            <div className="lh-endboss-title">엔드보스</div>
            <div className="lh-endboss-desc">Unit 1~8 전체 완료 후 해금</div>
          </div>
        </div>

      </div>
    </div>
  )
}
