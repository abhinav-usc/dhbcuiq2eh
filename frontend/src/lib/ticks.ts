/**
 * Round-number axis ticks (in MW) on 1/2/5 × 10^k GW steps, always including 0.
 * Recharts' automatic ticks land on values like 4.5 / 13.5 GW; these don't
 */
export function gwTicks(values: Array<number | null | undefined>, target = 5): number[] {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v))
  const min = Math.min(0, ...finite)
  const max = Math.max(0, ...finite)
  const spanGw = (max - min) / 1000 || 1
  const raw = spanGw / target
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw) * 1000
  const ticks: number[] = []
  for (let t = Math.floor(min / step) * step; t <= Math.ceil(max / step) * step + step / 2; t += step) {
    ticks.push(Math.round(t))
  }
  return ticks
}

export const domainOf = (ticks: number[]): [number, number] => [ticks[0], ticks[ticks.length - 1]]

/** Every `every`-th category label. Pair with interval="preserveStartEnd" so narrow screens drop overlaps */
export function everyNth<T extends { label: string }>(data: T[], every: number): string[] {
  return data.filter((_, i) => i % every === 0).map((d) => d.label)
}

/** Shared props for category x-axes: fixed tick positions, overlaps hidden on small screens */
export const categoryAxis = { interval: 'preserveStartEnd' as const, minTickGap: 12 }
