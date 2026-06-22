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

  useEffect(() => {
    setCounts(loadCounts());
  }, []);

  const handleClick = (g) => {
    if (!g.available || !g.route) return;
    if (!token) {
      alert("로그인이 필요한 기능입니다.");
      navigate("/auth");
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

  return (
    <div className="game-page">

      {/* ── 헤더 ── */}
      <div className="game-header">
        <p className="game-header-label">TRAINING</p>
        <h1 className="game-title">미니게임</h1>
      </div>

      {/* ── 오늘의 챌린지 히어로 ── */}
      <div className="game-challenge-hero card-glass">
        <div className="game-challenge-top">
          <div className="game-challenge-title-row">
            <span className="game-challenge-trophy">🏆</span>
            <div>
              <p className="game-challenge-title">오늘의 챌린지</p>
              <p className="game-challenge-sub">
                모두 달성하면 보너스 <strong>왕관 +5</strong>
              </p>
            </div>
          </div>
          {allDone && (
            <span className="game-challenge-done-badge">완료 ✓</span>
          )}
        </div>

        {/* 게임별 진행 바 */}
        <div className="game-challenge-list">
          {CHALLENGE_GAMES.map((g) => {
            const done = Math.min(counts[g.id] || 0, g.dailyTarget);
            const pct = Math.round((done / g.dailyTarget) * 100);
            const completed = done >= g.dailyTarget;
            return (
              <div key={g.id} className="game-challenge-item">
                <div className="game-challenge-item-top">
                  <div className="game-challenge-item-left">
                    <span className="game-challenge-item-emoji">{g.emoji}</span>
                    <span className="game-challenge-item-name">{g.title}</span>
                    <span className="game-challenge-item-label">오늘의 목표</span>
                  </div>
                  <span className={`game-challenge-item-count${completed ? " completed" : ""}`}>
                    {done} / {g.dailyTarget}판
                  </span>
                </div>
                <div className="game-challenge-bar-bg">
                  <div
                    className={`game-challenge-bar-fill${completed ? " completed" : ""}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* 전체 달성률 */}
        <div className="game-challenge-footer">
          <span className="game-challenge-footer-label">전체 달성률</span>
          <span className="game-challenge-footer-val">{totalDone} / {totalTarget}판</span>
        </div>
      </div>

      {/* ── 게임 리스트 ── */}
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
              <div className="game-row-action">
                {!g.available
                  ? <span className="game-row-lock">🔒</span>
                  : done
                  ? <span className="game-row-check">✓</span>
                  : <span className="game-row-play">▶</span>
                }
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
