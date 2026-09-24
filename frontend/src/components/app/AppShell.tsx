'use client'

import { useState } from 'react'
import type { SessionUser } from '@/types'
import Sidebar from '@/components/app/Sidebar'
import { TopBar } from '@/components/app/TopBar'

export function AppShell({ session, children }: { session: SessionUser; children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  function closeMobileNav() {
    setMobileNavOpen(false)
  }

  return (
    <div className={`sf-app-shell${mobileNavOpen ? ' sf-app-shell--nav-open' : ''}`}>
      <div
        className="sf-mobile-nav-backdrop"
        aria-hidden={!mobileNavOpen}
        onClick={closeMobileNav}
      />
      <Sidebar session={session} mobileOpen={mobileNavOpen} onNavigate={closeMobileNav} />
      <main className="sf-app-main">
        <TopBar onMenuClick={() => setMobileNavOpen((v) => !v)} menuOpen={mobileNavOpen} />
        <div className="sf-main-scroll">{children}</div>
      </main>
    </div>
  )
}
