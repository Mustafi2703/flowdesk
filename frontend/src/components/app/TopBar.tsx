'use client'

import { ClockBar } from '@/components/app/ClockBar'
import { NotificationBell } from '@/components/app/NotificationBell'
import { ThemeIconButton } from '@/components/app/ThemeProvider'

/** Slim top bar — clock + notifications + theme icon. */
export function TopBar() {
  return (
    <header className="sf-topbar">
      <ClockBar />
      <div className="sf-topbar-actions">
        <NotificationBell />
        <ThemeIconButton />
      </div>
    </header>
  )
}
