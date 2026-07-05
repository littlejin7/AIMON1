import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { gameApi } from '../../../api'
import { incrementGamePlay } from '../Game'
import { WORD_SETS, SET_NAMES } from './crosswordData'
import { buildLayout } from './crosswordEngine'
import TitleBlock from './components/TitleBlock'
import WinModal from './components/WinModal'
import CrosswordGrid from './components/CrosswordGrid'
import HintBox from './components/HintBox'
import ClueList from './components/ClueList'
import './AICross.css'

export default function AICross() {
  const navigate = useNavigate()
  const wrapRef = useRef(null)
  const gameTokenRef = useRef(null)

  const [usedIndices, setUsedIndices] = useState(new Set())
  const [setIndex, setSetIndex] = useState(() => Math.floor(Math.random() * WORD_SETS.length))
  const [layout, setLayout] = useState(() => buildLayout(WORD_SETS[Math.floor(Math.random() * WORD_SETS.length)]))

  const { wordData, rows, cols, cellMap, wordCells } = layout

  const [inputs, setInputs] = useState({})
  const [selectedId, setSelectedId] = useState(wordData[0]?.id)
  const [cursor, setCursor] = useState({ r: wordData[0]?.r ?? 0, c: wordData[0]?.c ?? 0 })
  const [checked, setChecked] = useState({})
  const [won, setWon] = useState(false)
  const [reward, setReward] = useState(null)

  useEffect(() => {
    setUsedIndices(new Set([setIndex]))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 보상 지급용 게임 세션 토큰 발급 (마운트당 1회 = 한 판)
  useEffect(() => {
    gameApi.startGame('aicross')
      .then(res => { gameTokenRef.current = res.data.game_token })
      .catch(() => { gameTokenRef.current = null })
  }, [])

  const selWord = wordData.find(w => w.id === selectedId)
  const selSet = selectedId
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
    const letter = e.key.toUpperCase()
    const { r, c } = cursor
    const key = `${r},${c}`

    if (e.key.length === 1 && /^[A-Za-z]$/.test(e.key)) {
      e.preventDefault()
      setInputs(prev => ({ ...prev, [key]: letter }))
      setChecked(prev => { const n = { ...prev }; delete n[key]; return n })
      if (selWord) {
        const cells = wordCells[selWord.id]
        const idx = cells.findIndex(x => x.r === r && x.c === c)
        if (idx < cells.length - 1) setCursor(cells[idx + 1])
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      if (inputs[key]) {
        setInputs(prev => { const n = { ...prev }; delete n[key]; return n })
        setChecked(prev => { const n = { ...prev }; delete n[key]; return n })
      } else if (selWord) {
        const cells = wordCells[selWord.id]
        const idx = cells.findIndex(x => x.r === r && x.c === c)
        if (idx > 0) {
          const prev = cells[idx - 1]
          setCursor(prev)
          const pk = `${prev.r},${prev.c}`
          setInputs(p => { const n = { ...p }; delete n[pk]; return n })
          setChecked(p => { const n = { ...p }; delete n[pk]; return n })
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const idx = wordData.findIndex(w => w.id === selectedId)
      const next = wordData[(idx + (e.shiftKey ? wordData.length - 1 : 1)) % wordData.length]
      setSelectedId(next.id)
      setCursor({ r: next.r, c: next.c })
    }
  }, [cursor, selWord, selectedId, inputs, wordData, wordCells])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => { wrapRef.current?.focus() }, [])

  const callClearAPI = async (score) => {
    if (!gameTokenRef.current) {
      setReward({ xp_awarded: 0, already_claimed: false })
      return
    }
    try {
      const res = await gameApi.clearGame({
        game_id: 'aicross',
        score,
        game_token: gameTokenRef.current,
      })
      setReward(res.data)
    } catch {
      setReward({ xp_awarded: 0, already_claimed: false })
    }
  }

  const handleCheck = () => {
    const result = {}
    let allCorrect = true
    Object.entries(cellMap).forEach(([key, { letter }]) => {
      const u = inputs[key]
      if (u) {
        result[key] = u === letter ? 'correct' : 'wrong'
        if (u !== letter) allCorrect = false
      } else {
        allCorrect = false
      }
    })
    setChecked(result)
    if (allCorrect && Object.keys(result).length === Object.keys(cellMap).length) {
      setWon(true)
      incrementGamePlay('aicross')
      const total = Object.keys(cellMap).length
      const correct = Object.values(result).filter(v => v === 'correct').length
      callClearAPI(Math.round((correct / total) * 100))
    }
  }

  const acrossWords = wordData.filter(w => w.dir === 'H').sort((a, b) => a.num - b.num)
  const downWords   = wordData.filter(w => w.dir === 'V').sort((a, b) => a.num - b.num)

  const selCells = selWord ? wordCells[selWord.id] : []

  return (
    <div className="aicross-wrap" ref={wrapRef} tabIndex={-1}>
      <button className="aicross-back" onClick={() => navigate('/game')}>✕</button>

      <TitleBlock setLabel={SET_NAMES[setIndex]} />

      {won && <WinModal reward={reward} onClose={() => navigate('/game')} />}

      <CrosswordGrid
        rows={rows}
        cols={cols}
        cellMap={cellMap}
        selSet={selSet}
        cursor={cursor}
        checked={checked}
        inputs={inputs}
        onCellClick={handleCellClick}
      />

      <HintBox
        selWord={selWord}
        selCells={selCells}
        cursor={cursor}
        checked={checked}
        inputs={inputs}
        onLetterClick={setCursor}
        onCheck={handleCheck}
      />

      <ClueList
        acrossWords={acrossWords}
        downWords={downWords}
        selectedId={selectedId}
        onSelect={(id) => selectWord(id, true)}
      />
    </div>
  )
}
