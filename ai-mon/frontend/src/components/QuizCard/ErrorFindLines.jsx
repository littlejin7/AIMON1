/**
 * ErrorFindLines
 * error_find 타입 문제를 줄별 클릭 UI로 렌더링합니다.
 *
 * 데이터 형식 기대값:
 *   codeLines  : ["1줄: def foo():", "2줄:     pass", ...]  (QuizCard parseQuestionCode 결과)
 *   choicesList: ["A. 1줄", "B. 3줄", "C. 8줄", "D. 오류 없음"]
 *   answer     : "B"
 */
export default function ErrorFindLines({
  codeLines,
  choicesList,
  selected,
  revealed,
  answer,
  onSelect,
  onSubmit,
}) {
  // ── choice 파싱 ──
  // lineNum(string) → choice 전체 문자열  (e.g. "3" → "C. 3줄")
  const lineToChoice = {}
  let noErrorChoice = null

  choicesList.forEach((c) => {
    const m = c.match(/^[A-E]\.\s*(\d+)줄$/)
    if (m) {
      lineToChoice[m[1]] = c
    } else if (/오류\s*없음/.test(c)) {
      noErrorChoice = c
    }
  })

  // ── 코드 줄 파싱 ──
  // "1줄: def foo():" → { num: "1", code: "def foo():" }
  // "4줄: " (빈 줄) 도 포함
  const parsedLines = codeLines
    .map((l) => {
      const m = l.match(/^(\d+)줄:\s?(.*)$/)
      return m ? { num: m[1], code: m[2] } : null
    })
    .filter(Boolean)

  // ── 정답 판별 ──
  const isLetterAnswer = answer?.length === 1 && /^[A-Z]$/.test(answer)

  const isCorrectChoice = (choice) => {
    if (!revealed || !choice) return false
    return isLetterAnswer ? choice.startsWith(answer + '.') : choice === answer
  }

  const isWrongChoice = (choice) => {
    if (!revealed || !choice) return false
    return choice === selected && !isCorrectChoice(choice)
  }

  const getLineState = (num) => {
    const choice = lineToChoice[num]
    if (!choice) return 'none'          // 선택지에 없는 줄 (클릭 불가)
    if (isCorrectChoice(choice)) return 'correct'
    if (isWrongChoice(choice)) return 'wrong'
    if (selected === choice) return 'sel'
    return 'idle'
  }

  const getNoErrorState = () => {
    if (!noErrorChoice) return null
    if (isCorrectChoice(noErrorChoice)) return 'correct'
    if (isWrongChoice(noErrorChoice)) return 'wrong'
    if (selected === noErrorChoice) return 'sel'
    return 'idle'
  }

  return (
    <div className="ef-wrap">
      {parsedLines.map(({ num, code }) => {
        const state = getLineState(num)
        const isSelectable = state !== 'none'
        return (
          <div
            key={num}
            className={[
              'ef-line',
              isSelectable ? '' : 'ef-line--dim',
              state === 'sel'     ? 'sel'     : '',
              state === 'correct' ? 'correct' : '',
              state === 'wrong'   ? 'wrong'   : '',
            ].join(' ')}
            onClick={() => {
              if (!revealed && isSelectable) onSelect(lineToChoice[num])
            }}
          >
            <span className="ef-ln">{num}</span>
            <span className="ef-lc">{code || ' '}</span>
          </div>
        )
      })}

      {noErrorChoice && (() => {
        const s = getNoErrorState()
        return (
          <button
            className={[
              'ef-no-error',
              s === 'sel'     ? 'sel'     : '',
              s === 'correct' ? 'correct' : '',
              s === 'wrong'   ? 'wrong'   : '',
            ].join(' ')}
            disabled={revealed}
            onClick={() => !revealed && onSelect(noErrorChoice)}
          >
            오류 없음
          </button>
        )
      })()}

      {!revealed && (
        <button
          className="quiz-submit-btn"
          disabled={!selected}
          onClick={onSubmit}
        >
          확인하기
        </button>
      )}
    </div>
  )
}
