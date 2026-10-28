import { useState } from 'react'
import { Activity, ChartColumn, Gauge, Info, Scale, Wind } from 'lucide-react'
import { paths } from '../api/client'
import type { Decision, GateId, HourPoint, Meta } from '../api/types'
import { DayForecastChart } from '../charts/DayForecastChart'
import { DivergingBars } from '../charts/DivergingBars'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { DeliveryDayPicker } from '../components/DeliveryDayPicker'
import { DeltaPill } from '../components/DeltaPill'
import { GateSelector } from '../components/GateSelector'
import { KpiTile } from '../components/KpiTile'
import { Legend } from '../components/Legend'
import { PageHeader } from '../components/PageHeader'
import { Switch } from '../components/Switch'
import { ErrorState, LoadingState } from '../components/StatusViews'
import { ViewToggle, type ViewMode } from '../components/ViewToggle'
import { useApi } from '../hooks/useApi'
import { duration, fmt, gw, gwh, minutesBetween, percent, signedGw, signedGwValue } from '../lib/format'
import { chart } from '../lib/theme'

interface DecisionDeskProps {
  meta: Meta
  gate: GateId
  onGateChange: (gate: GateId) => void
  day: string
  onDayChange: (day: string) => void
}

export function DecisionDesk({ meta, gate, onGateChange, day, onDayChange }: DecisionDeskProps) {
  const { data, error, loading } = useApi<Decision>(paths.decision(day, gate))

  return (
    <>
      <PageHeader
        title="Decision desk"
        subtitle="What the wind forecast said when bids closed, and what the wind actually did."
        actions={<GateSelector gates={meta.gates} value={gate} onChange={onGateChange} />}
      />

      <div className="hero-row">
        <DeliveryDayPicker
          day={day}
          min={meta.first_delivery_day}
          max={meta.last_delivery_day}
          onChange={onDayChange}
        />
        {data && <DecisionHero decision={data} />}
      </div>

      {error && <ErrorState message={error} />}
      {!data && loading && <LoadingState />}
      {data && (
        <div className={loading ? 'is-refreshing' : undefined}>
          <DecisionBody decision={data} />
        </div>
      )}
    </>
  )
}

function DecisionHero({ decision }: { decision: Decision }) {
  const run = decision.runs_used[decision.runs_used.length - 1]
  const lead = minutesBetween(run, decision.cutoff)
  return (
    <div className="hero">
      <div className="hero__eyebrow">Wind forecast at the {decision.gate.label} gate</div>
      <div className="hero__figure">{gwh(decision.totals.forecast_mwh)}</div>
      <p className="hero__caption">
        <span className="ink">
          Run published {fmt.dayTime(run)}, {duration(lead)} before bids closed.
        </span>{' '}
        Averages {gw(decision.totals.forecast_mwh / Math.max(decision.totals.hours, 1))} across{' '}
        {fmt.longDay(decision.delivery_day)}.
      </p>
    </div>
  )
}

/** Day error as a trader reads it: "26.6 GWh short" (forecast too high) or "3.5 GWh long" */
function position(errorMwh: number | null): string {
  if (errorMwh == null) return '—'
  return `${gwh(Math.abs(errorMwh))} ${errorMwh > 0 ? 'short' : 'long'}`
}

function worstHour(points: HourPoint[]): HourPoint | undefined {
  return points
    .filter((p) => p.error_mw != null)
    .reduce<HourPoint | undefined>((worst, p) => (!worst || Math.abs(p.error_mw!) > Math.abs(worst.error_mw!) ? p : worst), undefined)
}

