import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { quizApi, progressApi, userApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import LevelTestModal from '../../components/LevelTestModal/LevelTestModal'
import InfoModal from '../../components/InfoModal/InfoModal'
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
  const [levelTestErrorMsg, setLevelTestErrorMsg] = useState(null)
  const [lessons,  setLessons]  = useState([])
  const [progress, setProgress] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expandedUnit, setExpandedUnit] = useState(1)

  const courseLevel = user?.course_level || 'beginner'
  const activeLevelIdx = LEVEL_MAP[courseLevel]?.idx ?? 0
  const clearedLevels = Array.isArray(user?.endboss_cleared_levels) ? user.endboss_cleared_levels : []
  const isCurrentLevelCleared = clearedLevels.includes(courseLevel)
  
  // max_unlocked_unit 는 백엔드에서 {beginner,intermediate,advanced} 객체.
  // (레거시 스칼라도 방어적으로 허용)
  const rawMaxUnlocked = user?.max_unlocked_unit
  const maxUnlocked = isCurrentLevelCleared ? 9 : (
    rawMaxUnlocked && typeof rawMaxUnlocked === 'object'
      ? rawMaxUnlocked[courseLevel]
      : rawMaxUnlocked
  ) ?? 1

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
    const currentUnit = lessons.find((l) => {
      if (l.unit_id > maxUnlocked) return false
      const prog = getUnitProgress(l.unit_id, l.stages)
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
      setLevelTestErrorMsg('레벨 설정 변경에 실패했습니다.')
    } finally {
      setShowLevelTest(false)
      setPendingUnitId(null)
    }
  }

  const isStageComplete = (unitId, stageNum) =>
    isCurrentLevelCleared ||
    progress.some((p) => p.unit === unitId && p.stage === `${unitId}-${stageNum}` && p.is_completed && p.course_level === courseLevel)

  // 표시용 진행도 = "1-1부터 연속으로 완료된 스테이지 개수".
  // 중간에 구멍(예: 1-1 미완료인데 1-2 완료)이 있는 깨진 데이터에서는
  // 구멍 직전까지만 진행으로 보여 ✓가 중간에 박히거나 current 노드가 둘이 되는 것을 막는다.
  const getUnitProgress = (unitId, stages = 0) => {
    let completed = 0
    for (let s = 1; s <= stages; s++) {
      if (isStageComplete(unitId, s)) completed++
      else break
    }
    return { completed }
  }

  const isBossComplete = (unitId) =>
    isCurrentLevelCleared ||
    progress.some((p) => p.unit === unitId && p.stage === `${unitId}-boss` && p.is_completed && p.course_level === courseLevel)

  const totalStages = lessons.reduce((a, l) => a + (l.stages || 0), 0)
  // 맵 표시(연속 완료 기반)와 동일 정의로 집계해야 헤더/전체 카운트가 맵과 일치한다.
  // (보스 스테이지는 제외 — totalStages 도 보스 미포함)
  const doneStages  = lessons.reduce((a, l) => a + getUnitProgress(l.unit_id, l.stages).completed, 0)
  const overallPct  = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0


  // 엔드보스 해금 = Unit 1~8 전체 스테이지 완료 + 각 유닛 보스 클리어까지 끝난 상태.
  // 유닛 카드의 `done` 판정과 동일한 기준을 써야 "해금 문구"와 실제 잠금 상태가 어긋나지 않는다.
  const endbossUnlocked = token && lessons.length > 0 && lessons.every((l) => {
    const prog = getUnitProgress(l.unit_id, l.stages)
    return l.stages > 0 && prog.completed >= l.stages && isBossComplete(l.unit_id)
  })

  
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

      <InfoModal
        icon="⚠️"
        message={levelTestErrorMsg}
        onConfirm={() => setLevelTestErrorMsg(null)}
      />

      <div className="lh-scroll">
        {/* ── 레벨 표시 ── */}
        <div className="lh-level-tabs">
          {LEVELS.map((lv, i) => (
            <div
              key={lv}
              className={`lh-tab ${i === activeLevelIdx ? 'active' : ''}`}
            >
              {LEVEL_LABELS[i]}
            </div>
          ))}
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
          const unlocked = token ? lesson.unit_id <= maxUnlocked : lesson.unit_id === 1
          const prog = getUnitProgress(lesson.unit_id, lesson.stages)
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
                      // 연속 완료 개수(prog.completed) 기준으로만 판정 →
                      // 깨진 데이터에서도 ✓는 연속 prefix 에만, current 는 정확히 1개.
                      const stageDone    = s <= prog.completed
                      const isCurrent    = s === prog.completed + 1
                      const enabled      = s <= prog.completed + 1   // 완료분 + 다음 1개만 진입 가능
                      const stateClass   = stageDone ? 'done' : isCurrent ? 'current' : 'todo'
                      const lineClass    = stageDone ? 'done' : 'todo'
                      return (
                        <div
                          key={s}
                          className={`lh-stage-seg${!enabled ? ' lh-stage-disabled' : ''}`}
                          onClick={() => {
                            if (!token || !enabled) return
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
        <div
          className={`lh-endboss-teaser${endbossUnlocked ? ' unlocked' : ' locked'}`}
          onClick={() => endbossUnlocked && navigate('/boss/endboss')}
        >
          <div className="lh-endboss-icon">{endbossUnlocked ? '👑' : '🔒'}</div>
          <div>
            <div className="lh-endboss-title">엔드보스</div>
            <div className="lh-endboss-desc">
              {endbossUnlocked ? '도전할 수 있어요! 지금 바로 만나보세요' : 'Unit 1~8 전체 완료 후 해금'}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
