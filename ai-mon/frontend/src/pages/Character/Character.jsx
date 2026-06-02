import { useAuthStore } from '../../hooks/useAuthStore'
import { userApi } from '../../api/index'
import { useState } from 'react'
import CharacterDisplay from '../../components/CharacterDisplay/CharacterDisplay'
import './Character.css'

const CHARACTERS = [
  { id: 'default', emoji: '🤖', name: '에이몬 기본형', desc: '기본 캐릭터. 균형 잡힌 능력치', unlock: 0 },
  { id: 'fire',    emoji: '🔥', name: '파이어봇',      desc: '공격적인 스타일. 높은 퀴즈 점수 보너스', unlock: 5 },
  { id: 'cyber',   emoji: '⚡', name: '사이버봇',      desc: '분석 특화. 오답 힌트 강화', unlock: 10 },
  { id: 'crystal', emoji: '💎', name: '크리스탈봇',    desc: '최강의 캐릭터. 모든 능력치 강화', unlock: 20 },
]

export default function Character() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const [selected, setSelected] = useState(user?.character || 'default')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  const completedStages = 0 // TODO: pull from progress store

  const handleSelect = (id) => {
    const char = CHARACTERS.find((c) => c.id === id)
    if (completedStages < char.unlock) return
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
              const locked = completedStages < char.unlock
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
                  <div className="char-opt-desc">{locked ? `${char.unlock}스테이지 완료 후 해금` : char.desc}</div>
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
