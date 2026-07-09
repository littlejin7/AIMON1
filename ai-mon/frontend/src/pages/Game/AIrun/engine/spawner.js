import * as THREE from 'three';

// ── 꼬깔콘 ────────────────────────────────────────
function _makeCone() {
  const group = new THREE.Group();

  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.0, 12), coneMat);
  cone.position.y = 1.0;
  cone.castShadow = true;
  group.add(cone);

  const bandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });
  [0.55, 1.1].forEach(y => {
    const r = 0.55 * (1 - y / 2.0) + 0.04;
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.055, 8, 24), bandMat);
    band.position.y = y;
    group.add(band);
  });

  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), bandMat);
  tip.position.y = 2.05;
  group.add(tip);

  const baseMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.72, 0.14, 16), baseMat);
  base.position.y = 0.07;
  base.castShadow = true;
  group.add(base);

  return group;
}

// ── 바닥 구멍 ─────────────────────────────────────
function _makeHole() {
  const group = new THREE.Group();

  const HOLE_W = 8.4;   // 도로 너비 덮기
  const HOLE_D = 3.2;   // 앞뒤 깊이(z)
  const PIT_H  = 3.0;   // 구멍 깊이(y)

  // ① 구멍 위를 덮는 도로 부분을 잘라낸 것처럼 보이게 —
  //    도로색 평면을 구멍 주변에 깔고 구멍 자리만 비움
  //    → Three.js에서 구멍 뚫기가 어려우므로 "pit box"로 시각적으로 표현

  // ② pit 내부 바닥 — 아주 어두운 검정
  const bottomMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1.0 });
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(HOLE_W, HOLE_D), bottomMat);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = -PIT_H;
  group.add(bottom);

  // ③ pit 벽면 4개 (앞/뒤/좌/우) — 도로 단면처럼 돌 질감
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4030, roughness: 0.95 });
  const wallDarkMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 1.0 });

  // 앞벽 / 뒷벽
  [HOLE_D / 2, -HOLE_D / 2].forEach((z, idx) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(HOLE_W, PIT_H, 0.12), idx === 0 ? wallMat : wallDarkMat);
    wall.position.set(0, -PIT_H / 2, z);
    group.add(wall);
  });

  // 좌벽 / 우벽
  [-HOLE_W / 2, HOLE_W / 2].forEach(x => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, PIT_H, HOLE_D), wallMat);
    wall.position.set(x, -PIT_H / 2, 0);
    group.add(wall);
  });

  // ④ 테두리 — 도로 단면 크랙 표현 (밝은 베이지 테두리)
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xc8c0a8, roughness: 0.8 });
  // 앞/뒤 테두리
  [HOLE_D / 2, -HOLE_D / 2].forEach(z => {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(HOLE_W + 0.1, 0.22, 0.28), rimMat);
    rim.position.set(0, 0.0, z);
    group.add(rim);
  });
  // 좌/우 테두리
  [-HOLE_W / 2, HOLE_W / 2].forEach(x => {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, HOLE_D), rimMat);
    rim.position.set(x, 0.0, 0);
    group.add(rim);
  });

  // ⑤ 구멍 위 어두운 그림자 오버레이 (살짝 위에서 어둡게)
  const shadowMat = new THREE.MeshStandardMaterial({
    color: 0x000000, transparent: true, opacity: 0.82, depthWrite: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(HOLE_W, HOLE_D), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  group.add(shadow);

  // ⑥ 경고 줄무늬 — 구멍 직전 (노랑/검정)
  const warnYellow = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.5 });
  const warnBlack  = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  const stripeW = HOLE_W / 8;
  for (let i = 0; i < 8; i++) {
    const mat = i % 2 === 0 ? warnYellow : warnBlack;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(stripeW - 0.05, 0.015, 0.6), mat);
    stripe.position.set(-HOLE_W / 2 + stripeW * i + stripeW / 2, 0.01, HOLE_D / 2 + 0.5);
    group.add(stripe);
  }

  return group;
}

