interface SwitchProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Colour of the series this switch reveals, shown as a line key. */
  color?: string
}

export function Switch({ label, checked, onChange, color }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span className="switch__track" aria-hidden>
        <span className="switch__thumb" />
      </span>
      {color && <span className="switch__key" style={{ background: color }} aria-hidden />}
      {label}
    </button>
  )
}
