'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SessionUser, NAV_ITEMS, ROLE_COLORS, ROLE_LABELS } from '@/types'
import { ThemeToggle } from '@/components/app/ThemeProvider'
import { Icon } from '@/components/app/Icons'
import { Modal } from '@/components/app/Modal'

export default function Sidebar({ session }: { session: SessionUser }) {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwNotice, setPwNotice] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

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
            background: 'linear-gradient(135deg, var(--sf-accent), var(--sf-accent-hover))',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            color: '#fff',
            fontSize: 15,
            flexShrink: 0,
            fontFamily: "'Space Grotesk', sans-serif",
            boxShadow: '0 8px 18px rgba(234, 88, 12, 0.35)',
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

      <div style={{ padding: collapsed ? '0 0.25rem' : '0 0.375rem', marginBottom: '1rem' }}>
        <ThemeToggle compact />
      </div>

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
              <span className="sf-icon"><Icon name={item.icon} size={16} /></span>
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
        <button className="sf-nav" onClick={() => { setShowPassword(true); setPwError(''); setPwNotice('') }} style={{ marginBottom: 2 }}>
          <span className="sf-icon"><Icon name="key" size={16} /></span>
          {!collapsed && 'Change Password'}
        </button>
        <button className="sf-nav" onClick={() => setCollapsed(c => !c)} style={{ marginBottom: 2 }}>
          <span className="sf-icon"><Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={16} /></span>
          {!collapsed && 'Collapse'}
        </button>
        <button className="sf-nav" onClick={logout}>
          <span className="sf-icon"><Icon name="log-out" size={16} /></span>
          {!collapsed && 'Sign Out'}
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
