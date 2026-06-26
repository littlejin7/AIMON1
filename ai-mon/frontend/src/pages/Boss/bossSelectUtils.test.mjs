/**
 * getBossCardState 단언 테스트 (Node 직접 실행 — 프레임워크 없음).
 * 실행: node ai-mon/frontend/src/pages/Boss/bossSelectUtils.test.mjs
 */
import assert from 'node:assert/strict'
import { getBossCardState } from './bossSelectUtils.js'

// T1: 무료 0 + 왕관 201 → 왕관 진입 가능, 차단 아님
{
  const s = getBossCardState({ free_attempts_per_day: 0, crowns: 201 })
  assert.equal(s.freeOut,   true,  'T1: freeOut')
  assert.equal(s.canCrown,  true,  'T1: canCrown')
  assert.equal(s.isBlocked, false, 'T1: isBlocked')
  console.log('T1 pass: 무료 0 + 왕관 201 → canCrown, 차단 아님')
}

// T2: 무료 0 + 왕관 0 → 완전 차단
{
  const s = getBossCardState({ free_attempts_per_day: 0, crowns: 0 })
  assert.equal(s.freeOut,   true,  'T2: freeOut')
  assert.equal(s.canCrown,  false, 'T2: canCrown')
  assert.equal(s.isBlocked, true,  'T2: isBlocked')
  console.log('T2 pass: 무료 0 + 왕관 0 → 차단')
}

// T3: 무료 2 + 왕관 0 → 정상(무료 남음)
{
  const s = getBossCardState({ free_attempts_per_day: 2, crowns: 0 })
  assert.equal(s.freeOut,   false, 'T3: freeOut')
  assert.equal(s.canCrown,  false, 'T3: canCrown')
  assert.equal(s.isBlocked, false, 'T3: isBlocked')
  console.log('T3 pass: 무료 2 → 정상')
}

// T4: crowns 필드 누락(undefined) → canCrown=false, isBlocked=true
{
  const s = getBossCardState({ free_attempts_per_day: 0 })
  assert.equal(s.canCrown,  false, 'T4: canCrown undefined')
  assert.equal(s.isBlocked, true,  'T4: isBlocked')
  console.log('T4 pass: crowns 필드 없음 → canCrown false')
}

// T5: 무료 2 + 왕관 5 → 정상(무료 우선, 차단 아님)
{
  const s = getBossCardState({ free_attempts_per_day: 2, crowns: 5 })
  assert.equal(s.freeOut,   false, 'T5: freeOut')
  assert.equal(s.isBlocked, false, 'T5: isBlocked')
  console.log('T5 pass: 무료 2 + 왕관 5 → 정상')
}

console.log('\n모든 테스트 통과 ✓')
