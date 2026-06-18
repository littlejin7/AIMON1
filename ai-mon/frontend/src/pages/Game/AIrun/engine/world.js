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
  game.renderer.toneMappingExposure = 1.4;
  game.container.appendChild(game.renderer.domElement);

  game.scene = new THREE.Scene();
  game.scene.background = new THREE.Color(0x9ecfe8);
  game.scene.fog = new THREE.Fog(0x9ecfe8, 30, 120);

  game.camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 200);
  game.camera.position.set(0, 5.5, 11);
  game.camera.lookAt(0, 1.5, -5);
  game._camBaseX = 0;
  game._camBaseY = 5.5;
}

export function setupLights(game) {
  game.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x4a7c3f, 1.2));
  const dir = new THREE.DirectionalLight(0xfff5e0, 2.5);
  dir.position.set(8, 30, 10);
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
  game.scene.add(new THREE.AmbientLight(0xd0eaff, 0.8));
}

export function setupTrack(game) {
  const texLoader = new THREE.TextureLoader();

  const groundTex = texLoader.load(groundDiffuseUrl);
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(12, 12);
  groundTex.anisotropy = 16;
  game._groundTex = groundTex;

  const basePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 })
  );
  basePlane.rotation.x = -Math.PI / 2;
  basePlane.position.set(0, -0.05, -500);
  basePlane.receiveShadow = true;
  game.scene.add(basePlane);

  const roadTex = texLoader.load(roadDiffuseUrl);
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(3, 2);
  game._roadTex = roadTex;

  const ROAD_SEG_LEN = 50;
  const ROAD_SEG_NUM = 8;
  game.roadPlanes = [];
  for (let i = 0; i < ROAD_SEG_NUM; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(9.2, ROAD_SEG_LEN + 2),
      new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, -0.01, -i * ROAD_SEG_LEN);
    mesh.receiveShadow = true;
    mesh._loopLen = ROAD_SEG_LEN * ROAD_SEG_NUM;
    game.scene.add(mesh);
    game.roadPlanes.push(mesh);
  }

  for (let i = 0; i < 10; i++) {
    const seg = new THREE.Group();
    seg.position.z = -i * 38;
    game.scene.add(seg);
    game.tracks.push(seg);
  }

  _buildTrees(game);
  _buildClouds(game);
}

function _buildTrees(game) {
  const TREE_SPACING = 3.6;
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 3.2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.95 });
  const leafGeoA = new THREE.SphereGeometry(1.8, 6, 5);
  const leafGeoB = new THREE.SphereGeometry(1.4, 6, 5);
  const leafMats = [0x3a7d44, 0x2e6b38, 0x4a8f52].map(c =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })
  );
  game.treeGroups = [];
  let idx = 0;
  [-1, 1].forEach(side => {
    for (let row = 0; row < 2; row++) {
      const tx = side * (6.5 + row * 3.8);
      for (let t = 0; t < 15; t++) {
        const s = (3.5 + (idx % 3) * 0.8) / 3.2;
        const lm = leafMats[idx % 3];
        const xOff = ((idx * 7) % 10) * 0.1 - 0.5;
        const grp = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.6 * s; trunk.scale.setScalar(s); grp.add(trunk);
        [[leafGeoA, 0, 4.7], [leafGeoB, -1.1, 4.1], [leafGeoB, 1.0, 4.2]].forEach(([geo, ox, oy], li) => {
          const leaf = new THREE.Mesh(geo, lm);
          leaf.position.set(ox * s, oy * s, (li === 1 ? 0.4 : li === 2 ? -0.3 : 0) * s);
          leaf.scale.setScalar(s * (li === 0 ? 1 : li === 1 ? 0.85 : 0.8));
          grp.add(leaf);
        });
        grp.position.set(tx + xOff, 0, -t * TREE_SPACING);
        grp._loopLen = 15 * TREE_SPACING;
        game.scene.add(grp);
        game.treeGroups.push(grp);
        idx++;
      }
    }
  });
}

function _buildClouds(game) {
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Group();
    [0, 1.2, -1.2, 0.6, -0.6].forEach((ox, ci) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.5 + Math.random(), 7, 7), cloudMat);
      puff.position.set(ox * 2.5, Math.random() * 0.8, ci * 0.5);
      cloud.add(puff);
    });
    cloud.position.set((Math.random() - 0.5) * 200, 25 + Math.random() * 15, -40 - Math.random() * 200);
    game.scene.add(cloud);
  }
}
