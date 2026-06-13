// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser, ROLE_COLORS, ROLE_LABELS } from '@/types'

export default function TeamClient({ session }: { session: SessionUser }) {
  const [users, setUsers] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [assignableRoles, setAssignableRoles] = useState<string[]>([])
  const [managers, setManagers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', role: 'team', department: '', designation: '', password: '', manager_id: '' })
  const today = new Date().toISOString().split('T')[0]
  const canOnboard = ['owner','manager'].includes(session.role)
  const canReset = ['owner','hr'].includes(session.role)

  async function refresh() {
    const fetches: Promise<any>[] = [
      fetch(`/api/team${session.role==='owner'?'?include_inactive=true':''}`).then(r=>r.json()),
      fetch('/api/tasks').then(r=>r.json()),
      fetch('/api/attendance').then(r=>r.json()),
      fetch('/api/team/assignable-roles').then(r=>r.json()).catch(()=>({roles:[]})),
    ]
    if (session.role === 'owner') {
      fetches.push(fetch('/api/team/managers').then(r=>r.json()).catch(()=>[]))
    }
    Promise.all(fetches).then((results) => {
      const [u,t,a,roles,...rest] = results
      setUsers(Array.isArray(u)?u:[])
      setTasks(Array.isArray(t)?t:[])
      setAttendance(Array.isArray(a)?a:[])
      setAssignableRoles(Array.isArray(roles.roles)?roles.roles:[])
      if (rest[0]) setManagers(Array.isArray(rest[0])?rest[0]:[])
      setLoading(false)
    })
  }

  useEffect(() => {
    refresh()
  }, [])

  async function addUser(e:any) {
    e.preventDefault()
    setSaving(true); setError(''); setNotice('')
    const payload:any = {
      name: form.name,
      email: form.email,
      role: form.role,
      department: form.department || null,
      designation: form.designation || null,
    }
    if (form.password) payload.password = form.password
    if (session.role === 'owner' && form.manager_id) payload.manager_id = form.manager_id
    const res = await fetch('/api/team', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) })
    const data = await res.json().catch(()=>({}))
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Could not create user'); return }
    setNotice(`User created. Temporary password: ${data.temporary_password}`)
    setForm({ name: '', email: '', role: assignableRoles[0] || 'team', department: '', designation: '', password: '', manager_id: '' })
    setShowAdd(false)
    refresh()
  }

  async function resetPassword(id:string, name:string) {
    setError(''); setNotice('')
    const res = await fetch(`/api/team/${id}/reset-password`, { method:'POST' })
    const data = await res.json().catch(()=>({}))
    if (!res.ok) { setError(data.error || 'Could not reset password'); return }
    setNotice(`${name}'s temporary password: ${data.temporary_password}`)
  }

  async function deactivateUser(id:string, name:string) {
    if (!confirm(`Deactivate ${name}? They will no longer be able to log in.`)) return
    setError(''); setNotice('')
    const method = session.role === 'owner' ? 'DELETE' : 'PATCH'
    const opts:any = { method }
    if (method === 'PATCH') {
      opts.headers = {'content-type':'application/json'}
      opts.body = JSON.stringify({ is_active:false })
    }
    const res = await fetch(`/api/team/${id}`, opts)
    const data = await res.json().catch(()=>({}))
    if (!res.ok) { setError(data.error || 'Could not deactivate user'); return }
    setNotice(`${name} has been deactivated.`)
    refresh()
  }

  function load(uid:string) {
    const active = tasks.filter(t => t.assigned_to?.includes(uid) && !['Completed','On Hold'].includes(t.status))
    if (active.length===0) return { label:'Available', color:'#10B981' }
    if (active.length<=2) return { label:'Moderate', color:'#FBBF24' }
    return { label:'Fully Loaded', color:'#EF4444' }
  }

  const isOnline = (uid:string) => attendance.some(a => a.user_id===uid && a.date===today && !a.logout_time)
  if (loading) return <div style={{color:'var(--sf-muted)',padding:40,textAlign:'center'}}>Loading team…</div>

  const team = users
  const online = team.filter(u => isOnline(u.id)).length
  const managerName = (id:string|null) => team.find(u => u.id === id)?.name

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,gap:12}}>
        <h2 style={{color:'var(--sf-text)',fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,margin:0}}>Team Management</h2>
        {canOnboard && <button onClick={()=>{ setShowAdd(!showAdd); setNotice(''); setError('') }} style={{background:'var(--sf-accent)',border:'none',color:'var(--sf-text)',fontWeight:800,borderRadius:10,padding:'10px 14px',cursor:'pointer'}}>+ Add User</button>}
      </div>
      {notice && <div style={{background:'#052E1A',border:'1px solid #10B981',color:'#D1FAE5',borderRadius:10,padding:12,marginBottom:14,fontSize:13}}>{notice}</div>}
      {error && <div style={{background:'#3B0A0A',border:'1px solid #EF4444',color:'#FEE2E2',borderRadius:10,padding:12,marginBottom:14,fontSize:13}}>{error}</div>}
      {showAdd && (
        <form onSubmit={addUser} style={{background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:14,padding:18,marginBottom:18}}>
          <div style={{color:'var(--sf-text)',fontWeight:800,marginBottom:12}}>Onboard New User</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
            <input required placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={inputStyle} />
            <input required type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} style={inputStyle} />
            <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} style={inputStyle}>
              {(assignableRoles.length?assignableRoles:['team']).map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
            </select>
            <input placeholder="Department" value={form.department} onChange={e=>setForm({...form,department:e.target.value})} style={inputStyle} />
            <input placeholder="Designation / responsibility" value={form.designation} onChange={e=>setForm({...form,designation:e.target.value})} style={inputStyle} />
            <input type="password" placeholder="Password (blank = auto generate)" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} style={inputStyle} />
            {session.role === 'owner' && (
              <select value={form.manager_id} onChange={e=>setForm({...form,manager_id:e.target.value})} style={inputStyle}>
                <option value="">No manager (optional)</option>
                {managers.map((m:any) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
              </select>
            )}
          </div>
          {session.role === 'manager' && (
            <p style={{ color:'var(--sf-muted)', fontSize:12, marginTop:10 }}>
              New hires will report to you automatically.
            </p>
          )}
          <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:14}}>
            <button type="button" onClick={()=>setShowAdd(false)} style={secondaryBtn}>Cancel</button>
            <button disabled={saving} style={primaryBtn}>{saving?'Creating...':'Create User'}</button>
          </div>
        </form>
      )}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
        {[['Members',team.filter(u=>u.is_active).length,'var(--sf-accent)'],['Online',online,'#10B981'],['Total Tasks',tasks.length,'#3B82F6'],['Flagged',tasks.filter(t=>['Struggling','Needs Attention'].includes(t.status)).length,'#F59E0B']].map(([l,v,c]) => (
          <div key={String(l)} style={{background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:12,padding:'18px 20px',borderLeft:`3px solid ${c}`}}>
            <div style={{color:'var(--sf-muted)',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{l}</div>
            <div style={{color:'var(--sf-text)',fontSize:26,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif"}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(258px,1fr))',gap:14}}>
        {team.map((u:any) => {
          const l = load(u.id)
          const all = tasks.filter(t => t.assigned_to?.includes(u.id))
          const active = all.filter(t => !['Completed','On Hold'].includes(t.status))
          const done = all.filter(t => t.status==='Completed').length
          const rate = all.length>0 ? Math.round(done/all.length*100) : 0
          const online = isOnline(u.id)
          return (
            <div key={u.id} style={{background:'var(--sf-surface)',border:`1px solid ${u.is_active?'var(--sf-border)':'#3A2430'}`,borderRadius:14,padding:18,opacity:u.is_active?1:.65}}>
              <div style={{display:'flex',gap:11,marginBottom:12,alignItems:'center'}}>
                <div style={{position:'relative'}}>
                  <div style={{width:42,height:42,borderRadius:10,background:ROLE_COLORS[u.role]||'var(--sf-accent)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--sf-text)',fontWeight:700,fontSize:13}}>{u.avatar||u.name?.slice(0,2)}</div>
                  <div style={{position:'absolute',bottom:-2,right:-2,width:11,height:11,borderRadius:'50%',background:online?'#10B981':'var(--sf-muted-2)',border:'2px solid var(--sf-surface)'}} />
                </div>
                <div>
                  <div style={{color:'var(--sf-text)',fontWeight:700,fontSize:13}}>{u.name}</div>
                  <div style={{color:'var(--sf-muted)',fontSize:11}}>{u.designation || u.department || ROLE_LABELS[u.role]}</div>
                  {u.manager_id && <div style={{color:'var(--sf-muted-2)',fontSize:10,marginTop:2}}>Reports to {managerName(u.manager_id) || '—'}</div>}
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
                <span style={{background:l.color+'20',color:l.color,fontSize:10,padding:'3px 8px',borderRadius:6,fontWeight:700}}>{l.label}</span>
                <span style={{color:u.is_active?'var(--sf-muted)':'#EF4444',fontSize:11}}>{u.is_active ? `${active.length} active` : 'Inactive'}</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:7,marginBottom:10}}>
                {[['Total',all.length,'white'],['Done',done,'#10B981'],['Rate',`${rate}%`,'#FBBF24']].map(([l,v,c]) => (
                  <div key={String(l)} style={{background:'var(--sf-surface-2)',borderRadius:7,padding:'7px',textAlign:'center'}}>
                    <div style={{color:String(c),fontWeight:700,fontSize:13}}>{v}</div>
                    <div style={{color:'var(--sf-muted)',fontSize:10}}>{l}</div>
                  </div>
                ))}
              </div>
              {all.length>0 && <div style={{height:4,background:'var(--sf-surface-2)',borderRadius:2,overflow:'hidden'}}><div style={{width:`${rate}%`,height:'100%',background:'#10B981',borderRadius:2}}/></div>}
              <div style={{display:'flex',gap:8,marginTop:12}}>
                {canReset && u.id!==session.id && <button onClick={()=>resetPassword(u.id,u.name)} style={smallBtn}>Reset Password</button>}
                {['owner','manager'].includes(session.role) && u.id!==session.id && u.is_active && <button onClick={()=>deactivateUser(u.id,u.name)} style={{...smallBtn,color:'#FCA5A5',borderColor:'#7F1D1D'}}>Deactivate</button>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const inputStyle:any = { background:'#0B0B14', border:'1px solid #272742', color:'var(--sf-text)', borderRadius:9, padding:'10px 11px', outline:'none' }
const primaryBtn:any = { background:'var(--sf-accent)', border:'none', color:'var(--sf-text)', borderRadius:9, padding:'9px 13px', fontWeight:800, cursor:'pointer' }
const secondaryBtn:any = { background:'var(--sf-surface-2)', border:'1px solid #272742', color:'#C7C7D8', borderRadius:9, padding:'9px 13px', cursor:'pointer' }
const smallBtn:any = { background:'var(--sf-surface-2)', border:'1px solid #272742', color:'#C7C7D8', borderRadius:7, padding:'6px 8px', fontSize:11, cursor:'pointer' }