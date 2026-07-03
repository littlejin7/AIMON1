// ── AI팡 에셋 경로 (src/pages/Game/AipangPuzzle/assets/ 에서 Vite 번들에 포함) ──
// @aipang alias → src/pages/Game/AipangPuzzle/assets/

import ap1 from '@aipang/ap1.png'
import ap2 from '@aipang/ap2.png'
import ap3 from '@aipang/ap3.png'
import ap4 from '@aipang/ap4.png'
import bossUnit  from '@aipang/boss_unit.png'
import bossFinal from '@aipang/boss_final.png'
import projStone from '@aipang/proj_stone.png'
import bgmSrc    from '@aipang/bgm.m4a'
import popSrc    from '@aipang/pop.mp3'

// 파이어볼 / 파도(wave) 이펙트 — Higgsfield AI로 생성한 고퀄리티 VFX 스프라이트.
// 순수 검정 배경 위의 애디티브 글로우 이미지라서 mix-blend-mode:screen 으로
// 합성하면 검정이 자연스럽게 사라지고 빛만 남는다 (키컬러 배경제거 방식보다
// 경계 번짐이 없어 더 자연스럽고 고퀄리티로 보임).
import fireballSrc from '@aipang/fireball.png'
import waveFxSrc   from '@aipang/wave.png'
import orbFxSrc    from '@aipang/orb.png'

/** 블록 이미지 배열: AP_IMGS[type] = URL (type 1~6) */
export const AP_IMGS     = [null, ap1, ap2, ap3, ap4]
export const BOSS_UNIT   = bossUnit
export const BOSS_FINAL  = bossFinal
export const PROJ_STONE  = projStone
export const FIREBALL    = fireballSrc
export const WAVE_FX     = waveFxSrc
export const ORB_FX      = orbFxSrc

export const BGM_SRC     = bgmSrc
export const POP_SRC     = popSrc
