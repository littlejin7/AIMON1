// ─── 십자말풀이 배치 알고리즘 ─────────────────────────────────

const dr = { H: 0, V: 1 }
const dc = { H: 1, V: 0 }

export function buildCrossword(words) {
  const sorted = [...words].sort((a, b) => b.word.length - a.word.length)
  const placed = []
  const grid = {}

  const canPlace = (word, r, c, dir) => {
    const len = word.length
    const beforeKey = `${r - dr[dir]},${c - dc[dir]}`
    const afterKey  = `${r + dr[dir] * len},${c + dc[dir] * len}`
    if (grid[beforeKey] || grid[afterKey]) return false

    let intersects = 0
    for (let i = 0; i < len; i++) {
      const ri = r + dr[dir] * i
      const ci = c + dc[dir] * i
      const existing = grid[`${ri},${ci}`]
      if (existing) {
        if (existing !== word[i]) return false
        intersects++
      } else {
        if (dir === 'H') {
          if (grid[`${ri - 1},${ci}`] || grid[`${ri + 1},${ci}`]) return false
        } else {
          if (grid[`${ri},${ci - 1}`] || grid[`${ri},${ci + 1}`]) return false
        }
      }
    }
    return placed.length === 0 || intersects >= 1
  }

  const placeWord = (word, r, c, dir) => {
    for (let i = 0; i < word.length; i++) {
      grid[`${r + dr[dir] * i},${c + dc[dir] * i}`] = word[i]
    }
  }

  placeWord(sorted[0].word, 0, 0, 'H')
  placed.push({ ...sorted[0], r: 0, c: 0, dir: 'H' })

  for (let wi = 1; wi < sorted.length; wi++) {
    const w = sorted[wi]
    let best = null
    let bestScore = -Infinity

    for (const pw of placed) {
      const newDir = pw.dir === 'H' ? 'V' : 'H'
      for (let pi = 0; pi < pw.word.length; pi++) {
        const pr = pw.r + dr[pw.dir] * pi
        const pc = pw.c + dc[pw.dir] * pi
        for (let wi2 = 0; wi2 < w.word.length; wi2++) {
          if (pw.word[pi] !== w.word[wi2]) continue
          const nr = pr - dr[newDir] * wi2
          const nc = pc - dc[newDir] * wi2
          if (!canPlace(w.word, nr, nc, newDir)) continue

          let score = 0
          for (let i = 0; i < w.word.length; i++) {
            if (grid[`${nr + dr[newDir] * i},${nc + dc[newDir] * i}`]) score += 10
          }
          score -= (Math.abs(nr) + Math.abs(nc))
          if (score > bestScore) { bestScore = score; best = { ...w, r: nr, c: nc, dir: newDir } }
        }
      }
    }

    if (best) {
      placed.push(best)
      placeWord(best.word, best.r, best.c, best.dir)
    }
  }

  let minR = Infinity, minC = Infinity
  placed.forEach(p => {
    for (let i = 0; i < p.word.length; i++) {
      minR = Math.min(minR, p.r + dr[p.dir] * i)
      minC = Math.min(minC, p.c + dc[p.dir] * i)
    }
  })
  const normalized = placed.map(p => ({ ...p, r: p.r - minR, c: p.c - minC }))

  const starts = {}
  normalized.forEach(p => {
    const key = `${p.r},${p.c}`
    if (!starts[key]) starts[key] = []
    starts[key].push(p)
  })
  const sortedKeys = Object.keys(starts).sort((a, b) => {
    const [ar, ac] = a.split(',').map(Number)
    const [br, bc] = b.split(',').map(Number)
    return ar !== br ? ar - br : ac - bc
  })
  const numMap = {}
  sortedKeys.forEach((key, i) => { numMap[key] = i + 1 })

  const wordData = normalized.map(p => ({ ...p, num: numMap[`${p.r},${p.c}`] }))

  let maxR = 0, maxC = 0
  wordData.forEach(p => {
    for (let i = 0; i < p.word.length; i++) {
      maxR = Math.max(maxR, p.r + dr[p.dir] * i)
      maxC = Math.max(maxC, p.c + dc[p.dir] * i)
    }
  })

  return { wordData, rows: maxR + 1, cols: maxC + 1 }
}

// ─── 세트에서 셀맵 + 단어셀 레이아웃 계산 ───────────────────────
export function buildLayout(words) {
  const { wordData, rows, cols } = buildCrossword(words)

  const cellMap = {}
  const wordCells = {}

  wordData.forEach(({ id, word, r: sr, c: sc, dir, num }) => {
    wordCells[id] = []
    const dRow = dir === 'V' ? 1 : 0
    const dCol = dir === 'H' ? 1 : 0
    for (let i = 0; i < word.length; i++) {
      const r = sr + dRow * i
      const c = sc + dCol * i
      const key = `${r},${c}`
      if (!cellMap[key]) cellMap[key] = { letter: word[i], wordIds: [] }
      cellMap[key].wordIds.push(id)
      wordCells[id].push({ r, c })
    }
    const sk = `${sr},${sc}`
    if (cellMap[sk] && !cellMap[sk].num) cellMap[sk].num = num
  })

  return { wordData, rows, cols, cellMap, wordCells }
}

// ─── 랜덤 세트 선택 (이미 사용한 세트는 마지막에 재사용) ──────
export function pickRandomSet(usedIndices, totalSets) {
  const remaining = Array.from({ length: totalSets }, (_, i) => i).filter(i => !usedIndices.has(i))
  if (remaining.length === 0) {
    const idx = Math.floor(Math.random() * totalSets)
    return { idx, resetUsed: true }
  }
  const idx = remaining[Math.floor(Math.random() * remaining.length)]
  return { idx, resetUsed: false }
}
