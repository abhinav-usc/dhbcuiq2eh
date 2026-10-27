import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SeriesPoint } from '../api/types'
import { TooltipCard } from '../components/TooltipCard'
import { fmt, gw, gwTick, signedGw } from '../lib/format'
import { axisTick, chart } from '../lib/theme'
import { domainOf, gwTicks } from '../lib/ticks'

interface Datum {
  time: string
  forecast: number
  adjusted: number
  actual: number | null
}

const TICK_EVERY_DAYS = 4

export function MonthSeriesChart({ series, showAdjusted }: { series: SeriesPoint[]; showAdjusted: boolean }) {
  const data: Datum[] = series.map((p) => ({
    time: p.time,
    forecast: p.forecast_mw,
    adjusted: p.adjusted_mw,
    actual: p.actual_mw,
  }))
  // One tick at local midnight every few days.
  const midnights = data.filter((d) => fmt.time(d.time) === '00:00').map((d) => d.time)
  const ticks = midnights.filter((_, i) => i % TICK_EVERY_DAYS === 0)
  const yTicks = gwTicks(data.flatMap((d) => [d.forecast, d.actual]))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis
          dataKey="time"
          ticks={ticks}
          tickFormatter={fmt.shortDayOfTimestamp}
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: chart.axis }}
          tickMargin={8}
        />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={gwTick} width={32} ticks={yTicks} domain={domainOf(yTicks)} />
        <Tooltip
          cursor={{ stroke: chart.axis }}
          content={({ active, payload }) => {
            const d = active ? (payload?.[0]?.payload as Datum | undefined) : undefined
            if (!d) return null
            return (
              <TooltipCard
                title={fmt.dayTime(d.time)}
                rows={[
                  { label: 'Forecast at gate', value: gw(d.forecast), color: chart.forecast },
                  ...(showAdjusted ? [{ label: 'Bias-adjusted', value: gw(d.adjusted), color: chart.adjusted }] : []),
                  { label: 'Actual', value: gw(d.actual), color: chart.actual },
                  { label: 'Error (F − A)', value: signedGw(d.actual == null ? null : d.forecast - d.actual) },
                ]}
              />
            )
          }}
        />
        <Line
          dataKey="forecast"
          stroke={chart.forecast}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 4, stroke: chart.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
        <Line
          dataKey="actual"
          stroke={chart.actual}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 4, stroke: chart.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
        {showAdjusted && (
          <Line
            dataKey="adjusted"
            stroke={chart.adjusted}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, stroke: chart.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
