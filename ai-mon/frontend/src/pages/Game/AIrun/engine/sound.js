export class SoundManager {
  constructor() {
    this._ctx = null;
    this._master = null;
    this._bgmNodes = [];
    this._bgmActive = false;
    this._bgmTimer = null;
    this._volume = 0.7;
    this._destroyed = false;
  }

  _ctx_() {
    if (this._destroyed) return null;
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._master = this._ctx.createGain();
      this._master.gain.value = this._volume;
      this._master.connect(this._ctx.destination);
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  _out() { if (this._destroyed) return null; this._ctx_(); return this._master; }

  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this._master) this._master.gain.value = this._volume;
  }

  // ── 배경음 (8비트 칩튠) ────────────────────
  startBGM() {
    if (this._destroyed || this._bgmActive) return;
    this._bgmActive = true;
    this._loopChiptune();
  }

  stopBGM() {
    this._bgmActive = false;
    if (this._bgmTimer) { clearTimeout(this._bgmTimer); this._bgmTimer = null; }
    this._bgmNodes.forEach(n => { try { n.stop(); } catch (e) {} });
    this._bgmNodes = [];
  }

  _loopChiptune() {
    if (this._destroyed || !this._bgmActive) return;
    const ctx = this._ctx_();
    const out = this._out();
    const beat = 60 / 160;
    const melody = [523,659,784,1047,784,659,523,659,784,1047,1047,784,880,1047,880,784];
    const bass   = [131,131,165,131,131,131,165,131];
    let t = ctx.currentTime + 0.05;

    melody.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.06, t + i * beat * 0.5);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * beat * 0.5 + beat * 0.45);
      o.connect(g); g.connect(out);
      o.start(t + i * beat * 0.5); o.stop(t + i * beat * 0.5 + beat * 0.5);
      this._bgmNodes.push(o);
    });

    bass.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = f;
      g.gain.setValueAtTime(0.08, t + i * beat);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * beat + beat * 0.9);
      o.connect(g); g.connect(out);
      o.start(t + i * beat); o.stop(t + i * beat + beat);
      this._bgmNodes.push(o);
    });

    const loopLen = melody.length * beat * 0.5;
    this._bgmTimer = setTimeout(() => this._loopChiptune(), (loopLen - 0.2) * 1000);
  }

  // ── 점프 (가벼운 통통) ─────────────────────
  jump() {
    if (this._destroyed) return;
    const ctx = this._ctx_(); const out = this._out();
    const t = ctx.currentTime;
    [0, 0.05].forEach((delay, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(300 + i * 100, t + delay);
      o.frequency.exponentialRampToValueAtTime(700 + i * 100, t + delay + 0.1);
      g.gain.setValueAtTime(0.25, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.18);
      o.connect(g); g.connect(out);
      o.start(t + delay); o.stop(t + delay + 0.2);
    });
  }

  // ── 레인 이동 (부드러운 슈) ─────────────────
  move() {
    if (this._destroyed) return;
    const ctx = this._ctx_(); const out = this._out();
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.08);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.12);
  }

  // ── 충돌 (짧고 강한 충격) ──────────────────
  hit() {
    if (this._destroyed) return;
    const ctx = this._ctx_(); const out = this._out();
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 0.5;
    src.buffer = buf;
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(filter); filter.connect(g); g.connect(out);
    src.start(t); src.stop(t + 0.2);
  }

  // ── 정리 ───────────────────────────────────
  destroy() {
    this._destroyed = true;
    this.stopBGM();
    if (this._ctx) { this._ctx.close(); this._ctx = null; }
  }
}
