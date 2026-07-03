import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import airunIconUrl from '../assets/AIRUNicon.png';
import { OX_QUESTIONS } from '../constants/quizData.js';
import { setupScene, setupLights, setupTrack, updateWorld, setTimeOfDay } from './world.js';
import { setupPlayer, preloadModels, animatePlayer } from './player.js';
import { spawnObstacle, spawnQuizGate, spawnHeart } from './spawner.js';
import { SoundManager } from './sound.js';

export class RunnerEngine {
  constructor(container, onGameOver) {
    this.container = container;
    this.onGameOverCallback = onGameOver;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.animId = null;

    this.state = 'start';
    this.score = 0;
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
    this.hearts = [];
    this.tracks = [];
    this.nextObstacleZ = -60;
    this.nextQuizZ = -130;
    this.nextHeartZ = -200;
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
      <div class="rg-hp" id="rg-hp">❤️❤️❤️❤️❤️</div>
      <div class="rg-hud-bl">
        <div class="rg-volume-ctrl">
          <span class="rg-vol-icon" id="rg-vol-icon">🔊</span>
          <input type="range" class="rg-vol-slider" id="rg-vol-slider" min="0" max="100" value="70">
        </div>
      </div>
      <div class="rg-hud-tr">
        <button class="rg-time-btn" id="rg-time-btn">☀️ 아침</button>
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

    this._prevVolume = 70; // 음소거 해제 시 되돌아갈 볼륨(%)
    document.getElementById('rg-vol-slider')?.addEventListener('input', (e) => {
      const v = e.target.value / 100;
      this.sound.setVolume(v);
      if (e.target.value > 0) this._prevVolume = e.target.value;
      const icon = document.getElementById('rg-vol-icon');
      if (icon) icon.textContent = v === 0 ? '🔇' : v < 0.4 ? '🔉' : '🔊';
    });

    // 스피커 아이콘 클릭 시 음소거 토글
    document.getElementById('rg-vol-icon')?.addEventListener('click', () => {
      const slider = document.getElementById('rg-vol-slider');
      const icon = document.getElementById('rg-vol-icon');
      if (!slider) return;
      const isMuted = Number(slider.value) === 0;
      const nextValue = isMuted ? (Number(this._prevVolume) || 70) : 0;
      if (!isMuted) this._prevVolume = slider.value;
      slider.value = nextValue;
      const v = nextValue / 100;
      this.sound.setVolume(v);
      if (icon) icon.textContent = v === 0 ? '🔇' : v < 0.4 ? '🔉' : '🔊';
    });

    // 아침 / 저녁 토글
    this.timeOfDay = 'evening';
    document.getElementById('rg-time-btn')?.addEventListener('click', (e) => {
      this.timeOfDay = this.timeOfDay === 'evening' ? 'day' : 'evening';
      const btn = document.getElementById('rg-time-btn');
      if (btn) btn.textContent = this.timeOfDay === 'evening' ? '☀️ 아침' : '🌙 저녁';
      e.currentTarget?.blur(); // 클릭 후 포커스를 남기지 않아 Space 등 키 입력에 반응하지 않도록
      setTimeOfDay(this, this.timeOfDay);
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
    if (h) h.textContent = '❤️'.repeat(Math.max(0, this.hp)) + '🖤'.repeat(Math.max(0, 5 - this.hp));
    if (d) d.textContent = Math.floor(this.distance);
  }

  // ── 화면 ───────────────────────────────────
  _showStartScreen() {
    this.overlay.style.display = 'flex';
    this.overlay.innerHTML = `
      <div class="rg-panel">
        <img src="${airunIconUrl}" class="rg-icon" alt="AIrun" />
        <div class="rg-title">AIrun</div>
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
    this.score = 0;
    this.hp = 5;
    this.distance = 0;
    this.speed = 0.5;
    this._updateHUD();
    this._showCountdown();
  }

  _showCountdown() {
    this.state = 'countdown';
    let count = 5;
    const show = () => {
      this.overlay.style.display = 'flex';
      this.overlay.innerHTML = `
        <div class="rg-countdown">${count}</div>
      `;
      count--;
      if (count >= 0) {
        this._countdownTimer = setTimeout(show, 1000);
      } else {
        this.overlay.innerHTML = `<div class="rg-countdown rg-countdown-go">GO!</div>`;
        this._countdownTimer = setTimeout(() => {
          this._countdownTimer = null;
          this.overlay.style.display = 'none';
          this.state = 'running';
          this.sound.startBGM();
        }, 700);
      }
    };
    show();
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
    this.playerGroup.visible = true;  
    this.invincible = false;
    this.state = 'dead';
    this.sound.stopBGM();
    this.overlay.style.display = 'flex';
    this.overlay.innerHTML = `
      <div class="rg-panel">
        <div class="rg-title" style="color:#ff4422;text-shadow:0 0 20px #ff4422">GAME OVER</div>
        <div class="rg-score-final">최종 점수: <strong>${this.score.toLocaleString()}</strong></div>
        <div class="rg-score-final">달린 거리: <strong>${Math.floor(this.distance)}m</strong></div>
        <div id="rg-reward-info" style="margin-top:10px; color:#ffcc00; font-weight:bold;"></div>
        <button class="rg-btn" id="rg-retry-btn">다시하기</button>
        <button class="rg-btn rg-btn-danger" id="rg-list-btn">↩ 목록으로 가기</button>
      </div>
    `;
    document.getElementById('rg-retry-btn')?.addEventListener('click', () => this._resetGame());
    document.getElementById('rg-list-btn')?.addEventListener('click', () => window.history.back());
    
    if (this.onGameOverCallback) {
        const el = document.getElementById('rg-reward-info');
        if (el) el.innerHTML = `보상 정산 중...`;
        this.onGameOverCallback(this.score, this.distance).then(res => {
            if (el && res && res.data) {
                if (res.data.xp_awarded > 0) {
                    el.innerHTML = `✨ ${res.data.xp_awarded} XP 획득! (총 ${res.data.total_xp} XP)`;
                } else {
                    el.innerHTML = `오늘 획득 가능한 XP를 모두 받았습니다.`;
                }
            }
        }).catch(err => {
            if (el) el.innerHTML = `보상 정보를 불러오지 못했습니다.`;
        });
    }
  }

  // ── 이벤트 ─────────────────────────────────
  _setupEvents() {
    this._onKeyDown = (e) => {
      if (e.code === 'Escape') { window.history.back(); return; }
      // 게임 조작 키는 상태와 무관하게 항상 기본 동작(포커스된 버튼 클릭 등)을 막는다.
      // 그렇지 않으면 아침/저녁 토글 버튼 등에 포커스가 남아있을 때
      // 퀴즈 화면 등에서 Space를 눌러도 그 버튼이 브라우저 기본 동작으로 클릭돼버린다.
      if (e.code === 'Space' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
      }
      if (this.state === 'running') {
        if (e.code === 'ArrowLeft')  this._moveLane(-1);
        if (e.code === 'ArrowRight') this._moveLane(1);
        if (e.code === 'Space') this._jump();
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

  _spawnHeartParticles(pos) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xff2255, emissive: 0xff0044, emissiveIntensity: 1.5, transparent: true });
    for (let i = 0; i < 16; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 4), mat.clone());
      p.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.22,
        Math.random() * 0.25 + 0.1,
        (Math.random() - 0.5) * 0.22
      );
      this.scene.add(p);
      this.particles.push({ mesh: p, vel, life: 35 });
    }
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
    this.hearts.forEach(h => this.scene.remove(h.mesh));
    this.obstacles = [];
    this.quizGates = [];
    this.particles = [];
    this.hearts = [];
    this.nextObstacleZ = -60;
    this.nextQuizZ = -130;
    this.nextHeartZ = -200;
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
    this.roadPlanes?.forEach(r => { r.position.z += this.speed; if (r.position.z > 38) r.position.z -= r._loopLen; });
    this.treeGroups?.forEach(g => { g.position.z += this.speed; if (g.position.z > 6) g.position.z -= g._loopLen; });
    this.runTime += 1 / 60;  
    updateWorld(this, 1 / 60); 
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
  if (oz > pz + 12) { /* 제거 */ continue; }

  if (o.type === 'hole') {
    // 🆕 구멍 판정: x 무관 (전 레인), 점프 중이면 통과
    if (Math.abs(oz - pz) < 1.8 && !this.jumping && py < 0.3) {
      o.active = false;
      this._hitObstacle();
      this.scene.remove(o.mesh);
      this.obstacles.splice(i, 1);
    }
  } else {
    // 🆕 꼬깔콘 판정: 기존과 동일 (레인 + 높이)
    if (Math.abs(oz - pz) < 1.3 && Math.abs(ox - px) < 1.5) {
      if ((py + 2.2) > (o.yPos - o.h/2) + 0.15 && py < (o.yPos + o.h/2) - 0.1) {
        o.active = false;
        this._hitObstacle();
        this.scene.remove(o.mesh);
        if (o.ring) this.scene.remove(o.ring);
        this.obstacles.splice(i, 1);
      }
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

    // ── 하트 아이템 ──────────────────────────────────
    // 스폰
    const minHZ = this.hearts.length > 0
      ? Math.min(...this.hearts.map(h => h.mesh.position.z)) : 0;
    if (minHZ > -100) spawnHeart(this);

    // 이동 + 둥실 애니메이션 + 충돌
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.mesh.position.z += this.speed;
      h.mesh.position.y = h.mesh._baseY + Math.sin(this.runTime * 2 + h.mesh._phase) * 0.22;
      h.mesh.rotation.y += 0.05;

      // 화면 밖 제거
      if (h.mesh.position.z > pz + 15) {
        this.scene.remove(h.mesh);
        this.hearts.splice(i, 1);
        continue;
      }

      if (!h.active) continue;

      // 플레이어 수집 판정
      if (
        Math.abs(h.mesh.position.z - pz) < 1.5 &&
        Math.abs(h.mesh.position.x - px) < 1.8
      ) {
        h.active = false;
        this.scene.remove(h.mesh);
        this.hearts.splice(i, 1);
        if (this.hp < 5) {
          this.hp = Math.min(6, this.hp + 1);
          this._updateHUD();
        }
        this._spawnHeartParticles(h.mesh.position.clone());
      }
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
    if (this._countdownTimer) { clearTimeout(this._countdownTimer); this._countdownTimer = null; }
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
