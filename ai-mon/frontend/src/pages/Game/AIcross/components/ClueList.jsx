function ClueColumn({ icon, heading, words, selectedId, onSelect }) {
  return (
    <div className="aicross-clue-col">
      <div className="aicross-clue-heading">
        <span className="aicross-heading-icon">{icon}</span> {heading}
      </div>
      {words.map(w => (
        <div
          key={w.id}
          className={`aicross-clue-item${selectedId === w.id ? ' is-active' : ''}`}
          onClick={() => onSelect(w.id)}
        >
          <b>{w.num}</b> {w.clue} ({w.length})
        </div>
      ))}
    </div>
  )
}

export default function ClueList({ acrossWords, downWords, selectedId, onSelect }) {
  return (
    <div className="aicross-clue-card">
      <ClueColumn icon={'</>'} heading="가로 힌트" words={acrossWords} selectedId={selectedId} onSelect={onSelect} />
      <div className="aicross-clue-divider" />
      <ClueColumn icon={'{ }'} heading="세로 힌트" words={downWords} selectedId={selectedId} onSelect={onSelect} />
    </div>
  )
}
