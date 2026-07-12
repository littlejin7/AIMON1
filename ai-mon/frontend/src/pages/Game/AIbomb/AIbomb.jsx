/**
 * AIbomb.jsx — 제한시간 폭탄 해제 미니게임 (메인 컴포넌트)
 * 방식: 칠판 코드에서 "잘못된 코드(토큰)"를 터치해서 맞히기 (기존 로직 그대로)
 *
 * 화면 흐름(참고 이미지 4컷 구성):
 *   ready      — 인트로: 제목 + 규칙 + 시작하기 버튼
 *   playing    — 원형 타이머 + 폭탄 + 칠판 코드(터치) + 진행 점
 *   stageclear — CLEAR! 화면 + 보상(연출용 점수/코인) + 다음 스테이지 버튼
 *   gameover   — 폭발 화면 + 다시 도전 / 목록 버튼
 *   success    — 전체 클리어 화면
 *
 * 상단 바(모든 화면 공통): 뒤로가기 /  하트(라이프) / 코인
 *
 * 구조:
 *   bombConfig.js          — 규칙(타이머/보상) + 문구
 *   bombQuestions.js       — 문제 데이터(토큰)
 *   audio.js               — Web Audio API 엔진 함수
 *   sprites.jsx            — SVG 스프라이트 컴포넌트
 *   hooks/useAudio.js      — AudioContext + 볼륨 관리
 *   hooks/useTapGame.js    — 타이머 + 터치 채점 + 스테이지 관리(기존 문제 로직)
 *   components/ChalkBoard  — 칠판 코드 토큰(기존 문제 로직 UI)
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import './AIbomb.css';

import GameScaleFrame from '../GameScaleFrame';
import { useAudio }   from './hooks/useAudio';
import { useTapGame } from './hooks/useTapGame';
import useGameBgm     from '../../../hooks/useGameBgm';

import { RunningMonstersSprite, PixelHeart, ClearCheck } from './sprites';
import aibombIcon from './assets/AIbombicon.png';
import aibombfail from './assets/AIbombfail.png';
import aibombclear from './assets/AIbombclear.png';
import aibombBgm  from '@/assets/bgm/aibomb_bgm.mp3';
import ChalkBoard     from './components/ChalkBoard';

import { BOMB_CONFIG } from './bombConfig';
import { STAGE_COUNT } from './bombQuestions';

const { timer, intro, result } = BOMB_CONFIG;
const NEED_STAGES = Math.ceil(STAGE_COUNT * intro.passRatio);
const RING_R = 40;
const RING_CIRC = 2 * Math.PI * RING_R;

const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function AIbomb() {
  const navigate = useNavigate();

  const audio = useAudio();
  const game  = useTapGame({ audio });

  // BGM: 다른 미니게임과 동일하게 전역 bgmVolume(설정)에 연동해 재생.
  //      게임오버(폭발) 시엔 정지되도록 enabled 로 제어.
  useGameBgm(aibombBgm, { enabled: game.status !== 'ready' && game.status !== 'gameover' });

  const danger = game.timeLeft <= timer.dangerAt;
  const timerState = danger ? 'danger' : game.timeLeft > timer.initialTime * 0.5 ? 'safe' : 'warn';
  const ringPct = game.timeLeft / timer.initialTime;

  return (
    <GameScaleFrame background="var(--clr-bg)" scaleMode="fill-height">
      <div className="bd-root">
      <div className={`bd-screen ${game.shake ? 'bd-bomb-stage--shake' : ''}`}>

        {/* ── 상단 바(공통) ── */}
        <div className="bd-topbar-new">
          <div className="bd-topbar-left">
            <button className="bd-icon-btn" onClick={() => navigate(-1)} aria-label="뒤로가기">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div className="bd-topbar-right">
            <div className="bd-lives" aria-label={`남은 라이프 ${game.lives}`}>
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} className="bd-heart"><PixelHeart filled={i < game.lives} size={16} /></span>
              ))}
            </div>
          </div>
        </div>

        {/* ── ② 플레이 (칠판 코드 터치 — 기존 문제 로직) ── */}
        {(game.status === 'ready' || game.status === 'playing') && (
          <div className="bd-play">
            <div className="bd-timer-ring">
              <svg viewBox="0 0 100 100" className="bd-timer-ring-svg">
                <circle cx="50" cy="50" r={RING_R} className="bd-timer-ring-track" />
                <circle
                  cx="50" cy="50" r={RING_R}
                  className={`bd-timer-ring-fill bd-timer--${timerState}`}
                  style={{
                    strokeDasharray: RING_CIRC,
                    strokeDashoffset: RING_CIRC * (1 - ringPct),
                  }}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="bd-timer-ring-label">
                <span className="bd-timer-ring-tag">TIME</span>
                <span className={`bd-timer-ring-digits bd-timer--${timerState}`}>{fmtTime(game.timeLeft)}</span>
              </div>
            </div>

            <div className="bd-progress-text">{game.stage + 1} / {STAGE_COUNT} 문제</div>

            <div className="bd-bomb-stage">
              <RunningMonstersSprite danger={danger} />
            </div>

            {game.feedback && (
              <div className="bd-feedback">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1L15 14H1L8 1Z" fill="#ff4040" stroke="#ff8080" strokeWidth="1"/>
                  <text x="8" y="12" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">!</text>
                </svg>
                {game.feedback}
              </div>
            )}

            <ChalkBoard question={game.question} solved={game.solved} onTapToken={game.tapToken} />

            <div className="bd-dots-row">
              {Array.from({ length: STAGE_COUNT }).map((_, i) => (
                <span key={i} className={`bd-dot-sm ${i < game.stage ? 'bd-dot-sm--done' : i === game.stage ? 'bd-dot-sm--current' : ''}`} />
              ))}
            </div>
          </div>
        )}

        {/* ── ③ 스테이지 클리어 ── */}
        {game.status === 'stageclear' && (
          <div className="bd-clear-screen">
            <h1 className="bd-clear-title">{result.stageClearTitle}</h1>
            <div className="bd-clear-sub">{result.stageClearSub.split('\n').map((l,i) => <div key={i}>{l}</div>)}</div>
            <div className="bd-bomb-stage bd-bomb-stage--clear">
              <img src={aibombclear} alt="폭탄 해제 성공" className="bd-sprite bd-sprite--defused" />
              <div className="bd-clear-check"><ClearCheck size={40} /></div>
            </div>
            <button className="bd-btn bd-btn--primary bd-btn--full" onClick={game.nextStage}>
              {result.nextButton}
            </button>
            <button className="bd-btn bd-btn--secondary bd-btn--full" onClick={() => navigate('/game')}>
              {result.listButton}
            </button>
          </div>
        )}

        {/* ── ④ 전체 클리어 ── */}
        {game.status === 'success' && (
          <div className="bd-clear-screen">
            <h1 className="bd-clear-title">{result.stageClearTitle}</h1>
            <div className="bd-clear-sub"><div>{result.successTitle}</div><div>{result.successSub}</div></div>
            <div className="bd-bomb-stage bd-bomb-stage--clear">
              <img src={aibombclear} alt="폭탄 해제 성공" className="bd-sprite bd-sprite--defused" />
              <div className="bd-clear-check"><ClearCheck size={40} /></div>
            </div>
            <div className="bd-reward-box">
              <span className="bd-reward-label-tag">TOTAL REWARD</span>
              <div className="bd-reward-chips">
                {game.coinAwarded === null ? (
                  <span className="bd-reward-chip">적립 중...</span>
                ) : game.alreadyClaimed ? (
                  <span className="bd-reward-chip">오늘 획득 한도 도달</span>
                ) : (
                  <>
                    <span className="bd-reward-chip">✨ +{game.coinAwarded} 코인</span>
                    {game.gpAwarded > 0 && (
                      <span className="bd-reward-chip">💠 +{game.gpAwarded} GP</span>
                    )}
                  </>
                )}
              </div>
            </div>
            <button className="bd-btn bd-btn--primary bd-btn--full" onClick={game.restart}>
              {result.retryButton}
            </button>
            <button className="bd-btn bd-btn--secondary bd-btn--full" onClick={() => navigate('/game')}>
              {result.listButton}
            </button>
          </div>
        )}

        {/* ── ⑤ 게임오버 ── */}
        {game.status === 'gameover' && (
          <div className="bd-clear-screen bd-clear-screen--fail">
            <h1 className="bd-clear-title bd-clear-title--fail">GAME OVER</h1>
            <div className="bd-clear-sub"><div>{result.gameoverTitle}</div><div>{result.gameoverSub}</div></div>
            <div className="bd-bomb-stage">
              <img src={aibombfail} alt="폭발" className="bd-sprite bd-sprite--explode" />
            </div>
            <button className="bd-btn bd-btn--primary bd-btn--full" onClick={game.restart}>
              {result.retryButton}
            </button>
            <button className="bd-btn bd-btn--secondary bd-btn--full" onClick={() => navigate('/game')}>
              {result.listButton}
            </button>
          </div>
        )}

      </div>

      {/* ── 시작 인트로 — 다른 미니게임처럼 화이트 박스 오버레이 (안쪽 내용은 그대로) ── */}
      {game.status === 'ready' && (
        <div className="bd-intro-overlay">
          <button className="bd-intro-back" onClick={() => navigate(-1)} aria-label="뒤로가기">✕</button>
          <div className="bd-intro-panel">
            <img className="bd-intro-thumb" src={aibombIcon} alt="AI Bomb" />
            <h1 className="bd-intro-title">{intro.title.split('\n').map((l,i) => <div key={i}>{l}</div>)}</h1>
            <div className="bd-intro-desc">{intro.desc.split('\n').map((l,i) => <div key={i}>{l}</div>)}</div>
            <div className="bd-intro-rule-box">
              <div className="bd-intro-rule-lines">
                {intro.rule(STAGE_COUNT, NEED_STAGES).split('\n').map((l,i) => <div key={i}>{l}</div>)}
              </div>
            </div>
            <div className="bd-intro-reward">{intro.rewardText}</div>
            <button className="bd-btn bd-btn--primary bd-btn--full" onClick={game.startGame}>
              {intro.startButton}
            </button>
          </div>
        </div>
      )}
      </div>
    </GameScaleFrame>
  );
}
