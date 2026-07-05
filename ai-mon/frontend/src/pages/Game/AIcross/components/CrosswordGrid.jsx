export default function CrosswordGrid({ rows, cols, cellMap, selSet, cursor, checked, inputs, onCellClick }) {
  return (
    <div className="aicross-grid-card">
      <span className="aicross-corner aicross-corner--tl">{'</>'}</span>
      <span className="aicross-corner aicross-corner--tr">{'</>'}</span>
      <div
        className="aicross-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          '--cell-size': `clamp(22px, calc((min(100vw, 480px) - 96px) / ${cols}), 40px)`,
        }}
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
          const isActiveNum = cell.num && isSel

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
              onClick={() => onCellClick(r, c)}
            >
              {cell.num && <span className={`ac-num${isActiveNum ? ' ac-num--active' : ''}`}>{cell.num}</span>}
              <span className="ac-letter">{inputs[key] || ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
