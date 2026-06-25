import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../hooks/useAuthStore'
import { GAMES, CHALLENGE_GAMES, CHAL_META, loadCounts } from './gameConstants'
export { incrementGamePlay } from './gameConstants'
import './Game.css'

export default function Game() {
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const [counts, setCounts]         = useState({})
  const [lockedGame, setLockedGame] = useState(null)

  useEffect(() => {
    setCounts(loadCounts())
  }, [])

  const handleClick = (g) => {
    if (!g.available || !g.route) return
    if (!token) { setLockedGame(g); return }
    navigate(g.route)
  }

  const totalTarget = CHALLENGE_GAMES.reduce((s, g) => s + g.dailyTarget, 0)
  const totalDone   = CHALLENGE_GAMES.reduce((s, g) => s + Math.min(counts[g.id] || 0, g.dailyTarget), 0)
  const allDone     = totalDone >= totalTarget

  const ringRadius        = 21
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset        = ringCircumference - (totalDone / totalTarget) * ringCircumference

  if (lockedGame) {
    return (
      <div className="game-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '75vh' }}>
        <div className="game-card card-glass animate-fade-in-up" style={{ width: '100%', maxWidth: '450px', padding: '3.5rem 2rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', margin: '2rem auto' }}>
          <button
            onClick={() => setLockedGame(null)}
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--clr-text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
            aria-label="닫기"
          >✕</button>
          <div className="game-icon" style={{ fontSize: '3.5rem', marginBottom: '1.5rem', textShadow: '0 0 20px rgba(124,58,237,0.3)' }}>🔒</div>
          <h2 style={{ color: 'var(--clr-text-bright)', marginBottom: '0.8rem', fontSize: '1.75rem', fontWeight: 800 }}>
            {lockedGame.title} 잠김
          </h2>
          <p style={{ color: 'var(--clr-text-muted)', lineHeight: '1.6', marginBottom: '2.5rem', fontSize: '0.95rem' }}>
            로그인하시면 <strong>{lockedGame.title}</strong> 미니게임을 플레이하고<br />
            다양한 코딩 학습 모험과 <strong>XP, 왕관</strong> 보상을 받을 수 있습니다!
          </p>
          <button className="btn btn-primary btn-lg btn-full" onClick={() => navigate('/auth')}>
            로그인하러 가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="game-page">

      {/* ── 헤더 ── */}
      <div className="game-header">
        <p className="game-header-label">TRAINING</p>
        <h1 className="game-title">미니게임</h1>
      </div>

      {/* ── 오늘의 챌린지 카드 ── */}
      <div className="game-challenge-hero card-glass">
        <div className="game-challenge-top">
          <div className="game-challenge-title-row">
            <span className="game-challenge-trophy">🏆</span>
            <div>
              <p className="game-challenge-title">오늘의 챌린지</p>
              <p className="game-challenge-sub">모두 달성하면 보너스 지급!</p>
            </div>
          </div>
          {allDone
            ? <span className="game-challenge-done-badge">완료 ✓</span>
            : <span className="game-bonus-tag">👑 +5 <span className="game-bonus-label">보너스</span></span>
          }
        </div>

        <div className="game-overall-row">
          <div className="game-ring-wrap">
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5"/>
              <circle
                cx="26" cy="26" r={ringRadius}
                fill="none" stroke="var(--clr-primary)" strokeWidth="5"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                strokeLinecap="round"
                transform="rotate(-90 26 26)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="game-ring-label">
              <span className="game-ring-num">{totalDone}</span>
              <span className="game-ring-total">/ {totalTarget}판</span>
            </div>
          </div>
          <div className="game-overall-right">
            <div className="game-overall-label">
              <span>전체 달성률</span>
              <span className="game-overall-val">{totalDone} / {totalTarget}판</span>
            </div>
            <div className="game-overall-bar-bg">
              <div className="game-overall-bar-fill" style={{ width: `${totalTarget ? (totalDone / totalTarget) * 100 : 0}%` }}/>
            </div>
            <p className="game-overall-msg">
              {allDone ? '🎉 오늘 챌린지 완료!' : `👑 +5 보너스까지 ${totalTarget - totalDone}판 남았어요`}
            </p>
          </div>
        </div>

        <div className="game-challenge-list">
          {CHALLENGE_GAMES.map((g) => {
            const done = Math.min(counts[g.id] || 0, g.dailyTarget)
            const pct = Math.round((done / g.dailyTarget) * 100)
            const completed = done >= g.dailyTarget
            const meta = CHAL_META[g.id] || {}
            return (
              <div key={g.id} className="game-challenge-item">
                <div className="game-chal-icon">
                  {meta.img
                    ? <img src={meta.img} alt={g.title} style={{ width: 22, height: 22, objectFit: 'contain' }} />
                    : <span style={{ fontSize: 15 }}>{g.emoji}</span>
                  }
                </div>
                <div className="game-chal-info">
                  <div className="game-chal-name-row">
                    <span className="game-chal-name">{g.title}</span>
                    <span className={`game-challenge-item-count${completed ? ' completed' : ''}`}>
                      {done} / {g.dailyTarget}판
                    </span>
                  </div>
                  <div className="game-challenge-bar-bg">
                    <div
                      className={`game-challenge-bar-fill${completed ? ' completed' : ''}`}
                      style={{ width: `${pct}%`, background: completed ? undefined : meta.color }}
                    />
                  </div>
                </div>
                {completed
                  ? <div className="game-chal-check">✓</div>
                  : <span className="game-chal-reward" style={{ color: meta.rewardColor }}>{meta.rewardLabel}</span>
                }
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 게임 목록 ── */}
      <p className="game-section-label">게임 목록</p>
      <div className="game-list">
        {GAMES.map((g) => {
          const done = g.dailyTarget
            ? Math.min(counts[g.id] || 0, g.dailyTarget) >= g.dailyTarget
            : false
          return (
            <div
              key={g.id}
              className={`game-row card-glass${g.available ? ' game-row--active' : ' game-row--locked'}`}
              onClick={() => handleClick(g)}
              role={g.available ? 'button' : undefined}
            >
              <div className="game-row-icon">
                {g.icon
                  ? <img src={g.icon} alt={g.title} />
                  : <span className="game-row-emoji">{g.emoji}</span>
                }
              </div>
              <div className="game-row-info">
                <p className="game-row-title">{g.title}</p>
                <p className="game-row-desc">{g.desc}</p>
                <span className="game-row-reward">{g.rewardIcon} {g.reward}</span>
              </div>
              <button className="game-play-btn" aria-label={`${g.title} 플레이`} tabIndex={-1}>
                {!g.available
                  ? <span style={{ fontSize: '0.8rem' }}>🔒</span>
                  : done
                  ? <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>✓</span>
                  : <span style={{ fontSize: '0.75rem', marginLeft: 2 }}>▶</span>
                }
              </button>
            </div>
          )
        })}
      </div>

      {/* ── 이번 주 랭킹 ── */}
      <div className="game-ranking-card card-glass">
        <div className="game-ranking-header">
          <span className="game-ranking-title">이번 주 미니게임 랭킹</span>
          <span className="game-ranking-more">전체 보기 →</span>
        </div>
        {[
          { rank: '🥇', avatar: '😎', name: '코딩왕',    score: 142, bg: 'rgba(250,238,218,0.15)' },
          { rank: '🥈', avatar: '🐱', name: '파이썬천재', score: 98,  bg: 'rgba(230,241,251,0.1)' },
          { rank: '🥉', avatar: '🦊', name: 'AI러버',    score: 71,  bg: 'rgba(225,245,238,0.1)' },
        ].map((r) => (
          <div key={r.name} className="game-rank-row">
            <span className="game-rank-medal">{r.rank}</span>
            <div className="game-rank-avatar" style={{ background: r.bg }}>{r.avatar}</div>
            <span className="game-rank-name">{r.name}</span>
            <span className="game-rank-score">👑 {r.score}개</span>
          </div>
        ))}
        <div className="game-rank-row game-rank-row--me">
          <span className="game-rank-medal game-rank-medal--me">24</span>
          <div className="game-rank-avatar" style={{ background: 'rgba(127,119,221,0.3)' }}>👤</div>
          <span className="game-rank-name" style={{ fontWeight: 600 }}>나</span>
          <span className="game-rank-score">👑 {(counts.aipang || 0) + (counts.pairs || 0) + (counts.runner || 0)}개</span>
        </div>
      </div>

    </div>
  )
}
