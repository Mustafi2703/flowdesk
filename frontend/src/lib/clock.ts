export async function clockOutWithConfirm(): Promise<any | null> {
  const res = await fetch('/api/attendance/clockout', { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  if (res.status === 409 && data.needs_confirm) {
    const hours = data.hours_worked != null ? Number(data.hours_worked).toFixed(1) : '?'
    const ok = window.confirm(`You have worked ${hours} hours (less than 9). Do you want to leave early?`)
    if (!ok) return null
    const confirmed = await fetch('/api/attendance/clockout?confirm_early=true', { method: 'POST' })
    return confirmed.json().catch(() => ({}))
  }
  if (!res.ok) {
    alert(data.error || data.detail || 'Could not clock out')
    return null
  }
  return data
}
