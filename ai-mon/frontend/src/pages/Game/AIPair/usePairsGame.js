import { useState, useEffect, useCallback, useRef } from 'react'
import { PAIRS } from './data'
import { incrementGamePlay } from '../Game'
import { gameApi } from '../../../api'

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
  const [deck, setDeck] = useState([])
  const [flippedIds, setFlippedIds] = useState([])
  const [matchedIds, setMatchedIds] = useState(new Set())
  const [wrongIds, setWrongIds] = useState(new Set())
  const [score, setScore] = useState(0)
  const [timerSec, setTimerSec] = useState(0)
  const [running, setRunning] = useState(false)
  const [won, setWon] = useState(false)
  const [reward, setReward] = useState(null)
  const processingRef = useRef(false)
  const gameTokenRef = useRef(null)
  const [isPreview, setIsPreview] = useState(false)
  const [previewSeconds, setPreviewSeconds] = useState(5)

  /* 타이머 */
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setTimerSec((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  /* 미리보기 카운트다운 타이머 */
  useEffect(() => {
    if (!isPreview) return
    const id = setInterval(() => {
      setPreviewSeconds((s) => {
        if (s === 1) {
          return 'START'
        }
        if (s === 'START') {
          clearInterval(id)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isPreview])

  /* 시작 전 보드만 미리 깔기 (카운트다운·타이머·토큰 없이 카드 뒷면만 표시) */
  const seed = useCallback(() => {
    const picked = shuffle([...PAIRS]).slice(0, PAIRS_PER_GAME)
    setDeck(buildDeck(picked))
  }, [])

  /* 게임 초기화 (재시작마다 셔플) */
  const init = useCallback(() => {
    const picked = shuffle([...PAIRS]).slice(0, PAIRS_PER_GAME)
    setDeck(buildDeck(picked))
    setFlippedIds([])
    setMatchedIds(new Set())
    setWrongIds(new Set())
    setScore(0)
    setTimerSec(0)
    setWon(false)
    setReward(null)
    gameTokenRef.current = null
    // 보상 지급용 게임 세션 토큰 발급
    gameApi.startGame('aizzak')
      .then((res) => { gameTokenRef.current = res.data.game_token })
      .catch(() => { gameTokenRef.current = null })
    setIsPreview(true)
    setPreviewSeconds(5) // 5초로 설정: 바로 5부터 숫자로 카운트다운 시작
    setRunning(false)
    processingRef.current = true //미리보기 중엔 클릭 방지
    setTimeout(() => {
      setIsPreview(false)
      setRunning(true)
      processingRef.current = false
    }, 6000) // 총 6초 (5 4 3 2 1 + START 1초)
  }, [])

  /* 클리어 보상 API 호출 */
  const callClearAPI = useCallback(() => {
    if (!gameTokenRef.current) {
      setReward({ xp_awarded: 0, already_claimed: false })
      return
    }
    gameApi.clearGame({
      game_id: 'aizzak',
      correct_count: PAIRS_PER_GAME,
      game_token: gameTokenRef.current,
    })
      .then((res) => setReward(res.data))
      .catch(() => setReward({ xp_awarded: 0, already_claimed: false }))
  }, [])

  

  /* 카드 클릭 */
  const onCardClick = useCallback((idx) => {
    if (processingRef.current) return
    if (flippedIds.includes(idx)) return
    if (matchedIds.has(idx)) return

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
            callClearAPI()
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
 }, [deck, flippedIds, matchedIds, callClearAPI])

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
    reward,
    init,
    seed,
    onCardClick,
    matchedCount: matchedIds.size / 2,
    isPreview,
    previewSeconds,
  }
}
