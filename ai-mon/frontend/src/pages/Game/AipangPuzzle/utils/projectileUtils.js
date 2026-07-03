// ── 발사체 애니메이션 유틸리티 ──
import { PROJ_STONE, FIREBALL, WAVE_FX, ORB_FX } from '../assetPaths';

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
// Higgsfield로 생성한 고퀄리티 전기 에너지 파동(shockwave) VFX 스프라이트를
// 사용. 검정 배경 애디티브 글로우 이미지라 mix-blend-mode:screen 으로
// 합성하면 검정이 사라지고 빛나는 링만 자연스럽게 겹쳐 보인다.
// 기존 캔버스로 그리던 동심원 대신 실제 이미지를 회전+확대하며 날려서
// 훨씬 입체적이고 자연스러운 파동 이펙트를 만든다.
function launchWaveProj(fx, fy, tx, ty) {
  const SIZE = 240;
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; left:${fx}px; top:${fy}px;
      width:${SIZE}px; height:${SIZE}px;
      background:url(${WAVE_FX}) center/contain no-repeat;
      mix-blend-mode:screen;
      pointer-events:none; z-index:500;
      transform:translate(-50%,-50%);
    `;
    document.body.appendChild(el);

    // 잔상 링 (한 프레임 늦게 옅게 따라오며 궤적 표현)
    const trail = el.cloneNode();
    trail.style.zIndex = '499';
    document.body.appendChild(trail);

    const dur = 620;
    const t0 = performance.now();
    let lastX = fx, lastY = fy, lastSc = 0.55, lastRot = 0;

    function tick(now) {
      const t = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - t, 2.5);
      const x = fx + (tx - fx) * e;
      const y = fy + (ty - fy) * e;
      const sc = 0.55 + t * 1.35;          // 날아가며 점점 커지는 파동
      const rot = t * 200;
      const fade = 1 - Math.pow(t, 3) * 0.55;

      trail.style.left = lastX + 'px';
      trail.style.top  = lastY + 'px';
      trail.style.transform = `translate(-50%,-50%) rotate(${lastRot}deg) scale(${lastSc})`;
      trail.style.opacity = String(fade * 0.35);

      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      el.style.transform = `translate(-50%,-50%) rotate(${rot}deg) scale(${sc})`;
      el.style.opacity = String(fade);

      lastX = x; lastY = y; lastSc = sc; lastRot = rot;

      if (t < 1) requestAnimationFrame(tick);
      else { el.remove(); trail.remove(); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}

// ── 파이어볼 발사체 (콤보 게이지 100% 발동) ──
// Higgsfield로 생성한 고퀄리티 화염 코멧 VFX 스프라이트 사용.
// 검정 배경 애디티브 글로우 이미지라 mix-blend-mode:screen 으로 합성하면
// 검정이 사라지고 불꽃 빛만 자연스럽게 겹쳐 보인다 (경계 번짐 없음).
export function launchFireballAsync(fx, fy, isFinal) {
  const tgt = getBossCardCenter(isFinal);
  const tx = tgt.x, ty = tgt.y;
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; left:${fx}px; top:${fy}px;
      width:180px; height:180px;
      background:url(${FIREBALL}) center/contain no-repeat;
      mix-blend-mode:screen;
      pointer-events:none; z-index:600;
      transform:translate(-50%,-50%);
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
// Higgsfield로 생성한 고퀄리티 보라/파랑 플라즈마 에너지 구체 VFX 스프라이트.
// 검정 배경 애디티브 글로우 이미지라 mix-blend-mode:screen 으로 합성하면
// 검정이 사라지고 빛나는 구체만 자연스럽게 겹쳐 보인다. 기존 캔버스
// 그라디언트 대신 실제 이미지를 펄스(맥동)시키며 날려서 더 입체적이다.
function launchOrbProj(fx, fy, tx, ty) {
  const SIZE = 120;
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; left:${fx}px; top:${fy}px;
      width:${SIZE}px; height:${SIZE}px;
      background:url(${ORB_FX}) center/contain no-repeat;
      mix-blend-mode:screen;
      pointer-events:none; z-index:500;
      transform:translate(-50%,-50%);
    `;
    document.body.appendChild(el);
    const dur = 420;
    const t0 = performance.now();

    function tick(now) {
      const t = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - t, 2.5);
      const pulse = Math.sin(t * Math.PI * 3) * 0.5 + 0.5;
      const x = fx + (tx - fx) * e;
      const arc = Math.sin(t * Math.PI) * -80;
      const y = fy + (ty - fy) * e + arc;
      const sc = 1.0 + pulse * 0.35;
      const rot = t * 260;
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      el.style.transform = `translate(-50%,-50%) rotate(${rot}deg) scale(${sc})`;
      el.style.opacity = String(t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1);
      if (t < 1) requestAnimationFrame(tick);
      else { el.remove(); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}
