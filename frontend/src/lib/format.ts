// Formatting helpers. Power arrives in MW and energy in MWh; we display GW / GWh

const MINUS = '−'
const UK = 'Europe/London'

/**
 * `value * scale` at `digits` decimals, with a proper minus sign. The sign
 * comes from the rounded number, so −20 MW reads "0.0 GW", never "−0.0 GW"
 */
function scaled(value: number, scale: number, digits: number, { plus = false } = {}): string {
  const rounded = Number((value * scale).toFixed(digits))
  const text = Math.abs(rounded).toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const sign = rounded < 0 ? MINUS : rounded > 0 && plus ? '+' : ''
  return sign + text
}

const PER_THOUSAND = 1 / 1000

export function gw(mw: number | null | undefined, digits = 1): string {
  return mw == null ? '—' : `${scaled(mw, PER_THOUSAND, digits)} GW`
}

export function signedGw(mw: number | null | undefined, digits = 1): string {
  return mw == null ? '—' : `${scaled(mw, PER_THOUSAND, digits, { plus: true })} GW`
}

/** Signed GW without the unit, for compact ranges like "−4.8 to +0.6" */
export function signedGwValue(mw: number, digits = 1): string {
  return scaled(mw, PER_THOUSAND, digits, { plus: true })
}

export function gwh(mwh: number | null | undefined, digits = 1): string {
  return mwh == null ? '—' : `${scaled(mwh, PER_THOUSAND, digits)} GWh`
}

export function percent(ratio: number | null | undefined, digits = 1): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—'
  return `${scaled(ratio, 100, digits)}%`
}

/** "20 min", "1 h 50 min" */
export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Axis ticks: "12" (GW), "−2" etc */
export function gwTick(mw: number): string {
  const value = mw / 1000
  return `${value < 0 ? MINUS : ''}${Math.abs(value).toLocaleString('en-GB', { maximumFractionDigits: 1 })}`
}

// --- Dates & times ---------------------------------------------------------
// Timestamps (ISO, UTC) are shown in UK local time. Day strings ("YYYY-MM-DD")
// are calendar dates and are formatted in UTC so they never shift

const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: UK, hour: '2-digit', minute: '2-digit' })
const dayTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const shortDayOfTsFmt = new Intl.DateTimeFormat('en-GB', { timeZone: UK, day: 'numeric', month: 'short' })
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
const shortDayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const longDayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const weekdayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' })
const monthYearFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })

const asDate = (day: string) => new Date(`${day}T00:00:00Z`)

export const fmt = {
  time: (iso: string) => timeFmt.format(new Date(iso)),
  dayTime: (iso: string) => dayTimeFmt.format(new Date(iso)),
  shortDayOfTimestamp: (iso: string) => shortDayOfTsFmt.format(new Date(iso)),
  day: (day: string) => dayFmt.format(asDate(day)),
  shortDay: (day: string) => shortDayFmt.format(asDate(day)),
  longDay: (day: string) => longDayFmt.format(asDate(day)),
  weekday: (day: string) => weekdayFmt.format(asDate(day)),
  monthYear: (day: string) => monthYearFmt.format(asDate(day)),
  dayOfMonth: (day: string) => String(asDate(day).getUTCDate()),
}

export function addDays(day: string, days: number): string {
  const date = asDate(day)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Minutes between two ISO timestamps (b - a) */
export function minutesBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
}
