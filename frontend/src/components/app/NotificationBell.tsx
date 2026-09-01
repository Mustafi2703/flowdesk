'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon, NavIconBadge } from '@/components/app/Icons'
import {
  notificationAccent,
  notificationActionLabel,
  notificationIcon,
  notificationNavId,
  resolveNotificationLink,
} from '@/lib/notifications'
import type { IconName } from '@/components/app/Icons'

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
  if (type === 'announcement') return 'Announcement'
  return type || 'System'
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** Bell + top-right dropdown panel (not centered modal). */
export function NotificationBell() {
  const router = useRouter()
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<Notif | null>(null)
  const [panelPos, setPanelPos] = useState({ top: 56, right: 16 })
  const seenRef = useRef<Set<string>>(new Set())
  const primedRef = useRef(false)

  function updatePanelPos() {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPanelPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) })
  }

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
      const next =
        fresh.find((n) => n.type === 'chat') ||
        fresh.find((n) => n.type === 'review') ||
        fresh.find((n) => n.type === 'task') ||
        fresh[0]
      if (next) setToast(next)
    }
    setItems(list)
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 10000)
    updatePanelPos()
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return
    updatePanelPos()
    const onResize = () => updatePanelPos()
    window.addEventListener('resize', onResize)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 7000)
    return () => clearTimeout(t)
  }, [toast?.id])

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
    <div className="sf-notif-wrap">
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) setTimeout(updatePanelPos, 0) }}
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
        className={`sf-notif-bell${unreadCount > 0 ? ' sf-notif-bell-active' : ''}${open ? ' sf-notif-bell-open' : ''}`}
      >
        <Icon name="bell" size={18} />
        {unreadCount > 0 && (
          <span className="sf-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <>
          <div className="sf-notif-backdrop" aria-hidden onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className="sf-notif-panel"
            style={{ top: panelPos.top, right: panelPos.right }}
            role="dialog"
            aria-label="Notifications"
          >
            <div className="sf-notif-panel-head">
              <div>
                <div className="sf-notif-panel-title">Notifications</div>
                <div className="sf-notif-panel-sub">
                  {unreadCount ? `${unreadCount} unread` : 'All caught up'}
                </div>
              </div>
              <div className="sf-notif-panel-actions">
                {unreadCount > 0 && (
                  <button type="button" className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={markAllRead}>
                    Mark read
                  </button>
                )}
                <button type="button" className="sf-notif-panel-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
              </div>
            </div>
            <div className="sf-notif-panel-body">
              {items.length === 0 ? (
                <div className="sf-notif-empty">
                  <NavIconBadge name="bell" navId="overview" className="sf-notif-empty-icon" />
                  <div className="sf-notif-empty-title">Quiet for now</div>
                  <p>Task updates, reviews, and announcements appear here.</p>
                </div>
              ) : (
                items.map((n) => (
                  <NotifRow key={n.id} n={n} onOpen={() => openNotif(n)} />
                ))
              )}
            </div>
            <div className="sf-notif-panel-foot">
              <button type="button" className="sf-btn sf-btn-ghost" style={{ fontSize: 12 }} onClick={() => { setOpen(false); router.push('/updates') }}>
                Open Updates
              </button>
              <button type="button" className="sf-btn sf-btn-primary" style={{ fontSize: 12 }} onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {toast && !open && (
        <div
          className="sf-notif-toast"
          role="status"
          style={{ top: panelPos.top, right: panelPos.right, borderLeftColor: notificationAccent(toast.type) }}
        >
          <div className="sf-notif-toast-head">
            <NavIconBadge name={notificationIcon(toast.type)} navId={notificationNavId(toast.type)} />
            <span>New {typeLabel(toast.type)}</span>
            <button type="button" className="sf-notif-toast-close" onClick={() => setToast(null)} aria-label="Dismiss">×</button>
          </div>
          <p className="sf-notif-toast-msg">{toast.message}</p>
          <div className="sf-notif-toast-actions">
            <button type="button" className="sf-btn sf-btn-primary" style={{ fontSize: 12 }} onClick={() => openNotif(toast)}>
              {notificationActionLabel(toast.type)}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NotifRow({ n, onOpen }: { n: Notif; onOpen: () => void }) {
  const accent = notificationAccent(n.type)
  return (
    <button type="button" className={`sf-notif-panel-row${n.is_read ? '' : ' is-unread'}`} onClick={onOpen}>
      <div
        className="sf-notif-row-icon"
        style={{
          background: `color-mix(in srgb, ${accent} 14%, var(--sf-surface-2))`,
          border: `1px solid color-mix(in srgb, ${accent} 24%, var(--sf-border))`,
          color: accent,
        }}
      >
        <Icon name={notificationIcon(n.type)} size={15} />
      </div>
      <div className="sf-notif-row-body">
        <p className="sf-notif-row-msg">{n.message || 'Update'}</p>
        <div className="sf-notif-row-meta">
          {typeLabel(n.type)} · {n.created_at ? timeAgo(n.created_at) : ''}
        </div>
      </div>
    </button>
  )
}
