// ═══════════════════════════════════════════════════════════════
//  hooks/useTapGame.js — 타이머 + 게임 상태 + 스테이지 관리
//  (칠판 코드에서 "잘못된 토큰"을 터치해서 맞히는 방식)
//  상태 흐름: ready → playing → stageclear → (nextStage) → playing → ... → success
//                              → gameover
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { BOMB_CONFIG } from '../bombConfig';
import { BOMB_QUESTIONS, STAGE_COUNT, shuffle } from '../bombQuestions';
import { playSoundCorrect, playSoundError, playSoundGameOver } from '../audio';
import { gameApi } from '../../../../api';
import { incrementGamePlay } from '../../Game';

const { timer, reward } = BOMB_CONFIG;

// 50문제 풀에서 STAGE_COUNT(10)개만 셔플해서 뽑기
const pickStageQuestions = () => shuffle(BOMB_QUESTIONS).slice(0, STAGE_COUNT);

export function useTapGame({ audio }) {
  // ── 스테이지 & 문제 (매 게임 시작/재시작마다 50개 중 10개를 셔플해서 뽑음) ──
  const [stage, setStage] = useState(0);
  const [questions, setQuestions] = useState(pickStageQuestions);
  const question = questions[stage % questions.length];

  // ── 타이머 ──────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(timer.initialTime);
  const [running,  setRunning]  = useState(false);

  // ── 게임 상태 ────────────────────────────────────────────────
  // 'ready' | 'playing' | 'stageclear' | 'success' | 'gameover'
  const [status, setStatus] = useState('ready');
  const [solved, setSolved] = useState(false);
  const [coins,  setCoins]  = useState(0);
  const [exp,    setExp]    = useState(0);
  const [lives,  setLives]  = useState(3);   // 하트 — 스테이지를 시간 안에 못 풀고 실패(타임아웃)할 때만 1개 감소

  // ── UI 피드백 ────────────────────────────────────────────────
  const [feedback, setFeedback] = useState('');
  const [shake,    setShake]    = useState(false);
  const feedbackTimer = useRef(null);

  // ── 백엔드 /game 연동 (보상은 서버 채점이 단일 소스) ──────────
  const tokenRef     = useRef(null);   // /game/start 로 발급받은 game_token
  const clearedRef   = useRef(0);      // 맞힌 스테이지 누적 수 (0~STAGE_COUNT), correct_count 로 제출
  const submittedRef = useRef(false);  // finishGame 중복 호출 가드
  const [xpAwarded,     setXpAwarded]     = useState(null);  // 서버가 확정한 최종 XP (null=응답 대기중)
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);

  // ── 피드백 메시지 ────────────────────────────────────────────
  const showFeedback = useCallback((msg) => {
    setFeedback(msg);
    setShake(true);
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => {
      setFeedback('');
      setShake(false);
    }, 1400);
  }, []);

  // ── 전체 클리어 확정 — 두 지점(타임아웃 종료 / nextStage 마지막 스테이지)에서
  //    정확히 1회만 서버에 clear 를 제출한다. 화면 전환은 응답을 기다리지 않고 즉시 하고,
  //    xpAwarded 는 응답 도착 시 반영(성공 화면에서 로딩 → 실제 값으로 갱신).
  const finishGame = useCallback(() => {
    setStatus('success');
    if (submittedRef.current) return;
    submittedRef.current = true;
    incrementGamePlay('aibomb');

    gameApi.clearGame({
      game_id: 'aibomb',
      game_token: tokenRef.current,
      correct_count: clearedRef.current,
    }).then((res) => {
      console.log('[AIbomb] clearGame response', res.data);
      setXpAwarded(res.data.xp_awarded ?? 0);
      setAlreadyClaimed(!!res.data.already_claimed);
    }).catch((err) => {
      console.warn('[AIbomb] 보상 적립 실패 — XP 미지급 처리', err);
      setXpAwarded(0);
    });
  }, []);

  // ── 타이머 tick — 0초가 되면 "스테이지 실패": 하트 1개 감소 ────
  useEffect(() => {
    if (!running || status !== 'playing') return;
    if (timeLeft <= 0) {
      const ctx = audio.audioCtxRef.current;
      const remainingLives = lives - 1;

      if (remainingLives <= 0) {
        // 하트 전부 소진 → 진짜 게임오버
        audio.stopBgmRef.current?.();
        if (ctx) playSoundGameOver(ctx, audio.masterGainRef.current);
        setLives(0);
        setStatus('gameover');
        setRunning(false);
        return;
      }

      // 하트가 남아있으면 이번 스테이지만 실패 처리하고 다음 스테이지로 계속 진행
      if (ctx) playSoundError(ctx, audio.masterGainRef.current);
      setLives(remainingLives);
      showFeedback(`시간 초과! 하트 -1 (남은 하트 ${remainingLives})`);

      const next = stage + 1;
      if (next >= STAGE_COUNT) {
        finishGame();
        setRunning(false);
      } else {
        setStage(next);
        setSolved(false);
        setTimeLeft(timer.initialTime);
      }
      return;
    }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, running, status, audio, lives, stage, showFeedback, finishGame]);

  // ── 시작하기(인트로 → 플레이) ─────────────────────────────────
  const startGame = useCallback(() => {
    setQuestions(pickStageQuestions());
    setStage(0);
    setSolved(false);
    setLives(3);
    setCoins(0);
    setExp(0);
    setTimeLeft(timer.initialTime);
    setRunning(true);
    setStatus('playing');

    clearedRef.current = 0;
    submittedRef.current = false;
    tokenRef.current = null;
    setXpAwarded(null);
    setAlreadyClaimed(false);

    // 토큰 발급 실패해도 게임은 그대로 진행 — clear 제출 시 서버가 토큰 부재로 거부해
    // 보상만 미보장될 뿐, 플레이 자체를 막지 않는다.
    gameApi.startGame('aibomb').then((res) => {
      tokenRef.current = res.data.game_token;
    }).catch((err) => {
      console.warn('[AIbomb] 게임 토큰 발급 실패 — 이번 판은 보상이 지급되지 않을 수 있습니다.', err);
    });
  }, []);

  // ── 채점: 오류 토큰을 터치했는지 확인 (오답은 시간만 차감, 하트는 유지) ──
  const tapToken = useCallback((index) => {
    if (status !== 'playing' || solved) return;
    const tok = question.tokens[index];
    if (!tok) return;

    const ctx = audio.ensureAudio();

    if (tok.error) {
      playSoundCorrect(ctx, audio.masterGainRef.current);
      setSolved(true);
      setRunning(false);
      setCoins(c => c + reward.coinsPerStage);
      setExp(e => e + reward.expPerStage);
      clearedRef.current = Math.min(clearedRef.current + 1, STAGE_COUNT);
      setStatus('stageclear');
    } else {
      playSoundError(ctx, audio.masterGainRef.current);
      setTimeLeft(t => Math.max(0, t - timer.penaltySec));
      showFeedback(`오류가 아니에요! -${timer.penaltySec}초`);
    }
  }, [status, solved, question, showFeedback, audio]);

  // ── "다음 스테이지" 버튼 — 클리어 화면에서 수동으로 진행 (하트는 유지) ──
  const nextStage = useCallback(() => {
    if (status !== 'stageclear') return;
    const next = stage + 1;
    if (next >= STAGE_COUNT) {
      finishGame();
      return;
    }
    setStage(next);
    setSolved(false);
    setTimeLeft(timer.initialTime);
    setRunning(true);
    setStatus('playing');
  }, [status, stage, finishGame]);

  // ── 재시작 ──────────────────────────────────────────────────
  const restart = useCallback(() => {
    audio.restartAudio();
    setQuestions(pickStageQuestions());
    setStage(0);
    setSolved(false);
    setLives(3);
    setTimeLeft(timer.initialTime);
    setRunning(false);
    setStatus('ready');
    setFeedback('');
    setShake(false);
    setCoins(0);
    setExp(0);

    // 'ready' 로 되돌아가며 다음 판 시작은 startGame() 을 다시 거치므로 토큰도 그때 재발급된다.
    // 여기서는 이번 판의 잔여 상태만 정리한다.
    tokenRef.current = null;
    clearedRef.current = 0;
    submittedRef.current = false;
    setXpAwarded(null);
    setAlreadyClaimed(false);
  }, [audio]);

  return {
    stage,
    question,
    timeLeft,
    status,
    solved,
    coins,
    exp,
    lives,
    feedback,
    shake,
    xpAwarded,
    alreadyClaimed,
    startGame,
    tapToken,
    nextStage,
    restart,
  };
}
