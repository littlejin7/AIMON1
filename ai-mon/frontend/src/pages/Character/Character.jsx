import { useAuthStore } from '../../hooks/useAuthStore'
import { userApi, progressApi } from '../../api/index'
import { useState, useEffect } from 'react'
import CharacterDisplay from '../../components/CharacterDisplay/CharacterDisplay'
import './Character.css'

const CHARACTERS = [
  { id: 'slime',         emoji: '🟣', name: '에이몬 슬라임', desc: '기본 캐릭터', unlockUnits: 0 },
  { id: 'robot',         emoji: '🤖', name: '에이몬 로봇', desc: 'Unit 3 완료 시 해금', unlockUnits: 3 },
  { id: 'speech_bubble', emoji: '💬', name: '에이몬 말풍선', desc: 'Unit 6 완료 시 해금', unlockUnits: 6 },
  { id: 'final_ghost',   emoji: '👻', name: '파이널 에이몬', desc: 'Unit 8 완료 시 해금', unlockUnits: 8 },
]

export default function Character() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
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
        <h1 className="page-title">🤖 내 캐릭터</h1>
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
                  <span className="char-opt-emoji">{locked ? '🔒' : char.emoji}</span>
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
      </div>
    </div>
  )
}
