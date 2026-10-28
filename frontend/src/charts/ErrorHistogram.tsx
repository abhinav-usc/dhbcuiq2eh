import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HistogramBin } from '../api/types'
import { TooltipCard } from '../components/TooltipCard'
import { gw, gwTick } from '../lib/format'
import { axisTick, chart } from '../lib/theme'
import { categoryAxis } from '../lib/ticks'

interface Datum {
  label: string
  bin: HistogramBin
  over: number | null
  under: number | null
  neutral: number | null
}

const LABEL_EVERY_MW = 2000

/** Bins are centred on multiples of 0.5 GW; the zero bin is the neutral midpoint */
export function ErrorHistogram({ bins }: { bins: HistogramBin[] }) {
  const total = bins.reduce((sum, b) => sum + b.count, 0)
  const data: Datum[] = bins.map((bin) => ({
    label: gwTick(bin.center_mw),
    bin,
    over: bin.center_mw > 0 ? bin.count : null,
    under: bin.center_mw < 0 ? bin.count : null,
    neutral: bin.center_mw === 0 ? bin.count : null,
  }))
  const ticks = data.filter((d) => d.bin.center_mw % LABEL_EVERY_MW === 0).map((d) => d.label)

  const colorOf = (bin: HistogramBin) =>
    bin.center_mw > 0 ? chart.over : bin.center_mw < 0 ? chart.under : chart.neutral

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis
          dataKey="label"
          ticks={ticks}
          {...categoryAxis}
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: chart.axis }}
          tickMargin={8}
        />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: chart.grid, fillOpacity: 0.5 }}
          content={({ active, payload }) => {
            const d = active ? (payload?.[0]?.payload as Datum | undefined) : undefined
            if (!d) return null
            return (
              <TooltipCard
                title={`Error ${gw(d.bin.from_mw, 2)} to ${gw(d.bin.to_mw, 2)}`}
                rows={[
                  { label: 'Hours', value: d.bin.count.toLocaleString('en-GB'), color: colorOf(d.bin) },
                  { label: 'Share of hours', value: `${((d.bin.count / Math.max(total, 1)) * 100).toFixed(1)}%` },
                ]}
              />
            )
          }}
        />
        <Bar dataKey="under" stackId="bin" fill={chart.under} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="neutral" stackId="bin" fill={chart.neutral} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="over" stackId="bin" fill={chart.over} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
