import { useState } from 'react'
import { useAuthStore } from '../../hooks/useAuthStore'
import { userApi } from '../../api/index'


const CHARACTER_ICON = {
  slime:         '/src/assets/character_slime.png',
  robot:         '/src/assets/character_robot.png',
  speech_bubble: '/src/assets/character_bubble.png',
  final_ghost:   '/src/assets/character_final_ghost.png',
}



export default function SettingsProfile() {
  const user       = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)

  const [nickname, setNickname] = useState(user?.nickname || '')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await userApi.updateMe({ nickname })
      updateUser(res.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">프로필</h2>
      <div className="settings-card card">
        <div className="settings-profile-info">
          <div className="settings-avatar" style={{ background: 'transparent', border: 'none', padding: 0 }}>
            <img
              src={CHARACTER_ICON[user?.character] || CHARACTER_ICON.slime}
              alt="내 캐릭터"
              style={{ width: 56, height: 56, objectFit: 'contain' }}
            /> 
          </div>
          </div>
          <div>
            <div className="settings-username">@{user?.username}</div>
            <div className="settings-joined">아이디</div>
          </div>
        </div>
        <div className="divider" />
        <form onSubmit={handleSave} className="settings-form">
          <div className="form-group">
            <label htmlFor="settings-nickname">닉네임</label>
            <input
              id="settings-nickname"
              className="input"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요"
            />
          </div>
          <button
            id="btn-save-profile"
            type="submit"
            className="btn btn-primary"
            disabled={saving || nickname === user?.nickname}
          >
            {saved ? '✅ 저장 완료' : saving ? '저장 중...' : '저장하기'}
          </button>
        </form>
      </div>
    </section>
  )
}
