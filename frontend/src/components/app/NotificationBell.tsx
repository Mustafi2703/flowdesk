'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon, NavIconBadge } from '@/components/app/Icons'
import { Modal } from '@/components/app/Modal'
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

/**
 * Bell + notification modal + bottom-right toast for new items.
 */
export function NotificationBell() {
  const router = useRouter()
  const [items, setItems] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<Notif | null>(null)
  const seenRef = useRef<Set<string>>(new Set())
  const primedRef = useRef(false)

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
    const t = setTimeout(() => setToast(null), 8000)
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
  const grouped = {
    chat: items.filter((n) => n.type === 'chat'),
    task: items.filter((n) => n.type === 'task'),
    other: items.filter((n) => n.type !== 'chat' && n.type !== 'task'),
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Notifications"
        aria-label="Notifications"
        className={`sf-notif-bell${unreadCount > 0 ? ' sf-notif-bell-active' : ''}`}
      >
        <Icon name="bell" size={18} />
        {unreadCount > 0 && (
          <span className="sf-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Notifications"
        subtitle={unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'You are all caught up'}
        size="wide"
        zIndex={1300}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="sf-btn sf-btn-ghost" onClick={() => { setOpen(false); router.push('/updates') }}>
              Open Updates
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              {unreadCount > 0 && (
                <button type="button" className="sf-btn sf-btn-ghost" onClick={markAllRead}>Mark all read</button>
              )}
              <button type="button" className="sf-btn sf-btn-primary" onClick={() => setOpen(false)}>Done</button>
            </div>
          </div>
        }
      >
        {items.length === 0 ? (
          <div className="sf-notif-empty">
            <NavIconBadge name="bell" navId="overview" className="sf-notif-empty-icon" />
            <div className="sf-notif-empty-title">Quiet for now</div>
            <p>Task chats, reviews, and leave updates will appear here with one-click links.</p>
          </div>
        ) : (
          <div className="sf-notif-feed">
            {grouped.chat.length > 0 && (
              <NotifGroup title="Updates & chat" icon="inbox" navId="updates" count={grouped.chat.filter((n) => !n.is_read).length}>
                {grouped.chat.map((n) => (
                  <NotifRow key={n.id} n={n} onOpen={() => openNotif(n)} />
                ))}
              </NotifGroup>
            )}
            {grouped.task.length > 0 && (
              <NotifGroup title="Tasks & reviews" icon="tasks" navId="tasks" count={grouped.task.filter((n) => !n.is_read).length}>
                {grouped.task.map((n) => (
                  <NotifRow key={n.id} n={n} onOpen={() => openNotif(n)} />
                ))}
              </NotifGroup>
            )}
            {grouped.other.length > 0 && (
              <NotifGroup title="Everything else" icon="bell" navId="overview" count={grouped.other.filter((n) => !n.is_read).length}>
                {grouped.other.map((n) => (
                  <NotifRow key={n.id} n={n} onOpen={() => openNotif(n)} />
                ))}
              </NotifGroup>
            )}
          </div>
        )}
      </Modal>

      {toast && !open && (
        <div className="sf-notif-toast" role="status" style={{ borderLeftColor: notificationAccent(toast.type) }}>
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
            <button type="button" className="sf-btn sf-btn-ghost" style={{ fontSize: 12 }} onClick={() => setToast(null)}>
              Later
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function NotifGroup({
  title,
  icon,
  navId,
  count,
  children,
}: {
  title: string
  icon: IconName
  navId: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="sf-notif-group">
      <div className="sf-notif-group-head">
        <span className="sf-notif-group-title">
          <NavIconBadge name={icon} navId={navId} size={14} className="sf-notif-group-icon" />
          {title}
        </span>
        {count > 0 && <span className="sf-notif-group-count">{count} new</span>}
      </div>
      {children}
    </section>
  )
}

function NotifRow({ n, onOpen }: { n: Notif; onOpen: () => void }) {
  const accent = notificationAccent(n.type)
  return (
    <article className={`sf-notif-row${n.is_read ? '' : ' sf-notif-row-unread'}`}>
      <div
        className="sf-notif-row-icon"
        style={{
          background: `color-mix(in srgb, ${accent} 14%, var(--sf-surface-2))`,
          border: `1px solid color-mix(in srgb, ${accent} 24%, var(--sf-border))`,
          color: accent,
        }}
      >
        <Icon name={notificationIcon(n.type)} size={16} />
      </div>
      <div className="sf-notif-row-body">
        <p className="sf-notif-row-msg">{n.message || 'Update'}</p>
        <div className="sf-notif-row-meta">
          {typeLabel(n.type)} · {n.created_at ? timeAgo(n.created_at) : ''}
        </div>
        <button type="button" className="sf-notif-row-link" onClick={onOpen}>
          {notificationActionLabel(n.type)} →
        </button>
      </div>
    </article>
  )
}
