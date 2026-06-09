import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { quizApi, progressApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import LevelTestModal from '../../components/LevelTestModal/LevelTestModal'
import { userApi } from '../../api/index'
import './LessonHome.css'

// 유닛별 메타 정보 (기획안)
const UNIT_META = [
  { icon: '🖨️', color: '#7c3aed', keywords: ['print', '변수', '자료형'] },
  { icon: '📋', color: '#06b6d4', keywords: ['리스트', '딕셔너리'] },
  { icon: '🔀', color: '#10b981', keywords: ['조건문', '논리 연산'] },
  { icon: '🔁', color: '#f59e0b', keywords: ['for', 'while', 'break'] },
  { icon: '⚙️', color: '#ef4444', keywords: ['함수', 'return', '스코프'] },
  { icon: '📝', color: '#8b5cf6', keywords: ['문자열', '라이브러리'] },
  { icon: '🌐', color: '#0ea5e9', keywords: ['파일', 'JSON', 'API'] },
  { icon: '🤖', color: '#f59e0b', keywords: ['AI 에이전트'] },
]

// 코스 레벨 정의 (기획안)
const COURSE_LEVELS = [
  {
    id: 'beginner',
    label: 'beginner',
    badge: '🌱',
    desc: '개념 이해 위주, 선택형',
    color: '#10b981',
  },
  {
    id: 'intermediate',
    label: 'intermediate',
    badge: '⚡',
    desc: '코드 읽기 + 단순 작성 혼합',
    color: '#f59e0b',
  },
  {
    id: 'advanced',
    label: 'advanced',
    badge: '🔥',
    desc: '코드 작성 + 응용 위주',
    color: '#ef4444',
  },
]



export default function LessonHome() {
  const user     = useAuthStore((s) => s.user)
  const token    = useAuthStore((s) => s.token)
  const updateUser = useAuthStore((s) => s.updateUser)
  const navigate = useNavigate()

  const [showLevelTest, setShowLevelTest] = useState(false)
  const [pendingUnitId, setPendingUnitId] = useState(null)

  // 코스 레벨 — 유저 설정값 우선, 없으면 beginner
  const courseLevel = user?.course_level || 'beginner'

  const [lessons,  setLessons]  = useState([])
  const [progress, setProgress] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const calls = [quizApi.getUnits()]
    if (token) calls.push(progressApi.getProgress())

    Promise.all(calls)
      .then(([l, p]) => {
        setLessons(l.data)
        if (p) setProgress(p.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const handleLevelTestFinish = async (levelKey) => {
    try {
      const res = await userApi.updateMe({ course_level: levelKey, is_level_tested: true })
      updateUser(res.data)
      if (pendingUnitId) {
        navigate(`/lesson/${pendingUnitId}`)
      }
    } catch (err) {
      alert('레벨 설정 변경에 실패했습니다.')
    } finally {
      setShowLevelTest(false)
      setPendingUnitId(null)
    }
  }

  const getUnitProgress = (unitId) => {
    const items     = progress.filter((p) => p.unit === unitId)
    const completed = items.filter((p) => p.is_completed).length
    return { completed, total: items.length }
  }

  const isUnitUnlocked = (index) => {
    if (index === 0) return true
    const prev = lessons[index - 1]
    if (!prev) return false
    const prog = getUnitProgress(prev.unit_id)
    return prog.completed >= (prev.stages || 1)
  }

  const totalStages = lessons.reduce((a, l) => a + (l.stages || 0), 0)
  const doneStages  = progress.filter((p) => p.is_completed).length
  const overallPct  = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0

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
          onClose={() => {
            setShowLevelTest(false)
            setPendingUnitId(null)
          }}
          onFinish={handleLevelTestFinish}
          isLoggedIn={true}
        />
      )}

      {/* ── 헤더 ── */}
      <div className="lh-header">
        <div className="lh-header-row">
          <div>
            <p className="lh-greeting">
              {token
                ? `${user?.nickname || user?.username} 님의 레슨`
                : '에이몬에 오신 걸 환영합니다 👋'}
            </p>
            <h1 className="lh-title">📚 레슨</h1>
          </div>
          {token && (
            <div className="lh-overall">
              <div className="lh-overall-label">
                <span>전체 진도</span>
                <span className="lh-overall-pct">{overallPct}%</span>
              </div>
              <div className="progress-bar" style={{ width: 80 }}>
                <div className="progress-bar-fill" style={{ width: `${overallPct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 코스 레벨 표시 ── */}
      <div className="lh-level-section">
        <p className="lh-level-label">현재 나의 학습 레벨</p>
        <div className="lh-level-tabs">
          {(() => {
            const lv = COURSE_LEVELS.find((l) => l.id === courseLevel) || COURSE_LEVELS[0];
            return (
              <div
                className="lh-level-tab active"
                style={{ borderColor: lv.color, color: lv.color, cursor: 'default' }}
              >
                <span className="lh-level-badge">{lv.badge}</span>
                <span className="lh-level-name">{lv.label}</span>
              </div>
            )
          })()}
        </div>
        <p className="lh-level-desc">
          {COURSE_LEVELS.find((l) => l.id === courseLevel)?.desc}
        </p>
      </div>

      {/* ── 유닛 목록 ── */}
      <div className="lh-unit-list container">

        {lessons.map((lesson, idx) => {
          const meta     = UNIT_META[idx] || { icon: '📖', color: '#7c3aed', keywords: [] }
          const unlocked = isUnitUnlocked(idx)
          const prog     = getUnitProgress(lesson.unit_id)
          const pct      = lesson.stages > 0 ? (prog.completed / lesson.stages) * 100 : 0
          const done     = prog.completed >= lesson.stages && lesson.stages > 0
          const isUnit1  = idx === 0

          return (
            <button
              key={lesson.unit_id}
              id={`unit-${lesson.unit_id}`}
              className={[
                'lh-unit-card',
                'animate-fade-in-up',
                !unlocked ? 'lh-locked' : '',
                done ? 'lh-done' : '',
              ].join(' ')}
              style={done ? { borderColor: meta.color + '50' } : {}}
              onClick={() => {
                if (!unlocked) return
                if (!token && isUnit1) {
                  navigate('/stage/1/1')
                } else if (token) {
                  if (!user?.is_level_tested) {
                    setPendingUnitId(lesson.unit_id)
                    setShowLevelTest(true)
                  } else {
                    navigate(`/lesson/${lesson.unit_id}`)
                  }
                } else {
                  navigate('/auth')
                }
              }}
              disabled={!unlocked}
              aria-label={`유닛 ${lesson.unit_id} — ${lesson.title}`}
            >
              {/* 번호 원형 배지 */}
              <div
                className="lh-unit-badge"
                style={{ background: unlocked ? meta.color + '30' : undefined, borderColor: unlocked ? meta.color : undefined }}
              >
                {unlocked ? (
                  <span style={{ color: meta.color, fontWeight: 800 }}>{idx + 1}</span>
                ) : (
                  <span>🔒</span>
                )}
              </div>

              {/* 콘텐츠 */}
              <div className="lh-unit-body">
                <div className="lh-unit-row">
                  <span className="lh-unit-icon">{unlocked ? meta.icon : '🔒'}</span>
                  <div className="lh-unit-text">
                    <span className="lh-unit-title">{lesson.title}</span>
                    <div className="lh-unit-keywords">
                      {meta.keywords.map((k) => (
                        <span key={k} className="lh-keyword">{k}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {unlocked && (
                  <div className="lh-unit-progress">
                    <div className="progress-bar" style={{ flex: 1 }}>
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${meta.color}, #c4b5fd)` }}
                      />
                    </div>
                    <span className="lh-unit-pct">
                      {done ? '✅ 완료' : `${prog.completed}/${lesson.stages}`}
                    </span>
                  </div>
                )}

                {!unlocked && (
                  <p className="lh-unit-lock-hint">이전 유닛을 완료하면 해금됩니다</p>
                )}

                {/* 비로그인 Unit1 배지 */}
                {!token && isUnit1 && (
                  <span className="lh-free-badge">🚀 무료 체험 가능</span>
                )}
              </div>

              {/* 보스 완료 배지 */}
              {done && (
                <div className="lh-boss-done">
                  <span>👑</span>
                </div>
              )}

              {unlocked && !done && <span className="lh-arrow">›</span>}
            </button>
          )
        })}
{token && lessons.length >= 8 && lessons.every((l) => {
  const prog = getUnitProgress(l.unit_id)
  return prog.completed >= l.stages && l.stages > 0
}) && (
  <button className="lh-unit-card lh-finalboss animate-fade-in-up" onClick={() => navigate('/boss/final')}>
    <div className="lh-unit-badge" style={{ background: '#ef444430', borderColor: '#ef4444' }}>
      <span style={{ color: '#ef4444', fontWeight: 800 }}>👿</span>
    </div>
    <div className="lh-unit-body">
      <div className="lh-unit-row">
        <span className="lh-unit-icon">💀</span>
        <div className="lh-unit-text">
          <span className="lh-unit-title">FINAL BOSS</span>
          <div className="lh-unit-keywords">
            <span className="lh-keyword">최종 보스</span>
          </div>
        </div>
      </div>
    </div>
  </button>
)}



        
        {/* 비로그인 안내 배너 */}
        {!token && (
          <div className="lh-trial-banner card-glass">
            <div className="lh-trial-left">
              <span className="lh-trial-icon">🚀</span>
              <div>
                <strong className="lh-trial-title">지금 바로 체험하세요!</strong>
                <p className="lh-trial-desc">Unit 1 · Stage 1-1은 로그인 없이 무료 체험 가능합니다.</p>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/stage/1/1')}
            >
              시작하기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
