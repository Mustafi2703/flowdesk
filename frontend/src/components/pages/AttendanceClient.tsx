// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser } from '@/types'
import { PageHeader, PageShell, Section, StatCard, StatGrid } from '@/components/app/Section'

export default function AttendanceClient({ session }: { session: SessionUser }) {
  const [logs, setLogs] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState(session.id)
  const [clocked, setClocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const canView = ['owner','hr','manager'].includes(session.role)

  async function load() {
    const uid = canView ? selectedUser : session.id
    const [l, u] = await Promise.all([
      fetch(`/api/attendance?user_id=${uid}`).then(r=>r.json()),
      canView ? fetch('/api/users').then(r=>r.json()) : Promise.resolve([])
    ])
    const arr = Array.isArray(l)?l:[]
    setLogs(arr)
    if (canView) setUsers(Array.isArray(u)?u:[])
    setClocked(arr.some((x:any) => x.date===today && !x.logout_time))
    setLoading(false)
  }
  useEffect(() => { load() }, [selectedUser])

  async function clockIn()  { setAction(true); await fetch('/api/attendance/clockin', {method:'POST'}); setAction(false); load() }
  async function clockOut() { setAction(true); await fetch('/api/attendance/clockout', {method:'POST'}); setAction(false); load() }

  const totalH = logs.reduce((s,l) => s+(l.hours_worked||0), 0)
  const days = logs.filter(l => l.hours_worked>0).length
  const avg = days>0 ? (totalH/days).toFixed(1) : '0'
  const todayLog = logs.find(l => l.date===today)

  if (loading) return <div style={{color:'var(--sf-muted)',padding:40,textAlign:'center'}}>Loading…</div>

  return (
    <PageShell>
      <PageHeader title="Attendance" subtitle={`${days} days logged · ${Math.round(totalH)}h total`} />
      {session.id===selectedUser && (
        <Section title="Today" subtitle={today} style={{ flexShrink: 0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
            <div>
              <div style={{ color:clocked?'#10B981':'var(--sf-muted)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>{clocked?'Live · clocked in':'Not clocked in'}</div>
              <div style={{ color:'var(--sf-text)', fontSize:18, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>{clocked?`In since ${todayLog?.login_time||''}`:'Start your workday'}</div>
            </div>
            <button onClick={clocked?clockOut:clockIn} disabled={action} className="sf-btn sf-btn-primary">{action?'…':clocked?'Clock out':'Clock in'}</button>
          </div>
        </Section>
      )}
      {canView && (
        <Section title="View as" style={{ flexShrink: 0 }}>
          <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} style={{ padding:'9px 14px', background:'var(--sf-surface-2)', border:'1px solid var(--sf-border)', borderRadius:9, color:'var(--sf-text)', fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", width:'100%', maxWidth:360 }}>
            <option value={session.id}>My Attendance</option>
            {users.filter(u=>u.id!==session.id).map(u=><option key={u.id} value={u.id}>{u.name} — {u.designation}</option>)}
          </select>
        </Section>
      )}
      <StatGrid>
        <StatCard label="Days logged" value={days} accent="#3B82F6" />
        <StatCard label="Total hours" value={`${Math.round(totalH)}h`} accent="var(--sf-accent)" />
        <StatCard label="Avg / day" value={`${avg}h`} accent="#10B981" />
      </StatGrid>
      <Section title="Log history" subtitle="Last 30 entries" flush flex={1}>
        <div style={{ minWidth: 560 }}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',padding:'12px 20px',borderBottom:'1px solid var(--sf-border)',background:'var(--sf-surface-2)'}}>
          {['Date','Clock In','Clock Out','Hours'].map(h=><div key={h} style={{color:'var(--sf-muted)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</div>)}
        </div>
        {logs.slice(0,30).map((log:any) => (
          <div key={log.id} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',padding:'12px 20px',borderBottom:'1px solid #1A1A2E',background:log.date===today?'rgba(232,99,10,0.03)':'transparent'}}>
            <div style={{color:log.date===today?'var(--sf-accent)':'white',fontSize:13,fontWeight:log.date===today?700:400}}>{log.date}{log.date===today?' · Today':''}</div>
            <div style={{color:'#A0A0C0',fontSize:13}}>{log.login_time||'—'}</div>
            <div style={{color:log.logout_time?'#A0A0C0':'#F59E0B',fontSize:13}}>{log.logout_time||'— Active'}</div>
            <div style={{color:log.hours_worked>0?'#10B981':'var(--sf-muted)',fontWeight:600,fontSize:13}}>{log.hours_worked>0?`${log.hours_worked}h`:'—'}</div>
          </div>
        ))}
        {logs.length===0 && <div style={{padding:32,textAlign:'center',color:'var(--sf-muted-2)',fontSize:13}}>No attendance records.</div>}
        </div>
      </Section>
    </PageShell>
  )
}