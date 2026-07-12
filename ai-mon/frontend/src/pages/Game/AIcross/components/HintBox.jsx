import { useMemo } from 'react'

const FALLBACK_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// 글자 셔플칩(word bank)은 서버가 내려주는 selWord.letterBank(정답을 셔플한 배열, 정답
// 순서는 아님)를 그대로 쓴다. B-2 전환 전에는 프론트가 정답 문자열(word)을 직접 셔플했지만,
// 서버가 answer 를 내려주지 않으므로 셔플 자체도 서버 책임으로 옮겼다.
export default function HintBox({ selWord, selCells, cursor, checked, inputs, onLetterClick, onLetterInput, onCheck, disabled }) {
  const currentInputs = useMemo(() => {
    return selCells.map(cell => inputs[`${cell.r},${cell.c}`] || '').filter(Boolean)
  }, [selCells, inputs])

  const wordBankLetters = useMemo(() => {
    const sourceLetters = selWord?.letterBank?.length ? selWord.letterBank : FALLBACK_KEYS
    const tempInputs = [...currentInputs]
    return sourceLetters.map((char, index) => {
      const inputIdx = tempInputs.indexOf(char)
      const isUsed = !!selWord?.letterBank?.length && inputIdx !== -1
      if (isUsed) {
        tempInputs.splice(inputIdx, 1)
      }
      return { id: `${char}-${index}`, char, isUsed }
    })
  }, [selWord?.letterBank, currentInputs])

  if (!selWord) return null

  return (
    <div className="aicross-hint-box">
      <div className="aicross-hint-icon">💡</div>
      <div className="aicross-hint-main">
        <div className="aicross-hint-title">
          {selWord.num}번 {selWord.dir === 'H' ? '가로' : '세로'} 힌트
        </div>
        <div className="aicross-hint-desc">
          {selWord.easyClue || selWord.clue} ({selCells.length})
        </div>

        {/* Word Bank */}
        <div className="aicross-word-bank">
          {wordBankLetters.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`aicross-word-bank-letter ${item.isUsed ? 'is-used' : ''}`}
              onClick={() => onLetterInput?.(item.char)}
              disabled={item.isUsed}
              aria-label={`${item.char} 입력`}
            >
              {item.char}
            </button>
          ))}
        </div>

        <div className="aicross-hint-answer-row">
          <div className="aicross-hint-boxes">
            {selCells.map((cellPos) => {
              const k = `${cellPos.r},${cellPos.c}`
              const isCur = cursor.r === cellPos.r && cursor.c === cellPos.c
              const status = checked[k]
              return (
                <div
                  key={k}
                  className={[
                    'aicross-letter-box',
                    isCur ? 'is-cursor' : '',
                    status === 'correct' ? 'is-correct' : '',
                    status === 'wrong' ? 'is-wrong' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onLetterClick(cellPos)}
                >
                  {inputs[k] || ''}
                </div>
              )
            })}
          </div>
          <button className="aicross-submit-btn" onClick={onCheck} disabled={disabled}>정답 입력</button>
        </div>
      </div>
    </div>
  )
}
