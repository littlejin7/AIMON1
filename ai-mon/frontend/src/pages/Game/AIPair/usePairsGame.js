import { useState, useEffect, useCallback, useRef } from 'react'
import { PAIRS } from './data'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildDeck() {
  const cards = []
  PAIRS.forEach((p) => {
    cards.push({ pairId: p.id, ...p.concept })
    cards.push({ pairId: p.id, ...p.code })
  })
  return shuffle(cards)
}

export const TOTAL_PAIRS = PAIRS.length

export function usePairsGame() {
  const [deck, setDeck]               = useState([])
  const [flippedIds, setFlippedIds]   = useState([])   // index 배열
  const [matchedIds, setMatchedIds]   = useState(new Set())
  const [wrongIds, setWrongIds]       = useState(new Set())
  const [score, setScore]             = useState(0)
  const [timerSec, setTimerSec]       = useState(0)
  const [running, setRunning]         = useState(false)
  const [won, setWon]                 = useState(false)
  const processingRef                 = useRef(false)

  /* 타이머 */
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setTimerSec((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  /* 게임 초기화 */
  const init = useCallback(() => {
    setDeck(buildDeck())
    setFlippedIds([])
    setMatchedIds(new Set())
    setWrongIds(new Set())
    setScore(0)
    setTimerSec(0)
    setWon(false)
    setRunning(true)
    processingRef.current = false
  }, [])

  useEffect(() => { init() }, [init])

  /* 카드 클릭 */
  const onCardClick = useCallback((idx) => {
    if (processingRef.current)          return
    if (flippedIds.includes(idx))       return
    if (matchedIds.has(idx))            return

    const next = [...flippedIds, idx]
    setFlippedIds(next)

    if (next.length < 2) return

    processingRef.current = true
    const [a, b] = next

    if (deck[a].pairId === deck[b].pairId) {
      /* 정답 */
      setTimeout(() => {
        setMatchedIds((prev) => {
          const s = new Set(prev)
          s.add(a); s.add(b)
          const newCount = s.size / 2
          setScore((sc) => sc + 10)
          if (newCount === TOTAL_PAIRS) {
            setRunning(false)
            setWon(true)
          }
          return s
        })
        setFlippedIds([])
        processingRef.current = false
      }, 480)
    } else {
      /* 오답 */
      setWrongIds(new Set([a, b]))
      setTimeout(() => {
        setFlippedIds([])
        setWrongIds(new Set())
        processingRef.current = false
      }, 850)
    }
  }, [deck, flippedIds, matchedIds])

  const fmtTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return {
    deck,
    flippedIds,
    matchedIds,
    wrongIds,
    score,
    timerSec,
    fmtTime,
    won,
    init,
    onCardClick,
    matchedCount: matchedIds.size / 2,
  }
}
