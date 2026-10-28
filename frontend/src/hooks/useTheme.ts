import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'breeze-theme'

// index.html stamps data-theme on <html> before first paint (saved choice,
// else the OS setting), so read it back instead of deciding twice
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function savedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null // storage can be blocked (private windows); the OS setting applies
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  // Mirror the state onto <html> (the CSS tokens key off it) and tint the
  // browser's own UI, e.g. the mobile address bar, with the page colour
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    const page = getComputedStyle(root).getPropertyValue('--page').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', page)
  }, [theme])

  // Until someone picks a theme, follow the OS setting live
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => {
      if (!savedTheme()) setTheme(event.matches ? 'dark' : 'light')
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // The choice just won't survive a reload
    }
    setTheme(next)
  }, [theme])

  return { theme, toggle }
}
