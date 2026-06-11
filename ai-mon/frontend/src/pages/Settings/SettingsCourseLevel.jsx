import { useState } from 'react'
import { useAuthStore } from '../../hooks/useAuthStore'
import { userApi } from '../../api/index'

const LEVELS = [
  { key: 'beginner',     emoji: '🌱', label: 'beginner',     desc: 'Python 기초부터 차근차근', color: '#7c3aed' },
  { key: 'intermediate', emoji: '⚡', label: 'intermediate', desc: '기초를 알고 심화로 도전',  color: '#06b6d4' },
  { key: 'advanced',     emoji: '🔥', label: 'advanced',     desc: 'f-string급 실력자 전용',  color: '#f59e0b' },
]

export default function SettingsCourseLevel() {
  const user       = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)

  const [courseLevel,  setCourseLevel]  = useState(user?.course_level || 'beginner')
  const [levelSaving,  setLevelSaving]  = useState(false)
  const [levelSaved,   setLevelSaved]   = useState(false)

  const handleSave = async (key) => {
    if (key === courseLevel) return
    setLevelSaving(true)
    setCourseLevel(key)
    try {
      const res = await userApi.updateMe({ course_level: key })
      updateUser(res.data)
      setLevelSaved(true)
      setTimeout(() => setLevelSaved(false), 2000)
    } finally {
      setLevelSaving(false)
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">수강 레벨</h2>
      <div className="settings-card card">
        <p style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)', marginBottom: '0.75rem' }}>
          {levelSaved ? '✅ 레벨이 변경됐어요!' : '학습 난이도와 AI 설명 수준이 함께 바뀌어요.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {LEVELS.map(({ key, emoji, label, desc, color }) => {
            const isActive = courseLevel === key
            return (
              <button
                key={key}
                id={`btn-course-level-${key}`}
                onClick={() => handleSave(key)}
                disabled={levelSaving}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.7rem 1rem',
                  borderRadius: '10px',
                  border: isActive ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.1)',
                  background: isActive ? `${color}22` : 'rgba(255,255,255,0.04)',
                  color: isActive ? color : 'var(--clr-text-muted)',
                  fontWeight: isActive ? 700 : 400,
                  cursor: levelSaving ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div>{emoji} {label}</div>
                  <div style={{ fontSize: '0.74rem', marginTop: '2px', opacity: 0.7 }}>{desc}</div>
                </div>
                {isActive && (
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 800,
                    background: `${color}33`, border: `1px solid ${color}66`,
                    borderRadius: 99, padding: '2px 10px', color,
                    whiteSpace: 'nowrap',
                  }}>현재</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
