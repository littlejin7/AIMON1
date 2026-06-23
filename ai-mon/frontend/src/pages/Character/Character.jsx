import { useAuthStore } from '../../hooks/useAuthStore'
import { userApi, progressApi } from '../../api/index'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Character.css'

function calcLevel(xp) {
  let lv = 1, accumulated = 0
  while (lv < 30) {
    const needed = lv * 1000
    if (xp < accumulated + needed) return { lv, xpInLevel: xp - accumulated, xpForNext: needed }
    accumulated += needed
    lv++
  }
  const extraXp = xp - accumulated
  const extraLv = Math.floor(extraXp / 30000)
  return { lv: 30 + extraLv, xpInLevel: extraXp % 30000, xpForNext: 30000 }
}

const IconFirstStep  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10"/><path d="M12 20V10"/><path d="M12 10a4 4 0 0 1 4-4h2"/><path d="M12 14a4 4 0 0 0-4-4H6"/></svg>
const IconStreak     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FB923C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
const IconBossSlayer = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="9.5 17.5 21 6 21 3 18 3 6.5 14.5"/><line x1="11" y1="19" x2="5" y2="13"/><line x1="8" y1="16" x2="4" y2="20"/><line x1="5" y1="21" x2="3" y2="19"/></svg>
const IconAiExplorer = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M9 13h4"/><path d="M12 10v6"/><circle cx="12" cy="13" r="1" fill="#F472B6"/></svg>
const IconUnitMaster = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>
const IconAimonMaster= () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><path d="M2 9h20"/></svg>

const TITLES = [
  { id: 'first_step',   Icon: IconFirstStep,   name: '첫 발걸음',    desc: '첫 스테이지 클리어',   condition: (u) => (u?.completed_stages || 0) >= 1 },
  { id: 'streak_7',     Icon: IconStreak,       name: '연속학습자',   desc: '7일 스트릭 달성',      condition: (u) => (u?.streak || 0) >= 7 },
  { id: 'boss_slayer',  Icon: IconBossSlayer,   name: '보스슬레이어', desc: '첫 보스 클리어',       condition: (u) => (u?.boss_cleared || 0) >= 1 },
  { id: 'ai_explorer',  Icon: IconAiExplorer,   name: 'AI 탐구자',    desc: 'AI 피드백 10회 확인',  condition: (u) => (u?.ai_feedback_count || 0) >= 10 },
  { id: 'unit_master',  Icon: IconUnitMaster,   name: '유닛 마스터',  desc: '유닛 1개 100% 완료',   condition: (u) => (u?.completed_units || 0) >= 1 },
  { id: 'aimon_master', Icon: IconAimonMaster,  name: '에이몬 마스터',desc: 'Lv.30 달성',           condition: (u) => calcLevel(u?.xp || 0).lv >= 30 },
  { id: 'rookie_coder', Icon: IconUnitMaster,   name: '코드 ROOKIE',  desc: '초급 엔드보스 클리어', condition: (u) => u?.titles?.includes('rookie_coder') },
  { id: 'ace_coder',    Icon: IconUnitMaster,   name: 'ACE 코더',     desc: '중급 엔드보스 클리어', condition: (u) => u?.titles?.includes('ace_coder') },
  { id: 'ai_master',    Icon: IconAimonMaster,  name: 'AI 마스터',    desc: '고급 엔드보스 클리어', condition: (u) => u?.titles?.includes('ai_master') },
]

const CHARACTERS = [
  { id: 'slime',         icon: '/src/assets/character_slime.png',      name: '에이몬 슬라임', desc: '기본 캐릭터',         unlockUnits: 0 },
  { id: 'robot',         icon: '/src/assets/character_robot.png',       name: '에이몬 로봇',   desc: 'Unit 3 완료 시 해금', unlockUnits: 3 },
  { id: 'speech_bubble', icon: '/src/assets/character_bubble.png',      name: '에이몬 말풍선', desc: 'Unit 6 완료 시 해금', unlockUnits: 6 },
  { id: 'final_ghost',   icon: '/src/assets/character_final_ghost.png', name: '파이널 에이몬', desc: 'Unit 8 완료 시 해금', unlockUnits: 8 },
]

const CHAR_ICONS = Object.fromEntries(CHARACTERS.map(c => [c.id, c.icon]))

