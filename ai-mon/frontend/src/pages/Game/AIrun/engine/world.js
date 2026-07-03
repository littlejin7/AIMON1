import * as THREE from 'three';
import roadDiffuseUrl from '../assets/road_diffuse.jpg';
import groundDiffuseUrl from '../assets/ground_diffuse.jpg';

export function setupScene(game) {
  const w = game.container.clientWidth;
  const h = game.container.clientHeight;

  game.renderer = new THREE.WebGLRenderer({ antialias: true });
  game.renderer.setSize(w, h);
  game.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  game.renderer.shadowMap.enabled = true;
  game.renderer.shadowMap.type = THREE.PCFShadowMap;
  game.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  game.renderer.toneMappingExposure = 1.2;
  game.container.appendChild(game.renderer.domElement);

  game.scene = new THREE.Scene();
  // 저녁 하늘 — 인디고 보라
  game.scene.background = new THREE.Color(0x1a0f3a);
  game.scene.fog = new THREE.Fog(0x2a1848, 32, 105);

  game.camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 200);
  game.camera.position.set(0, 5.5, 11);
  game.camera.lookAt(0, 1.5, -5);
  game._camBaseX = 0;
  game._camBaseY = 5.5;
}

export function setupLights(game) {
  // 저녁 조명 — 노을빛 하늘 + 어두운 지면
  const hemi = new THREE.HemisphereLight(0xff8844, 0x1a0a30, 1.0);
  game.scene.add(hemi);
  game.hemiLight = hemi;

  // 저녁 태양 — 지평선 가까이 낮은 각도
  const dir = new THREE.DirectionalLight(0xffaa66, 3.5);
  dir.position.set(18, 12, 8);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 1024;
  dir.shadow.mapSize.height = 1024;
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 150;
  dir.shadow.camera.left = -25;
  dir.shadow.camera.right = 25;
  dir.shadow.camera.top = 25;
  dir.shadow.camera.bottom = -25;
  dir.shadow.bias = -0.0005;
  game.scene.add(dir);
  game.dirLight = dir;

  // 보라 앰비언트
  const ambient = new THREE.AmbientLight(0x3a1860, 1.2);
  game.scene.add(ambient);
  game.ambientLight = ambient;
}

export function setupTrack(game) {
  const texLoader = new THREE.TextureLoader();

  // 밝은 초록 잔디 바닥
  const groundTex = texLoader.load(groundDiffuseUrl);
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(12, 12);
  groundTex.anisotropy = 16;
  game._groundTex = groundTex;

  const basePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ map: groundTex, color: 0x7acc5a, roughness: 0.9 })
  );
  basePlane.rotation.x = -Math.PI / 2;
  basePlane.position.set(0, -0.05, -500);
  basePlane.receiveShadow = true;
  game.scene.add(basePlane);

  // 돌 타일 캔버스 텍스처 (코블스톤)
  const cobbleTex = _makeCobbleTex();
  cobbleTex.wrapS = cobbleTex.wrapT = THREE.RepeatWrapping;
  cobbleTex.repeat.set(4, 8);
  game._roadTex = cobbleTex;

  const ROAD_SEG_LEN = 50;
  const ROAD_SEG_NUM = 8;
  game.roadPlanes = [];
  for (let i = 0; i < ROAD_SEG_NUM; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(9.2, ROAD_SEG_LEN + 2),
      new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: 0.92, color: 0xddddd0 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, -0.01, -i * ROAD_SEG_LEN);
    mesh.receiveShadow = true;
    mesh._loopLen = ROAD_SEG_LEN * ROAD_SEG_NUM;
    game.scene.add(mesh);
    game.roadPlanes.push(mesh);
  }

  // 트랙 세그먼트 (장애물용)
  for (let i = 0; i < 10; i++) {
    const seg = new THREE.Group();
    seg.position.z = -i * 38;
    game.scene.add(seg);
    game.tracks.push(seg);
  }

  _buildKartCurbs(game);   // 핑크/흰/파랑 컬러 커브
  _buildFences(game);       // 흰색 카툰 울타리
  _buildLampPosts(game);    // 가로등 + 배너
  _buildTrees(game);        // 밝은 카툰 나무
  _buildClouds(game);       // 흰 구름
  _buildGateArch(game);     // 원거리 게이트
  _buildPetals(game);       // 벚꽃 꽃잎
}

