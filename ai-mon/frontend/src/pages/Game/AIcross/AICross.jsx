import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { incrementGamePlay } from '../Game'
import TitleBlock from './components/TitleBlock'
import WinModal from './components/WinModal'
import CrosswordGrid from './components/CrosswordGrid'
import HintBox from './components/HintBox'
import ClueList from './components/ClueList'
import { WORD_SETS, SET_NAMES } from './crosswordData'
import { buildLayout } from './crosswordEngine'
import './AICross.css'

export default function AICross() {
  const navigate = useNavigate()
  const wrapRef = useRef(null)

  const [layout, setLayout] = useState(null)
  const [error, setError] = useState('')
  const [selectedSetIndex, setSelectedSetIndex] = useState(() => {
    const saved = localStorage.getItem('aicross_last_set_index')
    return saved !== null ? Number(saved) : 0
  })
  const [starterCellKey, setStarterCellKey] = useState('')
  const [starterLetter, setStarterLetter] = useState('')

  // 입력/커서 상태
  const [inputs, setInputs] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [cursor, setCursor] = useState({ r: 0, c: 0 })
  const [checked, setChecked] = useState({})

  // 제출/결과 상태
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [showResult, setShowResult] = useState(false)

  const { wordData = [], rows = 0, cols = 0, cellMap = {}, wordCells = {} } = layout || {}

  const startNewGame = useCallback(() => {
    const words = WORD_SETS[selectedSetIndex] || WORD_SETS[0] || []
    if (!words.length) {
      setError('퍼즐 세트를 찾지 못했어요.')
      return
    }

    setError('')
    setResult(null)
    setShowResult(false)
    setSubmitting(false)
    setInputs({})
    setChecked({})

    const built = {
      ...buildLayout(words),
      setLabel: SET_NAMES[selectedSetIndex] || '코딩 명령어 퍼즐',
    }
    setLayout(built)
    const first = built.wordData[0]
    const starterKey = first ? `${first.r},${first.c}` : ''
    const firstLetter = first?.word?.[0] || ''
    if (starterKey && firstLetter) {
      setInputs({ [starterKey]: firstLetter })
    }
    setStarterCellKey(starterKey)
    setStarterLetter(firstLetter)
    setSelectedId(first?.id ?? null)
    setCursor({ r: first?.r ?? 0, c: first?.c ?? 0 })
    wrapRef.current?.focus()
  }, [selectedSetIndex])

  useEffect(() => { startNewGame() }, [startNewGame])

  const handleSetChange = (e) => {
    const nextIndex = Number(e.target.value)
    setSelectedSetIndex(nextIndex)
    localStorage.setItem('aicross_last_set_index', nextIndex.toString())
    setError('')
  }

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
    if (!layout || showResult) return
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)) return
    const letter = e.key.toUpperCase()
    const { r, c } = cursor
    const key = `${r},${c}`

    if (e.key.length === 1 && /^[A-Za-z]$/.test(e.key)) {
      e.preventDefault()
      if (key === starterCellKey && inputs[key]) {
        if (selWord) {
          const cells = wordCells[selWord.id]
          const idx = cells.findIndex(x => x.r === r && x.c === c)
          if (idx < cells.length - 1) setCursor(cells[idx + 1])
        }
        return
      }
      setInputs(prev => ({ ...prev, [key]: letter }))
      if (selWord) {
        const cells = wordCells[selWord.id]
        const idx = cells.findIndex(x => x.r === r && x.c === c)
        if (idx < cells.length - 1) setCursor(cells[idx + 1])
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      if (key === starterCellKey) return
      if (inputs[key]) {
        setInputs(prev => { const n = { ...prev }; delete n[key]; return n })
      } else if (selWord) {
        const cells = wordCells[selWord.id]
        const idx = cells.findIndex(x => x.r === r && x.c === c)
        if (idx > 0) {
          const prev = cells[idx - 1]
          setCursor(prev)
          const pk = `${prev.r},${prev.c}`
          if (pk === starterCellKey) return
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
  }, [cursor, selWord, selectedId, inputs, wordData, wordCells, showResult, layout, starterCellKey])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => { wrapRef.current?.focus() }, [])

  const handleSubmit = async () => {
    if (submitting || showResult) return
    setSubmitting(true)
    const nextChecked = {}
    let correct = 0

    wordData.forEach(word => {
      const cells = wordCells[word.id] || []
      const answer = cells.map(({ r, c }) => inputs[`${r},${c}`] || '').join('').toUpperCase()
      const isCorrect = answer === word.word
      if (isCorrect) correct += 1
      cells.forEach(({ r, c }) => {
        nextChecked[`${r},${c}`] = isCorrect ? 'correct' : 'wrong'
      })
    })

    const total = wordData.length
    const score = total ? Math.round((correct / total) * 100) : 0
    setChecked(nextChecked)
    incrementGamePlay('aicross')
    setResult({ score, correct, total, xp_awarded: 0, already_claimed: false })
    setShowResult(true)
    setSubmitting(false)
  }

  const handleNextSet = () => {
    const nextIndex = (selectedSetIndex + 1) % WORD_SETS.length
    setSelectedSetIndex(nextIndex)
    localStorage.setItem('aicross_last_set_index', nextIndex.toString())
    setError('')
  }

  const acrossWords = wordData.filter(w => w.dir === 'H').sort((a, b) => a.num - b.num)
  const downWords = wordData.filter(w => w.dir === 'V').sort((a, b) => a.num - b.num)

  const selCells = selWord ? wordCells[selWord.id] : []
  const won = showResult && result && result.score >= 100

  const isAllFilled = useMemo(() => {
    if (!cellMap || Object.keys(cellMap).length === 0) return false
    return Object.keys(cellMap).every(key => !!inputs[key])
  }, [cellMap, inputs])

  return (
    <div className="aicross-wrap" ref={wrapRef} tabIndex={-1}>
      <button className="aicross-back" onClick={() => navigate('/game')}>✕</button>

      <TitleBlock setLabel={layout?.setLabel || "코딩 명령어 퍼즐"} />

      <div className="aicross-toolbar">
        <label className="aicross-set-select">
          <span>세트</span>
          <select value={selectedSetIndex} onChange={handleSetChange}>
            {WORD_SETS.map((_, index) => (
              <option key={index} value={index}>
                {SET_NAMES[index] || '코딩 명령어 퍼즐'}
              </option>
            ))}
          </select>
        </label>
        <div className="aicross-starter-badge">
          <span>시작 알파벳</span>
          <b>{starterLetter || '?'}</b>
        </div>
      </div>

      {error && (
        <div className="aicross-status aicross-status--error">{error}</div>
      )}

      {!error && layout && (
        <>
          {showResult && (
            <WinModal
              result={result}
              won={won}
              onClose={won ? handleNextSet : () => navigate('/game')}
              onRetry={startNewGame}
            />
          )}

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
            onCheck={handleSubmit}
            disabled={!isAllFilled}
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
