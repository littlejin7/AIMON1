import * as THREE from 'three';

export function setupPlayer(game) {
  game.playerGroup = new THREE.Group();
  game.scene.add(game.playerGroup);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2255ff, emissive: 0x0a22aa, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.7 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcc88, roughness: 0.6 });

  game.torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.4), bodyMat);
  game.torso.position.y = 1.2; game.torso.castShadow = true;
  game.playerGroup.add(game.torso);

  game.head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.48), skinMat);
  game.head.position.y = 1.88; game.head.castShadow = true;
  game.playerGroup.add(game.head);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.2, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x222222 }));
  hair.position.y = 2.14;
  game.playerGroup.add(hair);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x00ffee, emissive: 0x00ffee, emissiveIntensity: 1.5 });
  [-0.13, 0.13].forEach(x => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.06), eyeMat);
    eye.position.set(x, 1.88, -0.26);
    game.playerGroup.add(eye);
  });

  game.arms = [];
  [-0.48, 0.48].forEach(x => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.22), bodyMat);
    arm.position.set(x, 1.0, 0); arm.castShadow = true;
    game.playerGroup.add(arm); game.arms.push(arm);
  });

  game.legs = [];
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1133bb, roughness: 0.4, metalness: 0.5 });
  [-0.2, 0.2].forEach(x => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.7, 0.27), legMat);
    leg.position.set(x, 0.38, 0); leg.castShadow = true;
    game.playerGroup.add(leg); game.legs.push(leg);
  });

  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  [-0.2, 0.2].forEach(x => {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.4), shoeMat);
    shoe.position.set(x, 0.0, 0.05);
    game.playerGroup.add(shoe);
  });

  const aura = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 24),
    new THREE.MeshStandardMaterial({ color: 0x2255ff, emissive: 0x2255ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.3 })
  );
  aura.rotation.x = -Math.PI / 2; aura.position.y = 0.01;
  game.playerAura = aura;
  game.playerGroup.add(aura);
  game.playerGroup.position.set(0, 0, 2);
}

export function preloadModels(game) {
  game.gltfLoader.load('/obstacle_fence.glb', (gltf) => {
    gltf.scene.traverse(c => {
      if (!c.isMesh) return;
      c.castShadow = c.receiveShadow = true;
      if (c.material) {
        c.material.side = THREE.DoubleSide;
        if (c.material.alphaMap || c.material.map) { c.material.transparent = true; c.material.alphaTest = 0.3; }
        c.material.needsUpdate = true;
      }
    });
    game.gltfModels.fence = gltf.scene;
  });

  game.gltfLoader.load('/obstacle_boulder.glb', (gltf) => {
    gltf.scene.traverse(c => { if (c.isMesh) c.castShadow = c.receiveShadow = true; });
    game.gltfModels.boulder = gltf.scene;
  });

  game.gltfLoader.load('/player_character.glb', (gltf) => {
    const model = gltf.scene;
    while (game.playerGroup.children.length > 0) game.playerGroup.remove(game.playerGroup.children[0]);

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    model.scale.setScalar(2.2 / size.y);
    model.rotation.y = Math.PI;
    box.setFromObject(model);
    model.position.y = -box.min.y;
    model.traverse(c => { if (c.isMesh) c.castShadow = c.receiveShadow = true; });
    game.playerGroup.add(model);
    game.gltfModels.player = model;

    if (gltf.animations?.length > 0) {
      game.playerMixer = new THREE.AnimationMixer(model);
      const clip = gltf.animations.find(a => /run|walk/i.test(a.name)) || gltf.animations[0];
      game.playerMixer.clipAction(clip).play();
    }

    const aura = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 24),
      new THREE.MeshStandardMaterial({ color: 0x2255ff, emissive: 0x2255ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.3 })
    );
    aura.rotation.x = -Math.PI / 2; aura.position.y = 0.01;
    game.playerAura = aura;
    game.playerGroup.add(aura);
  });
}

export function animatePlayer(game) {
  game.runTime += 0.14;
  if (game.state === 'running' || game.state === 'quiz') {
    const swing = Math.sin(game.runTime) * 0.55;
    game.legs[0].rotation.x = swing;
    game.legs[1].rotation.x = -swing;
    game.arms[0].rotation.x = -swing * 0.7;
    game.arms[1].rotation.x =  swing * 0.7;
    game.torso.position.y = 1.2 + Math.abs(Math.sin(game.runTime)) * 0.04;
  }
  const s = 0.85 + Math.sin(game.runTime * 0.9) * 0.15;
  game.playerAura.scale.set(s, s, s);
  game.playerAura.material.opacity = 0.2 + Math.sin(game.runTime * 1.2) * 0.1;
}
