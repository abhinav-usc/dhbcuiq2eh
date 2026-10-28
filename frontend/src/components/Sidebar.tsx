import { BookOpenText, CalendarClock, Crosshair, Wind } from 'lucide-react'
import type { Meta } from '../api/types'
import { fmt } from '../lib/format'
import { ThemeToggle } from './ThemeToggle'

export type View = 'decision' | 'accuracy' | 'method'

const NAV: { group: string; items: { view: View; label: string; icon: typeof Wind }[] }[] = [
  {
    group: 'Workspace',
    items: [
      { view: 'decision', label: 'Decision desk', icon: CalendarClock },
      { view: 'accuracy', label: 'Forecast accuracy', icon: Crosshair },
    ],
  },
  { group: 'Reference', items: [{ view: 'method', label: 'Methodology', icon: BookOpenText }] },
]

interface SidebarProps {
  view: View
  onNavigate: (view: View) => void
  meta: Meta | undefined
}

export function Sidebar({ view, onNavigate, meta }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <div className="brand">
          <span className="brand__mark" aria-hidden>
            <Wind size={20} strokeWidth={2.25} />
          </span>
          <div>
            <div className="brand__name">Anemo</div>
            <div className="brand__tagline">Day-ahead wind desk</div>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <nav className="nav" aria-label="Main">
        {NAV.map((section) => (
          <div key={section.group} className="nav__group">
            <div className="nav__label">{section.group}</div>
            {section.items.map(({ view: target, label, icon: Icon }) => (
              <button
                key={target}
                type="button"
                className="nav__item"
                aria-current={view === target ? 'page' : undefined}
                onClick={() => onNavigate(target)}
              >
                <Icon size={18} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {meta && (
        <div className="snapshot-card">
          <div className="snapshot-card__title">
            <span className="status-dot" aria-hidden />
            Data snapshot loaded
          </div>
          <dl className="snapshot-card__list">
            <div>
              <dt>Source</dt>
              <dd>Elexon BMRS</dd>
            </div>
            <div>
              <dt>Decisions</dt>
              <dd>{fmt.monthYear(meta.first_decision_day)}</dd>
            </div>
            <div>
              <dt>Forecast runs</dt>
              <dd>{meta.data.forecast_runs}</dd>
            </div>
            {meta.data.fetched_at && (
              <div>
                <dt>Fetched</dt>
                <dd>{fmt.shortDayOfTimestamp(meta.data.fetched_at)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </aside>
  )
}
