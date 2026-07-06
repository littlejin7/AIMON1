import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { gameApi } from '../../../api'
import { incrementGamePlay } from '../Game'
import TitleBlock from './components/TitleBlock'
import WinModal from './components/WinModal'
import CrosswordGrid from './components/CrosswordGrid'
import HintBox from './components/HintBox'
import ClueList from './components/ClueList'
import './AICross.css'

// 서버 public puzzle(grid/entries) → 화면 렌더링용 레이아웃으로 변환한다.
// 정답(letter/word/answer)은 포함하지 않는다 — 채점은 전적으로 서버가 한다.
function buildServerLayout(puzzle) {
  const grid = Array.isArray(puzzle?.grid) ? puzzle.grid : []
  const rows = grid.length
  const cols = grid.reduce((m, row) => Math.max(m, Array.isArray(row) ? row.length : 0), 0)
  const entries = Array.isArray(puzzle?.entries) ? puzzle.entries : []

  // 시작 칸(row,col)을 행 우선으로 정렬해 1..N 번호를 매긴다(기존 엔진과 동일 규칙).
  const startKeys = [...new Set(entries.map(e => `${e.row},${e.col}`))].sort((a, b) => {
    const [ar, ac] = a.split(',').map(Number)
    const [br, bc] = b.split(',').map(Number)
    return ar !== br ? ar - br : ac - bc
  })
  const numMap = {}
  startKeys.forEach((k, i) => { numMap[k] = i + 1 })

  const wordData = []
  const cellMap = {}
  const wordCells = {}

  entries.forEach(e => {
    const dir = e.direction === 'down' ? 'V' : 'H'
    const num = numMap[`${e.row},${e.col}`]
    wordData.push({ id: e.id, dir, r: e.row, c: e.col, num, clue: e.clue, length: e.length })
    wordCells[e.id] = []
    const dRow = dir === 'V' ? 1 : 0
    const dCol = dir === 'H' ? 1 : 0
    for (let i = 0; i < e.length; i++) {
      const r = e.row + dRow * i
      const c = e.col + dCol * i
      const key = `${r},${c}`
      if (!cellMap[key]) cellMap[key] = { wordIds: [] }
      cellMap[key].wordIds.push(e.id)
      wordCells[e.id].push({ r, c })
    }
    const sk = `${e.row},${e.col}`
    if (cellMap[sk] && cellMap[sk].num == null) cellMap[sk].num = num
  })

  return { wordData, rows, cols, cellMap, wordCells }
}

