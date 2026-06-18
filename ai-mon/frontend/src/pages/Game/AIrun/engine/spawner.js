import * as THREE from 'three';

export function spawnObstacle(game) {
  const lane = [-1, 0, 1][Math.floor(Math.random() * 3)];
  const isTall = Math.random() < 0.5;
  const template = isTall ? game.gltfModels.fence : game.gltfModels.boulder;
  let mesh;

  if (template) {
    mesh = template.clone(true);
    if (isTall) {
      const size = new THREE.Vector3();
      new THREE.Box3().setFromObject(mesh).getSize(size);
      const s = 2.8 / (size.y || 1);
      mesh.scale.set(s * 0.5, s, s);
      mesh.traverse(c => { if (/corner|start|end/i.test(c.name)) c.visible = false; });
      mesh.position.set(lane * 3, 0, game.nextObstacleZ);
    } else {
      const size = new THREE.Vector3();
      const box = new THREE.Box3().setFromObject(mesh);
      box.getSize(size);
      const s = 1.2 / (size.y || 1);
      mesh.scale.setScalar(s);
      const newBox = new THREE.Box3().setFromObject(mesh);
      mesh.position.set(lane * 3, -newBox.min.y, game.nextObstacleZ);
    }
  } else {
    const geo = isTall ? new THREE.BoxGeometry(2.5, 2.8, 0.4) : new THREE.SphereGeometry(0.8, 8, 6);
    mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: isTall ? 0x885522 : 0x776655, roughness: 0.9 }));
    mesh.position.set(lane * 3, isTall ? 1.4 : 0.8, game.nextObstacleZ);
  }

  mesh.castShadow = true;
  game.scene.add(mesh);
  game.obstacles.push({ mesh, ring: null, lane, active: true, h: isTall ? 2.8 : 1.2, yPos: isTall ? 1.4 : 0.6 });
  game.nextObstacleZ -= 4 + Math.random() * 2.3;
}

export function spawnQuizGate(game) {
  const quiz = game.quizPool[game.quizIndex++ % game.quizPool.length];
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