// ── 코블스톤 텍스처 생성 ──────────────────────────
function _makeCobbleTex() {
  const SIZE = 512;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  // 베이스 — 연한 회색
  ctx.fillStyle = '#d0cec8';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 돌 타일 그리기
  const COLS = 4, ROWS = 5;
  const TW = SIZE / COLS, TH = SIZE / ROWS;
  const PAD = 6; // 줄눈 두께

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const offsetX = (r % 2 === 0) ? 0 : TW * 0.5;
      const x = c * TW + offsetX;
      const y = r * TH;
      const w = TW - PAD;
      const h = TH - PAD;

      // 돌 색상 (살짝 변화)
      const v = 195 + Math.floor(((r * COLS + c) * 17) % 30);
      ctx.fillStyle = `rgb(${v},${v-4},${v-8})`;

      // 둥근 직사각형
      const rx = 10;
      ctx.beginPath();
      ctx.moveTo(x + PAD/2 + rx, y + PAD/2);
      ctx.lineTo(x + PAD/2 + w - rx, y + PAD/2);
      ctx.quadraticCurveTo(x + PAD/2 + w, y + PAD/2, x + PAD/2 + w, y + PAD/2 + rx);
      ctx.lineTo(x + PAD/2 + w, y + PAD/2 + h - rx);
      ctx.quadraticCurveTo(x + PAD/2 + w, y + PAD/2 + h, x + PAD/2 + w - rx, y + PAD/2 + h);
      ctx.lineTo(x + PAD/2 + rx, y + PAD/2 + h);
      ctx.quadraticCurveTo(x + PAD/2, y + PAD/2 + h, x + PAD/2, y + PAD/2 + h - rx);
      ctx.lineTo(x + PAD/2, y + PAD/2 + rx);
      ctx.quadraticCurveTo(x + PAD/2, y + PAD/2, x + PAD/2 + rx, y + PAD/2);
      ctx.closePath();
      ctx.fill();

      // 돌 하이라이트 (위쪽 밝은 선)
      ctx.strokeStyle = `rgba(255,255,255,0.2)`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 이끼/그림자 (약간 어두운 가장자리)
      const grad = ctx.createLinearGradient(x + PAD/2, y + PAD/2, x + PAD/2, y + PAD/2 + h);
      grad.addColorStop(0, 'rgba(255,255,255,0.06)');
      grad.addColorStop(1, 'rgba(0,0,0,0.09)');
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  // 줄눈 — 살짝 녹색빛 어두운 색
  ctx.strokeStyle = '#8a9c7a';
  ctx.lineWidth = PAD;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * TH); ctx.lineTo(SIZE, r * TH);
    ctx.stroke();
  }
  for (let r = 0; r < ROWS; r++) {
    const offsetX = (r % 2 === 0) ? 0 : TW * 0.5;
    for (let c = 0; c <= COLS + 1; c++) {
      const x = c * TW + offsetX - TW;
      ctx.beginPath();
      ctx.moveTo(x, r * TH); ctx.lineTo(x, (r + 1) * TH);
      ctx.stroke();
    }
  }

  return new THREE.CanvasTexture(canvas);
}

// ── 노랑/흰 줄무늬 커브 ──────────────────────────
function _buildKartCurbs(game) {
  const colors = [0xf5c020, 0xffffff]; // 노랑, 흰색 교대
  const curbH = 0.28;
  const curbW = 0.75;
  const segLen = 2.0;
  const numSegs = 250;

  game.curbGroups = [];

  [-1, 1].forEach(side => {
    const xPos = side * (9.2 / 2 + curbW / 2);
    for (let i = 0; i < numSegs; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: colors[i % 2],
        roughness: 0.45,
      });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(curbW, curbH, segLen),
        mat
      );
      mesh.position.set(xPos, curbH / 2, -i * segLen);
      mesh.receiveShadow = true;
      mesh._loopLen = numSegs * segLen;
      mesh._side = side;
      game.scene.add(mesh);
      game.curbGroups.push(mesh);
    }
  });
}

