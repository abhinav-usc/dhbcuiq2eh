import { useState } from 'react'
import { Activity, ChartColumn, ChartLine, Clock3, Gauge, Hourglass, Scale, Sigma, Target, TriangleAlert } from 'lucide-react'
import { paths } from '../api/client'
import type { Accuracy, ErrorStats, Gate, GateId, Meta } from '../api/types'
import { DivergingBars } from '../charts/DivergingBars'
import { ErrorHistogram } from '../charts/ErrorHistogram'
import { HorizonChart } from '../charts/HorizonChart'
import { HourOfDayChart } from '../charts/HourOfDayChart'
import { MonthSeriesChart } from '../charts/MonthSeriesChart'
import { Card } from '../components/Card'
import { CoverageBar } from '../components/CoverageBar'
import { DataTable } from '../components/DataTable'
import { GateSelector } from '../components/GateSelector'
import { KpiTile } from '../components/KpiTile'
import { Legend } from '../components/Legend'
import { PageHeader } from '../components/PageHeader'
import { Switch } from '../components/Switch'
import { ErrorState, LoadingState } from '../components/StatusViews'
import { ViewToggle, type ViewMode } from '../components/ViewToggle'
import { useApi } from '../hooks/useApi'
import { fmt, gw, gwh, percent, signedGw } from '../lib/format'
import { chart } from '../lib/theme'

interface AccuracyViewProps {
  meta: Meta
  gate: GateId
  onGateChange: (gate: GateId) => void
}

export function AccuracyView({ meta, gate, onGateChange }: AccuracyViewProps) {
  const { data, error, loading } = useApi<Accuracy>(paths.accuracy(gate))

  return (
    <>
      <PageHeader
        title="Forecast accuracy"
        subtitle={`How far the gate-time forecast was from outturn, ${fmt.shortDay(meta.first_delivery_day)} – ${fmt.shortDay(meta.last_delivery_day)} ${meta.last_delivery_day.slice(0, 4)}.`}
        actions={<GateSelector gates={meta.gates} value={gate} onChange={onGateChange} />}
      />
      {error && <ErrorState message={error} />}
      {!data && loading && <LoadingState />}
      {data && (
        <div className={loading ? 'is-refreshing' : undefined}>
          <AccuracyBody accuracy={data} />
        </div>
      )}
    </>
  )
}

/** Hours-ahead covered by the gate-time forecast: gate → start/end of delivery day. */
function decisionWindow(gate: Gate): [number, number] {
  const [h, m] = gate.closes_at_local.split(':').map(Number)
  const gateHour = h + m / 60
  return [24 - gateHour, 48 - gateHour]
}

