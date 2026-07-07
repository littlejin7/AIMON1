import { useMemo } from 'react'

function shuffleLetters(word) {
  if (!word) return [];
  const chars = word.split('');
  if (chars.length <= 1) return chars;

  const allSame = chars.every(c => c === chars[0]);
  if (allSame) return chars;

  let attempts = 0;
  let bestShuffle = null;
  let bestScore = Infinity;

  while (attempts < 100) {
    const shuffled = [...chars].sort(() => Math.random() - 0.5);
    const shuffledStr = shuffled.join('');

    if (shuffledStr === word) {
      attempts++;
      continue;
    }

    let adjacentDupes = 0;
    for (let i = 0; i < shuffled.length - 1; i++) {
      if (shuffled[i] === shuffled[i + 1]) {
        adjacentDupes++;
      }
    }

    if (adjacentDupes === 0) {
      return shuffled;
    }

    if (bestShuffle === null || adjacentDupes < bestScore) {
      bestShuffle = shuffled;
      bestScore = adjacentDupes;
    }

    attempts++;
  }

  return bestShuffle || chars;
}

export default function HintBox({ selWord, selCells, cursor, checked, inputs, onLetterClick, onCheck, disabled }) {
  if (!selWord) return null

  const shuffledLettersBase = useMemo(() => {
    return shuffleLetters(selWord.word)
  }, [selWord.word])

  const currentInputs = useMemo(() => {
    return selCells.map(cell => inputs[`${cell.r},${cell.c}`] || '').filter(Boolean)
  }, [selCells, inputs])

  const wordBankLetters = useMemo(() => {
    const tempInputs = [...currentInputs]
    return shuffledLettersBase.map((char, index) => {
      const inputIdx = tempInputs.indexOf(char)
      const isUsed = inputIdx !== -1
      if (isUsed) {
        tempInputs.splice(inputIdx, 1)
      }
      return { id: `${char}-${index}`, char, isUsed }
    })
  }, [shuffledLettersBase, currentInputs])

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
            <span key={item.id} className={`aicross-word-bank-letter ${item.isUsed ? 'is-used' : ''}`}>
              {item.char}
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
          <button className="aicross-submit-btn" onClick={onCheck} disabled={disabled}>정답 입력</button>
        </div>
      </div>
    </div>
  )
}
