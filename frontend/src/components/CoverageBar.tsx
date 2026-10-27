import type { Coverage } from '../api/types'
import { percent } from '../lib/format'
import { chart } from '../lib/theme'

/**
 * Where the actual landed relative to the likely range, as one part-to-whole bar.
 * Below the range = less wind than the range allowed (short); above = long.
 */
export function CoverageBar({ coverage }: { coverage: Coverage }) {
  if (!coverage.hours || coverage.inside == null) return null
  const parts = [
    { key: 'below', label: 'Below range (short)', share: coverage.below ?? 0, color: chart.over },
    { key: 'inside', label: 'Inside range', share: coverage.inside, color: chart.neutral },
    { key: 'above', label: 'Above range (long)', share: coverage.above ?? 0, color: chart.under },
  ]
  return (
    <div className="coverage">
      <div className="coverage__bar" role="img" aria-label={parts.map((p) => `${p.label} ${percent(p.share, 0)}`).join(', ')}>
        {parts.map((p) => (
          <span key={p.key} className="coverage__segment" style={{ flexGrow: p.share, background: p.color }} />
        ))}
      </div>
      <ul className="coverage__legend">
        {parts.map((p) => (
          <li key={p.key}>
            <span className="legend__key legend__key--bar" style={{ background: p.color }} />
            <strong>{percent(p.share, 0)}</strong> {p.label.toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  )
}
