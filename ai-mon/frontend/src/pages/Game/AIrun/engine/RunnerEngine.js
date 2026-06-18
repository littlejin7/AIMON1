import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import airunIconUrl from '../assets/AIRUNicon.png';
import { OX_QUESTIONS } from '../constants/quizData.js';
import { setupScene, setupLights, setupTrack } from './world.js';
import { setupPlayer, preloadModels, animatePlayer } from './player.js';
import { spawnObstacle, spawnQuizGate } from './spawner.js';
import { SoundManager } from './sound.js';

export class RunnerEngine {
  constructor(container) {
    this.container = container;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.animId = null;

    this.state = 'start';
    this.score = 0;
    this.hp = 3;
    this.speed = 0.5;
    this.distance = 0;
    this.targetLane = 0;
    this.currentLaneX = 0;
    this.jumping = false;
    this.jumpVel = 0;
    this.playerY = 0;
    this.invincible = false;
    this.invTimer = 0;
    this.runTime = 0;
    this._shakeAmount = 0;
    this._shakeDuration = 0;

    this.obstacles = [];
    this.quizGates = [];
    this.particles = [];
    this.tracks = [];
    this.nextObstacleZ = -60;
    this.nextQuizZ = -130;
    this.gltfModels = { fence: null, boulder: null, player: null };
    this.gltfLoader = new GLTFLoader();

    this.quizPool = [...OX_QUESTIONS].sort(() => Math.random() - 0.5);
    this.quizIndex = 0;
    this.currentQuiz = null;
    this.quizAnswered = false;

    this.overlay = null;
    this.hud = null;
    this.playerMixer = null;
    this.sound = new SoundManager();
  }

  init() {
    setupScene(this);
    setupLights(this);
    setupTrack(this);
    setupPlayer(this);
    this._setupHUD();
    this._setupOverlay();
    this._setupEvents();
    this._showStartScreen();
    this._loop();
    preloadModels(this);
  }

  // ── HUD / 오버레이 ─────────────────────────
  _setupHUD() {
    this.hud = document.createElement('div');
    this.hud.className = 'rg-hud';
    this.hud.innerHTML = `
      <div class="rg-hp" id="rg-hp">❤️❤️❤️</div>
      <div class="rg-hud-top">
        <div></div>
        <div class="rg-volume-ctrl">
          <span class="rg-vol-icon" id="rg-vol-icon">🔊</span>
          <input type="range" class="rg-vol-slider" id="rg-vol-slider" min="0" max="100" value="70">
        </div>
      </div>
      <div class="rg-hud-br">
        <div class="rg-stat">
          <span class="rg-stat-label">SCORE</span>
          <span class="rg-stat-val" id="rg-score-val">0</span>
        </div>
        <div class="rg-stat">
          <span class="rg-stat-label">DIST</span>
          <span class="rg-stat-val" id="rg-dist-val">0</span><span class="rg-stat-unit">m</span>
        </div>
      </div>
    `;
    this.container.appendChild(this.hud);

    document.getElementById('rg-vol-slider')?.addEventListener('input', (e) => {
      const v = e.target.value / 100;
      this.sound.setVolume(v);
      const icon = document.getElementById('rg-vol-icon');
      if (icon) icon.textContent = v === 0 ? '🔇' : v < 0.4 ? '🔉' : '🔊';
    });
  }

