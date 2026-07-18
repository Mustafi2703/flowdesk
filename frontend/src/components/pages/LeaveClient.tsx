// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser } from '@/types'
import { PageHeader, PageShell, Section, StatCard, StatGrid } from '@/components/app/Section'

const sInp = { width:'100%',padding:'9px 12px',background:'var(--sf-surface-2)',border:'1px solid #2A2A45',borderRadius:8,color:'var(--sf-text)',fontSize:13,outline:'none',fontFamily:"'DM Sans',sans-serif" }

const STAFF_ROLES = ['team','manager','hr','accountant']

export default function LeaveClient({ session }: { session: SessionUser }) {
  const [leaves, setLeaves] = useState<any[]>([])
  const [balance, setBalance] = useState<{ total: number; taken: number; remaining: number } | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  function load() {
    return Promise.all([
      fetch('/api/leave').then(r => r.json()),
      fetch('/api/leave/balance').then(r => r.json()),
    ]).then(([leaveData, balanceData]) => {
      setLeaves(Array.isArray(leaveData) ? leaveData : [])
      if (balanceData && typeof balanceData.total === 'number') {
        setBalance(balanceData)
      }
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  const canApprove = ['owner','hr'].includes(session.role)
  const canRequest = STAFF_ROLES.includes(session.role)
  const myLeaves = leaves.filter(l => l.user_id === session.id)
  const STAT: Record<string,{bg:string;c:string}> = { Pending:{bg:'#FBBF2420',c:'#FBBF24'}, Approved:{bg:'#10B98120',c:'#10B981'}, Rejected:{bg:'#EF444420',c:'#F87171'} }

  async function approve(id: string, status: string) {
    await fetch(`/api/leave/${id}`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})})
    load()
  }

  if (loading) return <div style={{color:'var(--sf-muted)',padding:40,textAlign:'center'}}>Loading…</div>

  const displayed = ['team','accountant'].includes(session.role) ? myLeaves : leaves
  const total = balance?.total ?? 21
  const taken = balance?.taken ?? myLeaves.filter(l => l.status === 'Approved').reduce((s, l) => s + l.days, 0)
  const remaining = balance?.remaining ?? Math.max(0, total - taken)

  return (
    <PageShell>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexShrink:0 }}>
        <PageHeader title="Leave Management" subtitle={`${displayed.length} requests`} />
        {canRequest && (
          <button onClick={()=>setShowCreate(true)} className="sf-btn sf-btn-primary" style={{ marginTop:4 }}>Request leave</button>
        )}
      </div>
      {(canRequest || canApprove) && (
        <StatGrid>
          <StatCard label="Total" value={total} accent="#8B5CF6" />
          <StatCard label="Taken" value={taken} accent="#EF4444" />
          <StatCard label="Remaining" value={remaining} accent="#10B981" />
        </StatGrid>
      )}
      <Section title={canApprove ? 'Team leave requests' : 'Leave requests'} subtitle="All requests in this view" flush flex={1}>
        <div style={{ minWidth: 720 }}>
        <div style={{display:'grid',gridTemplateColumns:canApprove?'1.5fr 1fr 1fr 1fr 1fr 1.2fr':'1.5fr 1fr 1fr 1fr 1fr',padding:'12px 20px',borderBottom:'1px solid var(--sf-border)',background:'var(--sf-surface-2)'}}>
          {['Employee','Type','Dates','Days','Status',...(canApprove?['Action']:[])].map(h=><div key={h} style={{color:'var(--sf-muted)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</div>)}
        </div>
        {displayed.map((req:any) => {
          const u = req.user||{}
          const s = STAT[req.status]||STAT.Pending
          return (
            <div key={req.id} style={{display:'grid',gridTemplateColumns:canApprove?'1.5fr 1fr 1fr 1fr 1fr 1.2fr':'1.5fr 1fr 1fr 1fr 1fr',padding:'12px 20px',borderBottom:'1px solid #1A1A2E',alignItems:'center'}}>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <div style={{width:30,height:30,borderRadius:7,background:'var(--sf-accent)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--sf-text)',fontWeight:700,fontSize:11}}>{u.avatar||(u.name||'U').slice(0,2)}</div>
                <div>
                  <div style={{color:'var(--sf-text)',fontSize:13,fontWeight:600}}>{u.name||'You'}</div>
                  <div style={{color:'var(--sf-muted)',fontSize:10}}>{(req.reason||'').slice(0,25)}{req.reason?.length>25?'…':''}</div>
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
                  ) : <span style={{color:'var(--sf-muted-2)',fontSize:12}}>—</span>}
                </div>
              )}
            </div>
          )
        })}
        {displayed.length===0 && <div style={{padding:32,textAlign:'center',color:'var(--sf-muted-2)',fontSize:13}}>No leave requests.</div>}
        </div>
      </Section>
      {showCreate && <LeaveForm session={session} onClose={()=>setShowCreate(false)} onSaved={()=>{setShowCreate(false); load()}} />}
    </PageShell>
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
      <div style={{background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:16,padding:28,width:'100%',maxWidth:460}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h3 style={{color:'var(--sf-text)',fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:700}}>Request Leave</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--sf-muted)',cursor:'pointer',fontSize:22}}>×</button>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{color:'var(--sf-muted)',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5,display:'block'}}>Leave Type</label>
          <select value={lt} onChange={e=>setLt(e.target.value)} style={{...sInp,cursor:'pointer'}}>{['Casual','Sick','Earned','Comp-Off','Other'].map(o=><option key={o}>{o}</option>)}</select>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          {[['Start',sd,setSd],['End',ed,setEd]].map(([l,v,s]) => (
            <div key={String(l)}>
              <label style={{color:'var(--sf-muted)',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5,display:'block'}}>{l} Date</label>
              <input type="date" value={String(v)} onChange={e=>(s as any)(e.target.value)} style={sInp} />
            </div>
          ))}
        </div>
        <div style={{marginBottom:16}}>
          <label style={{color:'var(--sf-muted)',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5,display:'block'}}>Reason *</label>
          <textarea value={r} onChange={e=>setR(e.target.value)} placeholder="Briefly explain…" rows={3} style={{...sInp,resize:'vertical' as const}} />
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={save} disabled={!sd||!ed||!r||saving} style={{padding:'10px 20px',background:'var(--sf-accent)',border:'none',borderRadius:9,color:'var(--sf-text)',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{saving?'Submitting…':'Submit Request'}</button>
          <button onClick={onClose} style={{padding:'10px 20px',background:'var(--sf-surface-2)',border:'1px solid #2A2A45',borderRadius:9,color:'#A0A0C0',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