// ── 흰색 카툰 울타리 ──────────────────────────────
function _buildFences(game) {
  const postMat  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  const railMat  = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.55 });
  const panelMat = new THREE.MeshStandardMaterial({ color: 0xffaac8, roughness: 0.5, side: THREE.DoubleSide });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

  const SPACING  = 3.6;   // 기둥 간격
  const PANEL_N  = 3;     // 패널 1개당 차지하는 기둥 칸 수
  const NUM      = 80;    // 기둥 수
  const TOTAL_LEN = NUM * SPACING;

  // 공유 지오메트리
  const postGeo   = new THREE.BoxGeometry(0.22, 1.5, 0.22);
  const topRailGeo = new THREE.BoxGeometry(0.14, 0.14, SPACING); // 한 칸짜리 레일
  const botRailGeo = new THREE.BoxGeometry(0.14, 0.14, SPACING);
  const panelGeo  = new THREE.BoxGeometry(0.1, 0.9, SPACING * PANEL_N - 0.1);
  const frameGeo  = new THREE.BoxGeometry(0.06, 1.02, SPACING * PANEL_N + 0.08);

  game.fenceGroups = [];

  [-1, 1].forEach(side => {
    const xPos = side * (9.2 / 2 + 1.5);

    for (let i = 0; i < NUM; i++) {
      const grp = new THREE.Group();

      // 기둥
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.y = 0.75;
      grp.add(post);

      // 상단 레일 — 이 기둥에서 다음 기둥까지 (-z 방향 절반씩)
      const topRail = new THREE.Mesh(topRailGeo, railMat);
      topRail.position.set(0, 1.3, -SPACING / 2);
      grp.add(topRail);

      // 하단 레일
      const botRail = new THREE.Mesh(botRailGeo, railMat);
      botRail.position.set(0, 0.4, -SPACING / 2);
      grp.add(botRail);

      // 핑크 패널 — PANEL_N 칸마다 1개, 정확히 PANEL_N 칸 너비로 배치
      if (i % PANEL_N === 0) {
        const panelZ = -(SPACING * PANEL_N) / 2; // 중앙 정렬

        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(0, 0.75, panelZ);
        grp.add(frame);

        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.set(0, 0.75, panelZ);
        grp.add(panel);
      }

      grp.position.set(xPos, 0, -i * SPACING);
      grp._loopLen = TOTAL_LEN;
      grp._side = side;
      game.scene.add(grp);
      game.fenceGroups.push(grp);
    }
  });
}

// ── 가로등 + 배너 ─────────────────────────────────
function _buildLampPosts(game) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.4, metalness: 0.3 });
  // 저녁 가로등 — 따뜻한 주황 글로우
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffdd88,
    emissive: 0xff9922,
    emissiveIntensity: 2.5,
    roughness: 0.2,
    metalness: 0.1,
  });
  game.lampHeadMat = headMat; // 조명 전환 시 업데이트용
  const bannerMat = new THREE.MeshStandardMaterial({ color: 0xff7baa, roughness: 0.7, side: THREE.DoubleSide });
  const bannerBlueMat = new THREE.MeshStandardMaterial({ color: 0x44aaee, roughness: 0.7, side: THREE.DoubleSide });

  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.5, 8);
  const headGeo = new THREE.SphereGeometry(0.3, 8, 6);
  const bannerGeo = new THREE.PlaneGeometry(0.7, 1.1);

  game.lampGroups = [];
  const numLamps = 20;
  const spacing = 14;

  [-1, 1].forEach((side, si) => {
    const xPos = side * (9.2 / 2 + 2.5 + 0.7);
    for (let i = 0; i < numLamps; i++) {
      const grp = new THREE.Group();

      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 2.25;
      grp.add(pole);

      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 4.7, 0);
      grp.add(head);

      // 배너 (핑크/파랑 교대)
      const bMat = (i + si) % 2 === 0 ? bannerMat : bannerBlueMat;
      const banner = new THREE.Mesh(bannerGeo, bMat);
      banner.position.set(0, 3.2, 0);
      grp.add(banner);

      // 배너 안 발자국 모양 (작은 구)
      const pawMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
      [[0, 0.1], [-0.15, 0.25], [0.15, 0.25], [-0.25, 0.05], [0.25, 0.05]].forEach(([ox, oy]) => {
        const paw = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 5), pawMat);
        paw.position.set(ox, oy, 0.06);
        banner.add(paw);
      });

      grp.position.set(xPos, 0, -i * spacing - 5);
      grp._loopLen = numLamps * spacing;
      grp._side = side;
      game.scene.add(grp);
      game.lampGroups.push(grp);
    }
  });
}

