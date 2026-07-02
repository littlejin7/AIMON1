/**
 * AIbomb.jsx — 드래그 앤 드롭 폭탄 해제 미니게임 (메인 컴포넌트)
 *
 * 구조:
 *   questions.js          — 문제 데이터, 상수, shuffle
 *   audio.js              — Web Audio API 엔진 함수
 *   sprites.jsx           — SVG 스프라이트 컴포넌트
 *   hooks/useAudio.js     — AudioContext + 볼륨 관리
 *   hooks/useGameState.js — 타이머 + 게임 상태 + 스테이지 관리
 *   hooks/useDrag.js      — 드래그 앤 드롭 핸들러
 *   components/           — UI 컴포넌트들
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import './AIbomb.css';

import { useAudio }     from './hooks/useAudio';
import { useGameState } from './hooks/useGameState';
import { useDrag }      from './hooks/useDrag';

import { BombSprite, ExplosionSprite, DefusedSprite, StageClearBadge } from './sprites';
import TimerBar       from './components/TimerBar';
import CodePanel      from './components/CodePanel';
import ChipsArea      from './components/ChipsArea';
import ResultOverlay  from './components/ResultOverlay';
import VolumeControl  from './components/VolumeControl';

import { TOTAL_STAGES } from './questions';

export default function AIbomb() {
  const navigate = useNavigate();

  const audio = useAudio();
  const game  = useGameState({ audio });
  const drag  = useDrag({
    processAnswer: game.processAnswer,
    chips:         game.chips,
    status:        game.status,
    ensureAudio:   audio.ensureAudio,
  });

  const danger = game.timeLeft <= 8;

  const renderBomb = () => {
    if (game.status === 'gameover')   return <ExplosionSprite />;
    if (game.status === 'success')    return <DefusedSprite />;
    if (game.status === 'stageclear') return <DefusedSprite />;
    return <BombSprite timeLeft={game.timeLeft} danger={danger} />;
  };

  return (
    <div className="bd-root">

      {/* ── SVG 배경 패턴 ── */}
      <svg className="bd-bg-pattern" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <pattern id="circuitPat" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <line x1="0"  y1="20" x2="30" y2="20" stroke="#1a2a3a" strokeWidth="1"/>
            <line x1="30" y1="20" x2="30" y2="50" stroke="#1a2a3a" strokeWidth="1"/>
            <line x1="30" y1="50" x2="80" y2="50" stroke="#1a2a3a" strokeWidth="1"/>
            <line x1="50" y1="0"  x2="50" y2="20" stroke="#1a2a3a" strokeWidth="1"/>
            <line x1="0"  y1="60" x2="20" y2="60" stroke="#1a2a3a" strokeWidth="1"/>
            <line x1="60" y1="50" x2="60" y2="80" stroke="#1a2a3a" strokeWidth="1"/>
            <circle cx="30" cy="20" r="2.5" fill="#1a3a5a"/>
            <circle cx="50" cy="20" r="2.5" fill="#1a3a5a"/>
            <circle cx="30" cy="50" r="2.5" fill="#1a3a5a"/>
            <circle cx="60" cy="50" r="2.5" fill="#1a3a5a"/>
            <circle cx="20" cy="60" r="2.5" fill="#1a3a5a"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#circuitPat)"/>
      </svg>

      {/* ── 뒤로가기 ── */}
      <button className="bd-back-fixed" onClick={() => navigate('/game')} aria-label="게임 목록으로 돌아가기">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        ✕
      </button>

      {/* ── 헤더 ── */}
      <header className="bd-header">
        <h1 className="bd-title">💣 폭탄 해제</h1>
        <div className="bd-stage-dots">
          {Array.from({ length: TOTAL_STAGES }).map((_, i) => (
            <span
              key={i}
              className={`bd-dot ${
                i < game.stage   ? 'bd-dot--done' :
                i === game.stage ? 'bd-dot--current' : ''
              }`}
            />
          ))}
        </div>
      </header>

      {/* ── 스테이지 라벨 ── */}
      <div className="bd-stage-label">
        STAGE <span className="bd-stage-num">{game.stage + 1}</span>
        <span className="bd-stage-total"> / {TOTAL_STAGES}</span>
      </div>

      {/* ── 타이머 ── */}
      <TimerBar timeLeft={game.timeLeft} />

      {/* ── 오답 피드백 ── */}
      {game.feedback && (
        <div className="bd-feedback">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L15 14H1L8 1Z" fill="#ff4040" stroke="#ff8080" strokeWidth="1"/>
            <text x="8" y="12" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">!</text>
          </svg>
          {game.feedback}
        </div>
      )}

      {/* ── 폭탄 스프라이트 ── */}
      <div className={`bd-bomb-stage ${game.shake ? 'bd-bomb-stage--shake' : ''}`}>
        {renderBomb()}
      </div>

      {/* ── 스테이지 클리어 플래시 ── */}
      {game.status === 'stageclear' && (
        <div className="bd-stage-clear-flash">
          <StageClearBadge stage={game.stage + 1} />
          <span>스테이지 {game.stage + 1} 클리어!</span>
        </div>
      )}

      {/* ── 코드 문제 패널 ── */}
      {(game.status === 'playing' || game.status === 'stageclear') && (
        <CodePanel
          question={game.question}
          slotWord={game.slotWord}
          onDragOver={drag.handleDragOver}
          onDrop={drag.handleDrop}
        />
      )}

      {/* ── 칩 선택지 ── */}
      {game.status === 'playing' && (
        <ChipsArea
          chips={game.chips}
          onDragStart={drag.handleDragStart}
          onChipClick={game.processAnswer}
        />
      )}

      {/* ── 볼륨 ── */}
      <VolumeControl
        volume={audio.volume}
        onVolumeChange={audio.handleVolume}
        onMuteToggle={audio.toggleMute}
      />

      {/* ── 결과 오버레이 ── */}
      <ResultOverlay
        status={game.status}
        stage={game.stage}
        question={game.question}
        onRestart={game.restart}
      />

    </div>
  );
}
