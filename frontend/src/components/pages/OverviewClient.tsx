// @ts-nocheck
'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionUser, STATUS_BG, STATUS_TEXT } from '@/types'
import { PageShell } from '@/components/app/Section'
import { EmptyState, DashTileIcon, NavIconBadge, type IconName } from '@/components/app/Icons'
import { clockOutWithConfirm, todayIST } from '@/lib/clock'
import { notifyAttendanceChanged } from '@/lib/attendance'
import { BrandBadge } from '@/components/app/BrandBadge'
import { StatusBadge } from '@/components/app/StatusBadge'

const ROLE_DASH: Record<string, { tag: string; blurb: string; icon: IconName; navId: string }> = {
  owner: { tag: 'Agency HQ', blurb: 'Delivery, people, and revenue at a glance.', icon: 'sparkles', navId: 'overview' },
  manager: { tag: 'Delivery lead', blurb: 'Keep campaigns moving and reviews flowing.', icon: 'performance', navId: 'tasks' },
  team: { tag: 'Creative desk', blurb: 'Your tasks, files, and Updates threads.', icon: 'tasks', navId: 'tasks' },
  hr: { tag: 'People pulse', blurb: 'Leave, attendance, and team health.', icon: 'team', navId: 'team' },
  accountant: { tag: 'Books & billing', blurb: 'Billable work and pending invoices.', icon: 'billing', navId: 'billing' },
}

const QUICK_TILES: { label: string; href: string; icon: IconName; navId: string }[] = [
  { label: 'Tasks', href: '/tasks', icon: 'tasks', navId: 'tasks' },
  { label: 'Updates', href: '/updates', icon: 'inbox', navId: 'updates' },
  { label: 'Calendar', href: '/calendar', icon: 'calendar', navId: 'calendar' },
  { label: 'Brands', href: '/brands', icon: 'brands', navId: 'brands' },
]

function Chip({ status }: { status: string }) {
  return <span style={{ background: STATUS_BG[status]||'#F3F4F6', color: STATUS_TEXT[status]||'#374151', fontSize:10, fontWeight:700, padding:'3px 7px', borderRadius:5, whiteSpace:'nowrap' }}>{status}</span>
}

function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--sf-text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--sf-text)', fontWeight: 650 }}>{value} · {pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--sf-surface-2)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
    </div>
  )
}

