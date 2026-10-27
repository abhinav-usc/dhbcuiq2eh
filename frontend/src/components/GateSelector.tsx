import type { Gate, GateId } from '../api/types'
import { SegmentedControl } from './SegmentedControl'

interface GateSelectorProps {
  gates: Gate[]
  value: GateId
  onChange: (gate: GateId) => void
}

export function GateSelector({ gates, value, onChange }: GateSelectorProps) {
  return (
    <div className="filter">
      <span className="filter__label">Auction gate</span>
      <SegmentedControl
        ariaLabel="Day-ahead auction gate"
        value={value}
        onChange={onChange}
        options={gates.map((gate) => ({
          value: gate.id,
          label: gate.label,
          hint: gate.closes_at_local,
          title: `${gate.market}: bids close ${gate.closes_at_local} UK time the day before delivery`,
        }))}
      />
    </div>
  )
}
