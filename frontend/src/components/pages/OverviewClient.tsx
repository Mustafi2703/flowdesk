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

function deskHealth(open: number, overdue: number, dueToday: number) {
  if (open === 0) return { label: 'Clear desk', tone: 'good', hint: 'Nothing open right now.' }
  if (overdue >= 3) return { label: 'Needs attention', tone: 'bad', hint: `${overdue} overdue — clear the oldest first.` }
  if (overdue > 0) return { label: 'At risk', tone: 'warn', hint: `${overdue} overdue · ${dueToday} due today.` }
  if (dueToday > 0) return { label: 'On track', tone: 'good', hint: `${dueToday} due today — keep momentum.` }
  return { label: 'Healthy', tone: 'good', hint: `${open} open · none overdue.` }
}

export default function OverviewClient({ session }: { session: SessionUser }) {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
  const [todayLog, setTodayLog] = useState<any>(null)
  const [clocked, setClocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [nowTick, setNowTick] = useState(Date.now())
  const [emailBusy, setEmailBusy] = useState('')
  const [emailNotice, setEmailNotice] = useState('')
  const [driveStatus, setDriveStatus] = useState<any>(null)
  const [driveBusy, setDriveBusy] = useState(false)
  const [teamAtt, setTeamAtt] = useState<any[]>([])
  const [teamUsers, setTeamUsers] = useState<any[]>([])
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
      fetch('/api/leave').then((r) => r.json()).catch(() => []),
      fetch('/api/attendance').then((r) => r.json()).catch(() => []),
    ]
    if (isAdmin) {
      loads.push(fetch('/api/attendance?report=true&days=1').then((r) => r.json()).catch(() => []))
      loads.push(fetch('/api/users').then((r) => r.json()).catch(() => []))
    }
    Promise.all(loads).then((results) => {
      const [t, l, att] = results
      setTasks(Array.isArray(t) ? t : [])
      setLeaves(Array.isArray(l) ? l : [])
      const logs = Array.isArray(att) ? att : []
      const todays = logs.find((x: any) => x.date === today)
      setTodayLog(todays || null)
      setClocked(Boolean(todays?.login_time && !todays?.logout_time))
      if (isAdmin) {
        setTeamAtt(Array.isArray(results[3]) ? results[3] : [])
        setTeamUsers(Array.isArray(results[4]) ? results[4] : [])
      }
      setLoading(false)
    })
  }, [today, isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/drive/status')
      .then((r) => r.json())
      .then(setDriveStatus)
      .catch(() => setDriveStatus(null))
  }, [isAdmin])

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

  const mineAssigned = openTasks.filter((t) => isTaskAssignee(t, session.id))
  const overdue = openTasks.filter((t) => t.due_date && t.due_date < today)
  const dueToday = openTasks.filter((t) => t.due_date === today)
  const inProgress = openTasks.filter((t) => t.status === 'In Progress')
  const underReview = openTasks.filter((t) => t.status === 'Under Review' || t.requires_review)
  const onTrack = Math.max(0, openTasks.length - overdue.length)
  const pendingLeave = leaves.filter((l) => l.status === 'Pending')
  const upNext = openTasks.slice(0, 10)
  const health = deskHealth(openTasks.length, overdue.length, dueToday.length)

  const clientChips = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of openTasks) {
      const name = t.brand?.name || 'No brand'
      map.set(name, (map.get(name) || 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 10)
  }, [openTasks])

  const threadChips = useMemo(() => {
    return openTasks.slice(0, 8).map((t) => ({
      id: t.id,
      title: t.title,
      brand: t.brand?.name || 'No brand',
    }))
  }, [openTasks])

  const teamToday = useMemo(() => {
    if (!isAdmin) return []
    const byUser: Record<string, any> = {}
    for (const u of teamUsers.filter((x: any) => x.is_active !== false && x.role !== 'owner')) {
      byUser[u.id] = { user: u, log: null as any }
    }
    for (const row of teamAtt) {
      if (row.date !== today) continue
      const uid = row.user_id
      if (!byUser[uid]) {
        byUser[uid] = {
          user: row.user || { id: uid, name: 'Unknown', role: '' },
          log: row,
        }
      } else {
        byUser[uid].log = row
      }
    }
    return Object.values(byUser).sort((a: any, b: any) => {
      const rank = (row: any) => {
        if (row.log?.login_time && !row.log?.logout_time) return 0
        if (row.log?.login_time) return 1
        return 2
      }
      const d = rank(a) - rank(b)
      if (d !== 0) return d
      return (a.user.name || '').localeCompare(b.user.name || '')
    })
  }, [isAdmin, teamUsers, teamAtt, today])

  const attSummary = useMemo(() => {
    let inNow = 0
    let done = 0
    let out = 0
    for (const row of teamToday) {
      if (row.log?.login_time && !row.log?.logout_time) inNow += 1
      else if (row.log?.login_time) done += 1
      else out += 1
    }
    return { inNow, done, out, total: teamToday.length }
  }, [teamToday])

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const firstName = (session.name || 'there').trim().split(/\s+/)[0] || 'there'
  const roleTag = ROLE_TAG[session.role] || 'Workspace'
  const todayInTime = todayLog?.login_time || null
  const hoursTodayLabel = todayInTime ? `${liveHoursToday(todayLog).toFixed(1)}h` : '0h'

  const deskBlurb = isOwner
    ? 'Agency-wide open work'
    : isManager
      ? 'Only tasks assigned to you or your delivery desk'
      : 'Only tasks assigned to you'

  const metrics = [
    {
      label: personalOnly ? 'My open' : 'Open',
      value: openTasks.length,
      href: '/tasks',
    },
    ...(isManager
      ? [{ label: 'Assigned to me', value: mineAssigned.length, href: '/tasks' }]
      : []),
    { label: 'Due today', value: dueToday.length, href: '/calendar' },
    { label: 'Overdue', value: overdue.length, href: '/tasks' },
    ...(isAdmin || session.role === 'team' || session.role === 'developer'
      ? [{ label: 'In review', value: underReview.length, href: isAdmin ? '/review' : '/tasks' }]
      : []),
    ...(isAdmin || session.role === 'hr'
      ? [{ label: 'Leave', value: pendingLeave.length, href: '/leave' }]
      : []),
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
        </div>
        <button type="button" onClick={clocked ? clockOut : clockIn} className="sf-btn sf-btn-primary">
          {clocked ? 'Clock out' : 'Clock in'}
        </button>
      </div>

      <header className="sf-home-hero">
        <div>
          <h1 className="sf-home-title">Good {greet}, {firstName}</h1>
          <p className="sf-home-sub">{roleTag} · {dateStr}</p>
          <p className="sf-home-blurb">{deskBlurb}</p>
        </div>
        <div className="sf-home-hero-actions">
          <button type="button" className="sf-btn sf-btn-ghost" onClick={() => router.push('/updates')}>
            Updates
          </button>
          <button type="button" className="sf-btn sf-btn-ghost" onClick={() => router.push('/calendar')}>
            Calendar
          </button>
          <button type="button" className="sf-btn sf-btn-primary" onClick={() => router.push('/tasks')}>
            Open tasks
          </button>
        </div>
      </header>

      <section className="sf-home-quick" aria-label="Clients and task threads">
        <div className="sf-home-quick-block">
          <div className="sf-home-quick-label">Clients</div>
          <div className="sf-home-quick-chips">
            {clientChips.length === 0 ? (
              <span className="sf-home-quick-empty">No brands on open tasks</span>
            ) : (
              clientChips.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className="sf-home-chip"
                  onClick={() => router.push(`/updates?brand=${encodeURIComponent(c.name)}`)}
                  title={`${c.count} open · open Updates for ${c.name}`}
                >
                  <span className="sf-home-chip-name">{c.name}</span>
                  <span className="sf-home-chip-count">{c.count}</span>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="sf-home-quick-block">
          <div className="sf-home-quick-label">Task threads</div>
          <div className="sf-home-quick-chips">
            {threadChips.length === 0 ? (
              <span className="sf-home-quick-empty">No open threads</span>
            ) : (
              threadChips.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="sf-home-chip is-task"
                  onClick={() => router.push(`/updates?task=${t.id}`)}
                  title={`Open Updates for ${t.title}`}
                >
                  <span className="sf-home-chip-brand">{t.brand}</span>
                  <span className="sf-home-chip-name">{t.title}</span>
                </button>
              ))
            )}
            <button type="button" className="sf-home-chip is-link" onClick={() => router.push('/updates')}>
              All Updates →
            </button>
          </div>
        </div>
      </section>

      <section className={`sf-home-health is-${health.tone}`} aria-label="Desk health">
        <div className="sf-home-health-main">
          <span className="sf-home-health-badge">{health.label}</span>
          <p className="sf-home-health-hint">{health.hint}</p>
        </div>
        <div className="sf-home-health-stats">
          <button type="button" className="sf-home-health-stat" onClick={() => router.push('/tasks')}>
            <strong>{onTrack}</strong>
            <span>On track</span>
          </button>
          <button type="button" className="sf-home-health-stat" onClick={() => router.push('/calendar')}>
            <strong>{dueToday.length}</strong>
            <span>Due today</span>
          </button>
          <button type="button" className="sf-home-health-stat" onClick={() => router.push('/tasks')}>
            <strong>{overdue.length}</strong>
            <span>Overdue</span>
          </button>
          <button type="button" className="sf-home-health-stat" onClick={() => router.push('/tasks')}>
            <strong>{inProgress.length}</strong>
            <span>In progress</span>
          </button>
        </div>
        <button type="button" className="sf-link-btn" onClick={() => router.push('/performance')}>
          Performance →
        </button>
      </section>

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

      {isAdmin && (
        <section className="sf-home-att" aria-label="Team attendance">
          <div className="sf-home-next-head">
            <h2>Team today</h2>
            <button type="button" className="sf-link-btn" onClick={() => router.push('/attendance')}>
              Full attendance →
            </button>
          </div>
          <div className="sf-home-att-summary">
            <span><strong>{attSummary.inNow}</strong> in now</span>
            <span><strong>{attSummary.done}</strong> finished</span>
            <span><strong>{attSummary.out}</strong> not in</span>
          </div>
          {teamToday.length === 0 ? (
            <div className="sf-home-att-empty">No team members to show.</div>
          ) : (
            <div className="sf-home-att-list">
              {teamToday.slice(0, 12).map((row: any) => {
                const active = row.log?.login_time && !row.log?.logout_time
                const finished = Boolean(row.log?.logout_time)
                const status = active ? 'In' : finished ? 'Out' : 'Away'
                return (
                  <button
                    key={row.user.id}
                    type="button"
                    className="sf-home-att-row"
                    onClick={() => router.push('/attendance')}
                  >
                    <span className="sf-home-att-name">{row.user.name}</span>
                    <span className="sf-home-att-role">{row.user.role || row.user.designation || ''}</span>
                    <span className={`sf-home-att-pill is-${status.toLowerCase()}`}>{status}</span>
                    <span className="sf-home-att-time">
                      {row.log?.login_time
                        ? `${row.log.login_time}${row.log.logout_time ? `–${row.log.logout_time}` : ''}`
                        : '—'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      <section className="sf-home-next" aria-label="Up next">
        <div className="sf-home-next-head">
          <h2>{personalOnly ? 'Your tasks' : 'Up next'}</h2>
          <button type="button" className="sf-link-btn" onClick={() => router.push('/tasks')}>
            All tasks →
          </button>
        </div>

        {upNext.length === 0 ? (
          <EmptyState
            icon="tasks"
            title={personalOnly ? 'Nothing on your desk right now.' : 'No open tasks.'}
          />
        ) : (
          <div className="sf-home-next-list">
            {upNext.map((t) => {
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

      {isAdmin && (
        <div className="sf-admin-desk sf-home-ops">
          <div className="sf-admin-desk-card">
            <div className="sf-admin-desk-head">
              <div>
                <div className="sf-page-eyebrow">Operations</div>
                <h3 className="sf-admin-desk-title">Email dispatch</h3>
                <p className="sf-admin-desk-sub">Morning and evening briefs for the team</p>
              </div>
              <span className="sf-admin-badge sf-admin-badge-brand">SMTP</span>
            </div>
            <div className="sf-admin-desk-actions">
              <button type="button" className="sf-btn sf-btn-ghost" disabled={!!emailBusy} onClick={() => runEmailAction('test')}>
                {emailBusy === 'test' ? 'Sending…' : 'Test connection'}
              </button>
              <button type="button" className="sf-btn sf-btn-ghost" disabled={!!emailBusy} onClick={() => runEmailAction('morning-sample')}>
                {emailBusy === 'morning-sample' ? 'Sending…' : 'Preview brief'}
              </button>
              <button type="button" className="sf-btn sf-btn-primary" disabled={!!emailBusy} onClick={() => runEmailAction('morning')}>
                {emailBusy === 'morning' ? 'Sending…' : 'Send morning brief'}
              </button>
              <button type="button" className="sf-btn sf-btn-ghost" disabled={!!emailBusy} onClick={() => runEmailAction('evening')}>
                {emailBusy === 'evening' ? 'Sending…' : 'Send evening brief'}
              </button>
            </div>
            {emailNotice && (
              <p className={`sf-admin-desk-notice${emailNotice.includes('fail') || emailNotice.includes('Could') ? ' is-error' : ''}`}>
                {emailNotice}
              </p>
            )}
          </div>

          <div className="sf-admin-desk-card">
            <div className="sf-admin-desk-head">
              <div>
                <div className="sf-page-eyebrow">Integrations</div>
                <h3 className="sf-admin-desk-title">Google Drive</h3>
                <p className="sf-admin-desk-sub">Per-task folders in your workspace</p>
              </div>
              <span className={`sf-admin-badge${driveStatus?.connected ? ' sf-admin-badge-ok' : ' sf-admin-badge-warn'}`}>
                {!driveStatus ? '…' : driveStatus.connected ? 'Connected' : driveStatus.configured ? 'Not linked' : 'Not configured'}
              </span>
            </div>
            <div className="sf-admin-desk-body">
              {!driveStatus ? (
                <p className="sf-admin-desk-copy">Checking connection…</p>
              ) : driveStatus.connected ? (
                <>
                  <p className="sf-admin-desk-copy">
                    Signed in as <strong>{driveStatus.account_email || 'Google account'}</strong>.
                    Create folders from any task&apos;s Files tab.
                  </p>
                  <div className="sf-admin-desk-actions">
                    {driveStatus.root_folder_url && (
                      <a href={driveStatus.root_folder_url} target="_blank" rel="noreferrer" className="sf-btn sf-btn-ghost" style={{ textDecoration: 'none' }}>
                        Open root folder
                      </a>
                    )}
                    {isOwner && (
                      <button type="button" className="sf-btn sf-btn-ghost" disabled={driveBusy} onClick={disconnectDrive} style={{ color: 'var(--sf-danger)' }}>
                        Disconnect
                      </button>
                    )}
                  </div>
                </>
              ) : driveStatus.configured ? (
                <>
                  <p className="sf-admin-desk-copy">
                    Drive is ready to connect. In-app file uploads continue to work without it.
                  </p>
                  {isOwner && (
                    <button type="button" className="sf-btn sf-btn-primary" disabled={driveBusy} onClick={connectDrive}>
                      {driveBusy ? 'Redirecting…' : 'Connect Google Drive'}
                    </button>
                  )}
                </>
              ) : (
                <p className="sf-admin-desk-copy">
                  Drive is not set up on the server yet. Use task file uploads in the meantime.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
