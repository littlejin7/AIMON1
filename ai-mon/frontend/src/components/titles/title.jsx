import { useState, useEffect } from 'react'
import { useAuthStore } from '../../hooks/useAuthStore'
import { userApi } from '../../api/index'
import './title.css'

// ── 레벨 계산 (Home.jsx와 동일)
function calcLevel(xp) {
  let lv = 1
  let accumulated = 0
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

// ── 레벨 → 테두리 티어
function getRingTier(lv) {
  if (lv >= 30) return 'ring-gold'
  if (lv >= 20) return 'ring-emerald'
  if (lv >= 10) return 'ring-cyan'
  return 'ring-purple'
}

// ── 칭호 아이콘 SVG
const IconFirstStep = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 20h10" /><path d="M12 20V10" />
    <path d="M12 10a4 4 0 0 1 4-4h2" /><path d="M12 14a4 4 0 0 0-4-4H6" />
  </svg>
)
const IconStreak = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FB923C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
)
const IconBossSlayer = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" /><line x1="13" y1="19" x2="19" y2="13" />
    <line x1="16" y1="16" x2="20" y2="20" /><line x1="19" y1="21" x2="21" y2="19" />
    <polyline points="9.5 17.5 21 6 21 3 18 3 6.5 14.5" /><line x1="11" y1="19" x2="5" y2="13" />
    <line x1="8" y1="16" x2="4" y2="20" /><line x1="5" y1="21" x2="3" y2="19" />
  </svg>
)
const IconAiExplorer = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F472B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
    <path d="M9 13h4" /><path d="M12 10v6" /><circle cx="12" cy="13" r="1" fill="#F472B6" />
  </svg>
)
const IconUnitMaster = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M3 20h18" />
  </svg>
)
const IconAimonMaster = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12l4 6-10 12L2 9z" />
    <path d="M11 3 8 9l4 12 4-12-3-6" /><path d="M2 9h20" />
  </svg>
)

// ── 칭호 데이터
const TITLES = [
  { id: 'first_step',   icon: IconFirstStep,  name: '첫 발걸음',    desc: '첫 스테이지 클리어',  condition: (u) => (u?.completed_stages || 0) >= 1 },
  { id: 'streak_7',     icon: IconStreak,      name: '연속학습자',   desc: '7일 스트릭 달성',     condition: (u) => (u?.streak || 0) >= 7 },
  { id: 'boss_slayer',  icon: IconBossSlayer,  name: '보스슬레이어', desc: '첫 보스 클리어',      condition: (u) => (u?.boss_cleared || 0) >= 1 },
  { id: 'ai_explorer',  icon: IconAiExplorer,  name: 'AI 탐구자',    desc: 'AI 피드백 10회 확인', condition: (u) => (u?.ai_feedback_count || 0) >= 10 },
  { id: 'unit_master',  icon: IconUnitMaster,  name: '유닛 마스터',  desc: '유닛 1개 100% 완료',  condition: (u) => (u?.completed_units || 0) >= 1 },
  { id: 'aimon_master', icon: IconAimonMaster, name: '에이몬 마스터', desc: 'Lv.30 달성',         condition: (u) => calcLevel(u?.xp || 0).lv >= 30 },
  { id: 'rookie_coder',  icon: IconUnitMaster,  name: '코드 ROOKIE',   desc: '초급 엔드보스 클리어', condition: (u) => u?.titles?.includes('rookie_coder') },
  { id: 'ace_coder',     icon: IconUnitMaster,  name: 'ACE 코더',      desc: '중급 엔드보스 클리어', condition: (u) => u?.titles?.includes('ace_coder') },
  { id: 'ai_master',     icon: IconAimonMaster, name: 'AI 마스터',     desc: '고급 엔드보스 클리어', condition: (u) => u?.titles?.includes('ai_master') },
]

// ── 캐릭터 이모지 (실제론 PNG지만 mock용)
const CHAR_EMOJI = {
  slime:         '🟣',
  robot:         '🤖',
  speech_bubble: '💬',
  final_ghost:   '👻',
}

// ── mock 유저 (백엔드 연결 전 테스트용)
//    실제 연결 시: useAuthStore의 user 그대로 사용하면 됨
const MOCK_USER = {
  username:          '에이몬유저',
  character:         'slime',
  xp:                3200,
  streak:            9,
  completed_stages:  5,
  completed_units:   1,
  boss_cleared:      1,
  ai_feedback_count: 3,
  equipped_title:    'first_step',    // 장착된 칭호 ID
}