// ── 하트 아이템 ───────────────────────────────────
function _makeHeart() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff2255,
    emissive: 0xff0044,
    emissiveIntensity: 1.2,
    roughness: 0.4,
  });

  // 상단 두 개의 볼록 (하트 위쪽 두 덩어리)
  [-0.25, 0.25].forEach(x => {
    const bump = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), mat);
    bump.position.set(x, 0.28, 0);
    group.add(bump);
  });

  // 45도 회전한 박스 → 하트 아래 뾰족한 부분
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.3), mat);
  bottom.rotation.z = Math.PI / 4;
  bottom.position.set(0, -0.1, 0);
  group.add(bottom);

  // 글로우 오라
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xff4477,
    transparent: true,
    opacity: 0.28,
    emissive: 0xff0044,
    emissiveIntensity: 0.4,
  });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 10), glowMat);
  glow.position.set(0, 0.1, 0);
  group.add(glow);

  return group;
}

export function spawnHeart(game) {
  const lane = [-1, 0, 1][Math.floor(Math.random() * 3)];
  const heart = _makeHeart();
  heart.position.set(lane * 3, 1.5, game.nextHeartZ);
  heart._baseY = 1.5;
  heart._phase = Math.random() * Math.PI * 2;
  game.scene.add(heart);
  game.hearts.push({ mesh: heart, lane, active: true });
  game.nextHeartZ -= 160 + Math.random() * 100;
}

export function spawnObstacle(game) {
  const lane = [-1, 0, 1][Math.floor(Math.random() * 3)];
  // 꼬깔콘 70%, 구멍 30%
  const isHole = Math.random() < 0.3;

  if (isHole) {
    const mesh = _makeHole();
    mesh.position.set(0, 0, game.nextObstacleZ);
    game.scene.add(mesh);
    // type:'hole' — 점프 중이면 통과, 아니면 데미지
    game.obstacles.push({ mesh, ring: null, lane: 'all', active: true, h: 0.5, yPos: 0, type: 'hole' });
    game.nextObstacleZ -= 2.25 + Math.random() * 0.75;
  } else {
    const cone = _makeCone();
    cone.position.set(lane * 3, 0, game.nextObstacleZ);
    game.scene.add(cone);
    game.obstacles.push({ mesh: cone, ring: null, lane, active: true, h: 2.1, yPos: 1.0, type: 'cone' });
    game.nextObstacleZ -= 1.55 + Math.random() * 0.8;
  }
}

export function spawnQuizGate(game) {
  if (game.quizIndex >= game.quizPool.length) {
    game.quizPool = [...game.quizPool].sort(() => Math.random() - 0.5);
    game.quizIndex = 0;
  }
  const quiz = game.quizPool[game.quizIndex++];
  const group = new THREE.Group();
  group.position.z = game.nextQuizZ;

  const mats = {
    wood:  new THREE.MeshStandardMaterial({ color: 0x8d6240, roughness: 0.9 }),
    dark:  new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.95 }),
    green: new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.8 }),
    red:   new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.8 }),
    white: new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.7 }),
  };

  // 상단 빔 + 기둥 2개
  const beam = new THREE.Mesh(new THREE.BoxGeometry(10, 0.35, 0.35), mats.dark);
  beam.position.set(0, 3.5, 0); beam.castShadow = true; group.add(beam);
  [-4.8, 4.8].forEach(x => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4.0, 8), mats.dark);
    post.position.set(x, 2.0, 0); post.castShadow = true; group.add(post);
  });

  // O판 / X판 / 중간판
  [
    { x: -3, mat: mats.green, label: 'O' },
    { x:  3, mat: mats.red,   label: 'X' },
  ].forEach(({ x, mat, label }) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.8, 0.18), mats.wood);
    board.position.set(x, 1.5, 0); group.add(board);
    const border = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.0, 0.12), mat);
    border.position.set(x, 1.5, -0.04); group.add(border);
    const lbl = makeTextSprite(label, '#ffffff', 90);
    lbl.position.set(x, 1.55, 0.14); group.add(lbl);
  });

  const mid = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.8, 0.18), mats.white);
  mid.position.set(0, 1.5, 0); group.add(mid);
  [1, -1].forEach(dir => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.22), mats.dark);
    bar.position.set(0, 1.5, 0.05); bar.rotation.z = dir * Math.PI / 4; group.add(bar);
  });

  game.scene.add(group);
  game.quizGates.push({ group, quiz, active: true, oRing: null });
  game.nextQuizZ -= 90 + Math.random() * 50;
}

export function makeTextSprite(text, color, size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${size}px Arial`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillText(text, 64, 64);
  const mat = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), mat);
}
