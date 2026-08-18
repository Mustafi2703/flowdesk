'use client'

import { ClockBar } from '@/components/app/ClockBar'
import { NotificationBell } from '@/components/app/NotificationBell'

/** Slim top bar — clock in/out for everyone + notifications. */
export function TopBar() {
  return (
    <header
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0.65rem 1.25rem',
        borderBottom: '1px solid var(--sf-border)',
        background: 'var(--sf-surface)',
        minHeight: 56,
        flexWrap: 'wrap',
      }}
    >
      <ClockBar />
      <NotificationBell />
    </header>
  )
}