export default function Profile() {
  const authUser = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)

  // 백엔드 연결 전엔 MOCK_USER, 연결 후엔 authUser로 교체
  const user = authUser || MOCK_USER

  const { lv, xpInLevel, xpForNext } = calcLevel(user.xp || 0)
  const xpPct = Math.round((xpInLevel / xpForNext) * 100)
  const ringTier = getRingTier(lv)
  const charEmoji = CHAR_EMOJI[user.character] || '🟣'

  // 칭호: 보유 여부 판정 + 장착 상태 - 유저별 key 사용으로 계정 전환 시 칭호 오염 방지
  const storageKey = `equipped_title_${user?.id || 'guest'}`
  const [equippedTitle, setEquippedTitle] = useState(
    user?.equipped_title || localStorage.getItem(storageKey) || 'first_step'
  )

  useEffect(() => {
    if (user) {
      setEquippedTitle(user.equipped_title || localStorage.getItem(storageKey) || 'first_step')
    }
  }, [user, storageKey])

  const titlesWithState = TITLES.map((t) => ({
    ...t,
    owned:    t.condition(user),
    equipped: t.id === equippedTitle,
  }))

  const currentTitle = TITLES.find((t) => t.id === equippedTitle)

  return (
    <div>
        {/* ── 통계 요약 ── */}
        <div className="pf-stats">
          <div className="pf-stat-card card-glass">
            <span className="pf-stat-val">{user.completed_stages || 0}</span>
            <span className="pf-stat-label">클리어 스테이지</span>
          </div>
          <div className="pf-stat-card card-glass">
            <span className="pf-stat-val">{user.streak || 0}🔥</span>
            <span className="pf-stat-label">연속 학습</span>
          </div>
          <div className="pf-stat-card card-glass">
            <span className="pf-stat-val">{user.boss_cleared || 0}</span>
            <span className="pf-stat-label">보스 처치</span>
          </div>
        </div>

        {/* ── 칭호 선택 ── */}
        <section className="pf-section">
          <h2 className="pf-section-title">🏅 칭호</h2>
          <p className="pf-section-desc">하나를 선택해 프로필에 표시하세요.</p>

          <div className="pf-title-list">
            {titlesWithState.map((t) => (
              <button
                key={t.id}
                className={`pf-title-row ${t.equipped ? 'equipped' : ''} ${!t.owned ? 'locked' : ''}`}
                onClick={async () => {
                  if (!t.owned) return
                  setEquippedTitle(t.id)
                  localStorage.setItem(storageKey, t.id)
                  try {
                    const res = await userApi.updateMe({ equipped_title: t.id })
                    updateUser(res.data)
                  } catch (err) {
                    console.error('Failed to sync equipped title to backend:', err)
                  }
                }}
                disabled={!t.owned}
              >
                <div className="pf-title-left">
                  <span className="pf-badge-emoji"><t.icon /></span>
                  <div>
                    <div className="pf-title-name">{t.name}</div>
                    <div className="pf-title-desc">{t.desc}</div>
                  </div>
                </div>
                <div className="pf-radio">
                  {t.equipped && <div className="pf-radio-dot" />}
                  {!t.owned && <span className="pf-lock">🔒</span>}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── 뱃지 컬렉션 ── */}
        <section className="pf-section">
          <h2 className="pf-section-title">✨ 뱃지 컬렉션</h2>
          <p className="pf-section-desc">조건 달성 시 자동으로 지급됩니다.</p>

          <div className="pf-badge-grid">
            {titlesWithState.map((t) => (
              <div key={t.id} className={`pf-badge-card card-glass ${!t.owned ? 'locked' : ''} ${t.equipped ? 'equipped' : ''}`}>
                <span className="pf-badge-emoji"><t.icon /></span>
                <div className="pf-badge-name">{t.name}</div>
                <div className="pf-badge-desc">{t.desc}</div>
                <span className={`pf-badge-status ${t.equipped ? 'status-equipped' : t.owned ? 'status-owned' : 'status-locked'}`}>
                  {t.equipped ? '장착 중' : t.owned ? '보유' : '미획득'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 프로필 테두리 안내 ── */}
        <section className="pf-section">
          <h2 className="pf-section-title">🎨 프로필 테두리</h2>
          <p className="pf-section-desc">레벨업 시 자동 적용됩니다.</p>

          <div className="pf-ring-list">
            {[
              { tier: 'ring-purple',  label: '슬라임',  range: 'Lv.1 ~ 9',   icon: '/src/assets/character_slime.png', active: lv < 10 },
              { tier: 'ring-cyan',    label: '로봇',    range: 'Lv.10 ~ 19', icon: '/src/assets/character_robot.png', active: lv >= 10 && lv < 20 },
              { tier: 'ring-emerald', label: '말풍선',  range: 'Lv.20 ~ 29', icon: '/src/assets/character_bubble.png', active: lv >= 20 && lv < 30 },
              { tier: 'ring-gold',    label: '파이널',  range: 'Lv.30+',     icon: '/src/assets/character_final_ghost.png', active: lv >= 30 },
            ].map((r) => (
              <div key={r.tier} className={`pf-ring-row card-glass ${r.active ? 'current' : ''}`}>
                <div className={`pf-ring-preview ${r.tier}`}>
                  <span><img src={r.icon} alt={r.label} /></span>
                </div>
                <div className="pf-ring-info">
                  <span className="pf-ring-label">{r.label}</span>
                  <span className="pf-ring-range">{r.range}</span>
                </div>
                {r.active && <span className="pf-current-chip">현재</span>}
              </div>
            ))}
          </div>
        </section>

      </div>

  )
}
