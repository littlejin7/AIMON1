export default function UnitSelector({ value, onChange, maxUnit = 8 }) {
  const units = Array.from({ length: maxUnit }, (_, i) => i + 1)
  return (
    <div className="tr-unit-grid">
      <button
        className={`tr-unit-btn tr-unit-btn-all ${value === null ? 'active' : ''}`}
        onClick={() => onChange(null)}
      >
        전체
      </button>
      {units.map(u => (
        <button
          key={u}
          className={`tr-unit-btn ${value === u ? 'active' : ''}`}
          onClick={() => onChange(u)}
        >
          Unit {u}
        </button>
      ))}
    </div>
  )
}
