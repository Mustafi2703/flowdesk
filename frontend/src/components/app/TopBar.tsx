'use client'

import { NotificationBell } from '@/components/app/NotificationBell'

/** Slim top bar — notifications only, top-right. */
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
      }}
    >
      <NotificationBell />
    </header>
  )
}
