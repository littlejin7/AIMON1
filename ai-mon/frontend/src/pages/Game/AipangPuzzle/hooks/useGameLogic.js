// ── 게임 핵심 로직 훅 ──
import { useState, useRef, useEffect, useCallback } from 'react';
import { COLS, ROWS, BOSS_STAGES } from '../constants/gameConstants';
import {
  rndType,
  findMatchGroups,
  findAllMatchedCells,
  hasMoves,
  createFreshGrid,
} from '../utils/gameUtils';
import { beep, delay } from '../utils/audioUtils';
import { launchProjectileAsync, launchFireballAsync } from '../utils/projectileUtils';
import { AP_IMGS, BGM_SRC, POP_SRC } from '../assetPaths';

/**
 * AI팡 퍼즐 게임 로직 훅
 * @param {React.RefObject} pCanvasRef - 파티클 캔버스 ref
 * @param {React.RefObject} lCanvasRef - 번개 캔버스 ref
 */
export function useGameLogic(pCanvasRef, lCanvasRef) {
  // ── 렌더링용 State ──
  const [grid, setGrid] = useState([]);
  const [moves, setMoves] = useState(20);
  const [unitHp, setUnitHp] = useState(0);
  const [unitHpMax, setUnitHpMax] = useState(0);
  const [finalHp, setFinalHp] = useState(30000);
  const [unitBossName, setUnitBossName] = useState('UNIT BOSS Lv.1');
  const [stageDisplay, setStageDisplay] = useState('1/5');
  const [selected, setSelected] = useState(null);
  const [bgmVolume, setBgmVolume] = useState(0.3);
  const [comboEnergy, setComboEnergy] = useState(0);
  const [cellAnims, setCellAnims] = useState({}); // { 'r,c': 'pop'|'drop'|'shake' }
  const [bossUI, setBossUI] = useState({
    unitActive: true,
    unitDefeated: false,
    unitShaking: false,
    finalActive: false,
    finalLocked: true,
    finalShaking: false,
  });
  const [popups, setPopups] = useState({
    title: true,
    clear: false,
    over: false,
    final: false,
    bossIntro: false,
  });

  // ── 가변 게임 상태 Refs (렌더 트리거 없이 변경) ──
  const gridRef           = useRef([]);
  const movesRef          = useRef(20);
  const stageRef          = useRef(0);
  const selectedRef       = useRef(null);
  const busyRef           = useRef(false);
  const unitHpRef         = useRef(0);
  const unitHpMaxRef      = useRef(0);
  const finalHpRef        = useRef(30000);
  const finalHpMaxRef     = useRef(30000);
  const finalUnlockedRef  = useRef(false);
  const bgmVolumeRef      = useRef(0.3);
  const comboEnergyRef = useRef(0);
  const comboDecayTimer = useRef(null);

  // ── 오디오 Refs ──
  const bgmRef    = useRef(null);
  const popSfxRef = useRef(null);

  // ── 파티클 Refs ──
  const particlesRef      = useRef([]);
  const imgsRef           = useRef([]);
  const particleAnimIdRef = useRef(null);

  // ── 오디오 초기화 ──
useEffect(() => {
  bgmRef.current = new Audio(BGM_SRC);
  bgmRef.current.loop = true;
  bgmRef.current.volume = 0.3;

  popSfxRef.current = new Audio(POP_SRC);
  popSfxRef.current.volume = 0.7;

  return () => {          // ← 추가
    bgmRef.current?.pause();
    bgmRef.current = null;
  };
}, []);

  // ── 블록 이미지 사전 로드 ──
  useEffect(() => {
    const imgs = [];
    for (let i = 1; i <= 4; i++) {
      const img = new Image();
      img.src = AP_IMGS[i];
      imgs.push(img);
    }
    imgsRef.current = imgs;
  }, []);

  // ── 파티클 애니메이션 루프 ──
  useEffect(() => {
    function animP() {
      const canvas = pCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particlesRef.current = particlesRef.current.filter(p => p.life > 0);
        particlesRef.current.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.2;
          p.life--;
          ctx.save();
          ctx.globalAlpha = p.life / p.maxLife;
          if (p.img.complete && p.img.naturalWidth > 0) {
            ctx.drawImage(p.img, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          }
          ctx.restore();
        });
      }
      particleAnimIdRef.current = requestAnimationFrame(animP);
    }
    particleAnimIdRef.current = requestAnimationFrame(animP);
    return () => cancelAnimationFrame(particleAnimIdRef.current);
  }, [pCanvasRef]);

  // ── 파티클 생성 ──
  function spawnParticles(x, y, type) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 5;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        img: imgsRef.current[type - 1],
        size: 14 + Math.random() * 12,
        life: 45,
        maxLife: 45,
      });
    }
  }

  // ── 그리드 state 동기화 ──
  const syncGrid = useCallback(() => {
    setGrid(gridRef.current.map(row => [...row]));
  }, []);

  // ── 셀 애니메이션 관리 ──
  const addCellAnim = useCallback((cells, anim) => {
    setCellAnims(prev => {
      const next = { ...prev };
      cells.forEach(({ r, c }) => { next[`${r},${c}`] = anim; });
      return next;
    });
  }, []);

  const removeCellAnim = useCallback((cells, anim) => {
    setCellAnims(prev => {
      const next = { ...prev };
      cells.forEach(({ r, c }) => {
        if (next[`${r},${c}`] === anim) delete next[`${r},${c}`];
      });
      return next;
    });
  }, []);

  // ── 보드 화면 중심 좌표 ──
  function getBoardScreenCenter() {
    const el = document.getElementById('board-wrap');
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  // ── 데미지 숫자 표시 (DOM 직접 삽입) ──
  function showDmgNumber(dmg, cardId) {
    const cardEl = document.getElementById(cardId);
    if (!cardEl) return;
    const rect = cardEl.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'dmg-num' + (dmg >= 200 ? ' big' : '');
    el.textContent = '-' + dmg.toLocaleString();
    el.style.left = (rect.left + rect.width / 2) + 'px';
    el.style.top  = (rect.top + 8) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  // ── 콤보 텍스트 표시 ──
  function showComboText(combo, mult) {
    const el = document.createElement('div');
    el.className = 'combo-text';
    el.textContent = `COMBO ×${mult.toFixed(1)}!`;
    el.style.cssText = 'left:50%;top:42%;';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1150);
  }

  // ── 보스 카드 흔들기 ──
  function shakeBossCard(cardId) {
    const isUnit = cardId === 'boss-unit-card';
    setBossUI(prev => ({
      ...prev,
      unitShaking:  isUnit ? true : prev.unitShaking,
      finalShaking: isUnit ? prev.finalShaking : true,
    }));
    setTimeout(() => {
      setBossUI(prev => ({
        ...prev,
        unitShaking:  isUnit ? false : prev.unitShaking,
        finalShaking: isUnit ? prev.finalShaking : false,
      }));
    }, 400);
  }

  // ── 보스 데미지 처리 ──
  function dealDamageToBoss(dmg, isFinal) {
    if (isFinal) {
      finalHpRef.current = Math.max(0, finalHpRef.current - dmg);
      setFinalHp(finalHpRef.current);
      shakeBossCard('boss-final-card');
      showDmgNumber(dmg, 'boss-final-card');
    } else {
      unitHpRef.current = Math.max(0, unitHpRef.current - dmg);
      setUnitHp(unitHpRef.current);
      shakeBossCard('boss-unit-card');
      showDmgNumber(dmg, 'boss-unit-card');
    }
  }

  // ── 셀 낙하 처리 ──
  async function dropCells() {
    const g = gridRef.current;
    for (let c = 0; c < COLS; c++) {
      const empties = [];
      for (let r = ROWS - 1; r >= 0; r--) {
        if (!g[r][c]) {
          empties.push(r);
        } else if (empties.length) {
          const er = empties.shift();
          g[er][c] = g[r][c];
          g[r][c] = 0;
          empties.push(r);
        }
      }
      for (let r = 0; r < ROWS; r++) {
        if (!g[r][c]) g[r][c] = rndType();
      }
    }
    syncGrid();

    const allCells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) allCells.push({ r, c });
    addCellAnim(allCells, 'drop');
    await delay(240);
    removeCellAnim(allCells, 'drop');
  }

  // ── 그리드 셔플 (유효 수가 없을 때) ──
  async function shuffleGrid() {
    const g = gridRef.current;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) g[r][c] = rndType();
    syncGrid();
    await delay(300);
  }

  // ── 매치 처리 (연쇄 콤보 포함) ──
  async function processMatches() {
    const sd = BOSS_STAGES[Math.min(stageRef.current, BOSS_STAGES.length - 1)];
    const isFinal = sd.boss === 'final';
    let comboCount = 0;
    let { groups, allCells } = findMatchGroups(gridRef.current);

    // 콤보 시작 시 decay 타이머 취소
    if (comboDecayTimer.current) {
      clearInterval(comboDecayTimer.current);
      comboDecayTimer.current = null;
    }

    while (allCells.length > 0) {
      comboCount++;
      const comboMult = 1 + (comboCount - 1) * 0.7;

      // 콤보 에너지 충전 (콤보마다 20% + 매치 크기 보너스, 최대 100)
      const prevEnergy = comboEnergyRef.current;
      comboEnergyRef.current = Math.min(100, comboEnergyRef.current + 35 + allCells.length * 2);
      setComboEnergy(comboEnergyRef.current);

      // 에너지 100% 도달 시 파이어볼 발사
      if (prevEnergy < 100 && comboEnergyRef.current >= 100) {
        const bc = getBoardScreenCenter();
        const fireballDmg = Math.round(500 * sd.dmgMult);
        launchFireballAsync(bc.x, bc.y, isFinal).then(() => {
          dealDamageToBoss(fireballDmg, isFinal);
        });
        comboEnergyRef.current = 0;
        setComboEnergy(0);
      }

      const hasWave   = groups.some(g => g.type === 'wave');
      const hasCross  = groups.some(g => g.type === 'cross');
      const hasSquare = groups.some(g => g.type === 'square');
      const matchType = hasWave ? 'wave' : hasCross ? 'cross' : hasSquare ? 'square' : 'line';

      const typeMult  = matchType === 'square' ? 1.5 : (matchType === 'cross' || matchType === 'wave') ? 2 : 1;
      const baseDmg   = Math.round(allCells.length * 5024 * sd.dmgMult * typeMult);
      const totalDmg  = Math.round(baseDmg * comboMult);

      // 팝 애니메이션 + 파티클
      addCellAnim(allCells, 'pop');
      allCells.forEach(({ r, c }) => {
        const el = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          spawnParticles(rect.left + 22, rect.top + 22, gridRef.current[r][c]);
        }
      });

      if (popSfxRef.current) {
        popSfxRef.current.currentTime = 0;
        popSfxRef.current.play().catch(() => {});
      }
      beep(660, 0.08, 'sine', 0.12);
      if (comboCount > 1) {
        showComboText(comboCount, comboMult);
        beep(880, 0.1, 'sine', 0.15);
      }

      await delay(280);

      // 매치 셀 제거
      allCells.forEach(({ r, c }) => { gridRef.current[r][c] = 0; });
      removeCellAnim(allCells, 'pop');
      syncGrid();

      // 발사체 + 셀 낙하 동시 진행, 발사체 완료 후 데미지
      const bc = getBoardScreenCenter();
      await Promise.all([
        dropCells(),
        launchProjectileAsync(matchType, bc.x, bc.y, isFinal, lCanvasRef)
          .then(() => dealDamageToBoss(totalDmg, isFinal)),
      ]);

      await delay(120);
      const next = findMatchGroups(gridRef.current);
      groups = next.groups;
      allCells = next.allCells;
      if (allCells.length) beep(880, 0.08, 'sine', 0.1);
    }

    if (!hasMoves(gridRef.current)) await shuffleGrid();
  comboDecayTimer.current = setInterval(() => {
    comboEnergyRef.current = Math.max(0, comboEnergyRef.current - 8);
    setComboEnergy(comboEnergyRef.current);
    if (comboEnergyRef.current <= 0) {
      clearInterval(comboDecayTimer.current);
      comboDecayTimer.current = null;
    }
  }, 60);
}

  // ── 게임 종료 체크 ──
  function checkEnd() {
    const sd = BOSS_STAGES[Math.min(stageRef.current, BOSS_STAGES.length - 1)];
    const isFinal = sd.boss === 'final';
    const bossHp = isFinal ? finalHpRef.current : unitHpRef.current;

    if (bossHp <= 0) {
      setTimeout(() => {
        bgmRef.current?.pause();
        if (isFinal) {
          beep(523, 0.1);
          setTimeout(() => beep(659, 0.1), 100);
          setTimeout(() => beep(784, 0.1), 200);
          setTimeout(() => beep(1046, 0.4), 300);
          setPopups(prev => ({ ...prev, final: true }));
        } else {
          beep(523, 0.15);
          setTimeout(() => beep(659, 0.15), 150);
          setTimeout(() => beep(784, 0.3), 300);
          setBossUI(prev => ({ ...prev, unitDefeated: true }));
          setTimeout(() => setPopups(prev => ({ ...prev, clear: true })), 600);
        }
      }, 400);
      return;
    }
    if (movesRef.current <= 0) {
      setTimeout(() => {
        bgmRef.current?.pause();
        setPopups(prev => ({ ...prev, over: true }));
      }, 300);
    }
  }

  // ── 스왑 처리 ──
  async function doSwap(r1, c1, r2, c2) {
    busyRef.current = true;
    const g = gridRef.current;

    [g[r1][c1], g[r2][c2]] = [g[r2][c2], g[r1][c1]];
    syncGrid();
    beep(440, 0.06, 'square', 0.08);

    if (findAllMatchedCells(g).length === 0) {
      await delay(130);
      [g[r1][c1], g[r2][c2]] = [g[r2][c2], g[r1][c1]];
      syncGrid();
      const shakeCells = [{ r: r1, c: c1 }, { r: r2, c: c2 }];
      addCellAnim(shakeCells, 'shake');
      beep(200, 0.15, 'sawtooth', 0.1);
      setTimeout(() => removeCellAnim(shakeCells, 'shake'), 300);
      busyRef.current = false;
      return;
    }

    movesRef.current--;
    setMoves(movesRef.current);
    await processMatches();
    busyRef.current = false;
    checkEnd();
  }

  // ── 스테이지 초기화 ──
  const initStage = useCallback(() => {
    const sd = BOSS_STAGES[Math.min(stageRef.current, BOSS_STAGES.length - 1)];
    movesRef.current = 20 + stageRef.current * 3;
    unitHpMaxRef.current = sd.hp;
    unitHpRef.current = sd.hp;
    selectedRef.current = null;
    busyRef.current = false;

    const isFinal = sd.boss === 'final';

    if (isFinal && !finalUnlockedRef.current) {
      finalUnlockedRef.current = true;
      finalHpMaxRef.current = sd.hp;
      finalHpRef.current = sd.hp;
      setFinalHp(sd.hp);
      setPopups(prev => ({ ...prev, bossIntro: true }));
    }

    setUnitBossName(sd.name);
    setUnitHp(sd.hp);
    setUnitHpMax(sd.hp);
    setMoves(movesRef.current);
    setStageDisplay(`${stageRef.current + 1}/5`);
    setSelected(null);
    setBossUI({
      unitActive:   !isFinal,
      unitDefeated: false,
      unitShaking:  false,
      unitLocked:   isFinal,          // 파이널 진행 중엔 유닛 카드 잠금
      finalActive:  isFinal,
      finalLocked:  !finalUnlockedRef.current,
      finalShaking: false,
    });

    // 초기 매치 없는 그리드 생성
    let newGrid;
    do {
      newGrid = createFreshGrid();
    } while (findAllMatchedCells(newGrid).length > 0);

    gridRef.current = newGrid;
    syncGrid();
  }, [syncGrid]);

  // ── 셀 클릭 핸들러 ──
  const onCellClick = useCallback((r, c) => {
    if (busyRef.current || !gridRef.current[r]?.[c]) return;

    if (selectedRef.current === null) {
      selectedRef.current = { r, c };
      setSelected({ r, c });
    } else {
      const { r: pr, c: pc } = selectedRef.current;
      if (pr === r && pc === c) {
        selectedRef.current = null;
        setSelected(null);
        return;
      }
      if (Math.abs(pr - r) + Math.abs(pc - c) === 1) {
        selectedRef.current = null;
        setSelected(null);
        doSwap(pr, pc, r, c);
      } else {
        selectedRef.current = { r, c };
        setSelected({ r, c });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 팝업 버튼 핸들러 ──
  const handleStart = useCallback(() => {
    stageRef.current = 0;
    finalUnlockedRef.current = false;
    finalHpRef.current = 30000;
    setFinalHp(30000);
    setPopups(prev => ({ ...prev, title: false }));
    setBossUI(prev => ({ ...prev, finalLocked: true, finalActive: false, unitActive: true }));
    initStage();
    if (!bgmMutedRef.current && bgmRef.current) { bgmRef.current.currentTime = 0; bgmRef.current.play().catch(() => {}); }
  }, [initStage]);

  const handleNext = useCallback(() => {
    setPopups(prev => ({ ...prev, clear: false }));
    stageRef.current = Math.min(stageRef.current + 1, BOSS_STAGES.length - 1);
    initStage();
    if (!bgmMutedRef.current && bgmRef.current) { bgmRef.current.currentTime = 0; bgmRef.current.play().catch(() => {}); }
  }, [initStage]);

  const handleRetry = useCallback(() => {
    setPopups(prev => ({ ...prev, over: false }));
    initStage();
    if (!bgmMutedRef.current && bgmRef.current) { bgmRef.current.currentTime = 0; bgmRef.current.play().catch(() => {}); }
  }, [initStage]);

  const handleRestart = useCallback(() => {
    stageRef.current = 0;
    finalUnlockedRef.current = false;
    finalHpRef.current = 30000;
    setFinalHp(30000);
    setPopups(prev => ({ ...prev, final: false }));
    setBossUI(prev => ({ ...prev, finalLocked: true, finalActive: false, unitActive: true }));
    initStage();
    if (!bgmMutedRef.current && bgmRef.current) { bgmRef.current.currentTime = 0; bgmRef.current.play().catch(() => {}); }
  }, [initStage]);

  const handleBossIntroOk = useCallback(() => {
    setPopups(prev => ({ ...prev, bossIntro: false }));
  }, []);

  const handleBgmVolume = useCallback((v) => {
    bgmVolumeRef.current = v;
    setBgmVolume(v);
    if (bgmRef.current) {
      bgmRef.current.volume = v;
      if (v === 0) bgmRef.current.pause();
      else if (bgmRef.current.paused) bgmRef.current.play().catch(() => {});
    }
  }, []);
  
  const handleRefresh = useCallback(() => {
    if (busyRef.current) return;
    setPopups({ title: false, clear: false, over: false, final: false, bossIntro: false });
    initStage();
    if (!bgmMutedRef.current && bgmRef.current) {
      bgmRef.current.currentTime = 0;
      bgmRef.current.play().catch(() => {});
    }
  }, [initStage]);

  return {
    // 렌더링 State
    grid,
    moves,
    unitHp,
    unitHpMax,
    finalHp,
    finalHpMax: finalHpMaxRef.current,
    unitBossName,
    stageDisplay,
    selected,
    bgmVolume,
    comboEnergy,
    cellAnims,
    bossUI,
    popups,
    // 핸들러
    onCellClick,
    handleStart,
    handleNext,
    handleRetry,
    handleRestart,
    handleBossIntroOk,
    handleBgmgmVolume,
    handleRefresh,
  };
}
