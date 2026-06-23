// ═══════════════════════════════════════════════════════════════
//  hooks/useGameState.js — 타이머 + 게임 상태 + 스테이지 관리
//  (타이머와 게임 상태는 서로 강하게 결합되어 함께 관리)
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { QUESTIONS, INITIAL_TIME, PENALTY_SEC, TOTAL_STAGES, shuffle } from '../questions';
import { playSoundCorrect, playSoundError, playSoundGameOver } from '../audio';

export function useGameState({ audio }) {
  // ── 스테이지 & 문제 ──────────────────────────────────────────
  const [stage, setStage]       = useState(0);
  const [chips, setChips]       = useState(() =>
    shuffle(QUESTIONS[0].choices).map((w, i) => ({ id: i, word: w, used: false }))
  );
  const [slotWord, setSlotWord] = useState(null);

  // ── 타이머 ──────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [running,  setRunning]  = useState(true);

  // ── 게임 상태 ────────────────────────────────────────────────
  // 'playing' | 'stageclear' | 'success' | 'gameover'
  const [status,   setStatus]   = useState('playing');

  // ── UI 피드백 ────────────────────────────────────────────────
  const [feedback, setFeedback] = useState('');
  const [shake,    setShake]    = useState(false);
  const feedbackTimer            = useRef(null);

  const question = QUESTIONS[stage % QUESTIONS.length];

  // ── 타이머 tick ─────────────────────────────────────────────
  useEffect(() => {
    if (!running || status !== 'playing') return;
    if (timeLeft <= 0) {
      audio.stopBgmRef.current?.();
      const ctx = audio.audioCtxRef.current;
      if (ctx) playSoundGameOver(ctx, audio.masterGainRef.current);
      setStatus('gameover');
      setRunning(false);
      return;
    }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, running, status, audio]);

  // ── 스테이지 클리어 → 다음 스테이지 ────────────────────────
  useEffect(() => {
    if (status !== 'stageclear') return;
    const id = setTimeout(() => {
      const nextStage = stage + 1;
      if (nextStage >= TOTAL_STAGES) {
        setStatus('success');
        return;
      }
      const nextQ = QUESTIONS[nextStage % QUESTIONS.length];
      setStage(nextStage);
      setChips(shuffle(nextQ.choices).map((w, i) => ({ id: i, word: w, used: false })));
      setSlotWord(null);
      setTimeLeft(INITIAL_TIME);
      setRunning(true);
      setStatus('playing');
    }, 1800);
    return () => clearTimeout(id);
  }, [status, stage]);

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

  // ── 채점 ─────────────────────────────────────────────────────
  const processAnswer = useCallback((chipId) => {
    if (status !== 'playing') return;
    const chip = chips.find(c => c.id === chipId);
    if (!chip || chip.used) return;

    const ctx = audio.ensureAudio();

    if (chip.word === question.answer) {
      playSoundCorrect(ctx, audio.masterGainRef.current);
      setSlotWord(chip.word);
      setChips(prev => prev.map(c => c.id === chipId ? { ...c, used: true } : c));
      setRunning(false);
      setStatus('stageclear');
    } else {
      playSoundError(ctx, audio.masterGainRef.current);
      setTimeLeft(t => Math.max(0, t - PENALTY_SEC));
      showFeedback(`오답! "${chip.word}" — ${PENALTY_SEC}초 차감`);
    }
  }, [chips, status, question, showFeedback, audio]);

  // ── 재시작 ──────────────────────────────────────────────────
  const restart = useCallback(() => {
    audio.restartAudio();
    const q = QUESTIONS[0];
    setStage(0);
    setChips(shuffle(q.choices).map((w, i) => ({ id: i, word: w, used: false })));
    setSlotWord(null);
    setTimeLeft(INITIAL_TIME);
    setRunning(true);
    setStatus('playing');
    setFeedback('');
    setShake(false);
  }, [audio]);

  return {
    stage,
    chips,
    slotWord,
    timeLeft,
    status,
    feedback,
    shake,
    question,
    processAnswer,
    restart,
  };
}