function DecisionBody({ decision }: { decision: Decision }) {
  const [mode, setMode] = useState<ViewMode>('chart')
  const [showAdjusted, setShowAdjusted] = useState(false)
  const { totals, stats, band, points, band_coverage: coverage } = decision
  const errorShare = totals.error_mwh != null && totals.actual_mwh ? totals.error_mwh / totals.actual_mwh : null
  const short = (totals.error_mwh ?? 0) > 0
  const worst = worstHour(points)
  const horizons = points.map((p) => p.horizon_h)

  return (
    <>
      <div className="kpi-grid">
        <KpiTile
          label="Actual outturn"
          icon={<Wind size={16} />}
          value={gwh(totals.actual_mwh)}
          sub={
            totals.hours_with_actual < totals.hours
              ? `${totals.hours_with_actual} of ${totals.hours} hours settled`
              : `Averaged ${gw((totals.actual_mwh ?? 0) / Math.max(totals.hours_with_actual, 1))}`
          }
        />
        <KpiTile
          label="Position vs forecast"
          icon={<Scale size={16} />}
          value={position(totals.error_mwh)}
          pill={
            <DeltaPill
              errorValue={totals.error_mwh}
              text={`${percent(errorShare == null ? null : Math.abs(errorShare))} ${short ? 'over' : 'under'}-forecast`}
            />
          }
          sub={`Buying against the raw forecast. Bias-adjusted: ${position(totals.adjusted_error_mwh)}`}
        />
        <KpiTile
          label="Typical hourly miss"
          icon={<Activity size={16} />}
          value={gw(stats.mae_mw)}
          sub={worst ? `Worst ${signedGw(worst.error_mw)} at ${fmt.time(worst.time)}` : 'No settled hours'}
        />
        <KpiTile
          label="Likely range at the gate"
          icon={<Gauge size={16} />}
          value={band ? `${signedGwValue(-band.error_high_mw)} to ${signedGwValue(-band.error_low_mw)}` : 'Too early'}
          sub={
            band
              ? `GW vs forecast (P${band.low_quantile * 100}–P${band.high_quantile * 100}). Held ${percent(coverage.inside, 0)} of hours in January; target 80%`
              : 'Needs 3 settled days before the gate'
          }
        />
      </div>

      <div className="grid">
        <Card
          className="span-8"
          title="Forecast vs outturn"
          subtitle="Hourly, GW, UK time"
          icon={<ChartColumn size={16} />}
          actions={
            <>
              <Legend
                items={[
                  { label: 'Forecast at gate', color: chart.forecast, kind: 'line' },
                  { label: 'Actual', color: chart.actual, kind: 'line' },
                  ...(band ? [{ label: 'Likely range', color: chart.forecast, kind: 'band' as const }] : []),
                ]}
              />
              <Switch label="Bias-adjusted" color={chart.adjusted} checked={showAdjusted} onChange={setShowAdjusted} />
              <ViewToggle value={mode} onChange={setMode} />
            </>
          }
        >
          {mode === 'chart' ? (
            <DayForecastChart points={points} showAdjusted={showAdjusted} />
          ) : (
            <DataTable
              rows={points}
              rowKey={(p) => p.time}
              columns={[
                { header: 'Hour', render: (p) => fmt.time(p.time) },
                { header: 'Forecast', align: 'right', render: (p) => gw(p.forecast_mw) },
                { header: 'Adjusted', align: 'right', render: (p) => gw(p.adjusted_mw) },
                { header: 'Actual', align: 'right', render: (p) => gw(p.actual_mw) },
                { header: 'Error', align: 'right', render: (p) => signedGw(p.error_mw) },
                { header: 'Range low', align: 'right', render: (p) => gw(p.band_low_mw) },
                { header: 'Range high', align: 'right', render: (p) => gw(p.band_high_mw) },
              ]}
            />
          )}
        </Card>

        <Card className="span-4" title="At the gate" subtitle="Exactly what was known, and when" icon={<Info size={16} />}>
          <dl className="facts">
            <div>
              <dt>Bids closed</dt>
              <dd>{fmt.dayTime(decision.cutoff)}</dd>
            </div>
            <div>
              <dt>Forecast run used</dt>
              <dd>{decision.runs_used.map(fmt.dayTime).join(', ')}</dd>
            </div>
            <div>
              <dt>Lead time</dt>
              <dd>
                {Math.min(...horizons).toFixed(1)}–{Math.max(...horizons).toFixed(1)} h ahead
              </dd>
            </div>
            <div>
              <dt>Recent bias</dt>
              <dd>{band ? `${signedGw(band.mean_error_mw)} ${band.mean_error_mw > 0 ? 'over' : 'under'}` : '—'}</dd>
            </div>
            <div>
              <dt>Bias-adjusted total</dt>
              <dd>{band ? gwh(totals.adjusted_mwh) : 'Same as forecast'}</dd>
            </div>
            <div>
              <dt>Range and bias from</dt>
              <dd>
                {band
                  ? `${fmt.shortDay(band.history_from)} – ${fmt.shortDay(band.history_to)} (${band.history_days} days)`
                  : '—'}
              </dd>
            </div>
          </dl>
          <p className="note">
            The range and bias only use days fully settled before bids closed. When bidding on D−1, day D−1 is
            still running, so the newest usable day is D−2. The bias-adjusted forecast is ours, not Elexon’s.
          </p>
        </Card>

        <Card
          className="span-12"
          title="Hourly miss"
          subtitle="Forecast − actual. Above zero, less wind came than forecast and the buyer was short."
          icon={<Scale size={16} />}
          actions={
            <Legend
              items={[
                { label: 'Over-forecast (short)', color: chart.over, kind: 'bar' },
                { label: 'Under-forecast (long)', color: chart.under, kind: 'bar' },
              ]}
            />
          }
        >
          <DivergingBars
            tickEvery={3}
            data={points.map((p) => ({
              label: fmt.time(p.time),
              value: p.error_mw,
              tooltipTitle: fmt.dayTime(p.time),
              extraRows: [
                { label: 'Forecast', value: gw(p.forecast_mw), color: chart.forecast },
                { label: 'Actual', value: gw(p.actual_mw), color: chart.actual },
              ],
            }))}
          />
        </Card>
      </div>
    </>
  )
}
