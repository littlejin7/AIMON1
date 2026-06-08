import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { progressApi, userApi } from '../../api/index'
import { useAuthStore } from '../../hooks/useAuthStore'
import slimeIcon from '../../assets/character_slime.png'
import robotIcon from '../../assets/character_robot.png'
import speechBubbleIcon from '../../assets/character_bubble.png'
import finalGhostIcon from '../../assets/character_final_ghost.png'
import LevelTestModal from '../../components/LevelTestModal/LevelTestModal'
import './Home.css'

// 기획안 기준 에이몬 진화 단계
const EVOLUTION_STAGES = [
  {
    id: 'slime',
    icon: slimeIcon,
    name: '에이몬 슬라임',
    unitRange: 'Lv.1 ~ 9',
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.5)',
    desc: '동글동글한 보라 슬라임 · 왕관 · </> 배지',
  },
  {
    id: 'robot',
    icon: robotIcon,
    name: '에이몬 로봇',
    unitRange: 'Lv.10 ~ 19',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.5)',
    desc: '헤드폰 달린 보라 로봇 · 왕관 · 입체감 UP',
  },
  {
    id: 'speech_bubble',
    icon: speechBubbleIcon,
    name: '에이몬 말풍선',
    unitRange: 'Lv.20 ~ 29',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.5)',
    desc: '말풍선 몸체 · 흰 얼굴 패널 · {} </> 배지',
  },
  {
    id: 'final_ghost',
    icon: finalGhostIcon,
    name: '파이널 에이몬',
    unitRange: 'Lv.30+',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.5)',
    desc: '연보라 반투명 고스트 · AI 배지 · 프리미엄',
  },
]

// 캐릭터 ID → 현재 진화 단계
function getEvolutionStage(characterId) {
  const stage = EVOLUTION_STAGES.find(s => s.id === characterId)
  return stage || EVOLUTION_STAGES[0]
}

// XP 레벨 테이블
function calcLevel(xp) {
  let lv = 1
  let accumulated = 0

  while (lv < 30) {
    const needed = lv * 1000
    if (xp < accumulated + needed) {
      return {
        lv,
        xpInLevel: xp - accumulated,
        xpForNext: needed
      }
    }
    accumulated += needed
    lv++
  }

  // Lv.30+ 리미트 해제
  const extraXp = xp - accumulated
  const extraLv = Math.floor(extraXp / 30000)
  return {
    lv: 30 + extraLv,
    xpInLevel: extraXp % 30000,
    xpForNext: 30000
  }
}

