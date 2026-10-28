export interface TooltipRow {
  label: string
  value: string
  color?: string
}

/** Dark hover card used by every chart. Values lead, labels follow */
export function TooltipCard({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="tooltip">
      <div className="tooltip__title">{title}</div>
      {rows.map((row) => (
        <div key={row.label} className="tooltip__row">
          <span className="tooltip__key" style={{ background: row.color ?? 'transparent' }} />
          <span className="tooltip__value">{row.value}</span>
          <span className="tooltip__label">{row.label}</span>
        </div>
      ))}
    </div>
  )
}
