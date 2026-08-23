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
  if (type === 'task') return 'View task'
  if (type === 'leave') return 'Open leave'
  if (type === 'announcement') return 'Read announcement'
  return 'Open'
}

export function notificationEmoji(type?: string | null): string {
  if (type === 'chat') return '💬'
  if (type === 'task') return '📋'
  if (type === 'leave') return '🏖️'
  if (type === 'announcement') return '📣'
  return '✨'
}

export function notificationAccent(type?: string | null): string {
  if (type === 'chat') return 'var(--sf-info)'
  if (type === 'task') return 'var(--sf-accent)'
  if (type === 'leave') return '#a855f7'
  if (type === 'announcement') return 'var(--sf-warning)'
  return 'var(--sf-muted)'
}