function AccuracyBody({ accuracy }: { accuracy: Accuracy }) {
  const [mode, setMode] = useState<ViewMode>('chart')
  const [showAdjusted, setShowAdjusted] = useState(false)
  const { stats, adjusted_stats: adjusted, series, gate } = accuracy
  const scored = series.filter((p) => p.actual_mw != null)
  const overShare = scored.filter((p) => p.forecast_mw > p.actual_mw!).length / Math.max(scored.length, 1)
  const worst = scored.reduce<(typeof scored)[number] | undefined>(
    (w, p) => (!w || Math.abs(p.forecast_mw - p.actual_mw!) > Math.abs(w.forecast_mw - w.actual_mw!) ? p : w),
    undefined,
  )
  const biasShare = stats.bias_mw != null && stats.mean_actual_mw ? stats.bias_mw / stats.mean_actual_mw : null
  const overall = (stats.bias_mw ?? 0) > 0

  return (
    <>
      <div className="hero-row">
        <div className="hero hero--wide">
          <div className="hero__eyebrow">Average bias at the {gate.label} gate</div>
          <div className="hero__figure">{signedGw(stats.bias_mw, 2)}</div>
          <p className="hero__caption">
            <span className="ink">
              The forecast {overall ? 'over' : 'under'}-estimated wind by {percent(biasShare && Math.abs(biasShare))} of
              mean output.
            </span>{' '}
            It was too high in {percent(overShare, 0)} of hours: buying against it left the buyer{' '}
            {gwh(stats.short_mwh, 0)} short over the period. A simple bias adjustment cuts that to{' '}
            {gwh(adjusted.short_mwh, 0)}.
          </p>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiTile
          label="Mean absolute error"
          icon={<Target size={16} />}
          value={gw(stats.mae_mw)}
          sub={`${percent(stats.mae_mw != null && stats.mean_actual_mw ? stats.mae_mw / stats.mean_actual_mw : null)} of mean output (${gw(stats.mean_actual_mw)})`}
        />
        <KpiTile label="RMSE" icon={<Sigma size={16} />} value={gw(stats.rmse_mw)} sub="Weights large misses more heavily" />
        <KpiTile
          label="P90 absolute error"
          icon={<Activity size={16} />}
          value={gw(stats.p90_abs_mw)}
          sub="9 in 10 hours missed by less than this"
        />
        <KpiTile
          label="Worst hour"
          icon={<TriangleAlert size={16} />}
          value={signedGw(worst ? worst.forecast_mw - worst.actual_mw! : null)}
          sub={worst ? fmt.dayTime(worst.time) : '—'}
        />
      </div>

      <div className="grid">
        <Card
          className="span-7"
          title="Raw forecast vs bias-adjusted"
          subtitle="Adjusted = forecast − mean error of the last 14 settled days (≤ D−2). Ours, not Elexon’s."
          icon={<Scale size={16} />}
        >
          <ComparisonTable raw={stats} adjusted={adjusted} />
        </Card>

        <Card
          className="span-5"
          title="Likely-range backtest"
          subtitle="How often the actual fell inside the P10–P90 range shown on the Decision desk"
          icon={<Gauge size={16} />}
        >
          <div className="kpi__value-row kpi__value-row--flush">
            <span className="kpi__value">{percent(accuracy.band_coverage.inside, 0)}</span>
            <span className="kpi__sub">of {accuracy.band_coverage.hours} hours inside, target 80%</span>
          </div>
          <CoverageBar coverage={accuracy.band_coverage} />
          <p className="note">
            Slightly narrow but balanced: misses fall about equally above and below. Days before the range has 3
            settled days of history are excluded.
          </p>
        </Card>

        <Card
          className="span-12"
          title="Forecast at gate vs outturn"
          subtitle="Every delivery hour in scope, GW"
          icon={<ChartLine size={16} />}
          actions={
            <>
              <Legend
                items={[
                  { label: 'Forecast at gate', color: chart.forecast, kind: 'line' },
                  { label: 'Actual', color: chart.actual, kind: 'line' },
                ]}
              />
              <Switch label="Bias-adjusted" color={chart.adjusted} checked={showAdjusted} onChange={setShowAdjusted} />
              <ViewToggle value={mode} onChange={setMode} />
            </>
          }
        >
          {mode === 'chart' ? (
            <MonthSeriesChart series={series} showAdjusted={showAdjusted} />
          ) : (
            <DataTable
              rows={accuracy.daily}
              rowKey={(d) => d.delivery_day}
              columns={[
                { header: 'Delivery day', render: (d) => fmt.day(d.delivery_day) },
                { header: 'Forecast', align: 'right', render: (d) => gwh(d.forecast_mwh) },
                { header: 'Adjusted', align: 'right', render: (d) => gwh(d.adjusted_mwh) },
                { header: 'Actual', align: 'right', render: (d) => gwh(d.actual_mwh) },
                { header: 'Bias', align: 'right', render: (d) => signedGw(d.bias_mw) },
                { header: 'MAE', align: 'right', render: (d) => gw(d.mae_mw) },
              ]}
            />
          )}
        </Card>

        <Card
          className="span-7"
          title="Accuracy by forecast horizon"
          subtitle="All forecast runs, grouped by hours between publish and target hour"
          icon={<Hourglass size={16} />}
          actions={
            <Legend
              items={[
                { label: 'MAE', color: chart.forecast, kind: 'bar' },
                { label: 'Bias', color: chart.over, kind: 'line' },
              ]}
            />
          }
        >
          <HorizonChart buckets={accuracy.by_horizon} decisionWindow={decisionWindow(gate)} />
        </Card>

        <Card
          className="span-5"
          title="Error distribution"
          subtitle="Hours by forecast − actual, GW, 0.5 GW bins"
          icon={<ChartColumn size={16} />}
          actions={
            <Legend
              items={[
                { label: 'Under', color: chart.under, kind: 'bar' },
                { label: '±0.25', color: chart.neutral, kind: 'bar' },
                { label: 'Over', color: chart.over, kind: 'bar' },
              ]}
            />
          }
        >
          <ErrorHistogram bins={accuracy.histogram} />
        </Card>

        <Card
          className="span-8"
          title="Daily bias"
          subtitle="Mean forecast − actual per delivery day"
          icon={<ChartColumn size={16} />}
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
            tickEvery={4}
            data={accuracy.daily.map((d) => ({
              label: fmt.shortDay(d.delivery_day),
              value: d.bias_mw,
              tooltipTitle: fmt.day(d.delivery_day),
              extraRows: [{ label: 'MAE', value: gw(d.mae_mw) }],
            }))}
          />
        </Card>

        <Card className="span-4" title="Error by hour of day" subtitle="MAE, UK time" icon={<Clock3 size={16} />}>
          <HourOfDayChart hours={accuracy.by_hour} />
        </Card>
      </div>
    </>
  )
}

/** Side-by-side error statistics: what the bias adjustment buys you. */
function ComparisonTable({ raw, adjusted }: { raw: ErrorStats; adjusted: ErrorStats }) {
  const change = (before: number | null, after: number | null) =>
    before && after != null ? `${after < before ? '−' : '+'}${percent(Math.abs(after - before) / Math.abs(before), 0)}` : '—'
  const rows: { label: string; raw: string; adjusted: string; change: string }[] = [
    { label: 'Mean absolute error', raw: gw(raw.mae_mw), adjusted: gw(adjusted.mae_mw), change: change(raw.mae_mw, adjusted.mae_mw) },
    { label: 'Bias (F − A)', raw: signedGw(raw.bias_mw, 2), adjusted: signedGw(adjusted.bias_mw, 2), change: change(raw.bias_mw, adjusted.bias_mw) },
    { label: 'RMSE', raw: gw(raw.rmse_mw), adjusted: gw(adjusted.rmse_mw), change: change(raw.rmse_mw, adjusted.rmse_mw) },
    { label: 'P90 absolute error', raw: gw(raw.p90_abs_mw), adjusted: gw(adjusted.p90_abs_mw), change: change(raw.p90_abs_mw, adjusted.p90_abs_mw) },
    { label: 'Energy short', raw: gwh(raw.short_mwh, 0), adjusted: gwh(adjusted.short_mwh, 0), change: change(raw.short_mwh, adjusted.short_mwh) },
    { label: 'Energy long', raw: gwh(raw.long_mwh, 0), adjusted: gwh(adjusted.long_mwh, 0), change: change(raw.long_mwh, adjusted.long_mwh) },
  ]
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Measure</th>
            <th className="num">Raw forecast</th>
            <th className="num">Bias-adjusted</th>
            <th className="num">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td className="num">{row.raw}</td>
              <td className="num">
                <strong>{row.adjusted}</strong>
              </td>
              <td className="num">{row.change}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
