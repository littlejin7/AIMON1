import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { incrementGamePlay } from '../Game'
import { aicrossApi } from '../../../api'
import { useAuthStore } from '../../../hooks/useAuthStore'
import useGameBgm from '../../../hooks/useGameBgm'
import GameScaleFrame from '../GameScaleFrame'
import { CHAR_ICONS } from '../../Character/characterData'
import TitleBlock from './components/TitleBlock'
import WinModal from './components/WinModal'
import CrosswordGrid from './components/CrosswordGrid'
import HintBox from './components/HintBox'
import ClueList from './components/ClueList'
import aikanBgm from '../../../assets/bgm/aikan_bgm.mp3'
import aiwordThumb from './AIwordicon.png'
import './AICross.css'

// 서버 start 응답 puzzle(grid_size + 좌표 포함 entries)을 프론트 렌더링 구조로 변환한다.
// 프론트는 layout 을 새로 계산하지 않고(=buildLayout 미사용) 서버 좌표만 그대로 배치한다.
// entries 에는 정답(answer)이 없으므로 셀 letter 는 만들지 않는다(정답 비노출 유지).
// letterBank(서버가 answer 를 셔플해 내려주는 배열)는 힌트박스의 글자 셔플칩 렌더링용으로
// 그대로 보존한다 — 정답 순서 자체는 아니므로 노출해도 안전하다.
function buildServerLayout(puzzle) {
  const entries = puzzle?.entries || []
  const cellMap = {}   // "r,c" -> { wordIds: [], num? }
  const wordCells = {} // id -> [{ r, c }]
  const placed = []    // { id, dir, r, c, length, clue, easyClue, letterBank }

  entries.forEach((e) => {
    const dir = e.direction === 'down' ? 'V' : 'H'
    const dRow = dir === 'V' ? 1 : 0
    const dCol = dir === 'H' ? 1 : 0
    const cells = []
    for (let i = 0; i < e.length; i++) {
      const r = e.row + dRow * i
      const c = e.col + dCol * i
      const key = `${r},${c}`
      if (!cellMap[key]) cellMap[key] = { wordIds: [] }
      cellMap[key].wordIds.push(e.id)
      cells.push({ r, c })
    }
    wordCells[e.id] = cells
    placed.push({
      id: e.id,
      dir,
      r: e.row,
      c: e.col,
      length: e.length,
      clue: e.clue,
      easyClue: e.easyClue,
      letterBank: e.letterBank || [],
    })
  })

  // 번호 부여: 시작 셀을 (행,열) 순으로 정렬해 1..N. (crosswordEngine 과 동일 규칙)
  const startKeys = placed.map((p) => `${p.r},${p.c}`)
  const uniqueStarts = Array.from(new Set(startKeys)).sort((a, b) => {
    const [ar, ac] = a.split(',').map(Number)
    const [br, bc] = b.split(',').map(Number)
    return ar !== br ? ar - br : ac - bc
  })
  const numMap = {}
  uniqueStarts.forEach((key, i) => { numMap[key] = i + 1 })

  const wordData = placed.map((p) => ({
    ...p,
    num: numMap[`${p.r},${p.c}`],
  }))
  wordData.forEach((p) => {
    const sk = `${p.r},${p.c}`
    if (cellMap[sk] && !cellMap[sk].num) cellMap[sk].num = p.num
  })

  // 좌표는 서버 생성 시 이미 0-기준으로 정규화되어 있으므로 셀 최대 좌표로 rows/cols 산출.
  let maxR = 0, maxC = 0
  Object.keys(cellMap).forEach((key) => {
    const [r, c] = key.split(',').map(Number)
    if (r > maxR) maxR = r
    if (c > maxC) maxC = c
  })
  const rows = maxR + 1
  const cols = maxC + 1

  return { wordData, rows, cols, cellMap, wordCells }
}