// ── 밝은 카툰 나무 ────────────────────────────────
function _buildTrees(game) {
  const TREE_SPACING = 3.8;
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3.5, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b5e2e, roughness: 0.9 });

  // 더 밝고 카툰같은 초록
  const leafMats = [0x4ecb3a, 0x3db82a, 0x5ed548].map(c =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 })
  );

  // 흰 꽃 (벚꽃나무 일부)
  const flowerMats = [0xffb6c8, 0xffd6e0].map(c =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })
  );

  game.treeGroups = [];
  let idx = 0;
  [-1, 1].forEach(side => {
    for (let row = 0; row < 2; row++) {
      const tx = side * (9.2 / 2 + 2.5 + row * 4.2 + 1.5);
      for (let t = 0; t < 18; t++) {
        const s = (3.8 + (idx % 3) * 0.7) / 3.2;
        // 일부 벚꽃나무
        const isCherry = (idx % 7 === 3);
        const lm = isCherry ? flowerMats[idx % 2] : leafMats[idx % 3];
        const xOff = ((idx * 7) % 10) * 0.08 - 0.4;

        const grp = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.75 * s;
        trunk.scale.setScalar(s);
        grp.add(trunk);

        // 둥근 수관 - 카툰 스타일 (구 여러 개)
        const leafGeoA = new THREE.SphereGeometry(2.2, 7, 6);
        const leafGeoB = new THREE.SphereGeometry(1.6, 7, 6);

        [[leafGeoA, 0, 5.2], [leafGeoB, -1.3, 4.5], [leafGeoB, 1.2, 4.6], [leafGeoB, 0, 6.0]].forEach(([geo, ox, oy], li) => {
          const leaf = new THREE.Mesh(geo, lm);
          leaf.position.set(ox * s, oy * s, (li === 1 ? 0.3 : li === 2 ? -0.3 : 0) * s);
          leaf.scale.setScalar(s * (li === 0 ? 1 : 0.78));
          grp.add(leaf);
        });

        grp.position.set(tx + xOff, 0, -t * TREE_SPACING);
        grp._loopLen = 18 * TREE_SPACING;
        game.scene.add(grp);
        game.treeGroups.push(grp);
        idx++;
      }
    }
  });
}

// ── 구름 ───────────────────────────────────────────
function _buildClouds(game) {
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  game.cloudGroups = [];
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    [0, 1.4, -1.4, 0.7, -0.7, 2.1, -2.1].forEach((ox, ci) => {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(1.6 + Math.random() * 0.8, 7, 7),
        cloudMat
      );
      puff.position.set(ox * 3, Math.random() * 1.0, ci * 0.4);
      cloud.add(puff);
    });
    cloud.position.set((Math.random() - 0.5) * 180, 22 + Math.random() * 12, -50 - Math.random() * 180);
    cloud._speed = 0.3 + Math.random() * 0.3;
    game.scene.add(cloud);
    game.cloudGroups.push(cloud);
  }
}

// ── 원거리 게이트 아치 ────────────────────────────
function _buildGateArch(game) {
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xf5d080, roughness: 0.5, metalness: 0.1 });
  const archMat   = new THREE.MeshStandardMaterial({ color: 0xf0c050, roughness: 0.45, metalness: 0.15 });
  const topMat    = new THREE.MeshStandardMaterial({ color: 0x55aaee, roughness: 0.5 });
  const flagMat   = new THREE.MeshStandardMaterial({ color: 0xff4477, roughness: 0.7, side: THREE.DoubleSide });

  const gateZ = -200;

  // 두 기둥
  [-1, 1].forEach(side => {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 10, 1.2),
      pillarMat
    );
    pillar.position.set(side * 6, 5, gateZ);
    game.scene.add(pillar);

    // 기둥 상단 장식
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.0, 1.2, 8),
      archMat
    );
    cap.position.set(side * 6, 10.6, gateZ);
    game.scene.add(cap);

    // 깃발
    const flagPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.5 })
    );
    flagPole.position.set(side * 6, 12.5, gateZ);
    game.scene.add(flagPole);

    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), flagMat);
    flag.position.set(side * 6 + side * 0.5, 13.6, gateZ);
    game.scene.add(flag);
  });

  // 아치 상단 빔
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(12, 1.4, 1.0),
    archMat
  );
  beam.position.set(0, 10, gateZ);
  game.scene.add(beam);

  // 상단 파란 장식 패널
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(9.5, 2.0, 0.5),
    topMat
  );
  panel.position.set(0, 11.8, gateZ);
  game.scene.add(panel);

  // 별 장식 (작은 구)
  const starMat = new THREE.MeshStandardMaterial({ color: 0xffee44, roughness: 0.3, metalness: 0.2 });
  [-3.5, 0, 3.5].forEach(sx => {
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), starMat);
    star.position.set(sx, 9.2, gateZ);
    game.scene.add(star);
  });
}

