// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser } from '@/types'
import { EmptyState } from '@/components/app/Icons'
import { PageHeader, PageShell, Section } from '@/components/app/Section'
import { Modal } from '@/components/app/Modal'
import { formatApiError } from '@/lib/apiErrors'

export default function AnnouncementsClient({ session }: { session: SessionUser }) {
  const [items, setItems] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const canPost = ['owner','manager'].includes(session.role)

  function load() { return fetch('/api/announcements').then(r=>r.json()).then(d => { setItems(Array.isArray(d)?d:[]); setLoading(false) }) }
  useEffect(() => { load() }, [])

  const PRI: Record<string,{c:string;b:string;label:string}> = { Normal:{c:'var(--sf-muted)',b:'var(--sf-muted-2)',label:''}, Important:{c:'#FBBF24',b:'#FBBF24',label:''}, Urgent:{c:'#F87171',b:'#EF4444',label:''} }

  if (loading) return <div style={{color:'var(--sf-muted)',padding:40,textAlign:'center'}}>Loading…</div>

  return (
    <PageShell>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexShrink:0 }}>
        <PageHeader title="Announcements" subtitle={`${items.length} posts`} />
        {canPost && <button onClick={()=>setShowCreate(true)} className="sf-btn sf-btn-primary" style={{ marginTop:4 }}>New announcement</button>}
      </div>
      <Section title="All announcements" subtitle="Company updates and notices" flex={1}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {items.map((a:any) => {
          const p = PRI[a.priority]||PRI.Normal
          const c = a.creator||{}
          return (
            <div key={a.id} style={{background:a.priority==='Urgent'?'rgba(239,68,68,0.04)':a.priority==='Important'?'rgba(251,191,36,0.04)':'var(--sf-surface)',border:'1px solid var(--sf-border)',borderLeft:`3px solid ${p.b}`,borderRadius:14,padding:'20px 22px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                <h3 style={{color:'var(--sf-text)',fontWeight:700,fontSize:16,fontFamily:"'Space Grotesk',sans-serif"}}>{p.label}{a.title}</h3>
                <span style={{background:p.c+'20',color:p.c,fontSize:10,padding:'3px 8px',borderRadius:5,fontWeight:700}}>{a.priority}</span>
              </div>
              <p style={{color:'var(--sf-text-secondary)',fontSize:13,lineHeight:1.6,marginBottom:12}}>{a.body}</p>
              {(a.event_date || a.image_url || a.link_url) && (
                <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
                  {a.event_date && <div style={{color:'#FBBF24',fontSize:12,fontWeight:600}}>Date: {a.event_date}</div>}
                  {a.image_url && <img src={a.image_url} alt="" style={{maxWidth:'100%',borderRadius:8,border:'1px solid var(--sf-border)'}} />}
                  {a.link_url && <a href={a.link_url} target="_blank" rel="noreferrer" style={{color:'#60A5FA',fontSize:13}}>{a.link_url}</a>}
                </div>
              )}
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
        {items.length===0 && <EmptyState icon="announcements" title="No announcements yet." />}
        </div>
      </Section>
      {showCreate && canPost && (
        <Modal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          title="New announcement"
          subtitle="Post a company-wide notice"
          width={500}
          footer={
            <>
              <button type="button" className="sf-btn sf-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" form="sf-announcement-form" className="sf-btn sf-btn-primary">Post announcement</button>
            </>
          }
        >
          <CreateForm onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />
        </Modal>
      )}
    </PageShell>
  )
}

function CreateForm({ onClose, onSaved }: any) {
  const [t, setT] = useState('')
  const [b, setB] = useState('')
  const [p, setP] = useState('Normal')
  const [eventDate, setEventDate] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!t.trim() || !b.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: t, body: b, priority: p, event_date: eventDate || null, image_url: imageUrl || null, link_url: linkUrl || null }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(formatApiError(data, 'Could not post announcement'))
      return
    }
    onSaved()
  }

  return (
    <form id="sf-announcement-form" onSubmit={save}>
      {error && <div className="sf-notice sf-notice-error" style={{ marginBottom: 12 }}>{error}</div>}
      <label className="sf-label">Title *</label>
      <input className="sf-input" value={t} onChange={e => setT(e.target.value)} required style={{ marginBottom: 12 }} />
      <label className="sf-label">Message *</label>
      <textarea className="sf-input" value={b} onChange={e => setB(e.target.value)} rows={4} required style={{ marginBottom: 12, resize: 'vertical' }} />
      <label className="sf-label">Event date</label>
      <input type="date" className="sf-input" value={eventDate} onChange={e => setEventDate(e.target.value)} style={{ marginBottom: 12 }} />
      <label className="sf-label">Image URL</label>
      <input className="sf-input" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://…/image.jpg" style={{ marginBottom: 12 }} />
      <label className="sf-label">Link URL</label>
      <input className="sf-input" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…" style={{ marginBottom: 12 }} />
      <label className="sf-label">Priority</label>
      <select className="sf-input" value={p} onChange={e => setP(e.target.value)} style={{ marginBottom: 4 }}>
        {['Normal', 'Important', 'Urgent'].map(o => <option key={o}>{o}</option>)}
      </select>
      <div style={{ display: 'none' }}>
        <button type="button" onClick={onClose} />
        <button type="submit" disabled={!t || !b || saving}>{saving ? 'Posting…' : 'Post'}</button>
      </div>
    </form>
  )
}