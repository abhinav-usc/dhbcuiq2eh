import { useEffect, useState } from 'react'
import { paths } from './api/client'
import type { GateId, Meta } from './api/types'
import { Sidebar, type View } from './components/Sidebar'
import { ErrorState, LoadingState } from './components/StatusViews'
import { useApi } from './hooks/useApi'
import { AccuracyView } from './views/AccuracyView'
import { DecisionDesk } from './views/DecisionDesk'
import { MethodologyView } from './views/MethodologyView'

const VIEWS: View[] = ['decision', 'accuracy', 'method']

// View, gate and day live in the URL so any screen can be shared as a link.
function readUrl() {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view') as View | null
  return {
    view: view && VIEWS.includes(view) ? view : 'decision',
    gate: params.get('gate'),
    day: params.get('day'),
  }
}

export default function App() {
  const [initial] = useState(readUrl)
  const { data: meta, error } = useApi<Meta>(paths.meta())
  const [view, setView] = useState<View>(initial.view)
  const [gateChoice, setGate] = useState<string | null>(initial.gate)
  const [dayChoice, setDay] = useState<string | null>(initial.day)

  // Fall back to defaults until the user picks, or if the URL holds junk.
  const gate = meta && (meta.gates.some((g) => g.id === gateChoice) ? (gateChoice as GateId) : meta.default_gate)
  const day =
    meta &&
    (dayChoice && dayChoice >= meta.first_delivery_day && dayChoice <= meta.last_delivery_day
      ? dayChoice
      : meta.last_delivery_day)

  useEffect(() => {
    if (!gate || !day) return
    const params = new URLSearchParams({ view, gate })
    if (view === 'decision') params.set('day', day)
    window.history.replaceState(null, '', `?${params}`)
  }, [view, gate, day])

  return (
    <div className="app">
      <Sidebar view={view} onNavigate={setView} meta={meta} />
      <main className="main">
        {error && !meta && <ErrorState message={error} />}
        {!meta && !error && <LoadingState label="Loading data snapshot" />}
        {meta && gate && day && view === 'decision' && (
          <DecisionDesk meta={meta} gate={gate} onGateChange={setGate} day={day} onDayChange={setDay} />
        )}
        {meta && gate && view === 'accuracy' && <AccuracyView meta={meta} gate={gate} onGateChange={setGate} />}
        {meta && view === 'method' && <MethodologyView meta={meta} />}
      </main>
    </div>
  )
}
