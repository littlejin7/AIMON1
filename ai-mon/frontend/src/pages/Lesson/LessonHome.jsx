import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { quizApi, progressApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import LevelTestModal from '../../components/LevelTestModal/LevelTestModal'
import { userApi } from '../../api/index'
import UnitCard   from './UnitCard'
import LevelBadge from './LevelBadge'
import './LessonHome.css'

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

  const courseLevel = user?.course_level || 'beginner'

  useEffect(() => {
    const calls = [quizApi.getUnits(courseLevel)]
    if (token) {
      calls.push(progressApi.getProgress().catch(err => { console.error(err); return null }))
      calls.push(userApi.getMe().catch(err => { console.error(err); return null }))
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

  const handleLevelTestFinish = async (levelKey) => {
    try {
      const res = await userApi.updateMe({ course_level: levelKey, is_level_tested: true })
      updateUser(res.data)
      if (pendingUnitId) navigate(`/lesson/${pendingUnitId}`)
    } catch {
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
    return getUnitProgress(prev.unit_id).completed >= (prev.stages || 1)
  }

  const totalStages = lessons.reduce((a, l) => a + (l.stages || 0), 0)
  const doneStages  = progress.filter((p) => p.is_completed).length
  const overallPct  = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0

  const isAllDone = token && lessons.length >= 8 && lessons.every((l) => {
    const prog = getUnitProgress(l.unit_id)
    const awardedCrowns = user?.awarded_crown_units || []
    return (prog.completed >= l.stages && l.stages > 0) || awardedCrowns.includes(l.unit_id)
  })

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
          onClose={() => { setShowLevelTest(false); setPendingUnitId(null) }}
          onFinish={handleLevelTestFinish}
          isLoggedIn={true}
        />
      )}

      {/* 헤더 */}
      <div className="lh-header">
        <div className="lh-header-row">
          <div>
            <p className="lh-greeting">
              {token ? `${user?.nickname || user?.username} 님의 레슨` : '에이몬에 오신 걸 환영합니다 👋'}
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

      {/* 코스 레벨 배지 */}
      <LevelBadge courseLevel={courseLevel} />

      {/* 유닛 목록 */}
      <div className="lh-unit-list container">
        {lessons.map((lesson, idx) => {
          const meta     = UNIT_META[idx] || { icon: '📖', color: '#7c3aed', keywords: [] }
          const maxUnlocked = user?.max_unlocked_unit ?? 1
          const unlocked = lesson.unit_id <= maxUnlocked
          const prog     = getUnitProgress(lesson.unit_id)
          const pct      = lesson.stages > 0 ? (prog.completed / lesson.stages) * 100 : 0
          const awardedCrowns = user?.awarded_crown_units || []
          const done     = (prog.completed >= lesson.stages && lesson.stages > 0) || awardedCrowns.includes(lesson.unit_id)
          const isUnit1  = idx === 0

          const handleClick = () => {
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
          }

          return (
            <UnitCard
              key={lesson.unit_id}
              lesson={lesson}
              meta={meta}
              prog={prog}
              pct={pct}
              done={done}
              unlocked={unlocked}
              isUnit1={isUnit1}
              token={token}
              onClick={handleClick}
            />
          )
        })}

        {/* 유닛보스 도전 */}
        {token && (
          <button 
            className="lh-unit-card lh-unitboss-nav animate-fade-in-up" 
            onClick={() => navigate('/boss')}
            style={{ 
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)', 
              borderColor: 'rgba(168, 85, 247, 0.3)' 
            }}
          >
            <div className="lh-unit-badge" style={{ background: 'rgba(168, 85, 247, 0.2)', borderColor: '#a855f7' }}>
              <span style={{ color: '#a855f7', fontWeight: 800 }}>⚔️</span>
            </div>
            <div className="lh-unit-body">
              <div className="lh-unit-row">
                <span className="lh-unit-icon">👾</span>
                <div className="lh-unit-text">
                  <span className="lh-unit-title">유닛보스 도전</span>
                  <div className="lh-unit-keywords">
                    <span className="lh-keyword">보스 선택 및 도전</span>
                  </div>
                </div>
              </div>
            </div>
            <span className="lh-arrow">›</span>
          </button>
        )}

        {/* 파이널 보스 */}
        {isAllDone && (
          <button className="lh-unit-card lh-endboss animate-fade-in-up" onClick={() => navigate('/boss/endboss')}>
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

        {/* 비로그인 체험 배너 */}
        {!token && (
          <div className="lh-trial-banner card-glass">
            <div className="lh-trial-left">
              <span className="lh-trial-icon">🚀</span>
              <div>
                <strong className="lh-trial-title">지금 바로 체험하세요!</strong>
                <p className="lh-trial-desc">Unit 1 · Stage 1-1은 로그인 없이 무료 체험 가능합니다.</p>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/stage/1/1')}>
              시작하기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
