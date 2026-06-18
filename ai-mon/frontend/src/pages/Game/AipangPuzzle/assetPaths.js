// ── AI팡 에셋 경로 (src/pages/Game/AipangPuzzle/assets/ 에서 Vite 번들에 포함) ──
// @aipang alias → src/pages/Game/AipangPuzzle/assets/

import ap1 from '@aipang/ap1.png'
import ap2 from '@aipang/ap2.png'
import ap3 from '@aipang/ap3.png'
import ap4 from '@aipang/ap4.png'
import bossUnit  from '@aipang/boss_unit.png'
import bossFinal from '@aipang/boss_final.png'
import projStone from '@aipang/proj_stone.png'
import fireballSrc from '@aipang/fireball.png'
import bgmSrc    from '@aipang/bgm.m4a'
import popSrc    from '@aipang/pop.mp3'

/** 블록 이미지 배열: AP_IMGS[type] = URL (type 1~6) */
export const AP_IMGS     = [null, ap1, ap2, ap3, ap4]
export const BOSS_UNIT   = bossUnit
export const BOSS_FINAL  = bossFinal
export const PROJ_STONE  = projStone
export const FIREBALL    = fireballSrc
export const BGM_SRC     = bgmSrc
export const POP_SRC     = popSrc
