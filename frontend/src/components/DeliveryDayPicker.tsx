import { useRef } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, fmt } from '../lib/format'

interface DeliveryDayPickerProps {
  day: string
  min: string
  max: string
  onChange: (day: string) => void
}

export function DeliveryDayPicker({ day, min, max, onChange }: DeliveryDayPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const prev = addDays(day, -1)
  const next = addDays(day, 1)

  return (
    <div className="day-picker">
      <div className="day-picker__badge" aria-hidden>
        {fmt.dayOfMonth(day)}
      </div>
      <div className="day-picker__text">
        <span className="day-picker__eyebrow">Delivery day</span>
        <span className="day-picker__weekday">{fmt.weekday(day)},</span>
        <span className="day-picker__month">{fmt.monthYear(day)}</span>
      </div>
      <div className="day-picker__divider" aria-hidden />
      <div className="day-picker__controls">
        <button
          type="button"
          className="round-button"
          aria-label={`Previous day, ${fmt.longDay(prev)}`}
          disabled={prev < min}
          onClick={() => onChange(prev)}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="round-button"
          aria-label={`Next day, ${fmt.longDay(next)}`}
          disabled={next > max}
          onClick={() => onChange(next)}
        >
          <ChevronRight size={18} />
        </button>
        <label className="round-button round-button--input" aria-label="Pick a delivery day">
          <CalendarDays size={18} />
          <input
            ref={inputRef}
            type="date"
            value={day}
            min={min}
            max={max}
            onClick={() => inputRef.current?.showPicker?.()}
            onChange={(event) => event.target.value && onChange(event.target.value)}
          />
        </label>
      </div>
    </div>
  )
}
