// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser } from '@/types'

export default function AnnouncementsClient({ session }: { session: SessionUser }) {
  const [items, setItems] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const canPost = ['owner','manager'].includes(session.role)

  function load() { return fetch('/api/announcements').then(r=>r.json()).then(d => { setItems(Array.isArray(d)?d:[]); setLoading(false) }) }
  useEffect(() => { load() }, [])

  const PRI: Record<string,{c:string;b:string;label:string}> = { Normal:{c:'var(--sf-muted)',b:'var(--sf-muted-2)',label:''}, Important:{c:'#FBBF24',b:'#FBBF24',label:'★ '}, Urgent:{c:'#F87171',b:'#EF4444',label:'🚨 '} }

  if (loading) return <div style={{color:'var(--sf-muted)',padding:40,textAlign:'center'}}>Loading…</div>

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h2 style={{color:'var(--sf-text)',fontFamily:"'Space Grotesk',sans-serif",fontSize:20,fontWeight:700}}>Announcements ({items.length})</h2>
        {canPost && <button onClick={()=>setShowCreate(true)} style={{padding:'9px 18px',background:'var(--sf-accent)',border:'none',borderRadius:9,color:'var(--sf-text)',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>+ Post Announcement</button>}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {items.map((a:any) => {
          const p = PRI[a.priority]||PRI.Normal
          const c = a.creator||{}
          return (
            <div key={a.id} style={{background:a.priority==='Urgent'?'rgba(239,68,68,0.04)':a.priority==='Important'?'rgba(251,191,36,0.04)':'var(--sf-surface)',border:'1px solid var(--sf-border)',borderLeft:`3px solid ${p.b}`,borderRadius:14,padding:'20px 22px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                <h3 style={{color:'var(--sf-text)',fontWeight:700,fontSize:16,fontFamily:"'Space Grotesk',sans-serif"}}>{p.label}{a.title}</h3>
                <span style={{background:p.c+'20',color:p.c,fontSize:10,padding:'3px 8px',borderRadius:5,fontWeight:700}}>{a.priority}</span>
              </div>
              <p style={{color:'#A0A0C0',fontSize:13,lineHeight:1.6,marginBottom:12}}>{a.body}</p>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <div style={{width:22,height:22,borderRadius:5,background:'var(--sf-accent)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--sf-text)',fontWeight:700,fontSize:9}}>{c.avatar||'?'}</div>
                  <span style={{color:'var(--sf-muted)',fontSize:11}}>{c.name||'Admin'}</span>
                </div>
                <span style={{color:'var(--sf-muted-2)',fontSize:11}}>{new Date(a.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
              </div>
            </div>
          )
        })}
        {items.length===0 && <div style={{textAlign:'center',padding:48,color:'var(--sf-muted-2)'}}><div style={{fontSize:36,marginBottom:12}}>📢</div><div>No announcements yet.</div></div>}
      </div>
      {showCreate && canPost && <CreateForm onClose={()=>setShowCreate(false)} onSaved={()=>{setShowCreate(false); load()}} />}
    </div>
  )
}

function CreateForm({ onClose, onSaved }: any) {
  const [t, setT] = useState('')
  const [b, setB] = useState('')
  const [p, setP] = useState('Normal')
  const [saving, setSaving] = useState(false)
  const sInp = { width:'100%',padding:'9px 12px',background:'var(--sf-surface-2)',border:'1px solid #2A2A45',borderRadius:8,color:'var(--sf-text)',fontSize:13,outline:'none',fontFamily:"'DM Sans',sans-serif" }
  async function save() {
    if (!t.trim()||!b.trim()) return
    setSaving(true)
    await fetch('/api/announcements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:t,body:b,priority:p})})
    setSaving(false); onSaved()
  }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}} onClick={onClose}>
      <div style={{background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:16,padding:28,width:'100%',maxWidth:500}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h3 style={{color:'var(--sf-text)',fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:700}}>New Announcement</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--sf-muted)',cursor:'pointer',fontSize:22}}>×</button>
        </div>
        {[['Title *',t,setT,false],['Message *',b,setB,true]].map(([l,v,s,m]) => (
          <div key={String(l)} style={{marginBottom:12}}>
            <label style={{color:'var(--sf-muted)',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5,display:'block'}}>{l}</label>
            {m ? <textarea value={String(v)} onChange={e=>(s as any)(e.target.value)} rows={4} style={{...sInp,resize:'vertical' as const}} /> : <input value={String(v)} onChange={e=>(s as any)(e.target.value)} style={sInp} />}
          </div>
        ))}
        <div style={{marginBottom:16}}>
          <label style={{color:'var(--sf-muted)',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5,display:'block'}}>Priority</label>
          <select value={p} onChange={e=>setP(e.target.value)} style={{...sInp,cursor:'pointer'}}>{['Normal','Important','Urgent'].map(o=><option key={o}>{o}</option>)}</select>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={save} disabled={!t||!b||saving} style={{padding:'10px 20px',background:'var(--sf-accent)',border:'none',borderRadius:9,color:'var(--sf-text)',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>{saving?'Posting…':'Post Announcement'}</button>
          <button onClick={onClose} style={{padding:'10px 20px',background:'var(--sf-surface-2)',border:'1px solid #2A2A45',borderRadius:9,color:'#A0A0C0',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
        </div>
      </div>
    </div>
  )
}