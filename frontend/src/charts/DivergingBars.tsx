import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TooltipCard, type TooltipRow } from '../components/TooltipCard'
import { gwTick, signedGw } from '../lib/format'
import { axisTick, chart } from '../lib/theme'
import { categoryAxis, domainOf, everyNth, gwTicks } from '../lib/ticks'

export interface DivergingDatum {
  label: string
  /** Forecast − actual (MW). Positive bars go up in the "over" colour */
  value: number | null
  tooltipTitle: string
  extraRows?: TooltipRow[]
}

interface Row extends DivergingDatum {
  over: number | null
  under: number | null
}

interface DivergingBarsProps {
  data: DivergingDatum[]
  height?: number
  /** Label every n-th bar */
  tickEvery?: number
}

/** Over-/under-forecast bars around zero (hourly misses, daily bias) */
export function DivergingBars({ data, height = 220, tickEvery = 1 }: DivergingBarsProps) {
  const rows: Row[] = data.map((d) => ({
    ...d,
    over: d.value != null && d.value > 0 ? d.value : null,
    under: d.value != null && d.value < 0 ? d.value : null,
  }))
  const ticks = gwTicks(data.map((d) => d.value))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis
          dataKey="label"
          ticks={everyNth(rows, tickEvery)}
          {...categoryAxis}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={gwTick} width={32} ticks={ticks} domain={domainOf(ticks)} />
        <ReferenceLine y={0} stroke={chart.axis} />
        <Tooltip
          cursor={{ fill: chart.grid, fillOpacity: 0.5 }}
          content={({ active, payload }) => {
            const d = active ? (payload?.[0]?.payload as Row | undefined) : undefined
            if (!d) return null
            const over = (d.value ?? 0) > 0
            return (
              <TooltipCard
                title={d.tooltipTitle}
                rows={[
                  {
                    label: over ? 'Over-forecast' : 'Under-forecast',
                    value: signedGw(d.value),
                    color: over ? chart.over : chart.under,
                  },
                  ...(d.extraRows ?? []),
                ]}
              />
            )
          }}
        />
        <Bar dataKey="over" stackId="error" fill={chart.over} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="under" stackId="error" fill={chart.under} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
