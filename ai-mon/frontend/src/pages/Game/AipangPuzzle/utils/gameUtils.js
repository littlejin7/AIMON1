// ── 게임 로직 유틸리티 ──
import { COLS, ROWS, TYPES } from '../constants/gameConstants';

/** 랜덤 블록 타입 (1~6) */
export function rndType() {
  return Math.floor(Math.random() * TYPES) + 1;
}

/**
 * 매치 그룹 탐지
 * cross(+) → wave(5줄) → square(2×2) → line(3~4줄) 우선순위로 분류
 * @param {number[][]} grid
 * @returns {{ groups: object[], allCells: {r,c}[] }}
 */
export function findMatchGroups(grid) {
  // ── 수평 런 ──
  const hRuns = [];
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      const t = grid[r][c];
      if (!t) { c++; continue; }
      let len = 1;
      while (c + len < COLS && grid[r][c + len] === t) len++;
      if (len >= 3) hRuns.push({ t, r, c, len });
      c += len;
    }
  }

  // ── 수직 런 ──
  const vRuns = [];
  for (let col = 0; col < COLS; col++) {
    let r = 0;
    while (r < ROWS) {
      const t = grid[r][col];
      if (!t) { r++; continue; }
      let len = 1;
      while (r + len < ROWS && grid[r + len][col] === t) len++;
      if (len >= 3) vRuns.push({ t, r, c: col, len });
      r += len;
    }
  }

  const groups = [];
  const crossedKeys = new Set();

  // ── 십자(+): H런 ∩ V런 ──
  for (const h of hRuns) {
    for (const v of vRuns) {
      if (h.t !== v.t) continue;
      if (h.r >= v.r && h.r < v.r + v.len && v.c >= h.c && v.c < h.c + h.len) {
        const ks = new Set();
        for (let x = h.c; x < h.c + h.len; x++) ks.add(h.r * 100 + x);
        for (let y = v.r; y < v.r + v.len; y++) ks.add(y * 100 + v.c);
        const cells = [...ks].map(k => ({ r: Math.floor(k / 100), c: k % 100 }));
        groups.push({ type: 'cross', cells, cx: v.c, cy: h.r });
        cells.forEach(({ r, c }) => crossedKeys.add(r * 100 + c));
      }
    }
  }

  // ── 파도(5+ 직선) ──
  const waveKeys = new Set();
  for (const run of hRuns) {
    if (run.len >= 5) {
      const cells = [];
      for (let x = run.c; x < run.c + run.len; x++) cells.push({ r: run.r, c: x });
      groups.push({ type: 'wave', cells, cx: (run.c + run.c + run.len - 1) / 2, cy: run.r });
      cells.forEach(({ r, c }) => waveKeys.add(r * 100 + c));
    }
  }
  for (const run of vRuns) {
    if (run.len >= 5) {
      const cells = [];
      for (let y = run.r; y < run.r + run.len; y++) cells.push({ r: y, c: run.c });
      groups.push({ type: 'wave', cells, cx: run.c, cy: (run.r + run.r + run.len - 1) / 2 });
      cells.forEach(({ r, c }) => waveKeys.add(r * 100 + c));
    }
  }

  // ── 2×2 블록 ──
  const squareKeys = new Set();
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      const t = grid[r][c];
      if (t && grid[r][c + 1] === t && grid[r + 1][c] === t && grid[r + 1][c + 1] === t) {
        const ks = [r * 100 + c, r * 100 + c + 1, (r + 1) * 100 + c, (r + 1) * 100 + c + 1];
        if (!ks.some(k => crossedKeys.has(k) || waveKeys.has(k))) {
          const cells = ks.map(k => ({ r: Math.floor(k / 100), c: k % 100 }));
          groups.push({ type: 'square', cells, cx: c + 0.5, cy: r + 0.5 });
          ks.forEach(k => squareKeys.add(k));
        }
      }
    }
  }

  // ── 일반 라인 (cross/wave/square 미포함) ──
  const specialKeys = new Set([...crossedKeys, ...waveKeys, ...squareKeys]);
  for (const run of hRuns) {
    if (run.len >= 5) continue;
    const cells = [];
    for (let x = run.c; x < run.c + run.len; x++) cells.push({ r: run.r, c: x });
    if (!cells.some(({ r, c }) => specialKeys.has(r * 100 + c))) {
      groups.push({ type: 'line', cells });
    }
  }
  for (const run of vRuns) {
    if (run.len >= 5) continue;
    const cells = [];
    for (let y = run.r; y < run.r + run.len; y++) cells.push({ r: y, c: run.c });
    if (!cells.some(({ r, c }) => specialKeys.has(r * 100 + c))) {
      groups.push({ type: 'line', cells });
    }
  }

  const allKeys = new Set(groups.flatMap(g => g.cells.map(({ r, c }) => r * 100 + c)));
  const allCells = [...allKeys].map(k => ({ r: Math.floor(k / 100), c: k % 100 }));
  return { groups, allCells };
}

/** 매치된 셀 목록만 반환 */
export function findAllMatchedCells(grid) {
  return findMatchGroups(grid).allCells;
}

/** 현재 그리드에서 유효한 스왑이 있는지 검사 */
export function hasMoves(grid) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS) {
        [grid[r][c], grid[r][c + 1]] = [grid[r][c + 1], grid[r][c]];
        const ok = findAllMatchedCells(grid).length > 0;
        [grid[r][c], grid[r][c + 1]] = [grid[r][c + 1], grid[r][c]];
        if (ok) return true;
      }
      if (r + 1 < ROWS) {
        [grid[r][c], grid[r + 1][c]] = [grid[r + 1][c], grid[r][c]];
        const ok = findAllMatchedCells(grid).length > 0;
        [grid[r][c], grid[r + 1][c]] = [grid[r + 1][c], grid[r][c]];
        if (ok) return true;
      }
    }
  }
  return false;
}

/** 새 그리드 생성 */
export function createFreshGrid() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = rndType();
    }
  }
  return grid;
}
