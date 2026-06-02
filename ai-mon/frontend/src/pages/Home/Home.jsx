import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { quizApi, progressApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import CharacterDisplay from '../../components/CharacterDisplay/CharacterDisplay'
import './Home.css'

export default function Home() {
  const user = useAuthStore((s) => s.user)
  const [lessons, setLessons]   = useState([])
  const [stats, setStats]       = useState(null)
  const [progress, setProgress] = useState([])
  const [loading, setLoading]   = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      quizApi.getLessons(),
      progressApi.getStats(),
      progressApi.getProgress(),
    ]).then(([l, s, p]) => {
      setLessons(l.data)
      setStats(s.data)
      setProgress(p.data)
    }).finally(() => setLoading(false))
  }, [])

  const getLessonProgress = (lessonId) => {
    const items = progress.filter((p) => p.lesson_id === lessonId)
    const completed = items.filter((p) => p.is_completed).length
    return { completed, total: items.length }
  }

  if (loading) {
    return (
      <div className="home-loading">
        <div className="spinner" />
        <p>에이몬 로딩 중...</p>
      </div>
    )
  }

  const level = Math.floor((stats?.completed_stages || 0) / 3) + 1
  const xp = ((stats?.completed_stages || 0) % 3) * 33

  return (
    <div className="home-page">
      {/* Header */}
      <div className="home-header">
        <div className="home-greeting">
          <p className="home-greeting-sub">안녕하세요,</p>
          <h1 className="home-greeting-name">{user?.nickname || user?.username} 님! 👋</h1>
        </div>
        <CharacterDisplay
          characterId={user?.character || 'default'}
          level={level}
          xp={xp}
          maxXp={100}
          compact
        />
      </div>

      {/* Stats */}
      {stats && (
        <div className="home-stats stagger">
          <div className="stat-card animate-fade-in-up">
            <span className="stat-icon">🏆</span>
            <div className="stat-value">{stats.completed_stages}</div>
            <div className="stat-label">완료한 스테이지</div>
          </div>
          <div className="stat-card animate-fade-in-up">
            <span className="stat-icon">⭐</span>
            <div className="stat-value">{stats.total_score}</div>
            <div className="stat-label">총 획득 점수</div>
          </div>
          <div className="stat-card animate-fade-in-up">
            <span className="stat-icon">📈</span>
            <div className="stat-value">{stats.average_score}</div>
            <div className="stat-label">평균 점수</div>
          </div>
        </div>
      )}

      {/* Lessons */}
      <div className="home-section">
        <h2 className="home-section-title">📚 학습 레슨</h2>
        <div className="lesson-list stagger">
          {lessons.map((lesson) => {
            const prog = getLessonProgress(lesson.id)
            const pct = lesson.stages > 0 ? (prog.completed / lesson.stages) * 100 : 0
            return (
              <button
                key={lesson.id}
                id={`lesson-${lesson.id}`}
                className="lesson-item card animate-fade-in-up"
                onClick={() => navigate(`/lesson/${lesson.id}`)}
              >
                <div className="lesson-icon">{lesson.icon}</div>
                <div className="lesson-info">
                  <div className="lesson-header-row">
                    <span className="lesson-title">{lesson.title}</span>
                    <span className="badge badge-primary">{lesson.difficulty}</span>
                  </div>
                  <p className="lesson-desc">{lesson.description}</p>
                  <div className="lesson-progress-row">
                    <div className="progress-bar" style={{ flex: 1 }}>
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="lesson-progress-text">{prog.completed}/{lesson.stages}</span>
                  </div>
                </div>
                <span className="lesson-arrow">›</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
