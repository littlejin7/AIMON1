// ── 게임 기본 상수 ──
export const COLS = 5;
export const ROWS = 8;
export const TYPES = 4;

// ── 보스 스테이지 데이터 ──
export const BOSS_STAGES = [
  { boss: 'unit',  name: 'UNIT BOSS Lv.1', hp: 300000,  dmgMult: 1   },
  { boss: 'unit',  name: 'UNIT BOSS Lv.2', hp: 600000,  dmgMult: 1.2 },
  { boss: 'unit',  name: 'UNIT BOSS Lv.3', hp: 1000000, dmgMult: 1.4 },
  { boss: 'unit',  name: 'UNIT BOSS Lv.4', hp: 1500000, dmgMult: 1.6   },
  { boss: 'final', name: 'FINAL BOSS',     hp: 3000000, dmgMult: 2.0 },
];

export const GAME_W = 450;
export const GAME_H = 806;
