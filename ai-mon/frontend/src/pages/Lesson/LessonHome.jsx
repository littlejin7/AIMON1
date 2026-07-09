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

const FALLBACK_UNIT_ICONS = {
  1: '🖨️',
  2: '📝',
  3: '🔀',
  4: '🔁',
  5: '📋',
  6: '⚙️',
  7: '🗂️',
  8: '🚀',
}

function getFallbackUnitIcon(unitId) {
  return FALLBACK_UNIT_ICONS[unitId] || '📘'
}

function getUnitShortTitle(title = '', unitId, courseLevel = 'beginner') {
  const mapping = {
    beginner: {
      1: '파이썬 첫걸음',
      2: '문자열',
      3: '조건문',
      4: '반복문',
      5: '리스트/파일',
      6: '함수',
      7: '딕셔너리',
      8: '프로젝트',
    },
    intermediate: {
      1: '예외처리',
      2: '자료형 심화',
      3: '함수 심화',
      4: '클래스 & OOP',
      5: '리스트/파일 심화',
      6: '가상환경',
      7: '정규표현식',
      8: 'API 프로젝트',
    },
    advanced: {
      1: '고급 문법',
      2: '비동기 프로그래밍',
      3: 'AI API 활용',
      4: 'Streamlit 챗봇',
      5: 'LangChain 기초',
      6: 'AI 에이전트',
      7: '웹 연동 프로젝트',
      8: '최종 프로젝트',
    }
  }

  return mapping[courseLevel]?.[unitId] || title.replace(/—/g, ' ').split(/\s+/).slice(0, 2).join(' ') || `Unit ${unitId}`
}

function getStageDisplayTitle(unitId, stageNum, unitTitle = '') {
  const beginnerUnit2 = {
    1: '문자열이란?',
    2: '문자열 인덱싱과 슬라이싱',
    3: '문자열 메서드 기초',
    4: '문자열 포매팅',
    5: '문자열 탐색과 치환',
    6: '종합 문제',
  }

  if (unitId === 2) return beginnerUnit2[stageNum] || `Stage ${stageNum}`

  return `Stage ${stageNum}`
}