export default function AICross() {
  const navigate = useNavigate()
  const wrapRef = useRef(null)
  const user = useAuthStore((s) => s.user)

  // 서버 진행도/세션 상태
  const [progress, setProgress] = useState(null)
  const [setIndex, setSetIndex] = useState(null)
  const [setLabel, setSetLabel] = useState('코딩 명령어 퍼즐')
  const [gameToken, setGameToken] = useState('')
  const [layout, setLayout] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 입력/커서 상태
  const [inputs, setInputs] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [cursor, setCursor] = useState({ r: 0, c: 0 })

  // 제출/결과 상태
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [showResult, setShowResult] = useState(false)

  // 시작 인트로 팝업 (다른 미니게임과 동일하게 게임 화면 위에 화이트 박스로 오버레이)
  const [started, setStarted] = useState(false)

  useGameBgm(aikanBgm, { enabled: started })

  const { wordData = [], rows = 0, cols = 0, cellMap = {}, wordCells = {} } = layout || {}

  // 셀별 정오 색칠은 서버가 per-cell 결과를 주지 않으므로 사용하지 않는다(빈 객체 고정).
  const checked = useMemo(() => ({}), [])

  // 특정 세트를 서버에서 start 하고 화면을 초기화한다.
  const startSet = useCallback(async (index) => {
    setError('')
    setResult(null)
    setShowResult(false)
    setSubmitting(false)
    setInputs({})

    const { data } = await aicrossApi.start(index)
    const built = buildServerLayout(data.puzzle)

    setSetIndex(data.set_index)
    setSetLabel(data.set_label || '코딩 명령어 퍼즐')
    setGameToken(data.game_token)
    setLayout(built)

    const first = built.wordData[0]
    setSelectedId(first?.id ?? null)
    setCursor({ r: first?.r ?? 0, c: first?.c ?? 0 })
    wrapRef.current?.focus()
  }, [])

  // 최초 진입: progress 조회 후 next_set_index 로 자동 start.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const { data: prog } = await aicrossApi.getProgress()
        if (cancelled) return
        setProgress(prog)
        await startSet(prog.next_set_index ?? 0)
      } catch (e) {
        if (!cancelled) setError('에이칸을 불러오지 못했어요. 잠시 후 다시 시도해주세요.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [startSet])

  const refreshProgress = useCallback(async () => {
    try {
      const { data: prog } = await aicrossApi.getProgress()
      setProgress(prog)
    } catch (e) {
      // 진행도 갱신 실패는 치명적이지 않으므로 화면 전체 에러로 막지 않는다.
    }
  }, [])

  const handleSetChange = async (e) => {
    const nextIndex = Number(e.target.value)
    try {
      setLoading(true)
      await startSet(nextIndex)
    } catch (err) {
      setError('세트를 시작하지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
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
  }, [cursor, selWord, selectedId, inputs, wordData, wordCells, showResult, layout])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => { wrapRef.current?.focus() }, [])

  const handleSubmit = async () => {
    if (submitting || showResult || setIndex === null) return
    setSubmitting(true)

    // 각 entry(단어) 별로 입력 셀을 이어붙여 answers[id] = 제출 문자열 로 구성.
    // 프론트 자체 채점은 하지 않고 서버 aicrossApi.clear() 가 answer 기준으로 채점한다.
    const answers = {}
    wordData.forEach(word => {
      const cells = wordCells[word.id] || []
      answers[word.id] = cells.map(({ r, c }) => inputs[`${r},${c}`] || '').join('').toUpperCase()
    })

    try {
      incrementGamePlay('aicross') // 홈 화면 플레이 카운트용(서버 보상/진행도와는 무관)
      const { data } = await aicrossApi.clear({ gameToken, setIndex, answers })
      setResult(data)
      setShowResult(true)
      await refreshProgress()
    } catch (err) {
      setResult({ submit_failed: true })
      setShowResult(true)
    } finally {
      setSubmitting(false)
    }
  }

  // "다음 세트로": 서버 clear 응답의 next_set_index 로 start.
  const handleNextSet = async () => {
    const nextIndex = result?.next_set_index ?? setIndex ?? 0
    try {
      setLoading(true)
      await startSet(nextIndex)
    } catch (err) {
      setError('다음 세트를 시작하지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  // 재도전: 같은 세트를 다시 start(새 game_token 발급, nonce 재사용 방지).
  const handleRetry = async () => {
    try {
      setLoading(true)
      await startSet(setIndex)
    } catch (err) {
      setError('다시 시작하지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const acrossWords = wordData.filter(w => w.dir === 'H').sort((a, b) => a.num - b.num)
  const downWords = wordData.filter(w => w.dir === 'V').sort((a, b) => a.num - b.num)

  const selCells = selWord ? wordCells[selWord.id] : []
  const won = showResult && result && result.score >= 100
  const characterSrc = CHAR_ICONS[user?.character] || CHAR_ICONS.slime

  const isAllFilled = useMemo(() => {
    if (!cellMap || Object.keys(cellMap).length === 0) return false
    return Object.keys(cellMap).every(key => !!inputs[key])
  }, [cellMap, inputs])

  // 진행도 파생값
  const completedSets = progress?.completed_sets || []
  const totalSets = progress?.total_sets || 0
  const completedCount = completedSets.length
  const todayRewardCount = progress?.today_reward_count ?? 0
  const todayRewardLimit = progress?.today_reward_limit ?? 3
  const nextSetIndex = progress?.next_set_index
  const allCompleted = totalSets > 0 && completedCount >= totalSets
  const currentIsCompleted = setIndex !== null && completedSets.includes(setIndex)

  return (
    <GameScaleFrame baseHeight={null} background="var(--clr-bg)" scaleMode="width" frameOverflow="visible">
      <div className="aicross-wrap" ref={wrapRef} tabIndex={-1}>
      <button className="aicross-back" onClick={() => navigate('/game')}>✕</button>
        
      <TitleBlock setLabel={setLabel} />

      {progress && (
        <div className="aicross-progress-bar">
          <span className="aicross-progress-badge">진행도 {completedCount} / {totalSets} 완료</span>
          <span className="aicross-reward-badge">오늘 보상 {todayRewardCount} / {todayRewardLimit}</span>
        </div>
      )}

      <div className="aicross-toolbar">
        <label className="aicross-set-select">
          <span>세트</span>
          <select value={setIndex ?? ''} onChange={handleSetChange} disabled={loading || !progress}>
            {(progress?.sets || []).map((s) => {
              const prefix = s.index === nextSetIndex ? '→ ' : ''
              const suffix = s.completed ? ' (완료)' : ''
              return (
                <option key={s.index} value={s.index}>
                  {prefix}{String(s.index + 1).padStart(2, '0')}. {s.title}{suffix}
                </option>
              )
            })}
          </select>
        </label>
      </div>

      {currentIsCompleted && !allCompleted && (
        <div className="aicross-status aicross-status--info">완료한 세트예요. 복습으로 다시 풀 수 있어요.</div>
      )}
      {allCompleted && (
        <div className="aicross-status aicross-status--info">모든 에이칸 세트를 완료했어요! 원하는 세트를 골라 복습할 수 있어요.</div>
      )}

      {error && (
        <div className="aicross-status aicross-status--error">{error}</div>
      )}

      {loading && !layout && (
        <div className="aicross-status">불러오는 중…</div>
      )}

      {!error && layout && (
        <>
          {showResult && (
            <WinModal
              result={result}
              won={won}
              characterSrc={characterSrc}
              onClose={won ? handleNextSet : () => navigate('/game')}
              onRetry={handleRetry}
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
            disabled={!isAllFilled || submitting}
          />

          <ClueList
            acrossWords={acrossWords}
            downWords={downWords}
            selectedId={selectedId}
            onSelect={(id) => selectWord(id, true)}
          />
        </>
      )}

      {/* 시작 인트로 — 게임 화면 위에 화이트 박스 팝업으로 오버레이 */}
      {!started && (
        <div className="aicross-intro-overlay">
          <div className="aicross-intro-panel">
            <img className="aicross-intro-thumb" src={aiwordThumb} alt="에이칸" />

            <h1 className="aicross-intro-title">AI Word</h1>
            <p className="aicross-intro-desc">단어 조각을 모아 십자말을 완성하라!</p>

            <div className="aicross-intro-rule">
              <div>⌨️&nbsp;가로·세로 <strong>힌트</strong>를 보고</div>
              <div>빈 칸에 알맞은 <strong>단어</strong>를 채우세요!</div>
            </div>

            <div className="aicross-intro-reward">⚡ 클리어 보상 · 코인 100~200</div>

            <button className="aicross-intro-start" onClick={() => setStarted(true)}>
              게임시작 ▶
            </button>
          </div>
        </div>
      )}
      </div>
    </GameScaleFrame>
  )
}
