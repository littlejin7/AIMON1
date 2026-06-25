// ── 발사체 애니메이션 유틸리티 ──
import { PROJ_STONE, FIREBALL } from '../assetPaths';

/** 보스 카드의 화면 중심 좌표 반환 */
function getBossCardCenter(isFinal) {
  const id = isFinal ? 'boss-final-card' : 'boss-unit-card';
  const rect = document.getElementById(id).getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * 매치 타입에 따라 적절한 발사체를 발사 (Promise 반환)
 * @param {'line'|'cross'|'wave'|'square'} type
 * @param {number} fx - 시작 X
 * @param {number} fy - 시작 Y
 * @param {boolean} isFinal - 파이널 보스 여부
 * @param {React.RefObject} lCanvasRef - 번개 전용 캔버스 ref
 */
export function launchProjectileAsync(type, fx, fy, isFinal, lCanvasRef) {
  const tgt = getBossCardCenter(isFinal);
  if (type === 'square') return launchStoneProj(fx, fy, tgt.x, tgt.y);
  if (type === 'cross')  return launchLightningProj(tgt.x, tgt.y, lCanvasRef);
  if (type === 'wave')   return launchWaveProj(fx, fy, tgt.x, tgt.y);
  return launchOrbProj(fx, fy, tgt.x, tgt.y); // line: 에너지 구체
}

// ── 돌 발사체 (2×2 square 매치) ──
function launchStoneProj(fx, fy, tx, ty) {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; left:${fx}px; top:${fy}px;
      width:120px; height:120px;
      background:url(${PROJ_STONE}) center/contain no-repeat;
      pointer-events:none; z-index:500;
      transform:translate(-50%,-50%);
      filter:drop-shadow(0 0 28px rgba(120,200,255,1)) drop-shadow(0 0 12px rgba(255,255,255,0.8));
    `;
    document.body.appendChild(el);
    const dur = 520;
    const t0 = performance.now();

    function tick(now) {
      const t = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - t, 3);
      const x = fx + (tx - fx) * e;
      const arc = Math.sin(t * Math.PI) * -130;
      const y = fy + (ty - fy) * e + arc;
      const sc = 1.0 + Math.sin(t * Math.PI) * 0.8;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.transform = `translate(-50%,-50%) rotate(${t * 560}deg) scale(${sc})`;
      if (t < 1) requestAnimationFrame(tick);
      else { el.remove(); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}

// ── 번개 발사체 (cross 매치) ──
function launchLightningProj(tx, ty, lCanvasRef) {
  return new Promise(resolve => {
    const lCanvas = lCanvasRef.current;
    const lCtx = lCanvas.getContext('2d');
    let frame = 0;
    const totalF = 40;
    const startY = Math.max(ty - 320, 5);

    function drawBolt() {
      lCtx.clearRect(0, 0, lCanvas.width, lCanvas.height);
      const fadeOut = frame > totalF - 8 ? 1 - (frame - (totalF - 8)) / 8 : 1;

      // 메인 번개 3겹 → 5겹으로 늘려 더 두껍게
      for (let stroke = 0; stroke < 5; stroke++) {
        const widths = [18, 12, 7, 3.5, 1.5][stroke];
        const cols = [
          'rgba(120,180,255,0.5)',
          'rgba(160,210,255,0.7)',
          'rgba(180,220,255,0.85)',
          'rgba(100,180,255,0.9)',
          'rgba(255,255,255,0.98)',
        ][stroke];
        lCtx.save();
        lCtx.globalAlpha = fadeOut * (stroke >= 3 ? 1 : 0.85);
        lCtx.strokeStyle = cols;
        lCtx.lineWidth = widths;
        if (stroke === 0) { lCtx.shadowColor = '#66aaff'; lCtx.shadowBlur = 60; }
        if (stroke === 1) { lCtx.shadowColor = '#88ccff'; lCtx.shadowBlur = 40; }
        lCtx.beginPath();
        let cx = tx + (Math.random() - 0.5) * 20;
        let cy = startY;
        lCtx.moveTo(cx, cy);
        const steps = 16;
        for (let i = 1; i <= steps; i++) {
          cx = tx + (Math.random() - 0.5) * 55 * (1 - (i / steps) * 0.4);
          cy = startY + (ty - startY) * i / steps;
          lCtx.lineTo(cx, cy);
        }
        lCtx.stroke();
        lCtx.restore();
      }

      // 충돌 플래시 — 더 크고 밝게
      if (frame >= totalF - 12) {
        const a = fadeOut * 0.9;
        lCtx.save();
        // 외곽 글로우
        lCtx.beginPath();
        lCtx.arc(tx, ty, 70 + Math.random() * 20, 0, Math.PI * 2);
        lCtx.fillStyle = `rgba(150,200,255,${a * 0.3})`;
        lCtx.shadowColor = '#aaddff';
        lCtx.shadowBlur = 60;
        lCtx.fill();
        // 코어 플래시
        lCtx.beginPath();
        lCtx.arc(tx, ty, 40 + Math.random() * 15, 0, Math.PI * 2);
        lCtx.fillStyle = `rgba(210,235,255,${a})`;
        lCtx.shadowBlur = 40;
        lCtx.fill();
        lCtx.restore();
      }
    }

    function anim() {
      if (frame >= totalF) {
        lCtx.clearRect(0, 0, lCanvas.width, lCanvas.height);
        resolve();
        return;
      }
      drawBolt();
      frame++;
      requestAnimationFrame(anim);
    }
    requestAnimationFrame(anim);
  });
}

// ── 파도 발사체 (wave 매치) ──
function launchWaveProj(fx, fy, tx, ty) {
  const SIZE = 260;
  const HALF = SIZE / 2;
  return new Promise(resolve => {
    const el = document.createElement('canvas');
    el.width = SIZE;
    el.height = SIZE;
    el.style.cssText = `
      position:fixed; left:${fx - HALF}px; top:${fy - HALF}px;
      pointer-events:none; z-index:500;
    `;
    document.body.appendChild(el);
    const ctx = el.getContext('2d');
    const dur = 620;
    const t0 = performance.now();

    function tick(now) {
      const t = Math.min((now - t0) / dur, 1);
      ctx.clearRect(0, 0, SIZE, SIZE);
      for (let i = 0; i < 8; i++) {
        const phase = t - i * 0.08;
        if (phase <= 0 || phase > 1) continue;
        const radius = phase * (HALF - 5);
        const alpha = (1 - phase) * 0.95;
        ctx.beginPath();
        ctx.arc(HALF, HALF, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(50,200,255,${alpha})`;
        ctx.lineWidth = 8 + phase * 4;
        ctx.shadowColor = 'rgba(80,220,255,1)';
        ctx.shadowBlur = 28;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      const e = 1 - Math.pow(1 - t, 2.5);
      el.style.left = (fx + (tx - fx) * e - HALF) + 'px';
      el.style.top  = (fy + (ty - fy) * e - HALF) + 'px';
      el.style.opacity = String(0.98 - t * 0.25);
      if (t < 1) requestAnimationFrame(tick);
      else { el.remove(); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}

// ── 파이어볼 발사체 (콤보 게이지 100% 발동) ──
export function launchFireballAsync(fx, fy, isFinal) {
  const tgt = getBossCardCenter(isFinal);
  const tx = tgt.x, ty = tgt.y;
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; left:${fx}px; top:${fy}px;
      width:160px; height:160px;
      background:url(${FIREBALL}) center/contain no-repeat;
      pointer-events:none; z-index:600;
      transform:translate(-50%,-50%);
      filter:drop-shadow(0 0 40px rgba(255,120,0,1)) drop-shadow(0 0 20px rgba(255,50,0,0.9));
    `;
    document.body.appendChild(el);

    // 충격파 원 (히트 시)
    const shockwave = document.createElement('div');
    shockwave.style.cssText = `
      position:fixed; left:${tx}px; top:${ty}px;
      width:0px; height:0px;
      border-radius:50%;
      pointer-events:none; z-index:599;
      transform:translate(-50%,-50%);
      background:radial-gradient(circle, rgba(255,180,0,0.6), rgba(255,80,0,0.3), transparent);
    `;
    document.body.appendChild(shockwave);

    const dur = 600;
    const t0 = performance.now();
    let hit = false;

    function tick(now) {
      const t = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - t, 2.8);
      const x = fx + (tx - fx) * e;
      const arc = Math.sin(t * Math.PI) * -160;
      const y = fy + (ty - fy) * e + arc;
      const sc = 1.2 + Math.sin(t * Math.PI) * 1.0; // 크게 커졌다가
      const rot = t * 720;
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      el.style.transform = `translate(-50%,-50%) rotate(${rot}deg) scale(${sc})`;

      // 히트 시 충격파 연출
      if (t > 0.85 && !hit) {
        hit = true;
        let sw = 0;
        const swTimer = setInterval(() => {
          sw += 18;
          shockwave.style.width  = sw + 'px';
          shockwave.style.height = sw + 'px';
          shockwave.style.opacity = String(1 - sw / 280);
          if (sw >= 280) { clearInterval(swTimer); shockwave.remove(); }
        }, 16);
      }

      if (t < 1) requestAnimationFrame(tick);
      else { el.remove(); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}


// ── 에너지 구체 발사체 (일반 line 매치) ──
function launchOrbProj(fx, fy, tx, ty) {
  const SIZE = 120;
  const HALF = SIZE / 2;
  return new Promise(resolve => {
    const el = document.createElement('canvas');
    el.width = SIZE;
    el.height = SIZE;
    el.style.cssText = `
      position:fixed; left:${fx - HALF}px; top:${fy - HALF}px;
      pointer-events:none; z-index:500;
    `;
    document.body.appendChild(el);
    const ctx = el.getContext('2d');
    const dur = 420;
    const t0 = performance.now();

    function drawOrb(pulse) {
      ctx.clearRect(0, 0, SIZE, SIZE);

      // 외부 글로우
      const glow = ctx.createRadialGradient(HALF, HALF, 4, HALF, HALF, HALF - 2 + pulse * 6);
      glow.addColorStop(0,   'rgba(180,100,255,0)');
      glow.addColorStop(0.5, 'rgba(120,180,255,0.28)');
      glow.addColorStop(1,   'rgba(80,120,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(HALF, HALF, HALF - 2 + pulse * 6, 0, Math.PI * 2);
      ctx.fill();

      // 코어 그라디언트
      const coreR = 32 + pulse * 4;
      const core = ctx.createRadialGradient(HALF - 10, HALF - 12, 2, HALF, HALF, coreR);
      core.addColorStop(0,    'rgba(255,255,255,0.95)');
      core.addColorStop(0.25, 'rgba(200,160,255,0.9)');
      core.addColorStop(0.6,  'rgba(100,140,255,0.85)');
      core.addColorStop(1,    'rgba(60,80,200,0.7)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(HALF, HALF, coreR, 0, Math.PI * 2);
      ctx.fill();

      // 하이라이트
      const hi = ctx.createRadialGradient(HALF - 12, HALF - 14, 0, HALF - 12, HALF - 14, 18);
      hi.addColorStop(0, 'rgba(255,255,255,0.95)');
      hi.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(HALF - 12, HALF - 14, 18, 0, Math.PI * 2);
      ctx.fill();

      // 스파크
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + pulse * 0.8;
        const r = 42 + pulse * 5;
        ctx.beginPath();
        ctx.arc(HALF + Math.cos(a) * r, HALF + Math.sin(a) * r, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${0.85 - pulse * 0.3})`;
        ctx.shadowColor = '#aaccff';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    function tick(now) {
      const t = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - t, 2.5);
      const pulse = Math.sin(t * Math.PI * 3) * 0.5 + 0.5;
      drawOrb(pulse * 2);
      const x = fx + (tx - fx) * e;
      const arc = Math.sin(t * Math.PI) * -80;
      const y = fy + (ty - fy) * e + arc;
      const sc = 1.0 + pulse * 0.35;
      el.style.left = (x - HALF) + 'px';
      el.style.top  = (y - HALF) + 'px';
      el.style.transform = `scale(${sc})`;
      el.style.opacity = String(t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1);
      if (t < 1) requestAnimationFrame(tick);
      else { el.remove(); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}