// ── 벚꽃 꽃잎 파티클 ──────────────────────────────
function _buildPetals(game) {
  const petalMat = new THREE.MeshStandardMaterial({
    color: 0xffb6c8,
    roughness: 0.8,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const petalGeo = new THREE.PlaneGeometry(0.18, 0.12);

  game.petalMeshes = [];
  for (let i = 0; i < 120; i++) {
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.position.set(
      (Math.random() - 0.5) * 30,
      4 + Math.random() * 14,
      -Math.random() * 60
    );
    petal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    petal._fallSpeed = 0.015 + Math.random() * 0.025;
    petal._swaySpeed = 0.5 + Math.random() * 1.0;
    petal._swayAmp   = 0.008 + Math.random() * 0.012;
    petal._phase     = Math.random() * Math.PI * 2;
    game.scene.add(petal);
    game.petalMeshes.push(petal);
  }
}

// ── 아침 / 저녁 조명 전환 ─────────────────────────────
export function setTimeOfDay(game, mode) {
  if (mode === 'day') {
    game.scene.background.set(0x55b5f0);
    game.scene.fog.color.set(0x88d0f5);
    game.scene.fog.near = 40;
    game.scene.fog.far = 130;
    game.hemiLight.color.set(0x87d4f5);
    game.hemiLight.groundColor.set(0x5aaa3f);
    game.hemiLight.intensity = 1.4;
    game.dirLight.color.set(0xfffbe8);
    game.dirLight.intensity = 3.0;
    game.dirLight.position.set(8, 30, 10);
    game.ambientLight.color.set(0xd0f0ff);
    game.ambientLight.intensity = 1.0;
    game.renderer.toneMappingExposure = 1.3;
    if (game.lampHeadMat) {
      game.lampHeadMat.color.set(0xddeeff);
      game.lampHeadMat.emissive.set(0x000000);
      game.lampHeadMat.emissiveIntensity = 0;
    }
  } else {
    game.scene.background.set(0x1a0f3a);
    game.scene.fog.color.set(0x2a1848);
    game.scene.fog.near = 32;
    game.scene.fog.far = 105;
    game.hemiLight.color.set(0xff8844);
    game.hemiLight.groundColor.set(0x1a0a30);
    game.hemiLight.intensity = 1.0;
    game.dirLight.color.set(0xffaa66);
    game.dirLight.intensity = 3.5;
    game.dirLight.position.set(18, 12, 8);
    game.ambientLight.color.set(0x3a1860);
    game.ambientLight.intensity = 1.2;
    game.renderer.toneMappingExposure = 1.2;
    if (game.lampHeadMat) {
      game.lampHeadMat.color.set(0xffdd88);
      game.lampHeadMat.emissive.set(0xff9922);
      game.lampHeadMat.emissiveIntensity = 2.5;
    }
  }
}

// ── 매 프레임 업데이트 (RunnerEngine에서 호출) ──────
export function updateWorld(game, delta) {
  const t = game.runTime;

  // 구름 천천히 이동
  if (game.cloudGroups) {
    game.cloudGroups.forEach(c => {
      c.position.x += c._speed * delta * 0.5;
      if (c.position.x > 120) c.position.x = -120;
    });
  }

  // 꽃잎 낙하
  if (game.petalMeshes) {
    game.petalMeshes.forEach(p => {
      p.position.y -= p._fallSpeed;
      p.position.x += Math.sin(t * p._swaySpeed + p._phase) * p._swayAmp;
      p.rotation.z += 0.01;
      if (p.position.y < -1) {
        p.position.y = 12 + Math.random() * 8;
        p.position.x = (Math.random() - 0.5) * 30;
        p.position.z = game.camera.position.z - Math.random() * 30;
      }
    });
  }

  // 커브 루프
  if (game.curbGroups) {
    game.curbGroups.forEach(c => {
      c.position.z += game.speed;
      if (c.position.z > 15) c.position.z -= c._loopLen;
    });
  }

  // 울타리 루프
  if (game.fenceGroups) {
    game.fenceGroups.forEach(f => {
      f.position.z += game.speed;
      if (f.position.z > 15) f.position.z -= f._loopLen;
    });
  }

  // 가로등 루프
  if (game.lampGroups) {
    game.lampGroups.forEach(l => {
      l.position.z += game.speed;
      if (l.position.z > 15) l.position.z -= l._loopLen;
    });
  }

  // 나무 루프
  if (game.treeGroups) {
    game.treeGroups.forEach(tr => {
      tr.position.z += game.speed;
      if (tr.position.z > 15) tr.position.z -= tr._loopLen;
    });
  }
}
