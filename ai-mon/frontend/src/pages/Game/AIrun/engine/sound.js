import airunBgm from '@/assets/bgm/airun_bgm.mp3';

export class SoundManager {
  constructor() {
    this._ctx = null;
    this._master = null;
    this._bgmEl = null;         // BGM용 HTMLAudioElement (파일 재생)
    this._bgmActive = false;
    this._bgmPending = null;    // 자동재생 대기 리스너 해제 함수
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
    if (this._bgmEl) this._bgmEl.volume = this._volume;   // BGM도 동일 볼륨 적용
  }

  // ── 배경음 (airun_bgm.mp3 루프) ────────────────────
  startBGM() {
    if (this._destroyed || this._bgmActive) return;
    this._bgmActive = true;

    if (!this._bgmEl) {
      this._bgmEl = new Audio(airunBgm);
      this._bgmEl.loop = true;
      this._bgmEl.preload = 'auto';
    }
    this._bgmEl.volume = this._volume;
    this._bgmEl.currentTime = 0;

    this._bgmEl.play().catch(() => {
      // 자동재생 차단 → 첫 인터랙션까지 대기
      const onInteract = () => {
        if (this._bgmActive) this._bgmEl?.play().catch(() => {});
        this._clearBgmPending();
      };
      document.addEventListener('click',      onInteract, { once: true });
      document.addEventListener('keydown',    onInteract, { once: true });
      document.addEventListener('touchstart', onInteract, { once: true });
      this._bgmPending = () => {
        document.removeEventListener('click',      onInteract);
        document.removeEventListener('keydown',    onInteract);
        document.removeEventListener('touchstart', onInteract);
      };
    });
  }

  stopBGM() {
    this._bgmActive = false;
    this._clearBgmPending();
    if (this._bgmEl) {
      this._bgmEl.pause();
      this._bgmEl.currentTime = 0;
    }
  }

  _clearBgmPending() {
    if (this._bgmPending) { this._bgmPending(); this._bgmPending = null; }
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
    if (this._bgmEl) { this._bgmEl.src = ''; this._bgmEl = null; }
    if (this._ctx) { this._ctx.close(); this._ctx = null; }
  }
}