export default function Home() {
  const user     = useAuthStore((s) => s.user)
  const token    = useAuthStore((s) => s.token)
  const updateUser = useAuthStore((s) => s.updateUser)
  const navigate = useNavigate()

  const [stats,         setStats]         = useState(null)
  const [loading,       setLoading]       = useState(!!token)
  const [showLevelTest, setShowLevelTest] = useState(false)

  const handleLevelTestFinish = async (levelKey) => {
    if (token) {
      try {
        const res = await userApi.updateMe({ course_level: levelKey, is_level_tested: true })
        updateUser(res.data)
        navigate('/lesson')
      } catch (err) {
        alert('레벨 설정 변경에 실패했습니다.')
      } finally {
        setShowLevelTest(false)
      }
    } else {
      navigate(`/auth?level=${levelKey}&mode=register`)
    }
  }

  useEffect(() => {
    if (!token) { setLoading(false); return }
    Promise.all([
      progressApi.getStats(),
      userApi.getMe()
    ])
      .then(([statsRes, userRes]) => {
        setStats(statsRes.data)
        updateUser(userRes.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [token, updateUser])

  /* ── 비로그인 랜딩 ── */
  if (!token) {
    return (
      <div className="home-page">
        {showLevelTest && (
          <LevelTestModal
            onClose={() => setShowLevelTest(false)}
            onFinish={handleLevelTestFinish}
            isLoggedIn={false}
          />
        )}

        {/* 히어로 섹션 */}
        <div className="home-hero">

          <div className="home-hero-char animate-float">
            <img src={slimeIcon} alt="에이몬 슬라임" />
          </div>
          <div className="home-hero-badge animate-fade-in">AI MON</div>
          <h1 className="home-hero-title animate-fade-in-up">
            에이몬과 함께<br />
            <span className="home-hero-accent">파이썬을 정복</span>하세요
          </h1>
          <p className="home-hero-sub animate-fade-in-up">
            Python 기초부터 AI 에이전트까지<br />
            게임하듯 재미있는 코딩 학습
          </p>

          <div className="home-hero-actions animate-fade-in-up">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate('/stage/1/1')}
              id="btn-free-trial"
            >
              🚀 바로 체험하기
            </button>
            <button
              className="btn btn-ghost btn-lg"
              onClick={() => navigate('/level-test-info')}
              id="btn-level-test"
              style={{ border: '1px solid rgba(124,58,237,0.45)', color: 'var(--clr-primary-lt)' }}
            >
              🔍 내 에이몬 찾기 (레벨 테스트)
            </button>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '8px', fontSize: '0.88rem' }}>
              <button
                id="btn-register-home"
                onClick={() => navigate('/auth?mode=register')}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: 'var(--clr-primary-lt)', textDecoration: 'underline',
                  cursor: 'pointer', fontWeight: 600
                }}
              >
                회원가입
              </button>
              <span style={{ color: 'var(--clr-text-faint)' }}>|</span>
              <button
                id="btn-login-home"
                onClick={() => navigate('/auth?mode=login')}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: 'var(--clr-text-muted)', cursor: 'pointer'
                }}
              >
                이미 계정이 있어요 (로그인)
              </button>
            </div>
          </div>
        </div>

        {/* 진화 프리뷰 */}
        <div className="home-evo-preview container">
          <h2 className="home-section-title">🌟 에이몬 진화 여정</h2>
          <div className="home-evo-track">
            {EVOLUTION_STAGES.map((stage, i) => (
              <div key={stage.id} className="home-evo-step">
                <div
                  className="home-evo-orb"
                  style={{ boxShadow: `0 0 20px ${stage.glow}`, borderColor: stage.color }}
                >
                  <img src={stage.icon} alt={stage.name} className="home-evo-icon" />
                </div>
                <div className="home-evo-info">
                  <span className="home-evo-name" style={{ color: stage.color }}>{stage.name}</span>
                  <span className="home-evo-range">{stage.unitRange}</span>
                </div>
                {i < EVOLUTION_STAGES.length - 1 && (
                  <div className="home-evo-arrow">→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 특징 카드 */}
        <div className="home-features container">
          <h2 className="home-section-title">✨ 에이몬만의 특별함</h2>
          <div className="home-feature-grid">
            {[
              { icon: '🧠', title: 'Claude AI 오답 설명', desc: '틀린 문제를 AI가 비유와 예시로 친절하게 설명해줘요' },
              { icon: '⚔️', title: '보스 클리어 시스템', desc: '유닛 완료 후 보스를 쓰러뜨리면 인증카드가 자동 생성!' },
              { icon: '📈', title: 'XP · 레벨업', desc: '퀴즈를 풀수록 XP가 쌓이고, 에이몬이 함께 성장해요' },
            ].map((f) => (
              <div key={f.title} className="home-feature-card card-glass">
                <span className="home-feature-icon">{f.icon}</span>
                <h3 className="home-feature-title">{f.title}</h3>
                <p className="home-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── 로딩 ── */
  if (loading) {
    return (
      <div className="home-loading">
        <div className="spinner" />
        <p>에이몬 로딩 중...</p>
      </div>
    )
  }

  /* ── 로그인 대시보드 ── */
  const completedStages = stats?.completed_stages || 0
  const completedUnits  = user?.completed_units || 0
  const evoStage        = getEvolutionStage(user?.character)
  const totalXp         = user?.xp || 0
  const { lv, xpInLevel, xpForNext } = calcLevel(totalXp)
  const xpPct = xpForNext > 0 ? Math.round((xpInLevel / xpForNext) * 100) : 100
  const streak = user?.streak || 0

  return (
    <div className="home-page">
      {showLevelTest && (
        <LevelTestModal
          onClose={() => setShowLevelTest(false)}
          onFinish={handleLevelTestFinish}
          isLoggedIn={true}
        />
      )}
      <div className="home-dashboard-header">
        <div className="home-dash-greeting" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <p className="home-dash-sub">안녕하세요,</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 className="home-dash-name" style={{ margin: 0 }}>{user?.nickname || user?.username} 님! 👋</h1>
              {user?.is_level_tested && (
                (() => {
                  const level = user?.course_level || 'beginner'
                  const colorMap = {
                    beginner:     { bg: 'rgba(124, 58, 237, 0.15)', border: '1px solid rgba(124, 58, 237, 0.4)', text: '#a78bfa', label: '비기너',        icon: slimeIcon },
                    intermediate: { bg: 'rgba(6, 182, 212, 0.15)',  border: '1px solid rgba(6, 182, 212, 0.4)',  text: '#22d3ee', label: '인터미디에이트', icon: robotIcon },
                    advanced:     { bg: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', text: '#fcd34d', label: '어드밴스드',     icon: finalGhostIcon }
                  }
                  const badge = colorMap[level] || colorMap.beginner
                  return (
                    <span
                      id="user-course-level-badge"
                      style={{
                        background: badge.bg,
                        border: badge.border,
                        color: badge.text,
                        borderRadius: '999px',
                        padding: '4px 12px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    >
                      <img src={badge.icon} alt={badge.label} className="home-level-badge-icon" />
                      <span>내 레벨: {badge.label}</span>
                    </span>
                  )
                })()
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!user?.is_level_tested && (
              <button
                onClick={() => setShowLevelTest(true)}
                id="btn-level-test-dashboard"
                style={{
                  background: 'rgba(124, 58, 237, 0.08)',
                  border: '1px solid rgba(124, 58, 237, 0.25)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--clr-primary-lt)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.2s'
                }}
              >
                🔍 첫 레벨 진단받기
              </button>
            )}
          </div>
        </div>

        {/* 현재 에이몬 진화 카드 */}
        <div
          className="home-char-card card-glass animate-fade-in-up"
          style={{ borderColor: evoStage.color + '60' }}
        >
          <div className="home-char-orb animate-float" style={{ boxShadow: `0 0 40px ${evoStage.glow}` }}>

            <img src={evoStage.icon} alt={evoStage.name} className="home-char-orb-img" />
          </div>
          <div className="home-char-meta">
            <span className="home-char-name" style={{ color: evoStage.color }}>{evoStage.name}</span>
            <span className="home-char-range">{evoStage.unitRange}</span>
            <div className="home-char-xp">
              <div className="home-char-xp-label">
                <span>Lv.{lv}</span>
                <span>{xpInLevel.toLocaleString()} / {xpForNext.toLocaleString()} XP</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg, ${evoStage.color}, #c4b5fd)` }} />
              </div>
            </div>
          </div>
          {streak > 0 && (
            <div className="home-streak-badge">
              🔥 {streak}일 연속
            </div>
          )}
        </div>

        {user?.character !== 'final_ghost' && (
          <div className="home-next-evo">
            <span className="home-next-evo-label">다음 진화까지</span>
            <span className="home-next-evo-val">
              {(!user?.character || user?.character === 'slime') && `Lv.10 달성 → 🤖 로봇 진화`}
              {user?.character === 'robot' && `Lv.20 달성 → 💬 말풍선 진화`}
              {user?.character === 'speech_bubble' && `Lv.30 달성 → 👻 파이널 진화`}
            </span>
          </div>
        )}
      </div>

      {stats && (
        <div className="home-stats stagger container">
          <div className="stat-card animate-fade-in-up">
            <span className="stat-icon">🏆</span>
            <div className="stat-value">{stats.completed_stages}</div>
            <div className="stat-label">완료 스테이지</div>
          </div>
          <div className="stat-card animate-fade-in-up">
            <span className="stat-icon">⭐</span>
            <div className="stat-value">{totalXp.toLocaleString()}</div>
            <div className="stat-label">누적 XP</div>
          </div>
          <div className="stat-card animate-fade-in-up">
            <span className="stat-icon">🔥</span>
            <div className="stat-value">{streak}</div>
            <div className="stat-label">연속 학습</div>
          </div>
        </div>
      )}

      <div className="home-cta container">
        <button
          id="btn-start-lesson"
          className="btn btn-primary btn-full btn-lg animate-pulse-glow"
          onClick={() => {
            if (!user?.is_level_tested) {
              setShowLevelTest(true)
            } else {
              navigate('/lesson')
            }
          }}
        >
          📚 오늘 학습 시작하기
        </button>
      </div>

      <div className="home-boss-hint container">
        <div className="card-glass home-boss-card">
        <span className="home-boss-icon" style={{
          fontWeight: 900,
          fontSize: '1.2rem',
          letterSpacing: '0.15em',
          background: 'var(--grad-boss)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>BOSS</span>          <div>
            <p className="home-boss-title">보스 전투</p>
            <p className="home-boss-desc">유닛을 완료하면 보스가 해금됩니다. 클리어 시 인증카드 자동 생성!</p>
          </div>
        </div>
      </div>
    </div>
  )
}