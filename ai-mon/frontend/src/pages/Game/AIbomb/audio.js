// ═══════════════════════════════════════════════════════════════
//  audio.js — Web Audio API 엔진
// ═══════════════════════════════════════════════════════════════

import aibombBgm from '@/assets/bgm/aibomb_bgm.mp3';

export function createAudioCtx() {
  return new (window.AudioContext || window.webkitAudioContext)();
}

// ── BGM: aibomb_bgm.mp3 루프 ──
// mp3 파일을 MediaElementSource 로 Web Audio 그래프에 연결해 masterGain(볼륨 슬라이더)
// 아래로 흐르게 한다. → SFX 와 동일하게 게임 볼륨/음소거가 그대로 BGM 에도 적용됨.
export function startBgm(ctx, masterGain) {
  const audio = new Audio(aibombBgm);
  audio.loop = true;
  audio.preload = 'auto';

  const srcNode = ctx.createMediaElementSource(audio);
  const bgmGain = ctx.createGain();
  bgmGain.gain.value = 0.5;   // SFX 아래로 살짝 낮춰 배경으로 깔림
  srcNode.connect(bgmGain);
  bgmGain.connect(masterGain ?? ctx.destination);

  audio.play().catch(() => {});

  return () => {
    try { audio.pause(); } catch(e) {}
    try { srcNode.disconnect(); } catch(e) {}
    try { bgmGain.disconnect(); } catch(e) {}
  };
}

// ── 정답 효과음 ──
export function playSoundCorrect(ctx, out) {
  const dest = out ?? ctx.destination;
  const click = ctx.createOscillator();
  click.type = 'square';
  click.frequency.value = 820;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.45, ctx.currentTime);
  cg.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.04);
  click.connect(cg); cg.connect(dest);
  click.start(); click.stop(ctx.currentTime + 0.05);

  const t1 = ctx.currentTime + 0.08;
  const chime = ctx.createOscillator();
  chime.type = 'sine';
  chime.frequency.setValueAtTime(880, t1);
  chime.frequency.linearRampToValueAtTime(1320, t1 + 0.3);
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(0.55, t1);
  mg.gain.linearRampToValueAtTime(0, t1 + 0.85);
  chime.connect(mg); mg.connect(dest);
  chime.start(t1); chime.stop(t1 + 0.9);

  const harmony = ctx.createOscillator();
  harmony.type = 'sine';
  harmony.frequency.value = 1056;
  const hg = ctx.createGain();
  hg.gain.setValueAtTime(0.25, t1);
  hg.gain.linearRampToValueAtTime(0, t1 + 0.6);
  harmony.connect(hg); hg.connect(dest);
  harmony.start(t1); harmony.stop(t1 + 0.65);
}

// ── 오답 효과음 ──
export function playSoundError(ctx, out) {
  const dest = out ?? ctx.destination;
  [1000, 800, 600, 400, 300].forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.1;
    const o = ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = freq;
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(0.38, t);
    eg.gain.linearRampToValueAtTime(0, t + 0.08);
    o.connect(eg); eg.connect(dest);
    o.start(t); o.stop(t + 0.1);
  });
  const t2 = ctx.currentTime + 0.58;
  const boom = ctx.createOscillator();
  boom.type = 'sawtooth'; boom.frequency.value = 80;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.45, t2);
  bg.gain.linearRampToValueAtTime(0, t2 + 0.55);
  boom.connect(bg); bg.connect(dest);
  boom.start(t2); boom.stop(t2 + 0.6);
}

// ── 게임오버 효과음 ──
export function playSoundGameOver(ctx, out) {
  const dest = out ?? ctx.destination;
  [1200, 1000, 800, 600, 450, 300, 200].forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.11;
    const o = ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = freq;
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(0.35, t);
    eg.gain.linearRampToValueAtTime(0, t + 0.09);
    o.connect(eg); eg.connect(dest);
    o.start(t); o.stop(t + 0.12);
  });
  const t3 = ctx.currentTime + 0.85;
  const boom = ctx.createOscillator();
  boom.type = 'sawtooth';
  boom.frequency.setValueAtTime(120, t3);
  boom.frequency.linearRampToValueAtTime(40, t3 + 0.9);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.55, t3);
  bg.gain.linearRampToValueAtTime(0, t3 + 0.95);
  boom.connect(bg); bg.connect(dest);
  boom.start(t3); boom.stop(t3 + 1.0);
}