export default function OverviewClient({ session }: { session: SessionUser }) {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
  const [updates, setUpdates] = useState<any[]>([])
  const [todayLog, setTodayLog] = useState<any>(null)
  const [clocked, setClocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [nowTick, setNowTick] = useState(Date.now())
  const [emailBusy, setEmailBusy] = useState('')
  const [emailNotice, setEmailNotice] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [driveStatus, setDriveStatus] = useState<any>(null)
  const [driveBusy, setDriveBusy] = useState(false)
  const today = todayIST()

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/announcements').then(r => r.json()),
      fetch('/api/leave').then(r => r.json()),
      fetch('/api/updates').then(r => r.json()).catch(() => []),
      fetch('/api/attendance').then(r => r.json()).catch(() => []),
    ]).then(([t, a, l, u, att]) => {
      const taskList = Array.isArray(t) ? t : []
      setTasks(taskList)
      setAnnouncements(Array.isArray(a) ? a : [])
      setLeaves(Array.isArray(l) ? l : [])
      setUpdates(Array.isArray(u) ? u : [])
      const logs = Array.isArray(att) ? att : []
      const todays = logs.find((x: any) => x.date === today)
      setTodayLog(todays || null)
      setClocked(Boolean(todays?.login_time && !todays?.logout_time))
      const open = taskList.filter((x: any) => x.status !== 'Completed')
      if (open.length > 0) setSelectedTaskId(String(open[0].id))
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!['owner', 'manager'].includes(session.role)) return
    fetch('/api/drive/status')
      .then(r => r.json())
      .then(setDriveStatus)
      .catch(() => setDriveStatus(null))
  }, [session.role])

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
    const status = await fetch('/api/drive/status').then(r => r.json()).catch(() => null)
    setDriveStatus(status)
    setDriveBusy(false)
  }

  async function runEmailAction(kind: 'test' | 'morning' | 'morning-sample' | 'evening') {
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
    else if (kind === 'test') setEmailNotice(`Test sent to ${data.to}`)
    else if (kind === 'morning-sample') setEmailNotice(`Morning sample sent to ${data.to}`)
    else if (kind === 'morning') setEmailNotice(`Morning brief sent for ${data.sent} users${data.test_recipients?.length ? ` → ${data.test_recipients.join(', ')}` : ''}`)
    else setEmailNotice(`Evening brief sent for ${data.sent} users`)
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

  const todayInTime = todayLog?.login_time || null
  const hoursTodayLabel = todayInTime ? `${liveHoursToday(todayLog).toFixed(1)}h` : '0h'

  const myTasks = tasks.filter(t => t.assigned_to?.includes(session.id))
  const scopeTasks = session.role === 'team' ? myTasks : tasks
  const overdue = scopeTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'Completed')
  const dueToday = scopeTasks.filter(t => t.due_date === today && t.status !== 'Completed')
  const underReview = scopeTasks.filter(t => t.status === 'Under Review' || t.requires_review)
  const pendingLeav = leaves.filter(l => l.status === 'Pending')
  const isTeam = session.role === 'team'
  const isAdmin = ['owner', 'manager'].includes(session.role)

  const openTasks = scopeTasks.filter(t => t.status !== 'Completed').sort((a, b) => {
    const rank = { Critical: 0, High: 1, Medium: 2, Low: 3 }
    const pa = rank[a.priority] ?? 4
    const pb = rank[b.priority] ?? 4
    if (pa !== pb) return pa - pb
    return (a.due_date || '9999').localeCompare(b.due_date || '9999')
  })

  const selectedTask = openTasks.find(t => String(t.id) === String(selectedTaskId)) || openTasks[0] || null

  const statusBreakdown = useMemo(() => {
    const keys = ['Not Started', 'In Progress', 'Under Review', 'Revision Needed', 'Completed']
    const counts: Record<string, number> = {}
    for (const k of keys) counts[k] = 0
    for (const t of scopeTasks) counts[t.status] = (counts[t.status] || 0) + 1
    return keys.map((k) => ({ label: k, value: counts[k] || 0 })).filter((r) => r.value > 0)
  }, [scopeTasks])

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })
  const roleDash = ROLE_DASH[session.role] || ROLE_DASH.team
  const openCount = openTasks.length

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>

  return (
    <PageShell>
      {/* Horizontal clock bar */}
      <div className={`sf-dash-clock-bar${clocked ? ' is-active' : ''}`}>
        <div className="sf-dash-clock-bar-left">
          <span className={`sf-dash-clock-pill${clocked ? ' is-on' : ''}`}>
            {clocked ? 'Active session' : 'Clock in required for task work'}
          </span>
          <span className="sf-dash-clock-stat">In <strong>{todayInTime || '—'}</strong></span>
          <span className="sf-dash-clock-stat">Today <strong>{hoursTodayLabel}</strong></span>
          {overdue.length > 0 && <span className="sf-dash-clock-alert">{overdue.length} overdue</span>}
          {dueToday.length > 0 && <span className="sf-dash-clock-warn">{dueToday.length} due today</span>}
        </div>
        <button type="button" onClick={clocked ? clockOut : clockIn} className="sf-btn sf-btn-primary">
          {clocked ? 'Clock out' : 'Clock in'}
        </button>
      </div>

      {/* Hero */}
      <div className="sf-dash-hero sf-dash-hero--compact">
        <div className="sf-dash-hero-inner">
          <div>
            <NavIconBadge name={roleDash.icon} navId={roleDash.navId} className="sf-dash-hero-icon" />
            <div className="sf-dash-hero-title">Good {greet}, {session.name.split(' ')[0]}</div>
            <p className="sf-dash-hero-sub">{roleDash.blurb}</p>
            <span className="sf-dash-role-pill">{roleDash.tag} · {dateStr}</span>
          </div>
          <div className="sf-dash-hero-stats-row">
            <div className="sf-dash-hero-stat"><span>{openCount}</span><label>Open</label></div>
            <div className="sf-dash-hero-stat"><span>{dueToday.length}</span><label>Due today</label></div>
            <div className="sf-dash-hero-stat"><span>{overdue.length}</span><label>Overdue</label></div>
            {isAdmin && <div className="sf-dash-hero-stat"><span>{underReview.length}</span><label>Review</label></div>}
            {isAdmin && <div className="sf-dash-hero-stat"><span>{pendingLeav.length}</span><label>Leave pending</label></div>}
          </div>
        </div>
      </div>

      {/* Quick nav */}
      <div className="sf-dash-quicknav">
        {[
          ...QUICK_TILES,
          ...(isAdmin ? [{ label: 'Review', href: '/review', icon: 'review' as IconName, navId: 'review' }] : []),
          ...(isAdmin || session.role === 'hr' ? [{ label: 'Leave', href: '/leave', icon: 'leave' as IconName, navId: 'leave' }] : []),
          ...(session.role === 'accountant' ? [{ label: 'Billing', href: '/billing', icon: 'billing' as IconName, navId: 'billing' }] : []),
        ].map((tile) => (
          <button key={tile.href} type="button" className="sf-dash-quicknav-btn" onClick={() => router.push(tile.href)}>
            <DashTileIcon name={tile.icon} navId={tile.navId} />
            <span>{tile.label}</span>
          </button>
        ))}
      </div>

      {/* Main workspace: tasks + detail + activity */}
      <div className="sf-dash-workspace">
        <div className="sf-dash-panel">
          <div className="sf-dash-panel-head">
            <h3>Your tasks</h3>
            <button type="button" className="sf-link-btn" onClick={() => router.push('/tasks')}>Board →</button>
          </div>
          <div className="sf-dash-panel-scroll">
            {openTasks.length === 0 ? (
              <EmptyState icon="tasks" title="No open tasks." />
            ) : openTasks.map((t) => {
              const dl = t.due_date ? Math.ceil((new Date(t.due_date).getTime() - Date.now()) / 86400000) : null
              const late = dl !== null && dl < 0
              const active = selectedTask && String(selectedTask.id) === String(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`sf-dash-task-row${active ? ' is-selected' : ''}`}
                  onClick={() => setSelectedTaskId(String(t.id))}
                >
                  <div className="sf-dash-task-row-main">
                    <div className="sf-dash-task-title">{t.title}</div>
                    <div className="sf-dash-task-meta">
                      <BrandBadge brand={t.brand} />
                      <span>{t.priority || 'Medium'}</span>
                    </div>
                  </div>
                  <div className="sf-dash-task-row-side">
                    <Chip status={t.status} />
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
        </div>

        <div className="sf-dash-panel sf-dash-panel--center">
          <div className="sf-dash-panel-head">
            <h3>Focus</h3>
            {selectedTask && (
              <button type="button" className="sf-btn sf-btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => router.push(`/tasks/${selectedTask.id}`)}>
                Open task
              </button>
            )}
          </div>
          <div className="sf-dash-panel-scroll">
            {!selectedTask ? (
              <div className="sf-dash-focus-empty">Select a task from the list to preview it here.</div>
            ) : (
              <div className="sf-dash-focus-card">
                <h4>{selectedTask.title}</h4>
                <div className="sf-dash-focus-tags">
                  <BrandBadge brand={selectedTask.brand} />
                  <StatusBadge status={selectedTask.status} />
                  {selectedTask.requires_review && <span className="sf-dash-focus-tag">Review</span>}
                </div>
                <p className="sf-dash-focus-desc">{selectedTask.description || 'No description yet.'}</p>
                <div className="sf-dash-focus-grid">
                  <div><label>Type</label><span>{selectedTask.type || '—'}</span></div>
                  <div><label>Priority</label><span>{selectedTask.priority || 'Medium'}</span></div>
                  <div><label>Due</label><span>{selectedTask.due_date || '—'}</span></div>
                  <div><label>Brand</label><span>{selectedTask.brand?.name || '—'}</span></div>
                </div>
                <div className="sf-dash-focus-actions">
                  <button type="button" className="sf-btn sf-btn-primary" onClick={() => router.push(`/tasks/${selectedTask.id}`)}>Work on task</button>
                  <button type="button" className="sf-btn sf-btn-ghost" onClick={() => router.push(`/updates?task=${selectedTask.id}`)}>Updates thread</button>
                </div>
                {statusBreakdown.length > 0 && (
                  <div className="sf-dash-focus-status">
                    <div className="sf-dash-panel-head" style={{ padding: 0, marginBottom: 10 }}>
                      <h3 style={{ fontSize: 13 }}>Pipeline</h3>
                    </div>
                    {statusBreakdown.map((row) => (
                      <BarRow key={row.label} label={row.label} value={row.value} total={scopeTasks.length} color={STATUS_TEXT[row.label] || 'var(--sf-accent)'} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="sf-dash-panel">
          <div className="sf-dash-panel-head">
            <h3>Activity</h3>
            <button type="button" className="sf-link-btn" onClick={() => router.push('/updates')}>Updates →</button>
          </div>
          <div className="sf-dash-panel-scroll">
            {updates.length === 0 && announcements.length === 0 ? (
              <div className="sf-dash-focus-empty">No recent activity yet.</div>
            ) : (
              <>
                {updates.slice(0, 8).map((u: any) => (
                  <button
                    key={u.id}
                    type="button"
                    className="sf-dash-activity-row"
                    onClick={() => router.push(u.task_id ? `/updates?task=${u.task_id}` : '/updates')}
                  >
                    <NavIconBadge name="inbox" navId="updates" className="sf-dash-activity-icon" />
                    <div>
                      <div className="sf-dash-activity-title">{u.sender?.name || 'Someone'} · {u.task_title}</div>
                      <div className="sf-dash-activity-msg">{u.message}</div>
                    </div>
                  </button>
                ))}
                {announcements.slice(0, 4).map((a: any) => (
                  <div key={a.id} className="sf-dash-announce-row">
                    <NavIconBadge name="announcements" navId="announcements" className="sf-dash-activity-icon" />
                    <div>
                      <div className="sf-dash-activity-title">{a.title}</div>
                      <div className="sf-dash-activity-msg">{new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="sf-admin-desk">
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
                    {session.role === 'owner' && (
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
                  {session.role === 'owner' && (
                    <button type="button" className="sf-btn sf-btn-primary" disabled={driveBusy} onClick={connectDrive}>
                      {driveBusy ? 'Redirecting…' : 'Connect Google Drive'}
                    </button>
                  )}
                </>
              ) : (
                <p className="sf-admin-desk-copy">
                  Drive is not set up on the server yet. Use task file uploads (R2/Postgres) in the meantime.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
