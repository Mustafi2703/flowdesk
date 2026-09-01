'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SessionUser, NAV_ITEMS, ROLE_COLORS, ROLE_LABELS } from '@/types'
import { Icon, NavIconBadge, navTone } from '@/components/app/Icons'
import { Modal } from '@/components/app/Modal'

const SIDEBAR_KEY = 'sf-sidebar-collapsed'

const NAV_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Workspace', ids: ['overview', 'calendar', 'tasks', 'updates', 'devboard'] },
  { label: 'Clients', ids: ['brands', 'meetings', 'review'] },
  { label: 'People', ids: ['team', 'performance', 'attendance', 'leave', 'announcements'] },
  { label: 'Finance', ids: ['billing'] },
]

export default function Sidebar({ session }: { session: SessionUser }) {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwNotice, setPwNotice] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY) === 'true'
    setCollapsed(stored)
    document.documentElement.style.setProperty('--sf-sidebar-w', stored ? '76px' : '260px')
    document.documentElement.dataset.sidebarCollapsed = stored ? 'true' : 'false'
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    document.documentElement.style.setProperty('--sf-sidebar-w', collapsed ? '76px' : '260px')
    document.documentElement.dataset.sidebarCollapsed = collapsed ? 'true' : 'false'
  }, [collapsed, ready])

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(SIDEBAR_KEY, String(next))
      return next
    })
  }

  const nav = NAV_ITEMS.filter(n => (n.roles as readonly string[]).includes(session.role))

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwNotice('')
    if (pwForm.next.length < 8) {
      setPwError('New password must be at least 8 characters')
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('New passwords do not match')
      return
    }
    setPwSaving(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: pwForm.current,
        new_password: pwForm.next,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setPwSaving(false)
    if (!res.ok) {
      setPwError(data.detail || data.error || 'Could not change password')
      return
    }
    setPwNotice('Password updated successfully')
    setPwForm({ current: '', next: '', confirm: '' })
    setTimeout(() => {
      setShowPassword(false)
      setPwNotice('')
    }, 1500)
  }

  const roleColor = ROLE_COLORS[session.role] || 'var(--sf-accent)'

  const sidebarWidth = collapsed ? 76 : 260

  return (
    <aside
      className={`sf-sidebar${collapsed ? ' sf-sidebar--collapsed' : ''}${ready ? ' sf-sidebar--ready' : ''}`}
      style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
      aria-label="Main navigation"
      aria-expanded={!collapsed}
    >
      <div className="sf-sidebar-brand-row">
        <div className="sf-sidebar-logo" aria-hidden>S</div>
        <div className="sf-sidebar-brand-text">
          <div className="sf-sidebar-brand-name">Scrumfolks</div>
          <div className="sf-sidebar-brand-tag">CRM · TMS</div>
        </div>
        <button
          type="button"
          className="sf-sidebar-collapse-btn"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={collapsed ? 'chevron-right' : 'panel-left'} size={16} />
        </button>
      </div>

      <nav className="sf-sidebar-nav" aria-label="Primary">
        {NAV_GROUPS.map(group => {
          const items = nav.filter(n => (group.ids as readonly string[]).includes(n.id))
          if (!items.length) return null
          return (
            <div key={group.label} className="sf-sidebar-group">
              {!collapsed && (
                <div className="sf-sidebar-group-label" aria-hidden>
                  {group.label}
                </div>
              )}
              {items.map(item => {
                const active =
                  pathname === `/${item.id}` ||
                  (pathname.startsWith(`/${item.id}/`) && item.id !== 'overview')
                const tone = navTone(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`sf-nav ${active ? 'active' : ''}`}
                    style={{ '--nav-fg': tone.fg } as CSSProperties}
                    onClick={() => router.push(`/${item.id}`)}
                    title={collapsed ? item.label : undefined}
                  >
                    <NavIconBadge name={item.icon} navId={item.id} active={active} />
                    <span className="sf-nav-label">{item.label}</span>
                    {active && <span className="sf-nav-active-bar" aria-hidden />}
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="sf-sidebar-footer">
        <div className="sf-sidebar-user">
          <div className="sf-sidebar-avatar" style={{ background: roleColor }}>
            {session.avatar || session.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="sf-sidebar-user-text">
            <div className="sf-sidebar-user-name">{session.name}</div>
            <div className="sf-sidebar-user-role">{ROLE_LABELS[session.role]}</div>
          </div>
        </div>
        <button
          type="button"
          className="sf-nav sf-nav-footer"
          onClick={() => { setShowPassword(true); setPwError(''); setPwNotice('') }}
          title={collapsed ? 'Change password' : undefined}
        >
          <span className="sf-nav-icon-badge sf-nav-icon-badge--muted">
            <Icon name="key" size={15} />
          </span>
          <span className="sf-nav-label">Change Password</span>
        </button>
        <button type="button" className="sf-nav sf-nav-footer sf-nav-danger" onClick={logout} title={collapsed ? 'Sign out' : undefined}>
          <span className="sf-nav-icon-badge sf-nav-icon-badge--danger">
            <Icon name="log-out" size={15} />
          </span>
          <span className="sf-nav-label">Sign Out</span>
        </button>
      </div>

      <Modal
        open={showPassword}
        onClose={() => setShowPassword(false)}
        title="Change password"
        subtitle="Set a new password for your Scrumfolks account"
        zIndex={1000}
        width={420}
        footer={
          <>
            <button type="button" onClick={() => setShowPassword(false)} className="sf-btn sf-btn-ghost">
              Cancel
            </button>
            <button type="submit" form="sf-change-password" disabled={pwSaving} className="sf-btn sf-btn-primary">
              {pwSaving ? 'Saving…' : 'Update password'}
            </button>
          </>
        }
      >
        <form id="sf-change-password" onSubmit={changePassword}>
          {pwError && <div style={{ color: 'var(--sf-danger)', fontSize: 13, marginBottom: 12 }}>{pwError}</div>}
          {pwNotice && <div style={{ color: 'var(--sf-success)', fontSize: 13, marginBottom: 12 }}>{pwNotice}</div>}
          <label className="sf-label">Current password</label>
          <input type="password" className="sf-input" required value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} style={{ marginBottom: 12 }} />
          <label className="sf-label">New password</label>
          <input type="password" className="sf-input" required minLength={8} value={pwForm.next} onChange={e => setPwForm({ ...pwForm, next: e.target.value })} style={{ marginBottom: 12 }} />
          <label className="sf-label">Confirm new password</label>
          <input type="password" className="sf-input" required minLength={8} value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} />
        </form>
      </Modal>
    </aside>
  )
}
