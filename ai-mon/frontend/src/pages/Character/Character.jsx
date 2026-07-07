import { useAuthStore } from '../../hooks/useAuthStore'
import { userApi, progressApi } from '../../api/index'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { calcLevel, TITLES, CHARACTERS, CHAR_ICONS, CERT_THEMES, TITLE_ICON_BG } from './characterData'
import './Character.css'

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

  const { lv, xpInLevel, xpForNext } = calcLevel(user?.xp || 0)
  const xpPct = Math.round((xpInLevel / xpForNext) * 100)

  const latestUnlocked = [...CHARACTERS].reverse().find(c => isCharUnlocked(c))
  const selectedChar   = CHARACTERS.find(c => c.id === selected) || CHARACTERS[0]

  const handleSelect = (id) => {
    const char = CHARACTERS.find(c => c.id === id)
    if (!isCharUnlocked(char)) return
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

  const bossCleared = user?.boss_cleared || 0
  const earnedCerts = CERT_THEMES.filter(theme => clearedLevels.includes(theme.level))
  const nextCert = CERT_THEMES.find(theme => !clearedLevels.includes(theme.level))

  // 장착 중인 칭호 이름
  const equippedTitleName = titlesWithState.find(t => t.id === equippedTitle)?.name || ''

  const logout = useAuthStore((s) => s.logout)
  const handleLogout = () => {
    logout?.()
    navigate('/auth')
  }

  return (
    <div className="char-page">

      {/* ── 히어로 (보라 배경) ── */}
      <div className="char-hero-bg">
        <div className="char-hero-topbar">
          <span className="char-hero-logo">AIMON</span>
          <button className="char-hero-settings" onClick={() => navigate('/settings')} aria-label="설정">
            ⚙️
          </button>
        </div>
        <div className="char-hero-body">
          {equippedTitleName && (
            <div className="char-hero-title-badge">🎖 {equippedTitleName}</div>
          )}
          {user?.course_level && (
            <div className="char-hero-level-badge">
              {{ beginner: '🟢 초급', intermediate: '🔵 중급', advanced: '🟣 고급' }[user.course_level]}
            </div>
          )}
          <p className="char-hero-username">{user?.nickname || user?.username || user?.email?.split('@')[0] || '유저'}</p>
          <div className="char-hero-glow">
            <img
              src={CHAR_ICONS[selected]}
              alt={selectedChar.name}
              className="char-visual-img animate-bob"
            />
          </div>
          <div className="char-hero-xp">
            <div className="char-hero-xp-row">
              <span className="char-hero-xp-lv">Lv. {lv} · {selectedChar.name}</span>
              <span className="char-hero-xp-num">{(user?.xp || 0).toLocaleString()} XP</span>
            </div>
            <div className="char-hero-xp-bar">
              <div className="char-hero-xp-fill" style={{ width: `${xpPct}%` }} />
            </div>
            <p className="char-hero-xp-hint">다음 레벨까지 {xpForNext - xpInLevel} XP 남았어요</p>
          </div>
        </div>
      </div>

      {/* ── 보상 스트립 ── */}
      <div className="char-reward-strip">
        <div className="char-ri">
          <span className="char-ri-val">👑 {user?.crowns || 0}</span>
          <span className="char-ri-label">보유 왕관</span>
        </div>
        <div className="char-ri">
          <span className="char-ri-val">🔥 {user?.streak || 0}일</span>
          <span className="char-ri-label">연속 학습</span>
        </div>
        <div className="char-ri">
          <span className="char-ri-val">⚔️ {bossCleared}회</span>
          <span className="char-ri-label">보스 클리어</span>
        </div>
      </div>

      <div className="char-scroll">

        {latestUnlocked && latestUnlocked.requiredLevel && (
          <div className="char-level-banner">⭐ {latestUnlocked.name} 해금!</div>
        )}

        {/* ── 학습 스탯 ── */}
        <p className="char-section-label">학습 스탯</p>
        <div className="char-stats-grid">
          <div className="char-stat-card">
            <div className="char-stat-icon" style={{ background: 'rgba(83,74,183,0.18)' }}>⚡</div>
            <div className="char-stat-val">{(user?.xp || 0).toLocaleString()}</div>
            <div className="char-stat-label">누적 XP</div>
          </div>
          <div className="char-stat-card">
            <div className="char-stat-icon" style={{ background: 'rgba(15,110,86,0.18)' }}>📈</div>
            <div className="char-stat-val">{stats?.accuracy != null ? `${Math.round(stats.accuracy)}%` : '—'}</div>
            <div className="char-stat-label">전체 정답률</div>
          </div>
          <div className="char-stat-card">
            <div className="char-stat-icon" style={{ background: 'rgba(133,79,11,0.18)' }}>🔥</div>
            <div className="char-stat-val">{user?.streak || 0}일</div>
            <div className="char-stat-label">최장 스트릭</div>
          </div>
          <div className="char-stat-card">
            <div className="char-stat-icon" style={{ background: 'rgba(163,45,45,0.15)' }}>🧠</div>
            <div className="char-stat-val">{stats?.total_answers || user?.completed_stages || 0}개</div>
            <div className="char-stat-label">총 푼 문제</div>
          </div>
        </div>

        {/* ── 캐릭터 변경 ── */}
        <p className="char-section-label">😺 캐릭터 변경</p>
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
          <button
            className="char-save-btn"
            onClick={handleSave}
            disabled={saving || selected === user?.character}
          >
            {saved ? '✅ 저장 완료!' : saving ? '저장 중...' : '캐릭터 저장하기'}
          </button>
        </div>

        {/* ── 칭호 선택 ── */}
        <p className="char-section-label">🏅 칭호 선택</p>
        <p className="char-section-hint">하나를 선택해 프로필에 표시하세요</p>
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
        {earnedCerts.length > 0 && (
          <>
            <p className="char-section-label">🎖 인증카드</p>
            <div className="char-cert-scroll">
              {earnedCerts.map((theme) => {
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
              {nextCert && (
                <div className="char-cert-card char-cert-locked">
                  <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>🔒</div>
                  <div className="char-cert-locked-text">{nextCert.label}<br />엔드보스 클리어 후 해금</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── 캐릭터 커스텀 ── */}
        <p className="char-section-label">🎨 캐릭터 커스텀</p>
        <div className="char-section-card">
          <p className="char-custom-subtitle">색상 팔레트 · 왕관으로 구매</p>
          <div className="char-palette-row">
            {[
              { color: '#7F77DD', unlocked: true  },
              { color: '#378ADD', unlocked: true  },
              { color: '#1D9E75', unlocked: true  },
              { color: '#EF9F27', unlocked: false },
              { color: '#D4537E', unlocked: false },
              { color: '#26215C', unlocked: false },
            ].map(({ color, unlocked }) => (
              <div
                key={color}
                className={`char-swatch${!unlocked ? ' locked' : ''}`}
                style={{ background: color }}
                aria-label={color}
              >
                {!unlocked && <span className="char-swatch-lock">🔒</span>}
              </div>
            ))}
          </div>
          <div className="char-custom-divider" />
          <p className="char-custom-subtitle" style={{ marginBottom: 8 }}>이펙트</p>
          <div className="char-effect-row">
            <div className="char-effect active">✨ 반짝이</div>
            <div className="char-effect locked">🔥 불꽃 🔒</div>
            <div className="char-effect locked">⚡ 전기 🔒</div>
          </div>
        </div>

        {/* ── 터미널 테마 ── */}
        <p className="char-section-label">💻 터미널 테마</p>
        <div className="char-theme-card">
          {[
            {
              bg: '#1a1a2e', lines: ['#7F77DD', '#AFA9EC', '#CECBF6'],
              name: '에이몬 퍼플', sub: '기본 테마', active: true, locked: false,
            },
            {
              bg: '#0d1117', lines: ['#58a6ff', '#79c0ff', '#d2a8ff'],
              name: '깃허브 다크', sub: 'Unit 4 보스 클리어 후 해금', active: false, locked: true,
            },
            {
              bg: '#001b00', lines: ['#00ff41', '#00cc33', '#008f11'],
              name: '매트릭스', sub: '엔드보스 클리어 후 해금', active: false, locked: true,
            },
          ].map(({ bg, lines, name, sub, active, locked }) => (
            <div key={name} className={`char-theme-row${locked ? ' locked' : ''}`}>
              <div className="char-theme-preview" style={{ background: bg }}>
                {lines.map((c, i) => (
                  <div key={i} className="char-theme-line" style={{ background: c, width: ['70%','45%','55%'][i] }} />
                ))}
              </div>
              <div className="char-theme-info">
                <div className="char-theme-name" style={active ? { color: 'var(--clr-primary)' } : {}}>
                  {name}{active ? ' ✓' : ''}
                </div>
                <div className="char-theme-sub">{sub}</div>
              </div>
              {active
                ? <span className="char-theme-active-label">사용 중</span>
                : <span style={{ fontSize: '0.85rem' }}>🔒</span>
              }
            </div>
          ))}
        </div>

        {/* ── 로그아웃 ── */}
        <button className="char-logout-btn" onClick={handleLogout}>
          <span style={{ fontSize: '1rem' }}>↩</span>
          <span>로그아웃</span>
        </button>

      </div>
    </div>
  )
}
