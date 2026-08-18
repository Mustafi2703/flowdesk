'use client'

import { useEffect, useState } from 'react'
import { clockOutWithConfirm } from '@/lib/clock'

export function ClockBar() {
  const [clocked, setClocked] = useState(false)
  const [loginTime, setLoginTime] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  async function load() {
    const res = await fetch('/api/attendance')
    const logs = await res.json().catch(() => [])
    const todays = Array.isArray(logs) ? logs.find((x: any) => x.date === today) : null
    setLoginTime(todays?.login_time || null)
    setClocked(Boolean(todays?.login_time && !todays?.logout_time))
  }

  useEffect(() => { load() }, [])

  async function clockIn() {
    setBusy(true)
    await fetch('/api/attendance/clockin', { method: 'POST' })
    await load()
    setBusy(false)
  }

  async function clockOut() {
    setBusy(true)
    await clockOutWithConfirm()
    await load()
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 12 }}>
      <div style={{ textAlign: 'right' }}>
        <div style={{ color: clocked ? '#10B981' : 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {clocked ? 'Clocked in' : 'Not clocked in'}
        </div>
        <div style={{ color: 'var(--sf-text)', fontSize: 12, fontWeight: 600 }}>
          {loginTime ? `In ${loginTime}` : 'Clock in to start work'}
        </div>
      </div>
      <button
        type="button"
        onClick={clocked ? clockOut : clockIn}
        disabled={busy}
        className="sf-btn sf-btn-primary"
        style={{ fontSize: 12, padding: '6px 12px' }}
      >
        {busy ? '…' : clocked ? 'Clock out' : 'Clock in'}
      </button>
    </div>
  )
}