export default function Character() {
  const navigate   = useNavigate()
  const token      = useAuthStore((s) => s.token)
  const user       = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)

  const [selected,      setSelected]      = useState(user?.character || 'slime')
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [stats,         setStats]         = useState(null)
  const [equippedTitle, setEquippedTitle] = useState(
    user?.equipped_title || localStorage.getItem(`equipped_title_${user?.id || 'guest'}`) || 'first_step'
  )

  useEffect(() => {
    if (token) {
      progressApi.getStats().then(r => setStats(r.data)).catch(() => {})
    }
  }, [token])

  useEffect(() => {
    if (user) {
      const key = `equipped_title_${user?.id || 'guest'}`
      setEquippedTitle(user.equipped_title || localStorage.getItem(key) || 'first_step')
    }
  }, [user])

  if (!token) {
    return (
      <div className="char-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '75vh' }}>
        <div className="char-section-card card-glass animate-fade-in-up" style={{ width: '100%', maxWidth: '450px', padding: '3.5rem 2rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', margin: '2rem auto' }}>
          
          <button 
            onClick={() => navigate('/')}
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--clr-text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
            aria-label="닫기"
          >
            ✕
          </button>

          <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem', textShadow: '0 0 20px rgba(124,58,237,0.3)' }}>🔒</div>
          
          <h2 style={{ color: 'var(--clr-text-bright)', marginBottom: '0.8rem', fontSize: '1.75rem', fontWeight: 800 }}>
            내 캐릭터 커스터마이징 잠김
          </h2>
          
          <p style={{ color: 'var(--clr-text-muted)', lineHeight: '1.6', marginBottom: '2.5rem', fontSize: '0.95rem' }}>
            로그인하시면 나만의 캐릭터와 칭호를 변경하고,<br />
            학습 진행 상황에 따라 새로운 캐릭터를 해금할 수 있습니다!
          </p>

          <button className="btn btn-primary btn-lg btn-full" onClick={() => navigate('/auth')}>
            로그인하러 가기
          </button>
        </div>
      </div>
    );
  }

  const completedUnits = Math.floor((stats?.completed_stages || 0) / 7)
  const { lv, xpInLevel, xpForNext } = calcLevel(user?.xp || 0)
  const xpPct = Math.round((xpInLevel / xpForNext) * 100)

  const latestUnlocked = [...CHARACTERS].reverse().find(c => completedUnits >= c.unlockUnits)
  const selectedChar   = CHARACTERS.find(c => c.id === selected) || CHARACTERS[0]

  const handleSelect = (id) => {
    const char = CHARACTERS.find(c => c.id === id)
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

  const handleEquipTitle = async (titleId) => {
    const key = `equipped_title_${user?.id || 'guest'}`
    setEquippedTitle(titleId)
    localStorage.setItem(key, titleId)
    try {
      const res = await userApi.updateMe({ equipped_title: titleId })
      updateUser(res.data)
    } catch (err) {
      console.error('칭호 저장 실패:', err)
    }
  }

  const titlesWithState = TITLES.map(t => ({
    ...t,
    owned:    t.condition(user),
    equipped: t.id === equippedTitle,
  }))

  return (
    <div className="char-page">

      {latestUnlocked && latestUnlocked.unlockUnits > 0 && (
        <div className="char-level-banner">
          ⭐ {latestUnlocked.name} 해금!
        </div>
      )}

      <div className="char-hero">
        <h1 className="char-hero-title">내 캐릭터</h1>
        <p className="char-hero-sub">캐릭터를 선택하고 칭호를 장착하세요</p>
      </div>

      <div className="char-visual-area">
        <img
          src={CHAR_ICONS[selected]}
          alt={selectedChar.name}
          className="char-visual-img animate-bob"
        />
      </div>

      <div className="char-info-card">
        <div className="char-info-header">
          <div>
            <p className="char-info-name">{selectedChar.name}</p>
            <p className="char-info-sub">{selectedChar.desc} · Lv. {lv}</p>
          </div>
          <div className="char-info-badge">
            <img src={CHAR_ICONS[selected]} alt="" />
          </div>
        </div>
        <div className="char-stats-row">
          <div className="char-stat">
            <span className="char-stat-label">클리어 스테이지</span>
            <span className="char-stat-val">{user?.completed_stages || 0}개</span>
          </div>
          <div className="char-stat">
            <span className="char-stat-label">연속 학습</span>
            <span className="char-stat-val">{user?.streak || 0}일 🔥</span>
          </div>
          <div className="char-stat">
            <span className="char-stat-label">보스 처치</span>
            <span className="char-stat-val">{user?.boss_cleared || 0}회</span>
          </div>
        </div>
        <div className="char-xp-row">
          <span>XP 진행도</span>
          <span>{xpPct}%</span>
        </div>
        <div className="char-xp-bar">
          <div className="char-xp-fill" style={{ width: `${xpPct}%` }} />
        </div>
      </div>

      <div className="char-section-card">
        <p className="char-section-title">🤖 캐릭터 변경</p>
        <div className="char-grid">
          {CHARACTERS.map(char => {
            const locked = completedUnits < char.unlockUnits
            const active = selected === char.id
            return (
              <button
                key={char.id}
                className={`char-option ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}
                onClick={() => handleSelect(char.id)}
                disabled={locked}
              >
                <span className="char-opt-img">
                  {locked
                    ? <span style={{ fontSize: '1.8rem' }}>🔒</span>
                    : <img src={char.icon} alt={char.name} />
                  }
                </span>
                <div className="char-opt-name">{char.name}</div>
                <div className="char-opt-desc">
                  {locked ? `Unit ${char.unlockUnits} 완료 후 해금` : char.desc}
                </div>
                {active && <div className="char-opt-check">✓</div>}
              </button>
            )
          })}
        </div>
        <button
          className="btn btn-primary btn-full"
          onClick={handleSave}
          disabled={saving || selected === user?.character}
        >
          {saved ? '✅ 저장 완료!' : saving ? '저장 중...' : '캐릭터 저장하기'}
        </button>
      </div>

      <div className="char-section-card">
        <p className="char-section-title">🏅 칭호 선택</p>
        <p className="char-section-desc">하나를 선택해 프로필에 표시하세요</p>
        <div className="char-title-list">
          {titlesWithState.map(({ id, Icon, name, desc, owned, equipped }) => (
            <button
              key={id}
              className={`char-title-row ${equipped ? 'equipped' : ''} ${!owned ? 'locked' : ''}`}
              onClick={() => owned && handleEquipTitle(id)}
              disabled={!owned}
            >
              <span className="char-title-icon"><Icon /></span>
              <div className="char-title-info">
                <div className="char-title-name">{name}</div>
                <div className="char-title-desc">{desc}</div>
              </div>
              <div className={`char-title-radio ${equipped ? 'on' : ''}`}>
                {equipped && <div className="char-title-dot" />}
                {!owned && <span style={{ fontSize: '0.8rem' }}>🔒</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: '90px' }} />
    </div>
  )
}
