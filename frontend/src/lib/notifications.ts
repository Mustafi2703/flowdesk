import type { IconName } from '@/components/app/Icons'

/** Map stored notification links to real app routes (avoids 404 on /tasks/:id). */
export function resolveNotificationLink(link?: string | null, type?: string | null): string {
  const raw = (link || '').trim()
  if (!raw) {
    if (type === 'chat') return '/updates'
    if (type === 'task') return '/tasks'
    return '/overview'
  }

  // /tasks/<uuid> → Updates channel (chat) or Tasks board (assignment)
  const taskMatch = raw.match(/^\/tasks\/([0-9a-fA-F-]{36})\/?$/)
  if (taskMatch) {
    const id = taskMatch[1]
    if (type === 'chat') return `/updates?task=${id}`
    return `/tasks/${id}`
  }

  // Already valid app paths
  if (raw.startsWith('/updates') || raw.startsWith('/tasks') || raw.startsWith('/brands')
    || raw.startsWith('/leave') || raw.startsWith('/announcements') || raw.startsWith('/overview')
    || raw.startsWith('/review') || raw.startsWith('/billing') || raw.startsWith('/team')
    || raw.startsWith('/calendar') || raw.startsWith('/attendance') || raw.startsWith('/performance')
    || raw.startsWith('/devboard')) {
    return raw
  }

  if (raw === '/login') return '/overview'
  return '/overview'
}

export function notificationActionLabel(type?: string | null): string {
  if (type === 'chat') return 'Open in Updates'
  if (type === 'review') return 'Open in Updates'
  if (type === 'task') return 'Open in Updates'
  if (type === 'leave') return 'Open leave'
  if (type === 'announcement') return 'Read announcement'
  return 'Open'
}

export function notificationIcon(type?: string | null): IconName {
  if (type === 'chat') return 'inbox'
  if (type === 'task') return 'tasks'
  if (type === 'leave') return 'leave'
  if (type === 'announcement') return 'announcements'
  if (type === 'review') return 'review'
  return 'bell'
}

export function notificationNavId(type?: string | null): string {
  if (type === 'chat') return 'updates'
  if (type === 'task') return 'tasks'
  if (type === 'leave') return 'leave'
  if (type === 'announcement') return 'announcements'
  if (type === 'review') return 'review'
  return 'overview'
}

export function notificationAccent(type?: string | null): string {
  if (type === 'chat') return '#0891b2'
  if (type === 'task') return '#ea580c'
  if (type === 'leave') return '#9333ea'
  if (type === 'announcement') return '#d97706'
  if (type === 'review') return '#7c3aed'
  return 'var(--sf-muted)'
}
