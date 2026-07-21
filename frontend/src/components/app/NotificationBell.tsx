'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/app/Icons'

type Notif = {
  id: string
  message: string | null
  type: string
  is_read: boolean
  link?: string | null
  created_at: string
}

/**
 * Global notification prompt: badge + dropdown + toast when new Updates arrive.
 */
export function NotificationBell({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter()
  const [items, setItems] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<Notif | null>(null)
  const seenRef = useRef<Set<string>>(new Set())
  const primedRef = useRef(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  async function load() {
    const res = await fetch('/api/notifications')
    const data = await res.json().catch(() => [])
    if (!Array.isArray(data)) return
    const list = data as Notif[]
    if (!primedRef.current) {
      for (const n of list) seenRef.current.add(n.id)
      primedRef.current = true
    } else {
      const fresh = list.filter((n) => !n.is_read && !seenRef.current.has(n.id))
      for (const n of fresh) seenRef.current.add(n.id)
      const chat = fresh.find((n) => n.type === 'chat') || fresh[0]
      if (chat) setToast(chat)
    }
    setItems(list)
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 10000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast?.id])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }

  function openNotif(n: Notif) {
    if (!n.is_read) markRead(n.id)
    setOpen(false)
    setToast(null)
    router.push(n.link || '/updates')
  }

  const unread = items.filter((n) => !n.is_read)
  const unreadCount = unread.length

  return (
    <div ref={panelRef} style={{ position: 'relative', marginBottom: collapsed ? 8 : '1rem', padding: collapsed ? '0 0.25rem' : '0 0.375rem' }}>
      <button
        type="button"
        className="sf-nav"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        style={{ width: '100%', position: 'relative' }}
      >
        <span className="sf-icon" style={{ position: 'relative' }}>
          <Icon name="bell" size={16} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -6,
                minWidth: 14,
                height: 14,
                padding: '0 3px',
                borderRadius: 999,
                background: 'var(--sf-accent)',
                color: '#fff',
                fontSize: 9,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
        {!collapsed && <span>Notifications</span>}
        {!collapsed && unreadCount > 0 && (
          <span style={{ marginLeft: 'auto', color: 'var(--sf-accent)', fontSize: 11, fontWeight: 700 }}>{unreadCount}</span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            left: collapsed ? '100%' : 0,
            top: collapsed ? 0 : '100%',
            marginLeft: collapsed ? 8 : 0,
            marginTop: collapsed ? 0 : 6,
            width: 320,
            maxWidth: 'min(320px, calc(100vw - 24px))',
            maxHeight: 380,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--sf-surface)',
            border: '1px solid var(--sf-border)',
            borderRadius: 12,
            boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
            zIndex: 80,
          }}
        >
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--sf-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--sf-text)', fontWeight: 700, fontSize: 13 }}>Notifications</span>
            <button type="button" className="sf-link-btn" style={{ fontSize: 11 }} onClick={() => { setOpen(false); router.push('/overview') }}>
              Dashboard
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {items.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--sf-muted)', fontSize: 12 }}>No notifications yet.</div>
            ) : (
              items.slice(0, 25).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNotif(n)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    borderBottom: '1px solid var(--sf-border)',
                    background: n.is_read ? 'transparent' : 'rgba(232,99,10,0.08)',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  <div style={{ color: 'var(--sf-text)', fontSize: 12, fontWeight: n.is_read ? 500 : 650, lineHeight: 1.4 }}>
                    {n.message || 'Update'}
                  </div>
                  <div style={{ color: 'var(--sf-muted)', fontSize: 10, marginTop: 3 }}>
                    {n.type === 'chat' ? 'Updates' : n.type} · {n.created_at ? new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            width: 340,
            maxWidth: 'calc(100vw - 40px)',
            background: 'var(--sf-surface)',
            border: '1px solid var(--sf-border)',
            borderLeft: '3px solid var(--sf-accent)',
            borderRadius: 12,
            padding: '12px 14px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
            zIndex: 1200,
            cursor: 'pointer',
          }}
          onClick={() => openNotif(toast)}
        >
          <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            New update
          </div>
          <div style={{ color: 'var(--sf-text)', fontSize: 13, fontWeight: 650, lineHeight: 1.4 }}>{toast.message}</div>
          <div style={{ color: 'var(--sf-accent)', fontSize: 11, marginTop: 8, fontWeight: 600 }}>Open channel →</div>
        </div>
      )}
    </div>
  )
}