export default function AICross() {
  const navigate = useNavigate()
  const wrapRef = useRef(null)

  // 서버 세션 상태
  const [gameToken, setGameToken] = useState(null)
  const [puzzleId, setPuzzleId] = useState(null)
  const [layout, setLayout] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 입력/커서 상태
  const [inputs, setInputs] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [cursor, setCursor] = useState({ r: 0, c: 0 })

  // 제출/결과 상태 (정답 판정은 서버 응답으로만 채운다)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [showResult, setShowResult] = useState(false)

  const { wordData = [], rows = 0, cols = 0, cellMap = {}, wordCells = {} } = layout || {}

  // 화면 진입/재도전 시 서버에서 새 puzzle + game_token 을 받아 초기화한다.
  const startNewGame = useCallback(() => {
    setLoading(true)
    setError('')
    setResult(null)
    setShowResult(false)
    setSubmitting(false)
    setInputs({})
    gameApi.startAicross()
      .then(res => {
        const data = res.data || {}
        const puzzle = data.puzzle || {}
        const built = buildServerLayout(puzzle)
        setGameToken(data.game_token || null)
        setPuzzleId(puzzle.puzzle_id || null)
        setLayout(built)
        const first = built.wordData[0]
        setSelectedId(first?.id ?? null)
        setCursor({ r: first?.r ?? 0, c: first?.c ?? 0 })
        setLoading(false)
      })
      .catch(() => {
        setGameToken(null)
        setLayout(null)
        setError('퍼즐을 불러오지 못했어요. 잠시 후 다시 시도해주세요.')
        setLoading(false)
      })
  }, [])

  useEffect(() => { startNewGame() }, [startNewGame])

  const selWord = wordData.find(w => w.id === selectedId)
  const selSet = selectedId && wordCells[selectedId]
    ? new Set(wordCells[selectedId].map(({ r, c }) => `${r},${c}`))
    : new Set()

  const selectWord = (id, jumpToStart = false) => {
    setSelectedId(id)
    if (jumpToStart) {
      const w = wordData.find(x => x.id === id)
      if (w) setCursor({ r: w.r, c: w.c })
    }
  }

  const handleCellClick = (r, c) => {
    const key = `${r},${c}`
    if (!cellMap[key]) return
    const wordsHere = cellMap[key].wordIds
      .map(id => wordData.find(w => w.id === id))
      .filter(Boolean)
    setCursor({ r, c })
    if (wordsHere.length === 1) {
      setSelectedId(wordsHere[0].id)
    } else if (wordsHere.some(w => w.id === selectedId)) {
      const other = wordsHere.find(w => w.id !== selectedId)
      if (other) setSelectedId(other.id)
    } else {
      const h = wordsHere.find(w => w.dir === 'H')
      setSelectedId(h ? h.id : wordsHere[0].id)
    }
  }

  const handleKeyDown = useCallback((e) => {
    if (showResult) return
    const letter = e.key.toUpperCase()
    const { r, c } = cursor
    const key = `${r},${c}`

    if (e.key.length === 1 && /^[A-Za-z]$/.test(e.key)) {
      e.preventDefault()
      setInputs(prev => ({ ...prev, [key]: letter }))
      if (selWord) {
        const cells = wordCells[selWord.id]
        const idx = cells.findIndex(x => x.r === r && x.c === c)
        if (idx < cells.length - 1) setCursor(cells[idx + 1])
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      if (inputs[key]) {
        setInputs(prev => { const n = { ...prev }; delete n[key]; return n })
      } else if (selWord) {
        const cells = wordCells[selWord.id]
        const idx = cells.findIndex(x => x.r === r && x.c === c)
        if (idx > 0) {
          const prev = cells[idx - 1]
          setCursor(prev)
          const pk = `${prev.r},${prev.c}`
          setInputs(p => { const n = { ...p }; delete n[pk]; return n })
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (!wordData.length) return
      const idx = wordData.findIndex(w => w.id === selectedId)
      const next = wordData[(idx + (e.shiftKey ? wordData.length - 1 : 1)) % wordData.length]
      setSelectedId(next.id)
      setCursor({ r: next.r, c: next.c })
    }
  }, [cursor, selWord, selectedId, inputs, wordData, wordCells, showResult])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => { wrapRef.current?.focus() }, [])

  // 제출: 로컬 판정 없이 cell 단위 answers 를 서버로 보내 채점받는다.
  const handleSubmit = async () => {
    if (submitting || showResult) return
    if (!gameToken) {
      setResult({ score: 0, xp_awarded: 0, already_claimed: false, submit_failed: true })
      setShowResult(true)
      return
    }
    setSubmitting(true)
    try {
      const res = await gameApi.clearAicross({
        gameToken,
        puzzleId,
        answers: inputs,
        score: 0,
      })
      incrementGamePlay('aicross')
      setResult(res.data)
      setShowResult(true)
    } catch {
      setResult({ score: 0, xp_awarded: 0, already_claimed: false, submit_failed: true })
      setShowResult(true)
    } finally {
      setSubmitting(false)
    }
  }

  const acrossWords = wordData.filter(w => w.dir === 'H').sort((a, b) => a.num - b.num)
  const downWords = wordData.filter(w => w.dir === 'V').sort((a, b) => a.num - b.num)

  const selCells = selWord ? wordCells[selWord.id] : []
  const won = showResult && result && result.score >= 100

  return (
    <div className="aicross-wrap" ref={wrapRef} tabIndex={-1}>
      <button className="aicross-back" onClick={() => navigate('/game')}>✕</button>

      <TitleBlock setLabel="코딩 명령어 퍼즐" />

      {loading && (
        <div className="aicross-status">퍼즐을 불러오는 중…</div>
      )}

      {!loading && error && (
        <div className="aicross-status aicross-status--error">
          {error}
          <button className="acbtn acbtn--next" onClick={startNewGame}>다시 시도</button>
        </div>
      )}

      {!loading && !error && layout && (
        <>
          {showResult && (
            <WinModal
              result={result}
              won={won}
              onClose={() => navigate('/game')}
              onRetry={startNewGame}
            />
          )}

          <CrosswordGrid
            rows={rows}
            cols={cols}
            cellMap={cellMap}
            selSet={selSet}
            cursor={cursor}
            checked={{}}
            inputs={inputs}
            onCellClick={handleCellClick}
          />

          <HintBox
            selWord={selWord}
            selCells={selCells}
            cursor={cursor}
            checked={{}}
            inputs={inputs}
            onLetterClick={setCursor}
            onCheck={handleSubmit}
          />

          <ClueList
            acrossWords={acrossWords}
            downWords={downWords}
            selectedId={selectedId}
            onSelect={(id) => selectWord(id, true)}
          />
        </>
      )}
    </div>
  )
}
