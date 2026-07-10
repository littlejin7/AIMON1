import { useAuthStore } from '../../hooks/useAuthStore'
import { userApi, progressApi } from '../../api/index'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TITLES, CHARACTERS, CHAR_ICONS, CERT_THEMES, TITLE_ICON_BG } from './characterData'
import './Character.css'

export default function Character() {
  const navigate   = useNavigate()
  const token      = useAuthStore((s) => s.token)
  const user       = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const logout     = useAuthStore((s) => s.logout)

  const [selected,      setSelected]      = useState(user?.character || 'slime')
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [saveError,     setSaveError]     = useState('')
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
      <div className="char-page app-locked-screen">
        <div className="char-section-card card-glass animate-fade-in-up app-locked-card">
          
          <button 
            onClick={() => navigate('/')}
            className="app-locked-close no-3d"
            aria-label="닫기"
          >
            ✕
          </button>

          <div className="app-locked-icon">🔒</div>
          
          <h2 className="app-locked-title">
            내 캐릭터 설정 잠김
          </h2>
          
          <p className="app-locked-desc">
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

  const clearedLevels = Array.isArray(user?.endboss_cleared_levels) ? user.endboss_cleared_levels : []
  const isCharUnlocked = (char) => !char.requiredLevel || clearedLevels.includes(char.requiredLevel)

  // lv/evolution_stage 는 백엔드 값 직접 사용 — 프론트에서 누적치로 재계산하지 않는다.
  const lv = user?.lv || 1
  const evolutionStage = user?.evolution_stage || 0
  const coinBalance = user?.coin_balance || 0
  const gp = user?.gp || 0

  const latestUnlocked = [...CHARACTERS].reverse().find(c => isCharUnlocked(c))
  const selectedChar   = CHARACTERS.find(c => c.id === selected) || CHARACTERS[0]

  const handleSelect = (id) => {
    const char = CHARACTERS.find(c => c.id === id)
    if (!isCharUnlocked(char)) return
    setSelected(id)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await userApi.updateMe({ character: selected })
      updateUser(res.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      const message = err?.response?.data?.detail || '캐릭터 저장에 실패했어요. 다시 시도해 주세요.'
      console.error('캐릭터 저장 실패:', err)
      setSaveError(message)
      // 저장 실패 시 선택값을 실제 저장된 캐릭터로 되돌려 UI가 거짓으로 "선택됨" 표시하지 않게 한다.
      setSelected(user?.character || 'slime')
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

  const bossCleared = user?.boss_cleared || 0

  // 장착 중인 칭호 이름
  const equippedTitleName = titlesWithState.find(t => t.id === equippedTitle)?.name || ''
  const equippedTitleMeta = titlesWithState.find(t => t.id === equippedTitle) || null
  const EquippedTitleIcon = equippedTitleMeta?.Icon || null

  const handleLogout = () => {
    logout?.()
    navigate('/auth')
  }

  return (
    <div className="char-page">
      <div className="char-shell">

      {/* ── 히어로 (보라 배경) ── */}
      <div className="char-hero-bg">
        <div className="char-hero-body">
          <div className="char-hero-top-meta">
            <span className="char-hero-stage-badge">
              {stats?.current_unit ? `Unit ${stats.current_unit} · Stage ${stats.current_stage || 1}` : 'Unit 1 · Stage 1'}
            </span>
            <span className="char-hero-character-badge">{selectedChar.name}</span>
          </div>
          <div className="char-hero-meta">
            <div className="char-hero-name-row">
              <span className="char-hero-username">{user?.nickname || user?.username || user?.email?.split('@')[0] || '유저'}</span>
              <span className="char-hero-inline-lv">Lv. {lv}</span>
            </div>
            {equippedTitleMeta && (
              <span className="char-hero-title-badge">
                {EquippedTitleIcon && (
                  <span
                    className="char-hero-title-icon"
                    style={{ background: TITLE_ICON_BG[equippedTitle]?.bg || 'rgba(255,255,255,0.16)' }}
                  >
                    <EquippedTitleIcon />
                  </span>
                )}
                <span>{equippedTitleName}</span>
              </span>
            )}
          </div>
          <div className="char-hero-glow">
            <img
              src={CHAR_ICONS[selected]}
              alt={selectedChar.name}
              className="char-visual-img animate-bob"
            />
          </div>
          {user?.course_level && (
            <span className="char-hero-level-badge">
              {{ beginner: '🟢 초급', intermediate: '🔵 중급', advanced: '🟣 고급' }[user.course_level]}
            </span>
          )}
          <div className="char-hero-status">
            {evolutionStage >= 3 && (
              <p className="char-hero-status-hint">💠 GP {gp.toLocaleString()}</p>
            )}
          </div>
        </div>
      </div>


      <div className="char-scroll">

        {latestUnlocked && latestUnlocked.requiredLevel && (
          <div className="char-level-banner">⭐ {latestUnlocked.name} 해금!</div>
        )}

        {/* ── 학습 스탯 ── */}
        <p className="char-section-label">📊 학습 스탯</p>
        <div className="char-stats-grid">
          <div className="char-stat-card">
            <div className="char-stat-icon" style={{ background: 'rgba(133,79,11,0.18)' }}>🔥</div>
            <div className="char-stat-val">{user?.streak || 0}일</div>
            <div className="char-stat-label">최장 스트릭</div>
          </div>
          <div className="char-stat-card">
            <div className="char-stat-icon" style={{ background: 'rgba(83,74,183,0.18)' }}>🪙</div>
            <div className="char-stat-val">{coinBalance.toLocaleString()}</div>
            <div className="char-stat-label">보유 코인</div>
          </div>
          <div className="char-stat-card">
            <div className="char-stat-icon" style={{ background: 'rgba(245,158,11,0.18)' }}>👑</div>
            <div className="char-stat-val">{user?.crowns || 0}개</div>
            <div className="char-stat-label">보유 왕관</div>
          </div>
          <div className="char-stat-card">
            <div className="char-stat-icon" style={{ background: 'rgba(163,45,45,0.15)' }}>⚔️</div>
            <div className="char-stat-val">{bossCleared}회</div>
            <div className="char-stat-label">보스 클리어</div>
          </div>
        </div>

        {/* ── 캐릭터 변경 ── */}
        <div className="char-section-header">
          <p className="char-section-label">😺 캐릭터 변경</p>
          <button
            className="char-save-btn-inline"
            onClick={handleSave}
            disabled={saving || selected === user?.character}
          >
            {saved ? '✅ 완료' : saving ? '저장 중' : '저장하기'}
          </button>
        </div>
        {saveError && <p className="char-save-error">⚠ {saveError}</p>}
        <div className="char-section-card">
          <div className="char-grid">
            {CHARACTERS.map(char => {
              const locked = !isCharUnlocked(char)
              const active = selected === char.id
              return (
                <button
                  key={char.id}
                  className={`char-option ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}
                  onClick={() => handleSelect(char.id)}
                  disabled={locked}
                >
                  {active && <div className="char-opt-check">✓</div>}
                  {locked && <div className="char-opt-lock">🔒</div>}
                  <span className="char-opt-img">
                    {locked
                      ? <span style={{ fontSize: '1.8rem', opacity: 0.4 }}>👾</span>
                      : <img src={char.icon} alt={char.name} />
                    }
                  </span>
                  <div className="char-opt-name">{locked ? <span style={{ color: 'var(--clr-text-faint)' }}>{char.name}</span> : char.name}</div>
                  <div className="char-opt-desc">
                    {locked
                      ? `${{ beginner: '초급', intermediate: '중급', advanced: '고급' }[char.requiredLevel]} 클리어 후 해금`
                      : char.desc}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 칭호 선택 ── */}
        <div className="char-section-header char-section-header--hint">
          <p className="char-section-label">🏅 칭호 선택</p>
          <p className="char-section-hint">하나를 선택해 프로필에 표시하세요</p>
        </div>
        <div className="char-title-list">
          {titlesWithState.map(({ id, Icon, name, desc, owned, equipped }) => {
            const meta = TITLE_ICON_BG[id] || { bg: 'rgba(255,255,255,0.06)', color: '#aaa' }
            return (
              <button
                key={id}
                className={`char-title-row no-3d ${equipped ? 'equipped' : ''} ${!owned ? 'locked' : ''}`}
                onClick={() => owned && handleEquipTitle(id)}
                disabled={!owned}
              >
                <div className="char-title-icon" style={{ background: meta.bg }}>
                  <Icon />
                </div>
                <div className="char-title-info">
                  <div className="char-title-name-row">
                    <span className="char-title-name" style={!owned ? { color: 'var(--clr-text-faint)' } : {}}>{name}</span>
                  </div>
                  <div className="char-title-desc">{desc}</div>
                </div>
                {!owned
                  ? <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>🔒</span>
                  : equipped
                  ? <span className="char-title-equip-btn on">장착중</span>
                  : <span className="char-title-equip-btn">장착</span>
                }
              </button>
            )
          })}
        </div>

        {/* ── 인증카드 ── */}
        <p className="char-section-label">🎖 인증카드</p>
        <div className="char-cert-scroll">
          {CERT_THEMES.map((theme) => {
            const earned = clearedLevels.includes(theme.level)
            if (!earned) {
              return (
                <div key={theme.level} className="char-cert-card char-cert-locked">
                  <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>🔒</div>
                  <div className="char-cert-locked-text">{theme.label}<br />엔드보스 클리어 후 해금</div>
                </div>
              )
            }
            return (
              <div key={theme.level} className="char-cert-card">
                <div className="char-cert-top" style={{ background: theme.grad }}>
                  <div className="char-cert-badge">{theme.badge}</div>
                  <div className="char-cert-name">{theme.label}</div>
                </div>
                <div className="char-cert-body" style={{ background: theme.bodyBg }}>
                  <img src={CHAR_ICONS[theme.character] || CHAR_ICONS.slime} alt="에이몬" className="char-cert-img" />
                </div>
                <div className="char-cert-footer" style={{ background: theme.footerBg }}>
                  <span className="char-cert-date">엔드보스 클리어</span>
                  <span className="char-cert-share">↗ 공유</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── 내 방꾸미기 ── */}
        <p className="char-section-label">🏠 내 방꾸미기</p>
        <div className="char-section-card">
          <p className="char-custom-subtitle" style={{ textAlign: 'center', padding: '32px 0' }}>
            🚧 준비중입니다
          </p>
        </div>

        {/* ── 로그아웃 ── */}
        <button className="char-logout-btn" onClick={handleLogout}>
          <span style={{ fontSize: '1rem' }}>↩</span>
          <span>로그아웃</span>
        </button>

      </div>
      </div>
    </div>
  )
}
