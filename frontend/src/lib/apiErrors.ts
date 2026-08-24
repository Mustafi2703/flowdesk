/** Turn FastAPI / proxy error payloads into a safe string for UI display. */
export function formatApiError(data: unknown, fallback = 'Something went wrong'): string {
  if (!data || typeof data !== 'object') return fallback
  const row = data as Record<string, unknown>

  if (typeof row.error === 'string' && row.error.trim()) return row.error
  if (typeof row.message === 'string' && row.message.trim()) return row.message

  const detail = row.detail
  if (typeof detail === 'string' && detail.trim()) return detail

  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          const d = item as { msg?: string; loc?: unknown[] }
          const field = Array.isArray(d.loc)
            ? d.loc.filter((x) => x !== 'body' && x !== 'query').join('.')
            : ''
          const msg = d.msg || 'Invalid value'
          return field ? `${field}: ${msg}` : msg
        }
        return null
      })
      .filter(Boolean)
    if (parts.length) return parts.join(' · ')
  }

  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const msg = (detail as { msg?: string }).msg
    if (msg) return msg
  }

  return fallback
}
