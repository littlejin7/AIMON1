import { useMemo } from 'react'

export default function HintBox({ selWord, selCells, cursor, checked, inputs, onLetterClick, onCheck }) {
  if (!selWord) return null

  const shuffledLetters = useMemo(() => {
    if (!selWord.word) return []
    return selWord.word.split('').sort(() => Math.random() - 0.5)
  }, [selWord.word])

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
          {shuffledLetters.map((letter, idx) => (
            <span key={idx} className="aicross-word-bank-letter">
              {letter}
            </span>
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
          <button className="aicross-submit-btn" onClick={onCheck}>정답 입력</button>
        </div>
      </div>
    </div>
  )
}
