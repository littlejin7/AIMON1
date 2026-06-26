// calcLevelResult 검증 스크립트 (Node.js 직접 실행)
// 실행: node src/components/LevelTestModal/calcLevelResult.test.mjs

import { calcLevelResult } from './calcLevelResult.js'

// ── 케이스 정의 ───────────────────────────────────────────────────────────────
const cases = [
  { input: { beginner: 0, intermediate: 0, advanced: 2 }, expected: 'beginner',      desc: '예전 버그 케이스 — 고급만 맞혀도 beginner' },
  { input: { beginner: 4, intermediate: 3, advanced: 3 }, expected: 'advanced',      desc: '전문제 정답 → advanced' },
  { input: { beginner: 3, intermediate: 2, advanced: 1 }, expected: 'intermediate',  desc: '초급·중급 OK, 고급 게이트 미통과 → intermediate' },
  { input: { beginner: 2, intermediate: 3, advanced: 3 }, expected: 'beginner',      desc: '초급 게이트 미통과 → beginner' },
  { input: { beginner: 4, intermediate: 1, advanced: 3 }, expected: 'beginner',      desc: '중급 게이트 미통과 → beginner' },
]

// ── 실행 ──────────────────────────────────────────────────────────────────────
let passed = 0
let failed = 0

for (const [i, { input, expected, desc }] of cases.entries()) {
  const actual = calcLevelResult(input)
  const ok = actual === expected
  const mark = ok ? '✅ PASS' : '❌ FAIL'
  const detail = ok ? '' : `  → got '${actual}', expected '${expected}'`
  console.log(`${mark}  [${i + 1}] ${desc}${detail}`)
  if (ok) passed++; else failed++
}

console.log(`\n${passed}/${cases.length} passed${failed > 0 ? `, ${failed} FAILED` : ''}`)
if (failed > 0) process.exit(1)
