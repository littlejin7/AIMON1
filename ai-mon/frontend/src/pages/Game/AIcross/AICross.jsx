import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../hooks/useAuthStore'
import { WORD_SETS, SET_NAMES } from './crosswordData'
import { buildLayout } from './crosswordEngine'
import './AICross.css'

export default function AICross() {
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const wrapRef = useRef(null)

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
    try {
      const res = await fetch('/api/game/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ game_id: 'aicross', score }),
      })
      if (res.ok) {
        const data = await res.json()
        setReward(data)
      }
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
      const total = Object.keys(cellMap).length
      const correct = Object.values(result).filter(v => v === 'correct').length
      callClearAPI(Math.round((correct / total) * 100))
    }
  }

  const handleReveal = () => {
    const all = {}
    const res = {}
    Object.entries(cellMap).forEach(([key, { letter }]) => {
      all[key] = letter
      res[key] = 'correct'
    })
    setInputs(all)
    setChecked(res)
    setWon(true)
    callClearAPI(0)
  }

  const handleReset = () => {
    setInputs({})
    setChecked({})
    setWon(false)
    setSelectedId(wordData[0]?.id)
    setCursor({ r: wordData[0]?.r ?? 0, c: wordData[0]?.c ?? 0 })
  }

  const acrossWords = wordData.filter(w => w.dir === 'H').sort((a, b) => a.num - b.num)
  const downWords   = wordData.filter(w => w.dir === 'V').sort((a, b) => a.num - b.num)

  return (
    <div className="aicross-wrap" ref={wrapRef} tabIndex={-1}>
      <div className="aicross-header">
        <button className="aicross-back" onClick={() => navigate('/game')}>✕</button>
        <div className="aicross-header-title-group">
          <span className="aicross-header-title">AI 크로스워드</span>
          <span className="aicross-set-label">{SET_NAMES[setIndex]}</span>
        </div>
        <div className="aicross-header-btns">
          <button className="acbtn acbtn--check" onClick={handleCheck}>확인</button>
          <button className="acbtn acbtn--reveal" onClick={handleReveal}>정답</button>
          <button className="acbtn acbtn--reset" onClick={handleReset}>초기화</button>
        </div>
      </div>

      {selWord && (
        <div className="aicross-active-clue">
          <span className="aicross-clue-tag">
            {selWord.num}{selWord.dir === 'H' ? '→' : '↓'}
          </span>
          <span className="aicross-clue-text">{selWord.clue}</span>
        </div>
      )}

      {won && (
        <div className="aicross-win-overlay">
          <div className="aicross-win-modal">
            <div className="aicross-win-emoji">🎉</div>
            <div className="aicross-win-title">완성!</div>
            <div className="aicross-win-sub">모든 단어를 맞혔어요!</div>
            {reward ? (
              reward.already_claimed
                ? <div className="aicross-win-xp aicross-win-xp--claimed">오늘 보상은 이미 받았어요 (최대 3판)</div>
                : <div className="aicross-win-xp">⚡ +{reward.xp_awarded} XP 획득!</div>
            ) : (
              <div className="aicross-win-xp aicross-win-xp--loading">보상 계산 중…</div>
            )}
            <button className="acbtn acbtn--next" onClick={() => navigate('/game')}>✕</button>
          </div>
        </div>
      )}

      <div className="aicross-body">
        <div className="aicross-grid-box">
          <div
            className="aicross-grid"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
          >
            {Array.from({ length: rows * cols }, (_, i) => {
              const r = Math.floor(i / cols)
              const c = i % cols
              const key = `${r},${c}`
              const cell = cellMap[key]

              if (!cell) return <div key={key} className="ac-cell ac-cell--void" />

              const isSel = selSet.has(key)
              const isCur = cursor.r === r && cursor.c === c
              const status = checked[key]

              return (
                <div
                  key={key}
                  className={[
                    'ac-cell',
                    isSel && !isCur ? 'is-selected' : '',
                    isCur ? 'is-cursor' : '',
                    status === 'correct' ? 'is-correct' : '',
                    status === 'wrong' ? 'is-wrong' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleCellClick(r, c)}
                >
                  {cell.num && <span className="ac-num">{cell.num}</span>}
                  <span className="ac-letter">{inputs[key] || ''}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="aicross-clues">
          <div className="aicross-clue-col">
            <div className="aicross-clue-heading">가로 →</div>
            {acrossWords.map(w => (
              <div
                key={w.id}
                className={`aicross-clue-item${selectedId === w.id ? ' is-active' : ''}`}
                onClick={() => selectWord(w.id, true)}
              >
                <b>{w.num}.</b> {w.clue}
              </div>
            ))}
          </div>
          <div className="aicross-clue-col">
            <div className="aicross-clue-heading">세로 ↓</div>
            {downWords.map(w => (
              <div
                key={w.id}
                className={`aicross-clue-item${selectedId === w.id ? ' is-active' : ''}`}
                onClick={() => selectWord(w.id, true)}
              >
                <b>{w.num}.</b> {w.clue}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
