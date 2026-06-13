// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser } from '@/types'

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

  if (loading) return <div style={{color:'#6B6B8A',padding:40,textAlign:'center'}}>Loading…</div>

  return (
    <div>
      <h2 style={{color:'white',fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,marginBottom:20}}>Attendance</h2>
      {session.id===selectedUser && (
        <div style={{background:clocked?'rgba(16,185,129,0.07)':'#111120',border:`1px solid ${clocked?'rgba(16,185,129,0.3)':'#1E1E35'}`,borderRadius:14,padding:'18px 22px',marginBottom:22,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{color:clocked?'#10B981':'#6B6B8A',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{clocked?'● Live':'○ Not Clocked In'}</div>
            <div style={{color:'white',fontSize:18,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif"}}>{clocked?`In since ${todayLog?.login_time||''}`:'Start your workday'}</div>
          </div>
          <button onClick={clocked?clockOut:clockIn} disabled={action} style={{padding:'11px 26px',background:clocked?'transparent':'#E8630A',border:clocked?'1px solid #10B981':'none',borderRadius:10,color:clocked?'#10B981':'white',fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{action?'…':clocked?'Clock Out':'Clock In'}</button>
        </div>
      )}
      {canView && (
        <div style={{marginBottom:20}}>
          <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} style={{padding:'9px 14px',background:'#111120',border:'1px solid #2A2A45',borderRadius:9,color:'white',fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
            <option value={session.id}>My Attendance</option>
            {users.filter(u=>u.id!==session.id).map(u=><option key={u.id} value={u.id}>{u.name} — {u.designation}</option>)}
          </select>
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:24}}>
        {[['Days Logged',days,'#3B82F6'],['Total Hours',`${Math.round(totalH)}h`,'#E8630A'],['Avg/Day',`${avg}h`,'#10B981']].map(([l,v,c]) => (
          <div key={String(l)} style={{background:'#111120',border:'1px solid #1E1E35',borderRadius:12,padding:'18px 20px',borderLeft:`3px solid ${c}`}}>
            <div style={{color:'#6B6B8A',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{l}</div>
            <div style={{color:'white',fontSize:26,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif"}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{color:'white',fontWeight:700,fontSize:15,fontFamily:"'Space Grotesk',sans-serif",marginBottom:12}}>Log History</div>
      <div style={{background:'#111120',border:'1px solid #1E1E35',borderRadius:14,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',padding:'12px 20px',borderBottom:'1px solid #1E1E35',background:'#16162A'}}>
          {['Date','Clock In','Clock Out','Hours'].map(h=><div key={h} style={{color:'#6B6B8A',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</div>)}
        </div>
        {logs.slice(0,30).map((log:any) => (
          <div key={log.id} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',padding:'12px 20px',borderBottom:'1px solid #1A1A2E',background:log.date===today?'rgba(232,99,10,0.03)':'transparent'}}>
            <div style={{color:log.date===today?'#E8630A':'white',fontSize:13,fontWeight:log.date===today?700:400}}>{log.date}{log.date===today?' · Today':''}</div>
            <div style={{color:'#A0A0C0',fontSize:13}}>{log.login_time||'—'}</div>
            <div style={{color:log.logout_time?'#A0A0C0':'#F59E0B',fontSize:13}}>{log.logout_time||'— Active'}</div>
            <div style={{color:log.hours_worked>0?'#10B981':'#6B6B8A',fontWeight:600,fontSize:13}}>{log.hours_worked>0?`${log.hours_worked}h`:'—'}</div>
          </div>
        ))}
        {logs.length===0 && <div style={{padding:32,textAlign:'center',color:'#4A4A6A',fontSize:13}}>No attendance records.</div>}
      </div>
    </div>
  )
}