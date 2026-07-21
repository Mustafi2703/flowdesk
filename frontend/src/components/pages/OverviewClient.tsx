// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionUser, STATUS_BG, STATUS_TEXT } from '@/types'
import { PageHeader, PageShell, Section, StatCard, StatGrid } from '@/components/app/Section'
import { EmptyState } from '@/components/app/Icons'
import { resolveNotificationLink } from '@/lib/notifications'

function Chip({ status }: { status: string }) {
  return <span style={{ background: STATUS_BG[status]||'#F3F4F6', color: STATUS_TEXT[status]||'#374151', fontSize:10, fontWeight:700, padding:'3px 7px', borderRadius:5, whiteSpace:'nowrap' }}>{status}</span>
}

export default function OverviewClient({ session }: { session: SessionUser }) {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
  const [updates, setUpdates] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [todayLog, setTodayLog] = useState<any>(null)
  const [clocked, setClocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [nowTick, setNowTick] = useState(Date.now())
  const today = new Date().toISOString().split('T')[0]

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
      fetch('/api/notifications').then(r => r.json()).catch(() => []),
    ]).then(([t, a, l, u, att, n]) => {
      setTasks(Array.isArray(t) ? t : [])
      setAnnouncements(Array.isArray(a) ? a : [])
      setLeaves(Array.isArray(l) ? l : [])
      setUpdates(Array.isArray(u) ? u : [])
      setNotifications(Array.isArray(n) ? n : [])
      const logs = Array.isArray(att) ? att : []
      const todays = logs.find((x: any) => x.date === today)
      setTodayLog(todays || null)
      setClocked(Boolean(todays?.login_time && !todays?.logout_time))
      setLoading(false)
    })
  }, [])

  async function markRead(id: string) {
    const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
    if (!res.ok) return
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.is_read)
    await Promise.all(unread.map((n) => fetch(`/api/notifications/${n.id}/read`, { method: 'POST' })))
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const clockIn  = () => fetch('/api/attendance/clockin',  { method:'POST' }).then(async (r) => {
    const log = await r.json().catch(() => null)
    if (log?.login_time) { setTodayLog(log); setClocked(true) }
    else setClocked(true)
  })
  const clockOut = () => fetch('/api/attendance/clockout', { method:'POST' }).then(async (r) => {
    const log = await r.json().catch(() => null)
    if (log) setTodayLog(log)
    setClocked(false)
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
  const hoursTodayVal = liveHoursToday(todayLog)
  const hoursTodayLabel = todayInTime ? `${hoursTodayVal.toFixed(1)}h` : '0h'

  const myTasks     = tasks.filter(t => t.assigned_to?.includes(session.id))
  const overdue     = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'Completed')
  const dueToday    = tasks.filter(t => t.due_date === today && t.status !== 'Completed')
  const flagged     = tasks.filter(t => ['Struggling','Needs Attention'].includes(t.status))
  const underReview = tasks.filter(t => t.status === 'Under Review' || t.requires_review)
  const pendingLeav = leaves.filter(l => l.status === 'Pending')
  const unreadNotifs = notifications.filter(n => !n.is_read)
  const isTeam      = session.role === 'team'
  const isAdmin     = ['owner','manager'].includes(session.role)

  const myCompleted = myTasks.filter(t => t.status === 'Completed')
  const myDelayed = myTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'Completed')
  const myOnTime = myCompleted.filter(t => {
    if (!t.due_date) return true
    return (t.updated_at || '').slice(0, 10) <= t.due_date
  }).length
  const myOnTimePct = myCompleted.length ? Math.round((myOnTime / myCompleted.length) * 100) : 0

  const important = (isTeam ? myTasks : tasks)
    .filter(t => t.status !== 'Completed')
    .sort((a, b) => {
      const rank = { Critical: 0, High: 1, Medium: 2, Low: 3 }
      const pa = rank[a.priority] ?? 4
      const pb = rank[b.priority] ?? 4
      if (pa !== pb) return pa - pb
      return (a.due_date || '9999').localeCompare(b.due_date || '9999')
    })
    .slice(0, 12)

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })

  if (loading) return <div style={{ color:'var(--sf-muted)', padding:40, textAlign:'center' }}>Loading…</div>

  return (
    <PageShell fill>
      <PageHeader
        title={`Good ${greet}, ${session.name.split(' ')[0]}`}
        subtitle={dateStr}
      />

      {isTeam && (
        <Section title="Attendance" subtitle={clocked ? 'You are clocked in' : 'Not clocked in today'} flush>
          <div style={{ padding:'1rem 1.125rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
            <div>
              <div style={{ color: clocked ? 'var(--sf-success)' : 'var(--sf-muted)', fontSize:13, fontWeight:600, marginBottom: 6 }}>
                {clocked ? 'Active work session' : 'Ready to start your day?'}
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>In time</div>
                  <div style={{ color: 'var(--sf-text)', fontSize: 16, fontWeight: 700 }}>{todayInTime || '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hours today</div>
                  <div style={{ color: '#10B981', fontSize: 16, fontWeight: 700 }}>{hoursTodayLabel}</div>
                </div>
              </div>
            </div>
            <button onClick={clocked?clockOut:clockIn} className="sf-btn sf-btn-primary" style={{ padding:'0.625rem 1.25rem' }}>
              {clocked ? 'Clock out' : 'Clock in'}
            </button>
          </div>
        </Section>
      )}

      <StatGrid>
        <StatCard label="Notifications" value={unreadNotifs.length} sub={`${notifications.length} total`} accent="#E8630A" />
        {isAdmin && <>
          <StatCard label="Total Tasks" value={tasks.length} sub={`${tasks.filter(t=>t.status==='Completed').length} completed`} accent="#3B82F6" />
          <StatCard label="Overdue" value={overdue.length} accent="#EF4444" />
          <StatCard label="Due today" value={dueToday.length} accent="#F59E0B" />
          <StatCard label="Under review" value={underReview.length} accent="#8B5CF6" />
          <StatCard label="Flagged" value={flagged.length} accent="#EF4444" />
          <StatCard label="Leave Pending" value={pendingLeav.length} accent="#8B5CF6" />
        </>}
        {isTeam && <>
          <StatCard label="Allocated" value={myTasks.length} sub={`${myCompleted.length} completed`} accent="#E8630A" />
          <StatCard label="Delayed" value={myDelayed.length} accent="#EF4444" />
          <StatCard label="On-time %" value={`${myOnTimePct}%`} accent="#10B981" />
          <StatCard label="In Progress" value={myTasks.filter(t=>t.status==='In Progress').length} accent="#3B82F6" />
        </>}
        {session.role === 'hr' && <>
          <StatCard label="Leave Pending" value={pendingLeav.length} accent="#8B5CF6" />
          <StatCard label="Overdue tasks" value={overdue.length} accent="#EF4444" />
        </>}
        {session.role === 'accountant' && <>
          <StatCard label="Billable Tasks" value={tasks.filter(t=>t.is_billable).length} accent="#EC4899" />
          <StatCard label="Pending Billing" value={tasks.filter(t=>t.is_billable&&!t.billed_at).length} accent="#F59E0B" />
        </>}
      </StatGrid>
      {session.role === 'accountant' && (
        <div style={{ marginBottom: '0.5rem', flexShrink: 0 }}>
          <button type="button" className="sf-link-btn" onClick={() => router.push('/billing')}>Open Billing module →</button>
        </div>
      )}

      <Section
        title="Your notifications"
        subtitle={unreadNotifs.length ? `${unreadNotifs.length} unread for you` : 'You are caught up'}
        action={unreadNotifs.length > 0 ? (
          <button type="button" className="sf-link-btn" onClick={markAllRead}>Mark all read</button>
        ) : undefined}
        flush
      >
        {notifications.length === 0 ? (
          <div style={{ padding: '1rem 1.125rem', color: 'var(--sf-muted)', fontSize: 13 }}>No notifications yet — assignments and reviews will show here.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 280, overflowY: 'auto' }}>
            {notifications.slice(0, 20).map((n: any) => (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.is_read) markRead(n.id)
                  router.push(resolveNotificationLink(n.link, n.type))
                }}
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid var(--sf-border)',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  background: n.is_read ? 'transparent' : 'rgba(232,99,10,0.06)',
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                  background: n.is_read ? 'var(--sf-border)' : 'var(--sf-accent)',
                }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: 'var(--sf-text)', fontSize: 13, fontWeight: n.is_read ? 500 : 650, lineHeight: 1.4 }}>
                    {n.message || 'Update'}
                  </div>
                  <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginTop: 3 }}>
                    {n.type === 'chat' ? 'Updates' : (n.type || 'system')} · {n.created_at ? new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    {n.link ? ' · Open →' : ''}
                  </div>
                </div>
                {!n.is_read && (
                  <button
                    type="button"
                    className="sf-btn sf-btn-ghost"
                    style={{ fontSize: 10, padding: '4px 8px', flexShrink: 0 }}
                    onClick={(e) => { e.stopPropagation(); markRead(n.id) }}
                  >
                    Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="sf-page-grid-2" style={{ flex: 1 }}>
        <Section
          title="Important tasks"
          subtitle={`${important.length} priority items`}
          flex={1}
          action={<button type="button" className="sf-link-btn" onClick={() => router.push('/tasks')}>View all</button>}
          flush
        >
          {important.length === 0 ? (
            <EmptyState icon="tasks" title="No open tasks." />
          ) : (
            <div style={{ display:'flex', flexDirection:'column' }}>
              {important.map((t:any) => {
                const dl = t.due_date ? Math.ceil((new Date(t.due_date).getTime()-Date.now())/86400000) : null
                const late = dl!==null && dl<0 && t.status!=='Completed'
                return (
                  <div
                    key={t.id}
                    onClick={() => router.push('/tasks')}
                    style={{ padding:'0.875rem 1rem', borderBottom:'1px solid var(--sf-border)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, cursor:'pointer' }}
                  >
                    <div style={{ minWidth:0 }}>
                      <div style={{ color:'var(--sf-text)', fontWeight:600, fontSize:13, marginBottom:2 }}>{t.title}</div>
                      <div style={{ color:'var(--sf-muted)', fontSize:11 }}>
                        {t.brand?.name||'No brand'} · {t.type||'Task'} · {t.priority || 'Medium'}
                        {t.requires_review ? ' · Review' : ''}
                        {(t.assigned_to||[]).length ? ` · ${t.assigned_to.length} assignee(s)` : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                      <Chip status={t.status} />
                      {dl!==null && <span style={{ color:late?'var(--sf-danger)':'var(--sf-muted)', fontSize:11 }}>{late?`${Math.abs(dl)}d overdue`:dl===0?'Today':`${dl}d`}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        <div style={{ display:'flex', flexDirection:'column', gap:'1rem', minHeight:0 }}>
          <Section
            title="Recent updates"
            flex={1}
            action={<button type="button" className="sf-link-btn" onClick={() => router.push('/updates')}>Open Updates</button>}
          >
            {updates.length === 0 ? (
              <p style={{ color:'var(--sf-muted)', fontSize:13 }}>No comments yet.</p>
            ) : updates.slice(0,6).map((u:any) => (
              <div key={u.id} onClick={() => router.push('/updates')} style={{ background:'var(--sf-surface-2)', border:'1px solid var(--sf-border)', borderRadius:8, padding:'0.75rem 0.875rem', marginBottom:8, cursor:'pointer' }}>
                <div style={{ color:'var(--sf-text)', fontWeight:600, fontSize:12, marginBottom:2 }}>{u.sender?.name || 'Someone'} on {u.task_title}</div>
                <div style={{ color:'var(--sf-muted)', fontSize:12, lineHeight:1.4 }}>{u.message}</div>
              </div>
            ))}
          </Section>

          <Section
            title="Announcements"
            action={<button type="button" className="sf-link-btn" onClick={() => router.push('/announcements')}>View all</button>}
          >
            {announcements.length === 0 ? (
              <p style={{ color:'var(--sf-muted)', fontSize:13 }}>No announcements yet.</p>
            ) : announcements.slice(0,5).map((a:any) => (
              <div key={a.id} style={{ background:'var(--sf-surface-2)', border:'1px solid var(--sf-border)', borderLeft:`3px solid ${a.priority==='Urgent'?'var(--sf-danger)':a.priority==='Important'?'var(--sf-warning)':'var(--sf-muted-2)'}`, borderRadius:8, padding:'0.75rem 0.875rem', marginBottom:8 }}>
                <div style={{ color:'var(--sf-text)', fontWeight:600, fontSize:12, marginBottom:2 }}>{a.title}</div>
                <div style={{ color:'var(--sf-muted-2)', fontSize:10 }}>{new Date(a.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
              </div>
            ))}
          </Section>

          {isAdmin && flagged.length > 0 && (
            <Section title="Needs attention" subtitle={`${flagged.length} flagged tasks`}>
              {flagged.slice(0,6).map((t:any) => (
                <div key={t.id} onClick={() => router.push('/tasks')} style={{ background:'var(--sf-surface-2)', border:'1px solid var(--sf-border)', borderRadius:8, padding:'0.625rem 0.75rem', marginBottom:8, cursor:'pointer' }}>
                  <div style={{ color:'var(--sf-text)', fontSize:12, fontWeight:600, marginBottom:4 }}>{t.title}</div>
                  <Chip status={t.status} />
                </div>
              ))}
            </Section>
          )}

          {isAdmin && pendingLeav.length > 0 && (
            <Section
              title="Leave pending"
              action={<button type="button" className="sf-link-btn" onClick={() => router.push('/leave')}>Manage</button>}
            >
              {pendingLeav.slice(0,6).map((l:any) => (
                <div key={l.id} style={{ background:'var(--sf-surface-2)', border:'1px solid var(--sf-border)', borderRadius:8, padding:'0.625rem 0.75rem', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ color:'var(--sf-text)', fontSize:12, fontWeight:600 }}>{l.user?.name||'Employee'}</div>
                    <div style={{ color:'var(--sf-muted)', fontSize:10 }}>{l.leave_type} · {l.days} days</div>
                  </div>
                  <span style={{ background:'rgba(251,191,36,0.15)', color:'var(--sf-warning)', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5 }}>Pending</span>
                </div>
              ))}
            </Section>
          )}
        </div>
      </div>
    </PageShell>
  )
}
