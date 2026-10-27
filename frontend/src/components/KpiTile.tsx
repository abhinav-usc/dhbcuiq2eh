import type { ReactNode } from 'react'

interface KpiTileProps {
  label: string
  value: string
  icon?: ReactNode
  pill?: ReactNode
  sub?: ReactNode
}

export function KpiTile({ label, value, icon, pill, sub }: KpiTileProps) {
  return (
    <div className="card kpi">
      <div className="kpi__label">
        {icon && <span className="icon-chip icon-chip--sm">{icon}</span>}
        {label}
      </div>
      <div className="kpi__value-row">
        <span className="kpi__value">{value}</span>
        {pill}
      </div>
      {sub && <div className="kpi__sub">{sub}</div>}
    </div>
  )
}
