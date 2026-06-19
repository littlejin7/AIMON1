import { useAuthStore } from '../../hooks/useAuthStore'
import { userApi, progressApi } from '../../api/index'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import CharacterDisplay from '../../components/CharacterDisplay/CharacterDisplay'
import './Character.css'
import Title from '../../components/titles/title'
const CHARACTERS = [
  { id: 'slime',         icon: '/src/assets/character_slime.png', name: '에이몬 슬라임', desc: '기본 캐릭터', unlockUnits: 0 },
  { id: 'robot',         icon: '/src/assets/character_robot.png', name: '에이몬 로봇', desc: 'Unit 3 완료 시 해금', unlockUnits: 3 },
  { id: 'speech_bubble', icon: '/src/assets/character_bubble.png', name: '에이몬 말풍선', desc: 'Unit 6 완료 시 해금', unlockUnits: 6 },
  { id: 'final_ghost',   icon: '/src/assets/character_final_ghost.png', name: '파이널 에이몬', desc: 'Unit 8 완료 시 해금', unlockUnits: 8 },
]

export default function Character() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const navigate = useNavigate()
  const [selected, setSelected] = useState(user?.character || 'slime')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [stats, setStats]       = useState(null)

  useEffect(() => {
    progressApi.getStats()
      .then((r) => setStats(r.data))
      .catch(() => {})
  }, [])

  const completedUnits = Math.floor((stats?.completed_stages || 0) / 7)

  const handleSelect = (id) => {
    const char = CHARACTERS.find((c) => c.id === id)
    if (completedUnits < char.unlockUnits) return
    setSelected(id)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await userApi.updateMe({ character: selected })
      updateUser(res.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="character-page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="page-title">🤖 내 캐릭터</h1>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            홈으로
          </button>
        </div>
        <p className="text-muted text-sm">캐릭터를 선택하고 커스터마이즈하세요</p>
      </div>

      <div className="container">
        <CharacterDisplay
          characterId={selected}
          level={1}
          xp={0}
          maxXp={100}
        />

        <div className="char-select-section">
          <h2 className="char-select-title">캐릭터 선택</h2>
          <div className="char-grid stagger">
            {CHARACTERS.map((char) => {
              const locked = completedUnits < char.unlockUnits
              return (
                <button
                  key={char.id}
                  id={`char-${char.id}`}
                  className={`char-option animate-fade-in-up ${selected === char.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
                  onClick={() => handleSelect(char.id)}
                  disabled={locked}
                >
                  <span className="char-opt-icon">
                {locked ? (
                  '🔒'
                ) : (
                  <img src={char.icon} alt={char.name} />
                )}
              </span>
                  <div className="char-opt-name">{char.name}</div>
                  <div className="char-opt-desc">{locked ? `${char.unlockUnits}유닛 완료 후 해금` : char.desc}</div>
                  {selected === char.id && <div className="char-opt-check">✓</div>}
                </button>
              )
            })}
          </div>
        </div>

        <button
          id="btn-save-character"
          className="btn btn-primary btn-full btn-lg"
          onClick={handleSave}
          disabled={saving || selected === user?.character}
        >
          {saved ? '✅ 저장 완료!' : saving ? '저장 중...' : '캐릭터 저장하기'}
        </button>
                        {/* ✅ 여기 추가 */}
                <Title />

      </div>
    </div>
  )
}