  _setupOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'rg-overlay';
    this.container.appendChild(this.overlay);
  }

  _updateHUD() {
    const s = document.getElementById('rg-score-val');
    const h = document.getElementById('rg-hp');
    const d = document.getElementById('rg-dist-val');
    if (s) s.textContent = this.score.toLocaleString();
    if (h) h.textContent = '❤️'.repeat(Math.max(0, this.hp)) + '🖤'.repeat(Math.max(0, 3 - this.hp));
    if (d) d.textContent = Math.floor(this.distance);
  }

  // ── 화면 ───────────────────────────────────
  _showStartScreen() {
    this.overlay.style.display = 'flex';
    this.overlay.innerHTML = `
      <div class="rg-panel">
        <img src="${airunIconUrl}" class="rg-icon" alt="AIrun" />
        <div class="rg-title">파이썬 런너</div>
        <div class="rg-subtitle">AIMON Python OX 퀴즈 달리기 게임</div>
        <div class="rg-controls">
          <div><kbd>◀ ▶</kbd> 레인 이동</div>
          <div><kbd>SPACE</kbd> 점프</div>
          <div><kbd>O</kbd> / <kbd>X</kbd> 퀴즈 정답</div>
        </div>
        <button class="rg-btn" id="rg-start-btn">▶ START GAME</button>
      </div>
    `;
    document.getElementById('rg-start-btn')?.addEventListener('click', () => this._startGame());
  }

  _startGame() {
    this.overlay.style.display = 'none';
    this.state = 'running';
    this.score = 0;
    this.hp = 3;
    this.distance = 0;
    this.speed = 0.5;
    this._updateHUD();
    this.sound.startBGM();
  }

  _showQuizPanel(quiz) {
    this.state = 'quiz';
    this.currentQuiz = quiz;
    this.quizAnswered = false;
    this.overlay.style.display = 'flex';
    this.overlay.innerHTML = `
      <div class="rg-quiz-panel">
        <div class="rg-quiz-label">📝 OX 퀴즈!</div>
        <div class="rg-quiz-q">${quiz.q}</div>
        <div class="rg-quiz-btns">
          <button class="rg-quiz-o" id="rg-o-btn">⭕ O</button>
          <button class="rg-quiz-x" id="rg-x-btn">❌ X</button>
        </div>
        <div class="rg-quiz-hint">키보드: <kbd>O</kbd> 또는 <kbd>X</kbd></div>
      </div>
    `;
    document.getElementById('rg-o-btn')?.addEventListener('click', () => this._answerQuiz(true));
    document.getElementById('rg-x-btn')?.addEventListener('click', () => this._answerQuiz(false));
  }

  _gameOver() {
    this.state = 'dead';
    this.sound.stopBGM();
    this.overlay.style.display = 'flex';
    this.overlay.innerHTML = `
      <div class="rg-panel">
        <div class="rg-title" style="color:#ff4422;text-shadow:0 0 20px #ff4422">GAME OVER</div>
        <div class="rg-score-final">최종 점수: <strong>${this.score.toLocaleString()}</strong></div>
        <div class="rg-score-final">달린 거리: <strong>${Math.floor(this.distance)}m</strong></div>
        <button class="rg-btn" id="rg-retry-btn">🔄 다시하기</button>
        <button class="rg-btn rg-btn-danger" id="rg-list-btn">↩ 목록으로 가기</button>
      </div>
    `;
    document.getElementById('rg-retry-btn')?.addEventListener('click', () => this._resetGame());
    document.getElementById('rg-list-btn')?.addEventListener('click', () => window.history.back());
  }

  // ── 이벤트 ─────────────────────────────────
  _setupEvents() {
    this._onKeyDown = (e) => {
      if (e.code === 'Escape') { window.history.back(); return; }
      if (this.state === 'running') {
        if (e.code === 'ArrowLeft')  this._moveLane(-1);
        if (e.code === 'ArrowRight') this._moveLane(1);
        if (e.code === 'Space') { e.preventDefault(); this._jump(); }
      }
      if (this.state === 'quiz') {
        if (e.code === 'KeyO') this._answerQuiz(true);
        if (e.code === 'KeyX') this._answerQuiz(false);
      }
    };
    this._onResize = () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('resize', this._onResize);
  }

  _moveLane(dir) {
    const next = this.targetLane + dir;
    if (next >= -1 && next <= 1) { this.targetLane = next; this.sound.move(); }
  }

  _jump() {
    if (!this.jumping && this.playerY <= 0.02) { this.jumping = true; this.jumpVel = 0.21; this.sound.jump(); }
  }

  // ── 퀴즈 / 충돌 ────────────────────────────
  _answerQuiz(answer) {
    if (this.quizAnswered) return;
    this.quizAnswered = true;
    const correct = answer === this.currentQuiz.answer;
    if (correct) {
      this.score += 300;
      this.overlay.innerHTML = `
        <div class="rg-result correct">
          <div class="rg-result-icon">⭕</div><div>정답!</div>
          <div class="rg-result-sub">+300점 획득!</div>
        </div>`;
    } else {
      this.hp = Math.max(0, this.hp - 1);
      this._updateHUD();
      this.overlay.innerHTML = `
        <div class="rg-result wrong">
          <div class="rg-result-icon">❌</div><div>틀렸어요!</div>
          <div class="rg-result-sub">정답: ${this.currentQuiz.answer ? 'O (맞다)' : 'X (틀리다)'}</div>
        </div>`;
    }
    setTimeout(() => {
      this.overlay.style.display = 'none';
      if (this.hp <= 0) this._gameOver();
      else this.state = 'running';
    }, 1400);
  }

  _hitObstacle() {
    if (this.invincible) return;
    this.hp = Math.max(0, this.hp - 1);
    this._updateHUD();
    this.sound.hit();
    this.invincible = true;
    this.invTimer = 100;
    this._shakeAmount = 0.35;
    this._shakeDuration = 18;
    this._spawnHitParticles();
    if (this.hp <= 0) setTimeout(() => this._gameOver(), 400);
  }

  _spawnHitParticles() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff4400, emissiveIntensity: 1.5 });
    for (let i = 0; i < 24; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 4, 4), mat);
      p.position.copy(this.playerGroup.position);
      p.position.y += 1;
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.28,
        Math.random() * 0.22 + 0.08,
        (Math.random() - 0.5) * 0.28
      );
      this.scene.add(p);
      this.particles.push({ mesh: p, vel, life: 45 });
    }
  }

  // ── 리셋 ───────────────────────────────────
  _resetGame() {
    this.obstacles.forEach(o => { this.scene.remove(o.mesh); if (o.ring) this.scene.remove(o.ring); });
    this.quizGates.forEach(g => this.scene.remove(g.group));
    this.particles.forEach(p => this.scene.remove(p.mesh));
    this.obstacles = [];
    this.quizGates = [];
    this.particles = [];
    this.nextObstacleZ = -60;
    this.nextQuizZ = -130;
    this.quizPool = [...OX_QUESTIONS].sort(() => Math.random() - 0.5);
    this.quizIndex = 0;
    this.playerGroup.position.set(0, 0, 2);
    this.playerY = 0;
    this.jumping = false;
    this.jumpVel = 0;
    this.targetLane = 0;
    this.currentLaneX = 0;
    this.invincible = false;
    this._startGame();
  }

  // ── 게임 루프 ──────────────────────────────
  _loop() {
    this.animId = requestAnimationFrame(() => this._loop());
    if (this.state === 'running') this._updateRunning();
    if (this.playerMixer) this.playerMixer.update(1 / 60);
    animatePlayer(this);
    this._updateParticles();
    this._animateGates();
    this._handleCameraShake();
    this.renderer.render(this.scene, this.camera);
  }

  _updateRunning() {
    this.distance += this.speed * 0.45;
    this.score += 1;
    if (this.distance > 100 && this.speed < 2.0) this.speed = 0.5 + (this.distance / 100) * 0.1;

    const targetX = this.targetLane * 3;
    this.currentLaneX += (targetX - this.currentLaneX) * 0.13;
    this.playerGroup.position.x = this.currentLaneX;

    if (this.jumping) {
      this.playerY += this.jumpVel;
      this.jumpVel -= 0.012;
      if (this.playerY <= 0) { this.playerY = 0; this.jumping = false; this.jumpVel = 0; }
    }
    this.playerGroup.position.y = this.playerY;

    this.tracks.forEach(t => { t.position.z += this.speed; if (t.position.z > 15) t.position.z -= 10 * 38; });
    this.roadPlanes?.forEach(r => { r.position.z += this.speed; if (r.position.z > 26) r.position.z -= r._loopLen; });
    this.treeGroups?.forEach(g => { g.position.z += this.speed; if (g.position.z > 6) g.position.z -= g._loopLen; });
    this.obstacles.forEach(o => { o.mesh.position.z += this.speed; if (o.ring) o.ring.position.z += this.speed; });
    this.quizGates.forEach(g => { g.group.position.z += this.speed; });

    if (this.invincible) {
      this.invTimer--;
      this.playerGroup.visible = Math.floor(this.invTimer / 5) % 2 === 0;
      if (this.invTimer <= 0) { this.invincible = false; this.playerGroup.visible = true; }
    }

    const minObZ = this.obstacles.length > 0 ? Math.min(...this.obstacles.map(o => o.mesh.position.z)) : 0;
    if (minObZ > -40) spawnObstacle(this);

    const minQZ = this.quizGates.length > 0 ? Math.min(...this.quizGates.map(g => g.group.position.z)) : 0;
    if (minQZ > -90) spawnQuizGate(this);

    const { x: px, z: pz } = this.playerGroup.position;
    const py = this.playerY;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (!o.active) continue;
      const { x: ox, z: oz } = o.mesh.position;
      if (oz > pz + 12) { this.scene.remove(o.mesh); if (o.ring) this.scene.remove(o.ring); this.obstacles.splice(i, 1); this.score += 50; continue; }
      if (Math.abs(oz - pz) < 1.3 && Math.abs(ox - px) < 1.5) {
        if ((py + 2.2) > (o.yPos - o.h / 2) + 0.15 && py < (o.yPos + o.h / 2) - 0.1) {
          o.active = false;
          this._hitObstacle();
          this.scene.remove(o.mesh);
          if (o.ring) this.scene.remove(o.ring);
          this.obstacles.splice(i, 1);
        }
      }
    }

    for (let i = this.quizGates.length - 1; i >= 0; i--) {
      const g = this.quizGates[i];
      if (!g.active) continue;
      const gz = g.group.position.z;
      if (gz > pz + 15) { this.scene.remove(g.group); this.quizGates.splice(i, 1); continue; }
      if (Math.abs(gz - pz) < 1.6 && py < 3) { g.active = false; this._showQuizPanel(g.quiz); }
    }

    this.dirLight.position.z = pz - 8;
    this._updateHUD();
  }

  _animateGates() {
    this.quizGates.forEach(g => {
      if (g.oRing) { g.oRing.rotation.z += 0.012; g.oRing.rotation.x = Math.sin(this.runTime * 0.4) * 0.1; }
    });
  }

  _updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.mesh.position.add(p.vel);
      p.vel.y -= 0.011;
      p.mesh.material.opacity = --p.life / 45;
      if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); }
    }
  }

  _handleCameraShake() {
    if (this._shakeAmount <= 0) return;
    this.camera.position.x = this._camBaseX + (Math.random() - 0.5) * this._shakeAmount;
    this.camera.position.y = this._camBaseY + (Math.random() - 0.5) * this._shakeAmount;
    if (--this._shakeDuration <= 0) {
      this._shakeAmount = 0;
      this.camera.position.set(this._camBaseX, this._camBaseY, this.camera.position.z);
    }
  }

  // ── 정리 ───────────────────────────────────
  destroy() {
    this.sound.destroy();
    if (this.animId) cancelAnimationFrame(this.animId);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('resize', this._onResize);
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode === this.container)
        this.container.removeChild(this.renderer.domElement);
    }
    if (this.hud?.parentNode === this.container) this.container.removeChild(this.hud);
    if (this.overlay?.parentNode === this.container) this.container.removeChild(this.overlay);
  }
}
