import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

/** Icon button that flips between light and dark. Shows the theme you'd switch to */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`

  return (
    <button type="button" className="round-button round-button--sm" onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  )
}
