'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Icon } from '@/components/app/Icons'

export type ThemeMode = 'night' | 'morning'

type ThemeContextValue = {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'night',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('night')

  useEffect(() => {
    const stored = localStorage.getItem('sf-theme') as ThemeMode | null
    const initial: ThemeMode =
      stored === 'morning' || stored === 'night'
        ? stored
        : window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'morning'
          : 'night'
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

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme()
  return (
    <div className="sf-theme-toggle" style={compact ? { width: '100%' } : undefined}>
      <button
        type="button"
        className={`sf-theme-btn ${theme === 'morning' ? 'active' : ''}`}
        onClick={() => setTheme('morning')}
        title="Morning mode (light)"
      >
        <Icon name="sun" size={14} /> Morning
      </button>
      <button
        type="button"
        className={`sf-theme-btn ${theme === 'night' ? 'active' : ''}`}
        onClick={() => setTheme('night')}
        title="Night mode (dark)"
      >
        <Icon name="moon" size={14} /> Night
      </button>
    </div>
  )
}
