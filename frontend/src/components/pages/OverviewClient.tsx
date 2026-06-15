// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionUser, STATUS_BG, STATUS_TEXT } from '@/types'
import { PageHeader, PageShell, Section, StatCard, StatGrid } from '@/components/app/Section'
import { EmptyState } from '@/components/app/Icons'

function Chip({ status }: { status: string }) {
  return <span style={{ background: STATUS_BG[status]||'#F3F4F6', color: STATUS_TEXT[status]||'#374151', fontSize:10, fontWeight:700, padding:'3px 7px', borderRadius:5, whiteSpace:'nowrap' }}>{status}</span>
}

export default function OverviewClient({ session }: { session: SessionUser }) {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [leaves, setLeaves] = useState<any[]>([])
  const [clocked, setClocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/announcements').then(r => r.json()),
      fetch('/api/leave').then(r => r.json()),
    ]).then(([t, a, l]) => {
      setTasks(Array.isArray(t) ? t : [])
      setAnnouncements(Array.isArray(a) ? a : [])
      setLeaves(Array.isArray(l) ? l : [])
      setLoading(false)
    })
  }, [])

  const clockIn  = () => fetch('/api/attendance/clockin',  { method:'POST' }).then(() => setClocked(true))
  const clockOut = () => fetch('/api/attendance/clockout', { method:'POST' }).then(() => setClocked(false))

  const myTasks     = tasks.filter(t => t.assigned_to?.includes(session.id))
  const overdue     = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'Completed')
  const flagged     = tasks.filter(t => ['Struggling','Needs Attention'].includes(t.status))
  const pendingLeav = leaves.filter(l => l.status === 'Pending')
  const isTeam      = ['team','developer'].includes(session.role)
  const isAdmin     = ['owner','manager'].includes(session.role)
  const taskList    = (isTeam ? myTasks : tasks).slice(0, 20)

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })

  if (loading) return <div style={{ color:'var(--sf-muted)', padding:40, textAlign:'center' }}>Loading…</div>

  return (
    <PageShell>
      <PageHeader
        title={`Good ${greet}, ${session.name.split(' ')[0]}`}
        subtitle={dateStr}
      />

      {isTeam && (
        <Section title="Attendance" subtitle={clocked ? 'You are clocked in' : 'Not clocked in today'} flush>
          <div style={{ padding:'1rem 1.125rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
            <div style={{ color: clocked ? 'var(--sf-success)' : 'var(--sf-muted)', fontSize:13, fontWeight:600 }}>
              {clocked ? 'Active work session' : 'Ready to start your day?'}
            </div>
            <button onClick={clocked?clockOut:clockIn} className="sf-btn sf-btn-primary" style={{ padding:'0.625rem 1.25rem' }}>
              {clocked ? 'Clock out' : 'Clock in'}
            </button>
          </div>
        </Section>
      )}

      <StatGrid>
        {isAdmin && <>
          <StatCard label="Total Tasks" value={tasks.length} sub={`${tasks.filter(t=>t.status==='Completed').length} completed`} accent="#3B82F6" />
          <StatCard label="Overdue" value={overdue.length} accent="#EF4444" />
          <StatCard label="Flagged" value={flagged.length} accent="#F59E0B" />
          <StatCard label="Leave Pending" value={pendingLeav.length} accent="#8B5CF6" />
        </>}
        {isTeam && <>
          <StatCard label="My Tasks" value={myTasks.length} sub={`${myTasks.filter(t=>t.status==='Completed').length} completed`} accent="#E8630A" />
          <StatCard label="Due Today" value={myTasks.filter(t=>t.due_date===today).length} accent="#EF4444" />
          <StatCard label="In Progress" value={myTasks.filter(t=>t.status==='In Progress').length} accent="#3B82F6" />
        </>}
        {session.role === 'hr' && <>
          <StatCard label="Leave Pending" value={pendingLeav.length} accent="#8B5CF6" />
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

      <div className="sf-page-grid-2" style={{ flex: 1 }}>
        <Section
          title={isTeam ? 'My tasks' : 'Recent tasks'}
          subtitle={`${taskList.length} shown`}
          flex={1}
          action={<button type="button" className="sf-link-btn" onClick={() => router.push('/tasks')}>View all</button>}
          flush
        >
          {taskList.length === 0 ? (
            <EmptyState icon="tasks" title="No tasks yet. Create your first task to get started." />
          ) : (
            <div style={{ display:'flex', flexDirection:'column' }}>
              {taskList.map((t:any) => {
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
                      <div style={{ color:'var(--sf-muted)', fontSize:11 }}>{t.brand?.name||'No brand'} · {t.type||'Task'}</div>
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
            title="Announcements"
            flex={1}
            action={<button type="button" className="sf-link-btn" onClick={() => router.push('/announcements')}>View all</button>}
          >
            {announcements.length === 0 ? (
              <p style={{ color:'var(--sf-muted)', fontSize:13 }}>No announcements yet.</p>
            ) : announcements.slice(0,8).map((a:any) => (
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
