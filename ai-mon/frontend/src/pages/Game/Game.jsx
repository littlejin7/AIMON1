import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./Game.css";
import aipangIconUrl from "./AipangPuzzle/assets/aipangicon.png";
import airunIconUrl from "./AIrun/assets/AIRUNicon.png";
import aibombIconUrl from "./AIbomb/assets/AIbombicon.png";
import aipairIconUrl from "./AIPair/assets/aipairicon.png";
import { useAuthStore } from "../../hooks/useAuthStore";
import AICross from './AIcross/AICross'
import aiwordIconUrl from './AIcross/AIwordicon.png'
const GAMES = [
  {
    id: "aipang",
    icon: aipangIconUrl,
    emoji: "🧩",
    title: "에이팡",
    desc: "우주 속 AI 친구들과 떠나는 퍼즐 모험!",
    reward: "왕관 획득",
    rewardIcon: "👑",
    route: "/game/aipang",
    available: true,
    dailyTarget: 1,
  },
  {
    id: "pairs",
    icon: aipairIconUrl,
    emoji: "🃏",
    title: "에이짝",
    desc: "같은 카드 맞추기!",
    reward: "XP 100~300",
    rewardIcon: "⚡",
    route: "/game/pairs",
    available: true,
    dailyTarget: 3,
  },
  {
    id: "runner",
    icon: airunIconUrl,
    emoji: "🏃",
    title: "에이런",
    desc: "달리고! 피하고! 맞혀라!",
    reward: "XP 200~500",
    rewardIcon: "⚡",
    route: "/game/runner",
    available: true,
    dailyTarget: 5,
  },
  {
    id: "aibomb",
    icon: aibombIconUrl,
    emoji: "💣",
    title: "에이밤",
    desc: "코딩을 배우고, 코드를 입력해 폭탄을 해제하라!",
    reward: "XP 100",
    rewardIcon: "⚡",
    route: "/game/aibomb",
    available: true,
    dailyTarget: null,
  },
      {
        id: 'aicross',
        icon: aiwordIconUrl,
        title: 'AI 크로스워드',
        desc: '파이썬 & AI 단어로 십자말풀이를 완성하라!',
        reward: 'XP 100~200',
        rewardIcon: '⚡',
        route: '/game/aicross',
        available: true,
      },
];

// 오늘 날짜 키 (YYYY-MM-DD)
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// localStorage에서 오늘 플레이 카운트 불러오기
function loadCounts() {
  try {
    const raw = localStorage.getItem("aimon_daily_plays");
    if (!raw) return {};
    const { date, counts } = JSON.parse(raw);
    if (date !== todayKey()) return {};
    return counts || {};
  } catch {
    return {};
  }
}

// localStorage에 오늘 플레이 카운트 저장
export function incrementGamePlay(gameId) {
  try {
    const raw = localStorage.getItem("aimon_daily_plays");
    let counts = {};
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === todayKey()) counts = parsed.counts || {};
    }
    counts[gameId] = (counts[gameId] || 0) + 1;
    localStorage.setItem(
      "aimon_daily_plays",
      JSON.stringify({ date: todayKey(), counts })
    );
  } catch {}
}

const CHALLENGE_GAMES = GAMES.filter((g) => g.available && g.dailyTarget);

