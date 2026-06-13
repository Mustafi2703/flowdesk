// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser, STATUS_BG, STATUS_TEXT } from '@/types'

export default function BillingClient({ session }: { session: SessionUser }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [filter, setFilter] = useState('unbilled')
  const [pricing, setPricing] = useState<any>(null)
  const [priceIn, setPriceIn] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  function load() { return fetch('/api/billing').then(r=>r.json()).then(d => { setTasks(Array.isArray(d)?d:[]); setLoading(false) }) }
  useEffect(() => { load() }, [])

  const canEdit = ['owner','accountant'].includes(session.role)
  const billed = tasks.filter(t => t.billed_at)
  const unbilled = tasks.filter(t => !t.billed_at)
  const unpriced = tasks.filter(t => !t.billable_amount)
  const total = tasks.reduce((s,t) => s+(t.billable_amount||0), 0)
  const totalBilled = billed.reduce((s,t) => s+(t.billable_amount||0), 0)
  const totalPending = unbilled.reduce((s,t) => s+(t.billable_amount||0), 0)
  const displayed = filter==='all' ? tasks : filter==='unbilled' ? unbilled : billed
  const fmt = (n:number) => `₹${(n||0).toLocaleString('en-IN')}`

  async function setPrice() {
    if (!pricing||!priceIn) return
    setSaving(true)
    await fetch(`/api/billing/${pricing.id}/price`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:parseFloat(priceIn)})})
    setSaving(false); setPricing(null); setPriceIn(''); load()
  }
  async function markBilled(id:string) {
    await fetch(`/api/billing/${id}/bill`,{method:'PATCH'})
    load()
  }

  if (loading) return <div style={{color:'var(--sf-muted)',padding:40,textAlign:'center'}}>Loading…</div>

  return (
    <div>
      <h2 style={{color:'var(--sf-text)',fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700,marginBottom:20}}>Billing Dashboard</h2>
      {unpriced.length>0 && <div style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:12,padding:'12px 16px',marginBottom:20,display:'flex',alignItems:'center',gap:12}}><span style={{color:'#FBBF24',fontSize:18}}>⚠</span><span style={{color:'#FBBF24',fontSize:13,fontWeight:600}}>{unpriced.length} billable task{unpriced.length>1?'s':''} have no price set.</span></div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
        {[['Total Billable',fmt(total),'#EC4899'],['Pending',fmt(totalPending),'#F59E0B'],['Billed',fmt(totalBilled),'#10B981'],['Unpriced',unpriced.length,'#EF4444']].map(([l,v,c]) => (
          <div key={String(l)} style={{background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:12,padding:'18px 20px',borderLeft:`3px solid ${c}`}}>
            <div style={{color:'var(--sf-muted)',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{l}</div>
            <div style={{color:'var(--sf-text)',fontSize:22,fontWeight:700,fontFamily:"'Space Grotesk',sans-serif"}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {[['all','All'],['unbilled',`Pending (${unbilled.length})`],['billed',`Billed (${billed.length})`]].map(([v,l]) => (
          <button key={String(v)} onClick={()=>setFilter(v)} style={{padding:'7px 14px',background:filter===v?'#EC4899':'var(--sf-surface)',border:filter===v?'none':'1px solid var(--sf-border)',borderRadius:8,color:filter===v?'white':'var(--sf-muted)',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>{l}</button>
        ))}
      </div>
      <div style={{background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:14,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'2.5fr 1fr 1fr 1fr 1fr 1.2fr',padding:'12px 20px',borderBottom:'1px solid var(--sf-border)',background:'var(--sf-surface-2)'}}>
          {['Task','Brand','Status','Amount','Billed On','Actions'].map(h=><div key={h} style={{color:'var(--sf-muted)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</div>)}
        </div>
        {displayed.map((task:any) => {
          const np = !task.billable_amount
          return (
            <div key={task.id} style={{display:'grid',gridTemplateColumns:'2.5fr 1fr 1fr 1fr 1fr 1.2fr',padding:'13px 20px',borderBottom:'1px solid #1A1A2E',alignItems:'center',background:np?'rgba(239,68,68,0.02)':'transparent'}}>
              <div>
                <div style={{color:'var(--sf-text)',fontSize:13,fontWeight:600}}>{task.title}</div>
                <div style={{color:'var(--sf-muted)',fontSize:11}}>{task.type}</div>
              </div>
              <div style={{color:'#A0A0C0',fontSize:12}}>{task.brand?.name||'—'}</div>
              <span style={{background:STATUS_BG[task.status]||'#F3F4F6',color:STATUS_TEXT[task.status]||'#374151',fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,display:'inline-block'}}>{task.status}</span>
              <div>{task.billable_amount ? <span style={{color:'#EC4899',fontWeight:700,fontSize:14}}>{fmt(task.billable_amount)}</span> : <span style={{color:'#EF4444',fontSize:11,fontStyle:'italic'}}>Not set</span>}</div>
              <div style={{color:task.billed_at?'#10B981':'#F59E0B',fontSize:12}}>{task.billed_at ? new Date(task.billed_at).toLocaleDateString('en-IN') : 'Pending'}</div>
              <div style={{display:'flex',gap:5}}>
                {canEdit && <button onClick={()=>{setPricing(task); setPriceIn(task.billable_amount?.toString()||'')}} style={{padding:'5px 9px',background:'var(--sf-surface-2)',border:'1px solid #2A2A45',borderRadius:6,color:np?'#EC4899':'#A0A0C0',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>{np?'₹ Set':'₹ Edit'}</button>}
                {!task.billed_at && canEdit && task.billable_amount && <button onClick={()=>markBilled(task.id)} style={{padding:'5px 9px',background:'var(--sf-accent)',border:'none',borderRadius:6,color:'var(--sf-text)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>Bill</button>}
                {task.billed_at && <span style={{background:'#10B98120',color:'#10B981',fontSize:10,padding:'3px 7px',borderRadius:5,fontWeight:700}}>✓ Billed</span>}
              </div>
            </div>
          )
        })}
        {displayed.length===0 && <div style={{padding:32,textAlign:'center',color:'var(--sf-muted-2)',fontSize:13}}>No tasks here.</div>}
      </div>
      {pricing && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}} onClick={()=>setPricing(null)}>
          <div style={{background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:16,padding:28,width:'100%',maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <h3 style={{color:'var(--sf-text)',fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700,marginBottom:6}}>Set Price</h3>
            <p style={{color:'var(--sf-muted)',fontSize:13,marginBottom:18}}>{pricing.title}</p>
            <div style={{marginBottom:18}}>
              <label style={{color:'var(--sf-muted)',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5,display:'block'}}>Amount (₹)</label>
              <input type="number" value={priceIn} onChange={e=>setPriceIn(e.target.value)} placeholder="e.g. 15000" style={{width:'100%',padding:'10px 14px',background:'var(--sf-surface-2)',border:'1px solid #EC489950',borderRadius:9,color:'var(--sf-text)',fontSize:14,outline:'none',fontFamily:"'DM Sans',sans-serif"}} />
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={setPrice} disabled={!priceIn||saving} style={{padding:'10px 20px',background:'var(--sf-accent)',border:'none',borderRadius:9,color:'var(--sf-text)',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{saving?'Saving…':'Save Price'}</button>
              <button onClick={()=>setPricing(null)} style={{padding:'10px 20px',background:'var(--sf-surface-2)',border:'1px solid #2A2A45',borderRadius:9,color:'#A0A0C0',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}