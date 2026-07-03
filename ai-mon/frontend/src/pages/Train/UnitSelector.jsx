export default function UnitSelector({ value, onChange, maxUnit = 8 }) {
  const units = Array.from({ length: maxUnit }, (_, i) => i + 1)
  return (
    <div className="tr-unit-grid">
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
