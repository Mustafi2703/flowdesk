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

function typeLabel(type: string) {
  if (type === 'chat') return 'Updates'
  if (type === 'task') return 'Task'
  if (type === 'review') return 'Review'
  if (type === 'leave') return 'Leave'
  return type || 'System'
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
          width: 42,
          height: 42,
          borderRadius: 999,
          border: '1px solid var(--sf-border)',
          background: open ? 'var(--sf-accent-soft)' : 'var(--sf-surface)',
          color: open ? 'var(--sf-accent)' : 'var(--sf-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--sf-shadow)',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        <Icon name="bell" size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: 'linear-gradient(135deg, var(--sf-accent), var(--sf-accent-hover))',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              border: '2px solid var(--sf-bg)',
              boxShadow: '0 4px 10px rgba(234, 88, 12, 0.4)',
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
            top: 'calc(100% + 10px)',
            width: 380,
            maxWidth: 'min(380px, calc(100vw - 24px))',
            maxHeight: 480,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: 'color-mix(in srgb, var(--sf-surface) 96%, transparent)',
            border: '1px solid var(--sf-border)',
            borderRadius: 18,
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(14px)',
            zIndex: 200,
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--sf-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              background: 'linear-gradient(180deg, var(--sf-accent-soft), transparent)',
            }}
          >
            <div>
              <div
                style={{
                  color: 'var(--sf-text)',
                  fontWeight: 750,
                  fontSize: 15,
                  fontFamily: "'Space Grotesk',sans-serif",
                }}
              >
                Notifications
              </div>
              <div style={{ color: 'var(--sf-muted)', fontSize: 12, marginTop: 2 }}>
                {unreadCount ? `${unreadCount} unread` : 'You are caught up'}
              </div>
            </div>
            {unreadCount > 0 && (
              <button type="button" className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '6px 12px' }} onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {items.length === 0 ? (
              <div style={{ padding: 28, color: 'var(--sf-muted)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
                No notifications yet.
                <br />
                Task chats and reviews will appear here.
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
                    background: n.is_read ? 'transparent' : 'var(--sf-accent-soft)',
                    padding: '13px 16px',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: n.is_read ? 'var(--sf-surface-2)' : 'var(--sf-accent)',
                      color: n.is_read ? 'var(--sf-muted)' : '#fff',
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {typeLabel(n.type).slice(0, 1).toUpperCase()}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        color: 'var(--sf-text)',
                        fontSize: 13,
                        fontWeight: n.is_read ? 500 : 650,
                        lineHeight: 1.4,
                      }}
                    >
                      {n.message || 'Update'}
                    </div>
                    <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginTop: 5 }}>
                      {typeLabel(n.type)} ·{' '}
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
                  {!n.is_read && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        marginTop: 6,
                        flexShrink: 0,
                        background: 'var(--sf-accent)',
                      }}
                    />
                  )}
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
            width: 380,
            maxWidth: 'calc(100vw - 40px)',
            background: 'color-mix(in srgb, var(--sf-surface) 96%, transparent)',
            border: '1px solid var(--sf-border)',
            borderLeft: '3px solid var(--sf-accent)',
            borderRadius: 14,
            padding: '14px 16px',
            boxShadow: '0 20px 56px rgba(0,0,0,0.42)',
            backdropFilter: 'blur(12px)',
            zIndex: 1200,
            cursor: 'pointer',
          }}
          onClick={() => openNotif(toast)}
        >
          <div
            style={{
              color: 'var(--sf-accent)',
              fontSize: 10,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 5,
            }}
          >
            New · {typeLabel(toast.type)}
          </div>
          <div style={{ color: 'var(--sf-text)', fontSize: 13.5, fontWeight: 650, lineHeight: 1.45 }}>
            {toast.message}
          </div>
          <div style={{ color: 'var(--sf-accent)', fontSize: 12, marginTop: 10, fontWeight: 650 }}>
            Open conversation →
          </div>
        </div>
      )}
    </div>
  )
}
