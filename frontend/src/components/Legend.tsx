import type { CSSProperties } from 'react'

export interface LegendItem {
  label: string
  color: string
  /** Mirrors the mark: a stroke for lines, a block for bars, a wash for bands. */
  kind: 'line' | 'bar' | 'band'
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="legend">
      {items.map((item) => (
        <li key={item.label} className="legend__item">
          <span className={`legend__key legend__key--${item.kind}`} style={{ '--key-color': item.color } as CSSProperties} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
