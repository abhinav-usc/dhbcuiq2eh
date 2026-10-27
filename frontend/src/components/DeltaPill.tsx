import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

interface DeltaPillProps {
  /** Forecast minus actual. Positive = over-forecast (buyer short). */
  errorValue: number | null | undefined
  text: string
}

/** Direction is carried by icon + words, never colour alone. */
export function DeltaPill({ errorValue, text }: DeltaPillProps) {
  if (errorValue == null) return null
  const over = errorValue > 0
  const Icon = over ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`pill ${over ? 'pill--over' : 'pill--under'}`}>
      <Icon size={13} strokeWidth={2.25} aria-hidden />
      {text}
    </span>
  )
}
