import { useState, useEffect, useCallback, useRef } from 'react'
import { PAIRS, GAMES } from './data'
import { incrementGamePlay } from '../Game'

const PAIRS_PER_GAME = 6   // 6쌍 = 12장 = 3x4

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildDeck(pairSubset) {
  const cards = []
  pairSubset.forEach((p) => {
    cards.push({ pairId: p.id, ...p.concept })
    cards.push({ pairId: p.id, ...p.analogy })
  })
  return shuffle(cards)
}

export const TOTAL_PAIRS = PAIRS_PER_GAME

export function usePairsGame() {
  const [activeGameId, setActiveGameId] = useState(1)
  const [deck, setDeck]             = useState([])
  const [flippedIds, setFlippedIds] = useState([])
  const [matchedIds, setMatchedIds] = useState(new Set())
  const [wrongIds, setWrongIds]     = useState(new Set())
  const [score, setScore]           = useState(0)
  const [timerSec, setTimerSec]     = useState(0)
  const [running, setRunning]       = useState(false)
  const [won, setWon]               = useState(false)
  const [isShuffling, setIsShuffling] = useState(false)
  const processingRef               = useRef(false)

  /* 타이머 */
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setTimerSec((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  /* 게임 초기화 (재시작마다 셔플) */
  const init = useCallback(() => {
    setIsShuffling(true)
    const game = GAMES.find((g) => g.gameId === activeGameId) || GAMES[0]
    const picked = shuffle([...game.pairs])
    setDeck(buildDeck(picked))
    setFlippedIds([])
    setMatchedIds(new Set())
    setWrongIds(new Set())
    setScore(0)
    setTimerSec(0)
    setWon(false)
    setRunning(true)
    processingRef.current = false
    
    setTimeout(() => {
      setIsShuffling(false)
    }, 900)
  }, [activeGameId])

  useEffect(() => { init() }, [init, activeGameId])

  /* 카드 클릭 */
  const onCardClick = useCallback((idx) => {
    if (processingRef.current)    return
    if (flippedIds.includes(idx)) return
    if (matchedIds.has(idx))      return

    const next = [...flippedIds, idx]
    setFlippedIds(next)
    if (next.length < 2) return

    processingRef.current = true
    const [a, b] = next

    if (deck[a].pairId === deck[b].pairId) {
      /* 정답 */
      setTimeout(() => {
        setFlippedIds([])
        setScore((sc) => sc + 10)
        setMatchedIds((prev) => {
          const s = new Set(prev)
          s.add(a); s.add(b)
          if (s.size / 2 === PAIRS_PER_GAME) {
            setRunning(false)
            setWon(true)
            incrementGamePlay('pairs')
          }
          processingRef.current = false
          return s
        })
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
    activeGameId,
    setActiveGameId,
    isShuffling,
  }
}
