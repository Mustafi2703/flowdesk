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
        gap: 12,
        padding: '0.7rem 1.35rem',
        borderBottom: '1px solid var(--sf-border)',
        background: 'color-mix(in srgb, var(--sf-surface) 88%, transparent)',
        backdropFilter: 'blur(12px)',
        minHeight: 58,
        flexWrap: 'wrap',
        boxShadow: '0 1px 0 rgba(255,255,255,0.02)',
      }}
    >
      <ClockBar />
      <NotificationBell />
    </header>
  )
}
