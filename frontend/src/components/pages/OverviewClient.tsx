// @ts-nocheck
'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionUser } from '@/types'
import { PageShell } from '@/components/app/Section'
import { EmptyState } from '@/components/app/Icons'
import { clockOutWithConfirm, todayIST } from '@/lib/clock'
import { notifyAttendanceChanged } from '@/lib/attendance'
import { isTaskAssignee } from '@/lib/tasks'
import { BrandBadge } from '@/components/app/BrandBadge'
import { StatusBadge } from '@/components/app/StatusBadge'

const ROLE_TAG: Record<string, string> = {
  owner: 'Agency HQ',
  manager: 'Delivery lead',
  team: 'Creative desk',
  hr: 'People',
  accountant: 'Billing',
  developer: 'Build desk',
}

export default function OverviewClient({ session }: { session: SessionUser }) {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
  const [todayLog, setTodayLog] = useState<any>(null)
  const [clocked, setClocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [nowTick, setNowTick] = useState(Date.now())
  const today = todayIST()

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/leave').then((r) => r.json()).catch(() => []),
      fetch('/api/attendance').then((r) => r.json()).catch(() => []),
    ]).then(([t, l, att]) => {
      setTasks(Array.isArray(t) ? t : [])
      setLeaves(Array.isArray(l) ? l : [])
      const logs = Array.isArray(att) ? att : []
      const todays = logs.find((x: any) => x.date === today)
      setTodayLog(todays || null)
      setClocked(Boolean(todays?.login_time && !todays?.logout_time))
      setLoading(false)
    })
  }, [today])

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

  const personalDesk = session.role === 'team' || session.role === 'developer'
  const isAdmin = ['owner', 'manager'].includes(session.role)
  const scopeTasks = personalDesk ? tasks.filter((t) => isTaskAssignee(t, session.id)) : tasks

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
  const underReview = openTasks.filter((t) => t.status === 'Under Review' || t.requires_review)
  const pendingLeave = leaves.filter((l) => l.status === 'Pending')
  const upNext = openTasks.slice(0, 8)

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const firstName = (session.name || 'there').trim().split(/\s+/)[0] || 'there'
  const roleTag = ROLE_TAG[session.role] || 'Workspace'
  const todayInTime = todayLog?.login_time || null
  const hoursTodayLabel = todayInTime ? `${liveHoursToday(todayLog).toFixed(1)}h` : '0h'

  const metrics = [
    { label: 'Open', value: openTasks.length, href: '/tasks' },
    { label: 'Due today', value: dueToday.length, href: '/tasks' },
    { label: 'Overdue', value: overdue.length, href: '/tasks' },
    ...(isAdmin || personalDesk
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
        </div>
        <button type="button" className="sf-btn sf-btn-primary" onClick={() => router.push('/tasks')}>
          Open tasks
        </button>
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

      <section className="sf-home-next" aria-label="Up next">
        <div className="sf-home-next-head">
          <h2>Up next</h2>
          <button type="button" className="sf-link-btn" onClick={() => router.push('/tasks')}>
            All tasks →
          </button>
        </div>

        {upNext.length === 0 ? (
          <EmptyState icon="tasks" title={personalDesk ? 'Nothing assigned to you right now.' : 'No open tasks.'} />
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
    </PageShell>
  )
}
