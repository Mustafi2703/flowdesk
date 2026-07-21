'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/app/Icons'
import { resolveNotificationLink } from '@/lib/notifications'

type Notif = {
  id: string
  message: string | null
  type: string
  is_read: boolean
  link?: string | null
  created_at: string
}

/**
 * Top-right notification prompt: bell, dropdown panel, toast.
 */
export function NotificationBell() {
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

  async function markAllRead() {
    const unread = items.filter((n) => !n.is_read)
    await Promise.all(unread.map((n) => fetch(`/api/notifications/${n.id}/read`, { method: 'POST' })))
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  function openNotif(n: Notif) {
    if (!n.is_read) markRead(n.id)
    setOpen(false)
    setToast(null)
    router.push(resolveNotificationLink(n.link, n.type))
  }

  const unreadCount = items.filter((n) => !n.is_read).length

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          borderRadius: 10,
          border: '1px solid var(--sf-border)',
          background: open ? 'rgba(232,99,10,0.12)' : 'var(--sf-surface)',
          color: 'var(--sf-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--sf-shadow)',
        }}
      >
        <Icon name="bell" size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -5,
              right: -5,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: 'var(--sf-accent)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              border: '2px solid var(--sf-bg)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 360,
            maxWidth: 'min(360px, calc(100vw - 24px))',
            maxHeight: 440,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--sf-surface)',
            border: '1px solid var(--sf-border)',
            borderRadius: 14,
            boxShadow: '0 18px 50px rgba(0,0,0,0.32)',
            zIndex: 200,
          }}
        >
          <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--sf-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            background: 'var(--sf-surface-2)',
          }}>
            <div>
              <div style={{ color: 'var(--sf-text)', fontWeight: 750, fontSize: 14, fontFamily: "'Space Grotesk',sans-serif" }}>
                Notifications
              </div>
              <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginTop: 2 }}>
                {unreadCount ? `${unreadCount} unread` : 'You are caught up'}
              </div>
            </div>
            {unreadCount > 0 && (
              <button type="button" className="sf-link-btn" style={{ fontSize: 11 }} onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {items.length === 0 ? (
              <div style={{ padding: 20, color: 'var(--sf-muted)', fontSize: 13, textAlign: 'center' }}>
                No notifications yet — task updates will show here.
              </div>
            ) : (
              items.slice(0, 30).map((n) => (
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
                    padding: '12px 14px',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    marginTop: 5,
                    flexShrink: 0,
                    background: n.is_read ? 'var(--sf-border)' : 'var(--sf-accent)',
                  }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: 'var(--sf-text)', fontSize: 13, fontWeight: n.is_read ? 500 : 650, lineHeight: 1.4 }}>
                      {n.message || 'Update'}
                    </div>
                    <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginTop: 4 }}>
                      {n.type === 'chat' ? 'Updates' : (n.type || 'system')} ·{' '}
                      {n.created_at
                        ? new Date(n.created_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </div>
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
            top: 72,
            width: 360,
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
          <div style={{ color: 'var(--sf-accent)', fontSize: 11, marginTop: 8, fontWeight: 600 }}>Open →</div>
        </div>
      )}
    </div>
  )
}
