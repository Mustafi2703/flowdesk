'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SessionUser, NAV_ITEMS, ROLE_COLORS, ROLE_LABELS } from '@/types'
import { ThemeToggle } from '@/components/app/ThemeProvider'

export default function Sidebar({ session }: { session: SessionUser }) {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const nav = NAV_ITEMS.filter(n => (n.roles as readonly string[]).includes(session.role))

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const roleColor = ROLE_COLORS[session.role] || 'var(--sf-accent)'

  return (
    <aside
      style={{
        width: collapsed ? 64 : 240,
        background: 'var(--sf-sidebar)',
        borderRight: '1px solid var(--sf-sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1rem 0.625rem',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        overflow: 'hidden',
        boxShadow: 'var(--sf-shadow)',
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 0.5rem',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            background: 'var(--sf-accent)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            color: '#fff',
            fontSize: 15,
            flexShrink: 0,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          S
        </div>
        {!collapsed && (
          <div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                color: 'var(--sf-text)',
                fontSize: 15,
                lineHeight: 1.2,
              }}
            >
              Scrumfolks
            </div>
            <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 500 }}>CRM · TMS</div>
          </div>
        )}
      </div>

      {!collapsed && (
        <div style={{ padding: '0 0.375rem', marginBottom: '1rem' }}>
          <ThemeToggle compact />
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {nav.map(item => {
          const active =
            pathname === `/${item.id}` ||
            (pathname.startsWith(`/${item.id}/`) && item.id !== 'overview')
          return (
            <button
              key={item.id}
              className={`sf-nav ${active ? 'active' : ''}`}
              onClick={() => router.push(`/${item.id}`)}
              title={collapsed ? item.label : undefined}
            >
              <span className="sf-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: '1px solid var(--sf-border)', paddingTop: '0.875rem', marginTop: 8 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0.375rem 0.5rem',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: roleColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            {session.avatar || session.name.slice(0, 2).toUpperCase()}
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <div
                style={{
                  color: 'var(--sf-text)',
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {session.name}
              </div>
              <div style={{ color: 'var(--sf-muted)', fontSize: 10 }}>{ROLE_LABELS[session.role]}</div>
            </div>
          )}
        </div>
        {collapsed && (
          <div style={{ padding: '0 0.25rem', marginBottom: 8 }}>
            <ThemeToggle compact />
          </div>
        )}
        <button className="sf-nav" onClick={() => setCollapsed(c => !c)} style={{ marginBottom: 2 }}>
          <span className="sf-icon">{collapsed ? '▶' : '◀'}</span>
          {!collapsed && 'Collapse'}
        </button>
        <button className="sf-nav" onClick={logout}>
          <span className="sf-icon">⇤</span>
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </aside>
  )
}
