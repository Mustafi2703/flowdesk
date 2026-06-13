// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionUser, STATUS_BG, STATUS_TEXT } from '@/types'

function Chip({ status }: { status: string }) {
  return <span style={{ background: STATUS_BG[status]||'#F3F4F6', color: STATUS_TEXT[status]||'#374151', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5, whiteSpace:'nowrap' }}>{status}</span>
}

function Stat({ label, value, sub, accent }: { label:string; value:string|number; sub?:string; accent:string }) {
  return (
    <div style={{ background:'#111120', border:'1px solid #1E1E35', borderRadius:12, padding:'16px 18px', borderLeft:`3px solid ${accent}` }}>
      <div style={{ color:'#6B6B8A', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{label}</div>
      <div style={{ color:'white', fontSize:26, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>{value}</div>
      {sub && <div style={{ color:'#6B6B8A', fontSize:11, marginTop:4 }}>{sub}</div>}
    </div>
  )
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

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  if (loading) return <div style={{ color:'#6B6B8A', padding:40, textAlign:'center' }}>Loading…</div>

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ color:'white', fontSize:24, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", marginBottom:4 }}>
          Good {greet}, {session.name.split(' ')[0]} 👋
        </h1>
        <p style={{ color:'#6B6B8A', fontSize:13 }}>{new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
      </div>

      {/* Clock card */}
      {isTeam && (
        <div style={{ background: clocked?'rgba(16,185,129,0.07)':'#111120', border:`1px solid ${clocked?'rgba(16,185,129,0.3)':'#1E1E35'}`, borderRadius:14, padding:'18px 22px', marginBottom:22, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ color: clocked?'#10B981':'#6B6B8A', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>{clocked?'● Live Session':'○ Not Clocked In'}</div>
            <div style={{ color:'white', fontSize:18, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>{clocked?'Currently working':'Ready to start?'}</div>
          </div>
          <button onClick={clocked?clockOut:clockIn} style={{ padding:'11px 24px', background: clocked?'transparent':'#E8630A', border: clocked?'1px solid #10B981':'none', borderRadius:10, color: clocked?'#10B981':'white', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            {clocked?'Clock Out':'Clock In'}
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:12, marginBottom:24 }}>
        {isAdmin && <>
          <Stat label="Total Tasks" value={tasks.length} sub={`${tasks.filter(t=>t.status==='Completed').length} done`} accent="#3B82F6" />
          <Stat label="Overdue"     value={overdue.length} accent="#EF4444" />
          <Stat label="Flagged"     value={flagged.length} accent="#F59E0B" />
          <Stat label="Leave Pending" value={pendingLeav.length} accent="#8B5CF6" />
        </>}
        {isTeam && <>
          <Stat label="My Tasks"   value={myTasks.length} sub={`${myTasks.filter(t=>t.status==='Completed').length} done`} accent="#E8630A" />
          <Stat label="Due Today"  value={myTasks.filter(t=>t.due_date===today).length} accent="#EF4444" />
          <Stat label="In Progress" value={myTasks.filter(t=>t.status==='In Progress').length} accent="#3B82F6" />
        </>}
        {session.role === 'hr' && <>
          <Stat label="Leave Pending" value={pendingLeav.length} accent="#8B5CF6" />
          <Stat label="Total Staff" value={0} accent="#E8630A" />
        </>}
        {session.role === 'accountant' && <>
          <Stat label="Billable Tasks" value={tasks.filter(t=>t.is_billable).length} accent="#EC4899" />
          <Stat label="Pending Billing" value={tasks.filter(t=>t.is_billable&&!t.billed_at).length} accent="#F59E0B" />
        </>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:18 }}>
        {/* Tasks */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ color:'white', fontWeight:700, fontSize:16, fontFamily:"'Space Grotesk',sans-serif" }}>{isTeam?'My Tasks':'Recent Tasks'}</h3>
            <button onClick={() => router.push('/tasks')} style={{ background:'none', border:'none', color:'#E8630A', fontSize:13, cursor:'pointer', fontWeight:600 }}>View all →</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {(isTeam?myTasks:tasks).slice(0,6).map((t:any) => {
              const dl = t.due_date ? Math.ceil((new Date(t.due_date).getTime()-Date.now())/86400000) : null
              const late = dl!==null && dl<0 && t.status!=='Completed'
              return (
                <div key={t.id} style={{ background:'#111120', border:'1px solid', borderColor: late?'rgba(239,68,68,0.4)':'#1E1E35', borderLeft: late?'3px solid #EF4444':'1px solid #1E1E35', borderRadius:11, padding:'13px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
                  onClick={() => router.push('/tasks')}>
                  <div>
                    <div style={{ color:'white', fontWeight:600, fontSize:13, marginBottom:2 }}>{t.title}</div>
                    <div style={{ color:'#6B6B8A', fontSize:11 }}>{t.brand?.name||'—'} · {t.type}</div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <Chip status={t.status} />
                    {dl!==null && <span style={{ color:late?'#F87171':'#6B6B8A', fontSize:11 }}>{late?`${Math.abs(dl)}d late`:dl===0?'Today':`${dl}d`}</span>}
                  </div>
                </div>
              )
            })}
            {tasks.length===0 && <div style={{ color:'#4A4A6A', textAlign:'center', padding:32 }}>No tasks yet.</div>}
          </div>
        </div>

        {/* Right */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <h3 style={{ color:'white', fontWeight:700, fontSize:14, fontFamily:"'Space Grotesk',sans-serif" }}>Announcements</h3>
              <button onClick={() => router.push('/announcements')} style={{ background:'none', border:'none', color:'#E8630A', fontSize:12, cursor:'pointer', fontWeight:600 }}>All →</button>
            </div>
            {announcements.slice(0,3).map((a:any) => (
              <div key={a.id} style={{ background:'#111120', border:'1px solid #1E1E35', borderLeft:`3px solid ${a.priority==='Urgent'?'#EF4444':a.priority==='Important'?'#FBBF24':'#4A4A6A'}`, borderRadius:10, padding:'12px 14px', marginBottom:7 }}>
                <div style={{ color:'white', fontWeight:600, fontSize:12, marginBottom:2 }}>{a.title}</div>
                <div style={{ color:'#4A4A6A', fontSize:10 }}>{new Date(a.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
              </div>
            ))}
            {announcements.length===0 && <div style={{ color:'#4A4A6A', fontSize:12 }}>No announcements.</div>}
          </div>

          {isAdmin && flagged.length>0 && (
            <div>
              <h3 style={{ color:'#F59E0B', fontWeight:700, fontSize:13, marginBottom:8 }}>⚠ Needs Attention</h3>
              {flagged.slice(0,3).map((t:any) => (
                <div key={t.id} style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:9, padding:'10px 12px', marginBottom:6, cursor:'pointer' }} onClick={() => router.push('/tasks')}>
                  <div style={{ color:'white', fontSize:12, fontWeight:600 }}>{t.title}</div>
                  <Chip status={t.status} />
                </div>
              ))}
            </div>
          )}

          {isAdmin && pendingLeav.length>0 && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <h3 style={{ color:'white', fontWeight:700, fontSize:13, fontFamily:"'Space Grotesk',sans-serif" }}>Leave Pending</h3>
                <button onClick={() => router.push('/leave')} style={{ background:'none', border:'none', color:'#E8630A', fontSize:12, cursor:'pointer', fontWeight:600 }}>Manage →</button>
              </div>
              {pendingLeav.slice(0,2).map((l:any) => (
                <div key={l.id} style={{ background:'#111120', border:'1px solid #1E1E35', borderRadius:9, padding:'10px 12px', marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ color:'white', fontSize:12, fontWeight:600 }}>{l.user?.name||'—'}</div>
                    <div style={{ color:'#6B6B8A', fontSize:10 }}>{l.leave_type} · {l.days}d</div>
                  </div>
                  <span style={{ background:'rgba(251,191,36,0.15)', color:'#FBBF24', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5 }}>Pending</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}