import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HourPoint } from '../api/types'
import { TooltipCard } from '../components/TooltipCard'
import { fmt, gw, gwTick, signedGw } from '../lib/format'
import { axisTick, chart } from '../lib/theme'
import { categoryAxis, domainOf, everyNth, gwTicks } from '../lib/ticks'

interface Datum {
  label: string
  forecast: number
  adjusted: number
  actual: number | null
  error: number | null
  band: [number, number] | null
}

export function DayForecastChart({ points, showAdjusted }: { points: HourPoint[]; showAdjusted: boolean }) {
  const data: Datum[] = points.map((p) => ({
    label: fmt.time(p.time),
    forecast: p.forecast_mw,
    adjusted: p.adjusted_mw,
    actual: p.actual_mw,
    error: p.error_mw,
    band: p.band_low_mw != null && p.band_high_mw != null ? [p.band_low_mw, p.band_high_mw] : null,
  }))
  const ticks = gwTicks(data.flatMap((d) => [d.forecast, d.actual, d.band?.[1], showAdjusted ? d.adjusted : null]))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis
          dataKey="label"
          ticks={everyNth(data, 3)}
          {...categoryAxis}
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: chart.axis }}
          tickMargin={8}
        />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={gwTick} width={32} ticks={ticks} domain={domainOf(ticks)} />
        <Tooltip
          cursor={{ stroke: chart.axis }}
          content={({ active, payload }) => {
            const d = active ? (payload?.[0]?.payload as Datum | undefined) : undefined
            if (!d) return null
            return (
              <TooltipCard
                title={d.label}
                rows={[
                  { label: 'Forecast at gate', value: gw(d.forecast), color: chart.forecast },
                  ...(showAdjusted ? [{ label: 'Bias-adjusted', value: gw(d.adjusted), color: chart.adjusted }] : []),
                  { label: 'Actual', value: gw(d.actual), color: chart.actual },
                  { label: 'Error (F − A)', value: signedGw(d.error) },
                  ...(d.band ? [{ label: 'Likely range', value: `${gw(d.band[0])} – ${gw(d.band[1])}` }] : []),
                ]}
              />
            )
          }}
        />
        <Area
          dataKey="band"
          stroke="none"
          fill={chart.forecast}
          fillOpacity={chart.bandOpacity}
          activeDot={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="forecast"
          type="monotone"
          stroke={chart.forecast}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4.5, stroke: chart.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
        <Line
          dataKey="actual"
          type="monotone"
          stroke={chart.actual}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4.5, stroke: chart.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
        {showAdjusted && (
          <Line
            dataKey="adjusted"
            type="monotone"
            stroke={chart.adjusted}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4.5, stroke: chart.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
