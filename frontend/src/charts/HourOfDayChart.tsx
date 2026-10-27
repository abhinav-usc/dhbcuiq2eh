import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HourOfDay } from '../api/types'
import { TooltipCard } from '../components/TooltipCard'
import { gw, gwTick, signedGw } from '../lib/format'
import { axisTick, chart } from '../lib/theme'
import { categoryAxis, domainOf, everyNth, gwTicks } from '../lib/ticks'

interface Datum {
  label: string
  mae: number
  bias: number
  n: number
}

export function HourOfDayChart({ hours }: { hours: HourOfDay[] }) {
  const data: Datum[] = hours.map((h) => ({
    label: String(h.hour).padStart(2, '0'),
    mae: h.mae_mw,
    bias: h.bias_mw,
    n: h.n,
  }))
  const ticks = gwTicks(data.map((d) => d.mae), 4)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis
          dataKey="label"
          ticks={everyNth(data, 6)}
          {...categoryAxis}
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: chart.axis }}
          tickMargin={8}
        />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={gwTick} width={32} ticks={ticks} domain={domainOf(ticks)} />
        <Tooltip
          cursor={{ fill: chart.grid, fillOpacity: 0.5 }}
          content={({ active, payload }) => {
            const d = active ? (payload?.[0]?.payload as Datum | undefined) : undefined
            if (!d) return null
            return (
              <TooltipCard
                title={`${d.label}:00 UK time`}
                rows={[
                  { label: 'Mean absolute error', value: gw(d.mae), color: chart.forecast },
                  { label: 'Bias (F − A)', value: signedGw(d.bias) },
                  { label: 'Hours', value: String(d.n) },
                ]}
              />
            )
          }}
        />
        <Bar dataKey="mae" fill={chart.forecast} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
