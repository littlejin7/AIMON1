// ═══════════════════════════════════════════════════════════════
//  audio.js — Web Audio API 엔진
// ═══════════════════════════════════════════════════════════════

export function createAudioCtx() {
  return new (window.AudioContext || window.webkitAudioContext)();
}

// ── BGM: Sneaky Mission (스파이 재즈 루프) ──
export function startBgm(ctx, masterGain) {
  const master = ctx.createGain();
  master.gain.value = 0.14;
  master.connect(masterGain ?? ctx.destination);

  // 베이스 드론
  const bass = ctx.createOscillator();
  bass.type = 'triangle';
  bass.frequency.value = 55;
  const bassG = ctx.createGain();
  bassG.gain.value = 0.35;
  bass.connect(bassG);
  bassG.connect(master);
  bass.start();

  // 멜로디 아르페지오 루프
  const notes = [220, 261, 196, 233, 220, 174, 196, 220];
  const noteDur = 0.22;
  const loopDur = notes.length * noteDur;
  let loopStart = ctx.currentTime;

  function scheduleLoop() {
    notes.forEach((freq, i) => {
      const t = loopStart + i * noteDur;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      const eg = ctx.createGain();
      eg.gain.setValueAtTime(0, t);
      eg.gain.linearRampToValueAtTime(0.55, t + 0.04);
      eg.gain.linearRampToValueAtTime(0,    t + noteDur - 0.02);
      o.connect(eg);
      eg.connect(master);
      o.start(t);
      o.stop(t + noteDur);
    });
    loopStart += loopDur;
  }

  scheduleLoop();
  const intervalId = setInterval(() => {
    if (ctx.state === 'closed') { clearInterval(intervalId); return; }
    scheduleLoop();
  }, loopDur * 1000);

  return () => {
    clearInterval(intervalId);
    try { bass.stop(); } catch(e) {}
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
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