export default function Game() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [counts, setCounts] = useState({});
  const [lockedGame, setLockedGame] = useState(null);

  useEffect(() => {
    setCounts(loadCounts());
  }, []);

  const handleClick = (g) => {
    if (!g.available || !g.route) return;
    if (!token) {
      setLockedGame(g);
      return;
    }
    navigate(g.route);
  };

  // 전체 챌린지 달성 계산
  const totalTarget = CHALLENGE_GAMES.reduce((s, g) => s + g.dailyTarget, 0);
  const totalDone = CHALLENGE_GAMES.reduce(
    (s, g) => s + Math.min(counts[g.id] || 0, g.dailyTarget),
    0
  );
  const allDone = totalDone >= totalTarget;

  if (lockedGame) {
    return (
      <div className="game-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '75vh' }}>
        <div className="game-card card-glass animate-fade-in-up" style={{ width: '100%', maxWidth: '450px', padding: '3.5rem 2rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', margin: '2rem auto' }}>
          
          <button 
            onClick={() => setLockedGame(null)}
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--clr-text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
            aria-label="닫기"
          >
            ✕
          </button>

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
    );
  }

  // 원형 링 계산
  const ringRadius = 21;
  const ringCircumference = 2 * Math.PI * ringRadius; // ~131.9
  const ringOffset = ringCircumference - (totalDone / totalTarget) * ringCircumference;

  // 챌린지별 색상 및 아이콘
  const chalMeta = {
    aipang:  { color: "#9B94E8", img: aipangIconUrl,  rewardLabel: "👑 +2",  rewardColor: "#854F0B" },
    pairs:   { color: "#378ADD", img: aipairIconUrl,  rewardLabel: "⚡ +300", rewardColor: "#534AB7" },
    runner:  { color: "#1D9E75", img: airunIconUrl,   rewardLabel: "⚡ +500", rewardColor: "#0F6E56" },
  };


  return (
    <div className="game-page">

      {/* ── 헤더 ── */}
      <div className="game-header">
        <p className="game-header-label">TRAINING</p>
        <h1 className="game-title">미니게임</h1>
      </div>

      {/* ── 오늘의 챌린지 카드 ── */}
      <div className="game-challenge-hero card-glass">

        {/* 타이틀 행 */}
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

        {/* 전체 진행: 링 + 바 */}
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
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
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
              {allDone ? "🎉 오늘 챌린지 완료!" : `👑 +5 보너스까지 ${totalTarget - totalDone}판 남았어요`}
            </p>
          </div>
        </div>

        {/* 개별 챌린지 행 */}
        <div className="game-challenge-list">
          {CHALLENGE_GAMES.map((g) => {
            const done = Math.min(counts[g.id] || 0, g.dailyTarget);
            const pct = Math.round((done / g.dailyTarget) * 100);
            const completed = done >= g.dailyTarget;
            const meta = chalMeta[g.id] || {};
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
                    <span className={`game-challenge-item-count${completed ? " completed" : ""}`}>
                      {done} / {g.dailyTarget}판
                    </span>
                  </div>
                  <div className="game-challenge-bar-bg">
                    <div
                      className={`game-challenge-bar-fill${completed ? " completed" : ""}`}
                      style={{ width: `${pct}%`, background: completed ? undefined : meta.color }}
                    />
                  </div>
                </div>
                {completed
                  ? <div className="game-chal-check">✓</div>
                  : <span className="game-chal-reward" style={{ color: meta.rewardColor }}>{meta.rewardLabel}</span>
                }
              </div>
            );
          })}
        </div>

      </div>

      {/* ── 게임 목록 ── */}
      <p className="game-section-label">게임 목록</p>
      <div className="game-list">
        {GAMES.map((g) => {
          const done = g.dailyTarget
            ? Math.min(counts[g.id] || 0, g.dailyTarget) >= g.dailyTarget
            : false;
          return (
            <div
              key={g.id}
              className={`game-row card-glass${g.available ? " game-row--active" : " game-row--locked"}`}
              onClick={() => handleClick(g)}
              role={g.available ? "button" : undefined}
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
              <button
                className="game-play-btn"
                aria-label={`${g.title} 플레이`}
                tabIndex={-1}
              >
                {!g.available
                  ? <span style={{ fontSize: "0.8rem" }}>🔒</span>
                  : done
                  ? <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>✓</span>
                  : <span style={{ fontSize: "0.75rem", marginLeft: 2 }}>▶</span>
                }
              </button>
            </div>
          );
        })}
      </div>

      {/* ── 이번 주 랭킹 ── */}
      <div className="game-ranking-card card-glass">
        <div className="game-ranking-header">
          <span className="game-ranking-title">이번 주 미니게임 랭킹</span>
          <span className="game-ranking-more">전체 보기 →</span>
        </div>
        {[
          { rank: "🥇", avatar: "😎", name: "코딩왕",   score: 142, bg: "rgba(250,238,218,0.15)" },
          { rank: "🥈", avatar: "🐱", name: "파이썬천재", score: 98,  bg: "rgba(230,241,251,0.1)" },
          { rank: "🥉", avatar: "🦊", name: "AI러버",   score: 71,  bg: "rgba(225,245,238,0.1)" },
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
          <div className="game-rank-avatar" style={{ background: "rgba(127,119,221,0.3)" }}>👤</div>
          <span className="game-rank-name" style={{ fontWeight: 600 }}>나</span>
          <span className="game-rank-score">👑 {counts.aipang || 0 + (counts.pairs || 0) + (counts.runner || 0)}개</span>
        </div>
      </div>

    </div>
  );
}
