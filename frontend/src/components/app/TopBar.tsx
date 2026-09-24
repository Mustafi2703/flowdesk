'use client'

import { ClockBar } from '@/components/app/ClockBar'
import { NotificationBell } from '@/components/app/NotificationBell'
import { ThemeIconButton } from '@/components/app/ThemeProvider'
/** Slim top bar — clock + notifications + theme icon. */
export function TopBar({
  onMenuClick,
  menuOpen,
}: {
  onMenuClick?: () => void
  menuOpen?: boolean
}) {
  return (
    <header className="sf-topbar">
      {onMenuClick && (
        <button
          type="button"
          className="sf-topbar-menu"
          onClick={onMenuClick}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span className="sf-topbar-menu-glyph" aria-hidden>{menuOpen ? '×' : '☰'}</span>
        </button>
      )}
      <ClockBar />
      <div className="sf-topbar-actions">
        <NotificationBell />
        <ThemeIconButton />
      </div>
    </header>
  )
}
