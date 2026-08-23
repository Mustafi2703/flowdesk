'use client'

import { useEffect, useState } from 'react'
import { clockOutWithConfirm, todayIST } from '@/lib/clock'
import { notifyAttendanceChanged } from '@/lib/attendance'

export function ClockBar() {
  const [clocked, setClocked] = useState(false)
  const [loginTime, setLoginTime] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const res = await fetch('/api/attendance')
    const logs = await res.json().catch(() => [])
    const day = todayIST()
    const todays = Array.isArray(logs) ? logs.find((x: any) => x.date === day) : null
    setLoginTime(todays?.login_time || null)
    setClocked(Boolean(todays?.login_time && !todays?.logout_time))
  }

  useEffect(() => { load() }, [])

  async function clockIn() {
    setBusy(true)
    const res = await fetch('/api/attendance/clockin', { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not clock in')
    }
    await load()
    notifyAttendanceChanged()
    setBusy(false)
  }

  async function clockOut() {
    setBusy(true)
    await clockOutWithConfirm()
    await load()
    notifyAttendanceChanged()
    setBusy(false)
  }

  return (
    <div className="sf-topbar-clock">
      <div className="sf-topbar-clock-copy">
        <div className={`sf-topbar-clock-status${clocked ? ' is-on' : ''}`}>
          {clocked ? 'Clocked in' : 'Not clocked in'}
        </div>
        <div className="sf-topbar-clock-detail">
          {loginTime ? `In ${loginTime}` : 'Clock in to start work'}
        </div>
      </div>
      <button
        type="button"
        onClick={clocked ? clockOut : clockIn}
        disabled={busy}
        className="sf-btn sf-btn-primary sf-topbar-clock-btn"
      >
        {busy ? '…' : clocked ? 'Clock out' : 'Clock in'}
      </button>
    </div>
  )
}
