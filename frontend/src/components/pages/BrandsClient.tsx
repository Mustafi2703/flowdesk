// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser, STATUS_BG, STATUS_TEXT } from '@/types'
import { EmptyState, Icon } from '@/components/app/Icons'
import { PageHeader, PageShell, Section } from '@/components/app/Section'

const sInp = { width:'100%', padding:'9px 12px', background:'var(--sf-surface-2)', border:'1px solid #2A2A45', borderRadius:8, color:'var(--sf-text)', fontSize:13, outline:'none', fontFamily:"'DM Sans',sans-serif" }

export default function BrandsClient({ session }: { session: SessionUser }) {
  const [brands, setBrands] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const canEdit = ['owner','manager'].includes(session.role)

  function load() {
    return Promise.all([
      fetch('/api/brands').then(r=>r.json()),
      fetch('/api/tasks').then(r=>r.json()),
      fetch('/api/users').then(r=>r.json()),
    ]).then(([b,t,u]) => {
      setBrands(Array.isArray(b)?b:[])
      setTasks(Array.isArray(t)?t:[])
      setUsers(Array.isArray(u)?u:[])
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  const visible = session.role==='team' ? brands.filter(b=>b.assigned_members?.includes(session.id)) : brands
  const TC: Record<string,string> = { Retainer:'#3B82F6','Project-Based':'#8B5CF6','One-Time':'#6B7280',Internal:'#10B981' }
  const PD: Record<string,string> = { P1:'#EF4444',P2:'#F97316',P3:'#FBBF24',P4:'#22C55E' }

  if (selected) return <BrandDetail brand={selected} tasks={tasks.filter(t=>t.brand_id===selected.id)} users={users} canEdit={canEdit} onBack={() => setSelected(null)} onUpdate={async (u:any) => { await fetch(`/api/brands/${selected.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(u)}); setSelected({...selected,...u}); load() }} />

  if (loading) return <div style={{ color:'var(--sf-muted)', padding:40, textAlign:'center' }}>Loading brands…</div>

  return (
    <PageShell>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexShrink:0 }}>
        <PageHeader title={session.role==='team'?'My brands':'Brands'} subtitle={`${visible.length} brands`} />
        {canEdit && <button onClick={() => setShowCreate(true)} className="sf-btn sf-btn-primary" style={{ marginTop:4 }}>Add brand</button>}
      </div>
      {!loading && visible.length===0 && (
        <Section title="Brands" flex={1}>
          <EmptyState icon="brands" title={session.role==='team' ? 'No brands assigned to you yet.' : 'No brands yet.'} />
        </Section>
      )}
      {visible.length > 0 && (
        <Section title="All brands" subtitle="Click a card for details" flex={1}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(288px,1fr))', gap:16 }}>
        {visible.map(b => {
          const bt = tasks.filter(t=>t.brand_id===b.id)
          const fl = bt.filter(t=>['Struggling','Needs Attention'].includes(t.status))
          const done = bt.filter(t=>t.status==='Completed').length
          return (
            <div key={b.id} onClick={() => setSelected(b)} style={{ background:'var(--sf-surface)', border:'1px solid var(--sf-border)', borderRadius:14, padding:20, cursor:'pointer', transition:'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--sf-accent)'; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--sf-border)'; e.currentTarget.style.transform='translateY(0)' }}>
              <div style={{ display:'flex', gap:12, marginBottom:12, alignItems:'flex-start' }}>
                <div style={{ width:46, height:46, background:'linear-gradient(135deg,#E8630A,#FF9A4A)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--sf-text)', fontWeight:800, fontSize:14, flexShrink:0 }}>{b.logo||b.name?.slice(0,2)}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:'var(--sf-text)', fontWeight:700, fontSize:14, marginBottom:4 }}>{b.name}</div>
                  <div style={{ display:'flex', gap:5 }}>
                    <span style={{ background:(TC[b.client_type]||'#6B7280')+'20', color:TC[b.client_type]||'#6B7280', fontSize:10, padding:'2px 6px', borderRadius:4, fontWeight:700 }}>{b.client_type}</span>
                    <span style={{ display:'flex', alignItems:'center', gap:3, color:'var(--sf-muted)', fontSize:11 }}><span style={{ width:6,height:6,borderRadius:'50%',background:PD[b.priority]||'#6B7280',display:'inline-block' }}></span>{b.priority}</span>
                  </div>
                </div>
                {fl.length>0 && <div style={{ background:'rgba(239,68,68,0.15)', color:'#F87171', fontSize:10, fontWeight:700, padding:'3px 7px', borderRadius:5, flexShrink:0 }}>⚠ {fl.length}</div>}
              </div>
              <p style={{ color:'var(--sf-muted)', fontSize:12, lineHeight:1.5, marginBottom:12, overflow:'hidden', display:'-webkit-box' as any, WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any }}>{b.description}</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                {[['Tasks',bt.length,'white'],['Flagged',fl.length,fl.length>0?'#F87171':'white'],['Done',done,'#10B981']].map(([l,v,c]) => (
                  <div key={String(l)} style={{ background:'var(--sf-surface-2)', borderRadius:8, padding:'8px', textAlign:'center' }}>
                    <div style={{ color:String(c), fontWeight:700, fontSize:16 }}>{v}</div>
                    <div style={{ color:'var(--sf-muted)', fontSize:10 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ height:4, background:'var(--sf-surface-2)', borderRadius:2, overflow:'hidden' }}>
                <div style={{ width: bt.length>0?`${Math.round(done/bt.length*100)}%`:'0%', height:'100%', background:'#10B981', borderRadius:2 }} />
              </div>
            </div>
          )
        })}
          </div>
        </Section>
      )}
      {showCreate && canEdit && <CreateBrand onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />}
    </PageShell>
  )
}

function BrandDetail({ brand, tasks, users, canEdit, onBack, onUpdate }: any) {
  const [tab, setTab] = useState('overview')
  const TABS = [{id:'overview',label:'Overview'},{id:'tasks',label:`Tasks (${tasks.length})`},{id:'goals',label:'Goals'},{id:'identity',label:'Identity'},{id:'journey',label:'Journey'}]
  const fl = tasks.filter((t:any)=>['Struggling','Needs Attention'].includes(t.status))
  const done = tasks.filter((t:any)=>t.status==='Completed').length

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <button onClick={onBack} style={{ background:'var(--sf-surface-2)', border:'1px solid #2A2A45', borderRadius:8, color:'#A0A0C0', padding:'6px 14px', cursor:'pointer', fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>← Brands</button>
        <span style={{ color:'var(--sf-muted-2)' }}>/</span>
        <span style={{ color:'var(--sf-text)', fontWeight:600, fontSize:14 }}>{brand.name}</span>
      </div>
      <div style={{ background:'linear-gradient(135deg,var(--sf-surface),#16162A)', border:'1px solid var(--sf-border)', borderRadius:16, padding:'24px 28px', marginBottom:20 }}>
        <div style={{ display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap' }}>
          <div style={{ width:60,height:60,background:'linear-gradient(135deg,#E8630A,#FF9A4A)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--sf-text)',fontWeight:800,fontSize:20,flexShrink:0 }}>{brand.logo||brand.name?.slice(0,2)}</div>
          <div style={{ flex:1, minWidth:200 }}>
            <h1 style={{ color:'var(--sf-text)',fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:700,marginBottom:6 }}>{brand.name}</h1>
            <div style={{ display:'flex',gap:8,marginBottom:8,flexWrap:'wrap' }}>
              <span style={{ background:'#3B82F620',color:'#3B82F6',fontSize:11,padding:'3px 8px',borderRadius:6,fontWeight:700 }}>{brand.client_type}</span>
              <span style={{ background:'#8B5CF620',color:'#8B5CF6',fontSize:11,padding:'3px 8px',borderRadius:6,fontWeight:700 }}>{brand.priority}</span>
            </div>
            <p style={{ color:'#A0A0C0', fontSize:13, lineHeight:1.6 }}>{brand.description}</p>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,flexShrink:0 }}>
            {[['Total',tasks.length,'#3B82F6'],['Done',done,'#10B981'],['Flagged',fl.length,'#EF4444']].map(([l,v,c]) => (
              <div key={String(l)} style={{ background:'var(--sf-bg)',borderRadius:10,padding:'10px 14px',textAlign:'center',border:'1px solid var(--sf-border)' }}>
                <div style={{ color:String(c),fontWeight:700,fontSize:20,fontFamily:"'Space Grotesk',sans-serif" }}>{v}</div>
                <div style={{ color:'var(--sf-muted)',fontSize:10,marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display:'flex',gap:2,background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:12,padding:4,marginBottom:20,overflowX:'auto' }}>
        {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'8px 18px',background:tab===t.id?'var(--sf-accent)':'transparent',border:'none',borderRadius:9,color:tab===t.id?'white':'var(--sf-muted)',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap' }}>{t.label}</button>)}
      </div>
      {tab==='overview' && (
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
          {fl.length>0 && <div style={{ gridColumn:'1/-1',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:12,padding:16 }}>
            <div style={{ color:'#F87171',fontWeight:700,fontSize:13,marginBottom:10 }}>⚠ Flagged Tasks ({fl.length})</div>
            {fl.map((t:any) => <div key={t.id} style={{ display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid rgba(239,68,68,0.1)' }}><span style={{ color:'#C0C0D0',fontSize:13 }}>{t.title}</span><span style={{ background:STATUS_BG[t.status]||'#F3F4F6',color:STATUS_TEXT[t.status]||'#374151',fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5 }}>{t.status}</span></div>)}
          </div>}
          <div style={{ background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:12,padding:18 }}>
            <div style={{ color:'var(--sf-muted)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12 }}>Recent Tasks</div>
            {tasks.slice(0,5).map((t:any) => <div key={t.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:'var(--sf-surface-2)',borderRadius:7,marginBottom:5 }}><span style={{ color:'#C0C0D0',fontSize:12 }}>{t.title}</span><span style={{ background:STATUS_BG[t.status]||'#F3F4F6',color:STATUS_TEXT[t.status]||'#374151',fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:4 }}>{t.status}</span></div>)}
            {tasks.length===0 && <div style={{ color:'var(--sf-muted-2)',fontSize:12 }}>No tasks yet.</div>}
          </div>
          <div style={{ background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:12,padding:18 }}>
            <div style={{ color:'var(--sf-muted)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12 }}>Assigned Team</div>
            {(brand.assigned_members||[]).map((uid:string) => { const u=users.find((u:any)=>u.id===uid); if(!u) return null; return <div key={uid} style={{ display:'flex',gap:8,alignItems:'center',padding:'8px 10px',background:'var(--sf-surface-2)',borderRadius:7,marginBottom:5 }}><div style={{ width:28,height:28,borderRadius:6,background:'var(--sf-accent)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--sf-text)',fontWeight:700,fontSize:10 }}>{u.avatar||u.name?.slice(0,2)}</div><div><div style={{ color:'var(--sf-text)',fontSize:12,fontWeight:600 }}>{u.name}</div><div style={{ color:'var(--sf-muted)',fontSize:10 }}>{u.designation}</div></div></div> })}
            {!(brand.assigned_members?.length>0) && <div style={{ color:'var(--sf-muted-2)',fontSize:12 }}>No team assigned.</div>}
          </div>
        </div>
      )}
      {tab==='tasks' && (
        <div>
          {tasks.length===0 && <div style={{ textAlign:'center',padding:40,color:'var(--sf-muted-2)' }}>No tasks for this brand.</div>}
          {tasks.map((t:any) => <div key={t.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px',background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:10,marginBottom:8 }}><div><div style={{ color:'var(--sf-text)',fontSize:13,fontWeight:600,marginBottom:2 }}>{t.title}</div><div style={{ color:'var(--sf-muted)',fontSize:11 }}>{t.type} · Due {t.due_date}</div></div><span style={{ background:STATUS_BG[t.status]||'#F3F4F6',color:STATUS_TEXT[t.status]||'#374151',fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:5 }}>{t.status}</span></div>)}
        </div>
      )}
      {tab==='goals' && (
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
          {[['Short-Term Goals','var(--sf-accent)',brand.short_term_goals||[]],['Long-Term Goals','#3B82F6',brand.long_term_goals||[]]].map(([title,color,items]) => (
            <div key={String(title)} style={{ background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:12,padding:18 }}>
              <div style={{ color:String(color),fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12 }}>{title}</div>
              {(items as string[]).map((g,i) => <div key={i} style={{ display:'flex',gap:8,padding:'7px 0',borderBottom:'1px solid var(--sf-border)' }}><span style={{ color:String(color) }}>→</span><span style={{ color:'#C0C0D0',fontSize:13 }}>{g}</span></div>)}
              {!(items as string[]).length && <div style={{ color:'var(--sf-muted-2)',fontSize:12 }}>None set yet.</div>}
            </div>
          ))}
          <div style={{ gridColumn:'1/-1' as any, background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:12,padding:18 }}>
            <div style={{ color:'#10B981',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10 }}>Responsibilities</div>
            <p style={{ color:'#C0C0D0',fontSize:13,lineHeight:1.7 }}>{brand.responsibilities||'Not specified.'}</p>
          </div>
        </div>
      )}
      {tab==='identity' && (
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
          <div style={{ background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:12,padding:18 }}>
            <div style={{ color:'var(--sf-muted)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12 }}>Brand Info</div>
            {[['Name',brand.name],['Client Type',brand.client_type],['Priority',brand.priority],['Team',`${brand.assigned_members?.length||0} members`]].map(([l,v]) => <div key={String(l)} style={{ display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--sf-border)' }}><span style={{ color:'var(--sf-muted)',fontSize:12 }}>{l}</span><span style={{ color:'var(--sf-text)',fontSize:12,fontWeight:600 }}>{v}</span></div>)}
          </div>
          <div style={{ background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:12,padding:18 }}>
            <div style={{ color:'var(--sf-muted)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12 }}>Coming Soon</div>
            {['Brand Fonts','Logo Variants','Brand Colors','Product Images','Photography Style','Brand Voice'].map(item => <div key={item} style={{ display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderBottom:'1px solid var(--sf-border)' }}><span style={{ width:14,height:14,border:'1px solid var(--sf-border-strong)',borderRadius:3,display:'inline-block' }} /><span style={{ color:'var(--sf-muted-2)',fontSize:12 }}>{item}</span><span style={{ marginLeft:'auto',background:'var(--sf-surface-2)',color:'var(--sf-muted-2)',fontSize:9,padding:'2px 6px',borderRadius:4 }}>Soon</span></div>)}
          </div>
        </div>
      )}
      {tab==='journey' && (
        <div>
          <div style={{ textAlign:'center',padding:'40px 20px' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:12, color:'var(--sf-muted)' }}>
              <Icon name="map" size={40} />
            </div>
            <div style={{ color:'#A0A0C0',fontWeight:600,fontSize:16,fontFamily:"'Space Grotesk',sans-serif",marginBottom:8 }}>Brand Journey — Coming Next</div>
            <div style={{ color:'var(--sf-muted-2)',fontSize:13,maxWidth:440,margin:'0 auto' }}>Campaign history, milestone timeline, monthly tasks, and full brand story will live here.</div>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(185px,1fr))',gap:10,marginTop:20 }}>
            {['Monthly Task Calendar','Campaign Timeline','Key Milestones','Performance History','Client Communication Log','Deliverables Archive','Blog Management','Category Management'].map(item => <div key={item} style={{ background:'var(--sf-surface)',border:'1px dashed #2A2A45',borderRadius:10,padding:16,textAlign:'center' }}><div style={{ color:'var(--sf-muted-2)',fontSize:20,marginBottom:8 }}>+</div><div style={{ color:'var(--sf-muted-2)',fontSize:12 }}>{item}</div></div>)}
          </div>
        </div>
      )}
    </div>
  )
}

function CreateBrand({ onClose, onSaved }: any) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [ct, setCt] = useState('Retainer')
  const [priority, setPriority] = useState('P2')
  const [resp, setResp] = useState('')
  const [saving, setSaving] = useState(false)
  const sInp = { width:'100%',padding:'9px 12px',background:'var(--sf-surface-2)',border:'1px solid #2A2A45',borderRadius:8,color:'var(--sf-text)',fontSize:13,outline:'none',fontFamily:"'DM Sans',sans-serif" }
  async function save() {
    if (!name.trim()) return
    setSaving(true)
    await fetch('/api/brands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,logo:name.slice(0,2).toUpperCase(),description:desc,client_type:ct,priority,responsibilities:resp,short_term_goals:[],long_term_goals:[],assigned_members:[]})})
    setSaving(false); onSaved()
  }
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20 }} onClick={onClose}>
      <div style={{ background:'var(--sf-surface)',border:'1px solid var(--sf-border)',borderRadius:16,padding:28,width:'100%',maxWidth:500 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}><h3 style={{ color:'var(--sf-text)',fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:700 }}>Add New Brand</h3><button onClick={onClose} style={{ background:'none',border:'none',color:'var(--sf-muted)',cursor:'pointer',fontSize:22 }}>×</button></div>
        {[['Brand Name *',name,setName,'text','e.g. Quick Furnish',false],['Description',desc,setDesc,'text','Brief description…',true],['Responsibilities',resp,setResp,'text','What does the agency handle?',true]].map(([label,val,set,type,ph,multi]) => (
          <div key={String(label)} style={{ marginBottom:12 }}>
            <label style={{ color:'var(--sf-muted)',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5,display:'block' }}>{label}</label>
            {multi ? <textarea value={String(val)} onChange={e=>(set as any)(e.target.value)} placeholder={String(ph)} rows={2} style={{ ...sInp,resize:'vertical' as const }} /> : <input value={String(val)} onChange={e=>(set as any)(e.target.value)} placeholder={String(ph)} style={sInp} />}
          </div>
        ))}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16 }}>
          {[['Client Type',ct,setCt,['Retainer','Project-Based','One-Time','Internal']],['Priority',priority,setPriority,['P1','P2','P3','P4']]].map(([label,val,set,opts]) => (
            <div key={String(label)}>
              <label style={{ color:'var(--sf-muted)',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5,display:'block' }}>{label}</label>
              <select value={String(val)} onChange={e=>(set as any)(e.target.value)} style={{ ...sInp,cursor:'pointer' }}>{(opts as string[]).map(o=><option key={o}>{o}</option>)}</select>
            </div>
          ))}
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <button onClick={save} disabled={!name||saving} style={{ padding:'10px 20px',background:'var(--sf-accent)',border:'none',borderRadius:9,color:'var(--sf-text)',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }}>{saving?'Creating…':'Create Brand'}</button>
          <button onClick={onClose} style={{ padding:'10px 20px',background:'var(--sf-surface-2)',border:'1px solid #2A2A45',borderRadius:9,color:'#A0A0C0',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:"'DM Sans',sans-serif" }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