function UnitIcon({ unitId, className = '' }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    'aria-hidden': true,
  }

  switch (unitId) {
    case 1:
      return (
        <svg {...common}>
          <rect x="6" y="8" width="12" height="8" rx="2" />
          <path d="M8 8V5h8v3" />
          <path d="M8 16v3h8v-3" />
          <path d="M9 12h6" />
        </svg>
      )
    case 2:
      return (
        <svg {...common}>
          <path d="M7 5h10" />
          <path d="M7 9h7" />
          <path d="M7 13h10" />
          <path d="M7 17h6" />
          <path d="M17 15l2 2-2 2" />
        </svg>
      )
    case 3:
      return (
        <svg {...common}>
          <path d="M6 6h5a4 4 0 0 1 4 4v1" />
          <path d="M6 18h5a4 4 0 0 0 4-4v-1" />
          <path d="M16 8l3 3-3 3" />
        </svg>
      )
    case 4:
      return (
        <svg {...common}>
          <path d="M17 7a6 6 0 0 0-10 2" />
          <path d="M7 7v2h2" />
          <path d="M7 17a6 6 0 0 0 10-2" />
          <path d="M17 17v-2h-2" />
        </svg>
      )
    case 5:
      return (
        <svg {...common}>
          <rect x="6" y="5" width="12" height="14" rx="2" />
          <path d="M9 9h6" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      )
    case 6:
      return (
        <svg {...common}>
          <path d="M8 7h8" />
          <path d="M8 12h8" />
          <path d="M8 17h5" />
          <path d="M5 7h.01" />
          <path d="M5 12h.01" />
          <path d="M5 17h.01" />
        </svg>
      )
    case 7:
      return (
        <svg {...common}>
          <rect x="5" y="5" width="14" height="14" rx="3" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
          <path d="M8 17h7" />
        </svg>
      )
    case 8:
      return (
        <svg {...common}>
          <path d="M12 4v5" />
          <path d="M8 8h8" />
          <rect x="6" y="10" width="12" height="8" rx="3" />
          <path d="M9 14h.01" />
          <path d="M15 14h.01" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <rect x="5" y="5" width="14" height="14" rx="3" />
          <path d="M9 9h6" />
          <path d="M9 13h6" />
        </svg>
      )
  }
}

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


  const endbossUnlocked = token && lessons.length > 0 && lessons.every((l) => {
    const prog = getUnitProgress(l.unit_id, l.stages)
    return l.stages > 0 && prog.completed >= l.stages && isBossComplete(l.unit_id)
  })

  const selectedLesson = lessons.find((l) => l.unit_id === expandedUnit) || lessons[0]

  
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
          <div className="lh-progress-card lh-progress-card-v2">
            <div className="lh-progress-head">
              <span className="lh-progress-label">{LEVEL_MAP[courseLevel]?.label} 진행률</span>
              <span className="lh-progress-count">
                <strong>{doneStages}</strong> / {totalStages} 스테이지 완료
              </span>
            </div>
            <div className="lh-progress-main">
              <span className="lh-progress-percent">{overallPct}%</span>
              <div className="lh-prog-bar lh-prog-bar-v2">
                <div className="lh-prog-fill" style={{ width: `${overallPct}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* ── 유닛 선택 가로 UI ── */}
        {lessons.length > 0 && (
          <section className="lh-unit-selector-card" aria-label={`${LEVEL_MAP[courseLevel]?.label} 유닛 선택`}>
            <div className="lh-unit-selector-head">
              <h2>{LEVEL_MAP[courseLevel]?.label} 유닛</h2>
              <span>총 {lessons.length}개 Unit</span>
            </div>

            <div className="lh-unit-selector-scroll">
              {lessons.map((lesson, idx) => {
                const unlocked = token ? lesson.unit_id <= maxUnlocked : lesson.unit_id === 1
                const prog = getUnitProgress(lesson.unit_id, lesson.stages)
                const done = prog.completed >= lesson.stages && lesson.stages > 0 && isBossComplete(lesson.unit_id)
                const isCurrent = unlocked && !done && lesson.unit_id === expandedUnit
                const title = lesson.title || UNIT_TITLES[idx] || `Unit ${lesson.unit_id}`
                const shortTitle = getUnitShortTitle(title, lesson.unit_id, courseLevel)
                const icon = lesson.icon || getFallbackUnitIcon(lesson.unit_id)

                return (
                  <button
                    key={lesson.unit_id}
                    type="button"
                    className={`lh-unit-node no-3d unit-${lesson.unit_id} ${done ? 'done' : !unlocked ? 'locked' : isCurrent ? 'current' : 'open'}`}
                    onClick={() => {
                      if (!unlocked) return
                      setExpandedUnit(lesson.unit_id)
                    }}
                    disabled={!unlocked}
                    aria-label={`Unit ${lesson.unit_id} ${shortTitle}`}
                  >
                    <span className="lh-unit-node-icon-wrap">
                      <UnitIcon unitId={lesson.unit_id} className="lh-unit-node-svg" />
                      {done && <span className="lh-unit-node-state done">✓</span>}
                      {!unlocked && <span className="lh-unit-node-state locked">🔒</span>}
                      {isCurrent && <span className="lh-unit-node-state current">▶</span>}
                    </span>
                    <span className="lh-unit-node-num">{lesson.unit_id}</span>
                    <span className="lh-unit-node-title">{shortTitle}</span>
                    <span className="lh-unit-node-status">
                      {done ? '완료' : !unlocked ? '잠김' : isCurrent ? '진행중' : '열림'}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── 선택된 유닛 상세 및 발자국 로드맵 ── */}
        {selectedLesson && (() => {
          const lesson = selectedLesson
          const idx = lessons.findIndex((l) => l.unit_id === lesson.unit_id)
          const unlocked = token ? lesson.unit_id <= maxUnlocked : lesson.unit_id === 1
          const prog = getUnitProgress(lesson.unit_id, lesson.stages)
          const done = prog.completed >= lesson.stages && lesson.stages > 0 && isBossComplete(lesson.unit_id)
          const pct = lesson.stages > 0 ? Math.round((prog.completed / lesson.stages) * 100) : 0
          const title = lesson.title || UNIT_TITLES[idx] || `Unit ${lesson.unit_id}`
          const icon = lesson.icon || getFallbackUnitIcon(lesson.unit_id)
          const stageNums = Array.from({ length: lesson.stages || 0 }, (_, i) => i + 1)

          return (
            <section className={`lh-selected-unit-card unit-${lesson.unit_id} ${!unlocked ? 'locked' : ''}`}>
              <div className="lh-selected-unit-head">
                <div className="lh-selected-unit-icon">
                  <UnitIcon unitId={lesson.unit_id} className="lh-selected-unit-svg" />
                </div>
                <div className="lh-selected-unit-info">
                  <div className="lh-selected-unit-kicker">Unit {lesson.unit_id}</div>
                  <h2>{title}</h2>
                  <p>{lesson.description || `${prog.completed} / ${lesson.stages} 스테이지 완료`}</p>
                </div>
                {(() => {
                  const isBossFinished = isBossComplete(lesson.unit_id)
                  const isReadyForBoss = prog.completed >= lesson.stages
                  
                  let btnText = "유닛보스 잠김"
                  let btnClass = "locked"
                  let btnDisabled = true
                  
                  if (isBossFinished) {
                    btnText = "보스 복습"
                    btnClass = "cleared"
                    btnDisabled = false
                  } else if (isReadyForBoss) {
                    btnText = "유닛보스 도전"
                    btnClass = "open"
                    btnDisabled = false
                  }
                  
                  return (
                    <button
                      type="button"
                      className={`lh-stage-boss-cta no-3d ${btnClass}`}
                      disabled={btnDisabled}
                      onClick={() => {
                        if (btnDisabled) return
                        if (!token) return
                        if (!user?.is_level_tested) {
                          setPendingUnitId(lesson.unit_id)
                          setShowLevelTest(true)
                          return
                        }
                        navigate(`/boss/${lesson.unit_id}`)
                      }}
                    >
                      {btnText}
                    </button>
                  )
                })()}
              </div>

              <div className="lh-selected-unit-progress">
                <span>{prog.completed} / {lesson.stages} 스테이지 완료</span>
                <div className="lh-selected-unit-bar">
                  <div style={{ width: `${done ? 100 : pct}%` }} />
                </div>
              </div>

              <div className="lh-paw-roadmap">
                {stageNums.map((s) => {
                  const stageDone = s <= prog.completed
                  const isCurrent = s === prog.completed + 1
                  const enabled = unlocked && s <= prog.completed + 1
                  const stateClass = stageDone ? 'done' : isCurrent ? 'current' : 'locked'

                  return (
                    <button
                      key={s}
                      type="button"
                      className={`lh-paw-stage no-3d ${stateClass}`}
                      disabled={!enabled}
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
                      <span className="lh-paw-node">{s}</span>
                      <span className="lh-paw-content">
                        <span className="lh-paw-title">{getStageDisplayTitle(lesson.unit_id, s, title)}</span>
                        <span className="lh-paw-status">
                          {stageDone ? '완료' : isCurrent ? '진행중' : '잠김'}
                        </span>
                      </span>
                      {stageDone && <span className="lh-paw-action review">복습</span>}
                      {isCurrent && <span className="lh-paw-action continue">이어하기</span>}
                      {!enabled && <span className="lh-paw-lock">🔒</span>}
                    </button>
                  )
                })}

                {/* 유닛보스 큰 카드는 제거됨 */}
              </div>
            </section>
          )
        })()}

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
