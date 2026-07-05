export default function TitleBlock({ setLabel }) {
  return (
    <div className="aicross-title-block">
      <div className="aicross-badge">🔧 SMART CODING BUDDY</div>
      <h1 className="aicross-maintitle">
        <span className="aicross-tag">{'</>'}</span>
        <span className="aicross-title-ai">AI</span>{' '}
        <span className="aicross-title-word">CROSSWORD</span>
        <span className="aicross-tag">{'</>'}</span>
      </h1>
      <div className="aicross-subtitle">⭐ 코딩 명령어를 완성해보세요! ⭐</div>
      <div className="aicross-set-label">{setLabel}</div>
    </div>
  )
}
