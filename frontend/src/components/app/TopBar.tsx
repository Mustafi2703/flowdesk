'use client'

import { ClockBar } from '@/components/app/ClockBar'
import { NotificationBell } from '@/components/app/NotificationBell'
import { ThemeToggle } from '@/components/app/ThemeProvider'

/** Slim top bar — clock in/out for everyone + notifications + theme. */
export function TopBar() {
  return (
    <header className="sf-topbar">
      <ThemeToggle compact />
      <ClockBar />
      <NotificationBell />
    </header>
  )
}
