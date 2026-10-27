import { ChartSpline, Table2 } from 'lucide-react'
import { SegmentedControl } from './SegmentedControl'

export type ViewMode = 'chart' | 'table'

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <SegmentedControl
      size="sm"
      ariaLabel="Show as chart or table"
      value={value}
      onChange={onChange}
      options={[
        { value: 'chart', label: <ChartSpline size={15} aria-label="Chart" />, title: 'Chart' },
        { value: 'table', label: <Table2 size={15} aria-label="Table" />, title: 'Table' },
      ]}
    />
  )
}
