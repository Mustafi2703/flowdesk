// @ts-nocheck
'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionUser } from '@/types'
import { PageShell } from '@/components/app/Section'
import { EmptyState } from '@/components/app/Icons'
import { clockOutWithConfirm, todayIST } from '@/lib/clock'
import { notifyAttendanceChanged } from '@/lib/attendance'
import { isPersonalDeskTask, isTaskAssignee } from '@/lib/tasks'
import { BrandBadge } from '@/components/app/BrandBadge'
import { StatusBadge } from '@/components/app/StatusBadge'

const ROLE_TAG: Record<string, string> = {
  owner: 'Agency HQ',
  manager: 'Your delivery desk',
  team: 'Your creative desk',
  hr: 'People desk',
  accountant: 'Billing desk',
  developer: 'Your build desk',
}

function formatUpdateTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function OverviewClient({ session }: { session: SessionUser }) {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [updates, setUpdates] = useState<any[]>([])
  const [todayLog, setTodayLog] = useState<any>(null)
  const [clocked, setClocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [nowTick, setNowTick] = useState(Date.now())
  const [attSummary, setAttSummary] = useState({ inNow: 0, total: 0 })
  const [opsOpen, setOpsOpen] = useState(false)
  const [emailBusy, setEmailBusy] = useState('')
  const [emailNotice, setEmailNotice] = useState('')
  const [driveStatus, setDriveStatus] = useState<any>(null)
  const [driveBusy, setDriveBusy] = useState(false)
  const today = todayIST()

  const isOwner = session.role === 'owner'
  const isManager = session.role === 'manager'
  const isAdmin = isOwner || isManager
  const personalOnly = !isOwner

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const loads: Promise<any>[] = [
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/updates').then((r) => r.json()).catch(() => []),
      fetch('/api/attendance').then((r) => r.json()).catch(() => []),
    ]
    if (isAdmin) {
      loads.push(fetch('/api/attendance?report=true&days=1').then((r) => r.json()).catch(() => []))
      loads.push(fetch('/api/users').then((r) => r.json()).catch(() => []))
    }
    Promise.all(loads).then((results) => {
      const [t, u, att] = results
      setTasks(Array.isArray(t) ? t : [])
      setUpdates(Array.isArray(u) ? u : [])
      const logs = Array.isArray(att) ? att : []
      const todays = logs.find((x: any) => x.date === today)
      setTodayLog(todays || null)
      setClocked(Boolean(todays?.login_time && !todays?.logout_time))
      if (isAdmin) {
        const report = Array.isArray(results[3]) ? results[3] : []
        const users = Array.isArray(results[4]) ? results[4] : []
        const activeUsers = users.filter((x: any) => x.is_active !== false && x.role !== 'owner')
        let inNow = 0
        for (const row of report) {
          if (row.date === today && row.login_time && !row.logout_time) inNow += 1
        }
        setAttSummary({ inNow, total: activeUsers.length || report.length })
      }
      setLoading(false)
    })
  }, [today, isAdmin])

  useEffect(() => {
    if (!isAdmin || !opsOpen) return
    fetch('/api/drive/status')
      .then((r) => r.json())
      .then(setDriveStatus)
      .catch(() => setDriveStatus(null))
  }, [isAdmin, opsOpen])

  async function connectDrive() {
    setDriveBusy(true)
    const res = await fetch('/api/drive/connect')
    const data = await res.json().catch(() => ({}))
    setDriveBusy(false)
    if (data.url) window.location.href = data.url
    else alert(data.error || data.detail || 'Drive is not configured on the backend')
  }

  async function disconnectDrive() {
    if (!window.confirm('Disconnect Google Drive? Existing task folder links stay on tasks.')) return
    setDriveBusy(true)
    await fetch('/api/drive/disconnect', { method: 'POST' })
    const status = await fetch('/api/drive/status').then((r) => r.json()).catch(() => null)
    setDriveStatus(status)
    setDriveBusy(false)
  }

  async function runEmailAction(kind: 'test' | 'morning-sample' | 'morning' | 'evening') {
    setEmailBusy(kind)
    setEmailNotice('')
    const path =
      kind === 'test' ? '/api/emails/test'
      : kind === 'morning-sample' ? '/api/emails/test-morning-sample'
      : kind === 'morning' ? '/api/emails/morning-digest'
      : '/api/emails/evening-digest'
    const res = await fetch(path, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setEmailBusy('')
    if (!res.ok || data.ok === false) setEmailNotice(data.error || data.detail || 'Could not send email')
    else setEmailNotice(kind === 'test' ? `Test sent to ${data.to || 'your inbox'}.` : `Sent (${data.sent ?? 0}).`)
  }

  const clockIn = () => fetch('/api/attendance/clockin', { method: 'POST' }).then(async (r) => {
    const log = await r.json().catch(() => null)
    if (log?.login_time) { setTodayLog(log); setClocked(true) }
    else setClocked(true)
    notifyAttendanceChanged()
  })
  const clockOut = () => clockOutWithConfirm().then((log) => {
    if (log) setTodayLog(log)
    if (log?.logout_time) setClocked(false)
    notifyAttendanceChanged()
  })

  function liveHoursToday(log: any) {
    if (!log?.login_time) return 0
    if (log.logout_time && log.hours_worked != null) return Number(log.hours_worked) || 0
    const [hh, mm] = String(log.login_time).split(':').map(Number)
    if (Number.isNaN(hh)) return 0
    const start = new Date()
    start.setHours(hh, mm || 0, 0, 0)
    return Math.max(0, (nowTick - start.getTime()) / 3600000)
  }

  const scopeTasks = useMemo(() => {
    if (!personalOnly) return tasks
    return tasks.filter((t) => isPersonalDeskTask(t, session.id, session.role))
  }, [tasks, personalOnly, session.id, session.role])

  const openTasks = useMemo(() => {
    return scopeTasks
      .filter((t) => t.status !== 'Completed')
      .sort((a, b) => {
        const rank = { Critical: 0, High: 1, P1: 0, P2: 1, Medium: 2, P3: 2, Low: 3, P4: 3 }
        const pa = rank[a.priority] ?? 4
        const pb = rank[b.priority] ?? 4
        if (pa !== pb) return pa - pb
        return (a.due_date || '9999').localeCompare(b.due_date || '9999')
      })
  }, [scopeTasks])

  const overdue = openTasks.filter((t) => t.due_date && t.due_date < today)
  const dueToday = openTasks.filter((t) => t.due_date === today)
  const inProgress = openTasks.filter((t) => t.status === 'In Progress')
  const underReview = openTasks.filter((t) => t.status === 'Under Review')
  const taskList = openTasks.slice(0, 12)

  const updateFeed = useMemo(() => {
    const byTask = new Map()
    for (const u of updates) {
      const prev = byTask.get(u.task_id)
      if (!prev || new Date(u.created_at) > new Date(prev.created_at)) byTask.set(u.task_id, u)
    }
    const rows = []
    for (const t of openTasks) {
      if (t.updates_closed) continue
      const last = byTask.get(t.id)
      rows.push({
        task: t,
        lastMessage: last?.message || null,
        lastAt: last?.created_at || t.updated_at || t.created_at,
        lastSender: last?.sender?.name || null,
      })
    }
    rows.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    return rows.slice(0, 10)
  }, [updates, openTasks])

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const firstName = (session.name || 'there').trim().split(/\s+/)[0] || 'there'
  const roleTag = ROLE_TAG[session.role] || 'Workspace'
  const todayInTime = todayLog?.login_time || null
  const hoursTodayLabel = todayInTime ? `${liveHoursToday(todayLog).toFixed(1)}h` : '0h'

  const metrics = [
    { label: 'Open', value: openTasks.length, href: '/tasks' },
    { label: 'In progress', value: inProgress.length, href: '/tasks' },
    { label: 'Due today', value: dueToday.length, href: '/calendar' },
    { label: 'Overdue', value: overdue.length, href: '/tasks' },
    { label: 'In review', value: underReview.length, href: isAdmin ? '/review' : '/tasks' },
  ]

  if (loading) {
    return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>
  }

  return (
    <PageShell>
      <div className={`sf-dash-clock-bar${clocked ? ' is-active' : ''}`}>
        <div className="sf-dash-clock-bar-left">
          <span className={`sf-dash-clock-pill${clocked ? ' is-on' : ''}`}>
            {clocked ? 'Clocked in' : 'Not clocked in'}
          </span>
          <span className="sf-dash-clock-stat">In <strong>{todayInTime || '—'}</strong></span>
          <span className="sf-dash-clock-stat">Today <strong>{hoursTodayLabel}</strong></span>
          {isAdmin && (
            <button type="button" className="sf-home-att-mini" onClick={() => router.push('/attendance')}>
              Team <strong>{attSummary.inNow}</strong>/{attSummary.total} in
            </button>
          )}
        </div>
        <button type="button" onClick={clocked ? clockOut : clockIn} className="sf-btn sf-btn-primary">
          {clocked ? 'Clock out' : 'Clock in'}
        </button>
      </div>

      <header className="sf-home-hero">
        <div>
          <h1 className="sf-home-title">Good {greet}, {firstName}</h1>
          <p className="sf-home-sub">{roleTag} · {dateStr}</p>
        </div>
        <div className="sf-home-hero-actions">
          <button type="button" className="sf-btn sf-btn-ghost" onClick={() => router.push('/tasks')}>
            Tasks
          </button>
          <button type="button" className="sf-btn sf-btn-primary" onClick={() => router.push('/updates')}>
            Updates
          </button>
        </div>
      </header>

      <div className="sf-home-metrics" role="list">
        {metrics.map((m) => (
          <button
            key={m.label}
            type="button"
            role="listitem"
            className="sf-home-metric"
            onClick={() => router.push(m.href)}
          >
            <span className="sf-home-metric-val">{m.value}</span>
            <span className="sf-home-metric-label">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="sf-home-split">
        <section className="sf-home-next" aria-label="Tasks">
          <div className="sf-home-next-head">
            <h2>{personalOnly ? 'Your tasks' : 'Tasks'}</h2>
            <button type="button" className="sf-link-btn" onClick={() => router.push('/tasks')}>
              All tasks →
            </button>
          </div>
          {taskList.length === 0 ? (
            <EmptyState icon="tasks" title={personalOnly ? 'Nothing on your desk right now.' : 'No open tasks.'} />
          ) : (
            <div className="sf-home-next-list">
              {taskList.map((t) => {
                const dl = t.due_date ? Math.ceil((new Date(t.due_date).getTime() - Date.now()) / 86400000) : null
                const late = dl !== null && dl < 0
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="sf-home-task"
                    onClick={() => router.push(`/tasks/${t.id}`)}
                  >
                    <div className="sf-home-task-main">
                      <div className="sf-home-task-title">{t.title}</div>
                      <div className="sf-home-task-meta">
                        <BrandBadge brand={t.brand} />
                        <span>{t.priority || 'Medium'}</span>
                        {isManager && isTaskAssignee(t, session.id) && (
                          <span className="sf-home-task-chip">Assigned to you</span>
                        )}
                      </div>
                    </div>
                    <div className="sf-home-task-side">
                      <StatusBadge status={t.status} />
                      {dl !== null && (
                        <span className={late ? 'sf-dash-task-late' : 'sf-dash-task-due'}>
                          {late ? `${Math.abs(dl)}d late` : dl === 0 ? 'Today' : `${dl}d`}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="sf-home-updates" aria-label="Updates">
          <div className="sf-home-next-head">
            <h2>Updates</h2>
            <button type="button" className="sf-link-btn" onClick={() => router.push('/updates')}>
              Open Updates →
            </button>
          </div>
          {updateFeed.length === 0 ? (
            <div className="sf-home-updates-empty">No active threads yet.</div>
          ) : (
            <div className="sf-home-updates-list">
              {updateFeed.map((row) => (
                <button
                  key={row.task.id}
                  type="button"
                  className="sf-home-update-row"
                  onClick={() => router.push(`/updates?task=${row.task.id}`)}
                >
                  <span className="sf-home-update-brand">{row.task.brand?.name || 'No brand'}</span>
                  <span className="sf-home-update-title">{row.task.title}</span>
                  <span className="sf-home-update-preview">
                    {row.lastMessage
                      ? `${row.lastSender || 'Someone'}: ${row.lastMessage}`
                      : 'No messages yet'}
                  </span>
                  <span className="sf-home-update-time">{formatUpdateTime(row.lastAt)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {isAdmin && (
        <div className="sf-home-ops-wrap">
          <button type="button" className="sf-link-btn" onClick={() => setOpsOpen((v) => !v)}>
            {opsOpen ? 'Hide email & Drive' : 'Email & Drive ops'}
          </button>
          {opsOpen && (
            <div className="sf-admin-desk sf-home-ops">
              <div className="sf-admin-desk-card">
                <div className="sf-admin-desk-head">
                  <div>
                    <h3 className="sf-admin-desk-title">Email dispatch</h3>
                    <p className="sf-admin-desk-sub">Morning and evening briefs</p>
                  </div>
                </div>
                <div className="sf-admin-desk-actions">
                  <button type="button" className="sf-btn sf-btn-ghost" disabled={!!emailBusy} onClick={() => runEmailAction('test')}>
                    {emailBusy === 'test' ? 'Sending…' : 'Test'}
                  </button>
                  <button type="button" className="sf-btn sf-btn-primary" disabled={!!emailBusy} onClick={() => runEmailAction('morning')}>
                    {emailBusy === 'morning' ? 'Sending…' : 'Morning brief'}
                  </button>
                  <button type="button" className="sf-btn sf-btn-ghost" disabled={!!emailBusy} onClick={() => runEmailAction('evening')}>
                    {emailBusy === 'evening' ? 'Sending…' : 'Evening brief'}
                  </button>
                </div>
                {emailNotice && <p className="sf-admin-desk-notice">{emailNotice}</p>}
              </div>
              <div className="sf-admin-desk-card">
                <div className="sf-admin-desk-head">
                  <div>
                    <h3 className="sf-admin-desk-title">Google Drive</h3>
                    <p className="sf-admin-desk-sub">
                      {!driveStatus ? 'Checking…' : driveStatus.connected ? `Connected as ${driveStatus.account_email || 'Google'}` : driveStatus.configured ? 'Not linked' : 'Not configured'}
                    </p>
                  </div>
                </div>
                {isOwner && driveStatus?.configured && !driveStatus?.connected && (
                  <button type="button" className="sf-btn sf-btn-primary" disabled={driveBusy} onClick={connectDrive}>
                    {driveBusy ? 'Redirecting…' : 'Connect Drive'}
                  </button>
                )}
                {isOwner && driveStatus?.connected && (
                  <button type="button" className="sf-btn sf-btn-ghost" disabled={driveBusy} onClick={disconnectDrive} style={{ color: 'var(--sf-danger)' }}>
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  )
}
