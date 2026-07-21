'use client'

import { ThemeToggle } from '@/components/app/ThemeProvider'
import { NotificationBell } from '@/components/app/NotificationBell'

/** Slim top bar — notifications anchored top-right across the dashboard. */
export function TopBar() {
  return (
    <header
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 10,
        padding: '0.65rem 1.25rem',
        borderBottom: '1px solid var(--sf-border)',
        background: 'var(--sf-surface)',
        minHeight: 56,
      }}
    >
      <ThemeToggle compact />
      <NotificationBell />
    </header>
  )
}
