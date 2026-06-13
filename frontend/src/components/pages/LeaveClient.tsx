// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser } from '@/types'

const sInp = { width:'100%',padding:'9px 12px',background:'#1A1A2E',border:'1px solid #2A2A45',borderRadius:8,color:'white',fontSize:13,outline:'none',fontFamily:"'DM Sans',sans-serif" }

export default function LeaveClient({ session }: { session: SessionUser }) {
  const [leaves, setLeaves] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  function load() { return fetch('/api/leave').then(r=>r.json()).then(d => { setLeaves(Array.isArray(d)?d:[]); setLoading(false) }) }
  useEffect(() => { load() }, [])

  const canApprove = ['owner','hr'].includes(session.role)
  const myLeaves = leaves.filter(l => l.user_id===session.id)
  const taken = myLeaves.filter(l => l.status==='Approved').reduce((s,l) => s+l.days, 0)
  const STAT: Record<string,{bg:string;c:string}> = { Pending:{bg:'#FBBF2420',c:'#FBBF24'}, Approved:{bg:'#10B98120',c:'#10B981'}, Rejected:{bg:'#EF444420',c:'#F87171'} }

  async function approve(id: string, status: string) {
    await fetch(`/api/leave/${id}`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})})
    load()
  }

  if (loading) return <div style={{color:'#6B6B8A',padding:40,textAlign:'center'}}>Loading…</div>

  const displayed = ['team','developer','accountant'].includes(session.role) ? myLeaves : leaves

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h2 style={{color:'white',fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700}}>Leave Management</h2>
        {!['owner','manager'].includes(session.role) && <button onClick={()=>setShowCreate(true)} style={{padding:'9px 18px',background:'#E8630A',border:'none',borderRadius:9,color:'white',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>+ Request Leave</button>}
      </div>
      {['team','developer','accountant','hr','manager'].includes(session.role) && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:24}}>
          {[['Total',21,'#8B5CF6'],['Taken',taken,'#EF4444'],['Remaining',21-taken,'#10B981']].map(([l,v,c]) => (
            <div key={String(l)} style={{background:'#111120',border:'1px solid #1E1E35',borderRadius:12,padding:'18px 20px',borderLeft:`3px solid ${c}`}}>
              <div style={{color:'#6B6B8A',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{l}</div>
              <div style={{color:'white',fontSize:26,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif"}}>{v}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{background:'#111120',border:'1px solid #1E1E35',borderRadius:14,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:canApprove?'1.5fr 1fr 1fr 1fr 1fr 1.2fr':'1.5fr 1fr 1fr 1fr 1fr',padding:'12px 20px',borderBottom:'1px solid #1E1E35',background:'#16162A'}}>
          {['Employee','Type','Dates','Days','Status',...(canApprove?['Action']:[])].map(h=><div key={h} style={{color:'#6B6B8A',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</div>)}
        </div>
        {displayed.map((req:any) => {
          const u = req.user||{}
          const s = STAT[req.status]||STAT.Pending
          return (
            <div key={req.id} style={{display:'grid',gridTemplateColumns:canApprove?'1.5fr 1fr 1fr 1fr 1fr 1.2fr':'1.5fr 1fr 1fr 1fr 1fr',padding:'12px 20px',borderBottom:'1px solid #1A1A2E',alignItems:'center'}}>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <div style={{width:30,height:30,borderRadius:7,background:'#E8630A',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:11}}>{u.avatar||(u.name||'U').slice(0,2)}</div>
                <div>
                  <div style={{color:'white',fontSize:13,fontWeight:600}}>{u.name||'You'}</div>
                  <div style={{color:'#6B6B8A',fontSize:10}}>{(req.reason||'').slice(0,25)}{req.reason?.length>25?'…':''}</div>
                </div>
              </div>
              <div style={{color:'#A0A0C0',fontSize:13}}>{req.leave_type}</div>
              <div style={{color:'#A0A0C0',fontSize:11}}>{req.start_date}{req.end_date!==req.start_date && ` → ${req.end_date}`}</div>
              <div style={{color:'#A0A0C0',fontSize:13}}>{req.days}d</div>
              <span style={{background:s.bg,color:s.c,fontSize:11,padding:'3px 8px',borderRadius:6,fontWeight:700,display:'inline-block'}}>{req.status}</span>
              {canApprove && (
                <div style={{display:'flex',gap:5}}>
                  {req.status==='Pending' ? (
                    <>
                      <button onClick={()=>approve(req.id,'Approved')} style={{padding:'5px 9px',background:'rgba(16,185,129,0.15)',border:'1px solid #10B981',borderRadius:6,color:'#10B981',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>Approve</button>
                      <button onClick={()=>approve(req.id,'Rejected')} style={{padding:'5px 9px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:6,color:'#F87171',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>Reject</button>
                    </>
                  ) : <span style={{color:'#4A4A6A',fontSize:12}}>—</span>}
                </div>
              )}
            </div>
          )
        })}
        {displayed.length===0 && <div style={{padding:32,textAlign:'center',color:'#4A4A6A',fontSize:13}}>No leave requests.</div>}
      </div>
      {showCreate && <LeaveForm session={session} onClose={()=>setShowCreate(false)} onSaved={()=>{setShowCreate(false); load()}} />}
    </div>
  )
}

function LeaveForm({ session, onClose, onSaved }: any) {
  const [lt, setLt] = useState('Casual')
  const [sd, setSd] = useState('')
  const [ed, setEd] = useState('')
  const [r, setR] = useState('')
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!sd||!ed||!r.trim()) return
    const days = Math.ceil((new Date(ed).getTime()-new Date(sd).getTime())/86400000) + 1
    setSaving(true)
    await fetch('/api/leave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leave_type:lt,start_date:sd,end_date:ed,days,reason:r})})
    setSaving(false); onSaved()
  }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}} onClick={onClose}>
      <div style={{background:'#111120',border:'1px solid #1E1E35',borderRadius:16,padding:28,width:'100%',maxWidth:460}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h3 style={{color:'white',fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:700}}>Request Leave</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#6B6B8A',cursor:'pointer',fontSize:22}}>×</button>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{color:'#8888AA',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5,display:'block'}}>Leave Type</label>
          <select value={lt} onChange={e=>setLt(e.target.value)} style={{...sInp,cursor:'pointer'}}>{['Casual','Sick','Earned','Comp-Off','Other'].map(o=><option key={o}>{o}</option>)}</select>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          {[['Start',sd,setSd],['End',ed,setEd]].map(([l,v,s]) => (
            <div key={String(l)}>
              <label style={{color:'#8888AA',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5,display:'block'}}>{l} Date</label>
              <input type="date" value={String(v)} onChange={e=>(s as any)(e.target.value)} style={sInp} />
            </div>
          ))}
        </div>
        <div style={{marginBottom:16}}>
          <label style={{color:'#8888AA',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5,display:'block'}}>Reason *</label>
          <textarea value={r} onChange={e=>setR(e.target.value)} placeholder="Briefly explain…" rows={3} style={{...sInp,resize:'vertical' as const}} />
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={save} disabled={!sd||!ed||!r||saving} style={{padding:'10px 20px',background:'#E8630A',border:'none',borderRadius:9,color:'white',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{saving?'Submitting…':'Submit Request'}</button>
          <button onClick={onClose} style={{padding:'10px 20px',background:'#1A1A2E',border:'1px solid #2A2A45',borderRadius:9,color:'#A0A0C0',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
        </div>
      </div>
    </div>
  )
}