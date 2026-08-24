'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Icon } from '@/components/app/Icons'

export type ThemeMode = 'night' | 'morning'

type ThemeContextValue = {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'morning',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('morning')

  useEffect(() => {
    const stored = localStorage.getItem('sf-theme') as ThemeMode | null
    const initial: ThemeMode =
      stored === 'morning' || stored === 'night'
        ? stored
        : 'morning'
    setThemeState(initial)
    document.documentElement.setAttribute('data-theme', initial)
  }, [])

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next)
    localStorage.setItem('sf-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeIconButton() {
  const { theme, setTheme } = useTheme()
  const isMorning = theme === 'morning'
  return (
    <button
      type="button"
      className="sf-theme-icon-btn"
      onClick={() => setTheme(isMorning ? 'night' : 'morning')}
      title={isMorning ? 'Switch to night mode' : 'Switch to morning mode'}
      aria-label={isMorning ? 'Switch to night mode' : 'Switch to morning mode'}
    >
      <Icon name={isMorning ? 'moon' : 'sun'} size={16} />
    </button>
  )
}

/** @deprecated Use ThemeIconButton in the top bar */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  return <ThemeIconButton />
}
