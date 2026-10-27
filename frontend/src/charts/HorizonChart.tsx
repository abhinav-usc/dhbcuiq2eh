import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HorizonBucket } from '../api/types'
import { TooltipCard } from '../components/TooltipCard'
import { gw, gwTick, signedGw } from '../lib/format'
import { axisTick, chart } from '../lib/theme'
import { categoryAxis, domainOf, everyNth, gwTicks } from '../lib/ticks'

interface Datum {
  label: string
  from: number
  to: number
  n: number
  mae: number
  bias: number
}

interface HorizonChartProps {
  buckets: HorizonBucket[]
  /** Hours-ahead range the gate-time forecast covers (gate → each delivery hour). */
  decisionWindow: [number, number]
}

export function HorizonChart({ buckets, decisionWindow }: HorizonChartProps) {
  const data: Datum[] = buckets.map((b) => ({
    label: `${b.horizon_from_h}–${b.horizon_to_h}`,
    from: b.horizon_from_h,
    to: b.horizon_to_h,
    n: b.n,
    mae: b.mae_mw,
    bias: b.bias_mw,
  }))
  const [windowStart, windowEnd] = decisionWindow
  const inWindow = data.filter((d) => d.to > windowStart && d.from < windowEnd)
  const ticks = gwTicks(data.flatMap((d) => [d.mae, d.bias]))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
        <CartesianGrid vertical={false} stroke={chart.grid} />
        {inWindow.length > 0 && (
          <ReferenceArea
            x1={inWindow[0].label}
            x2={inWindow[inWindow.length - 1].label}
            fill={chart.grid}
            fillOpacity={0.6}
            stroke="none"
            label={{ value: 'Day-ahead window', position: 'insideTop', fill: chart.tick, fontSize: 11, dy: -16 }}
          />
        )}
        <XAxis
          dataKey="label"
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: chart.axis }}
          tickMargin={8}
          ticks={everyNth(data, 2)}
          {...categoryAxis}
          tickFormatter={(value: string) => `${value}h`}
        />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={gwTick} width={32} ticks={ticks} domain={domainOf(ticks)} />
        <Tooltip
          cursor={{ fill: chart.grid, fillOpacity: 0.5 }}
          content={({ active, payload }) => {
            const d = active ? (payload?.[0]?.payload as Datum | undefined) : undefined
            if (!d) return null
            return (
              <TooltipCard
                title={`${d.from}–${d.to} h ahead`}
                rows={[
                  { label: 'Mean absolute error', value: gw(d.mae), color: chart.forecast },
                  { label: 'Bias (F − A)', value: signedGw(d.bias), color: chart.over },
                  { label: 'Forecast–hour pairs', value: d.n.toLocaleString('en-GB') },
                ]}
              />
            )
          }}
        />
        <Bar dataKey="mae" fill={chart.forecast} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Line
          dataKey="bias"
          stroke={chart.over}
          strokeWidth={2}
          dot={{ r: 3.5, fill: chart.over, stroke: chart.surface, strokeWidth: 2 }}
          activeDot={{ r: 5, stroke: chart.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
