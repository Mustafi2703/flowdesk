// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser, TaskStatus, STATUS_BG, STATUS_TEXT } from '@/types'

const STATUSES: TaskStatus[] = ['Not Started','In Progress','Under Review','Revision Needed','Completed','On Hold','Struggling','Needs Attention']
const PRIORITIES = ['Critical','High','Medium','Low']
const TYPES = ['Design','Content','Development','Strategy','Operations','Other']

function Chip({ status }: { status: string }) {
  return <span style={{ background: STATUS_BG[status]||'#F3F4F6', color: STATUS_TEXT[status]||'#374151', fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:5, whiteSpace:'nowrap' }}>{status}</span>
}

function PriBadge({ p }: { p: string }) {
  const map: Record<string,{bg:string;c:string}> = { Critical:{bg:'#EF4444',c:'white'}, High:{bg:'#F97316',c:'white'}, Medium:{bg:'#FBBF24',c:'#1A1A00'}, Low:{bg:'#22C55E',c:'white'} }
  const s = map[p]||{bg:'#6B7280',c:'white'}
  return <span style={{ background:s.bg, color:s.c, fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:4, textTransform:'uppercase' }}>{p}</span>
}

const inputSt = { width:'100%', padding:'9px 12px', background:'#1A1A2E', border:'1px solid #2A2A45', borderRadius:8, color:'white', fontSize:13, outline:'none', fontFamily:"'DM Sans',sans-serif" }

export default function TasksClient({ session }: { session: SessionUser }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [view, setView] = useState<'list'|'kanban'>('list')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterBrand, setFilterBrand] = useState('All')
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  const canCreate = ['owner','manager'].includes(session.role)
  const canSeeBilling = ['owner','manager','accountant'].includes(session.role)

  function load() {
    return Promise.all([
      fetch('/api/tasks').then(r=>r.json()),
      fetch('/api/brands').then(r=>r.json()),
      fetch('/api/users').then(r=>r.json()),
    ]).then(([t,b,u]) => {
      setTasks(Array.isArray(t)?t:[])
      setBrands(Array.isArray(b)?b:[])
      setUsers(Array.isArray(u)?u:[])
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/tasks/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) })
    setTasks(prev => prev.map(t => t.id===id ? {...t,status} : t))
  }

  const filtered = tasks.filter(t =>
    (filterStatus==='All'||t.status===filterStatus) &&
    (filterBrand==='All'||t.brand_id===filterBrand)
  )

  if (loading) return <div style={{ color:'#6B6B8A', padding:40, textAlign:'center' }}>Loading tasks…</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ color:'white', fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>
          {['team','developer'].includes(session.role)?'My Tasks':'All Tasks'} ({filtered.length})
        </h2>
        {canCreate && <button onClick={() => setShowCreate(true)} style={{ padding:'9px 18px', background:'#E8630A', border:'none', borderRadius:9, color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>+ New Task</button>}
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', background:'#111120', border:'1px solid #1E1E35', borderRadius:9, overflow:'hidden' }}>
          {(['list','kanban'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding:'7px 14px', background:view===v?'#E8630A':'transparent', border:'none', color:view===v?'white':'#6B6B8A', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>
              {v==='list'?'≡ List':'⊞ Kanban'}
            </button>
          ))}
        </div>
        {['All',...STATUSES.slice(0,5)].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{ padding:'5px 10px', background:filterStatus===s?'rgba(232,99,10,0.15)':'#111120', border:filterStatus===s?'1px solid #E8630A':'1px solid #1E1E35', borderRadius:7, color:filterStatus===s?'#E8630A':'#6B6B8A', cursor:'pointer', fontSize:11, fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>{s}</button>
        ))}
        <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={{ padding:'5px 10px', background:'#111120', border:'1px solid #1E1E35', borderRadius:7, color:'#A0A0C0', fontSize:12, cursor:'pointer', marginLeft:'auto' }}>
          <option value="All">All Brands</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {view==='list' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(task => {
            const dl = task.due_date ? Math.ceil((new Date(task.due_date).getTime()-Date.now())/86400000) : null
            const late = dl!==null && dl<0 && task.status!=='Completed'
            return (
              <div key={task.id} style={{ background:'#111120', border:'1px solid', borderColor:late?'rgba(239,68,68,0.4)':'#1E1E35', borderLeft: late?'3px solid #EF4444':task.status==='Struggling'?'3px solid #F59E0B':'1px solid #1E1E35', borderRadius:12, padding:'13px 16px', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:3, flexWrap:'wrap' }}>
                    {task.task_mode==='project' && <span style={{ background:'rgba(6,182,212,0.15)',color:'#06B6D4',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:3 }}>PROJECT</span>}
                    {task.is_billable && canSeeBilling && <span style={{ background:'rgba(236,72,153,0.15)',color:'#EC4899',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:3 }}>₹ Billable</span>}
                    {task.recurring_config?.enabled && <span style={{ background:'rgba(139,92,246,0.15)',color:'#8B5CF6',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:3 }}>↻</span>}
                    <span style={{ color:'white', fontWeight:600, fontSize:13 }}>{task.title}</span>
                  </div>
                  <div style={{ color:'#6B6B8A', fontSize:11 }}>{task.brand?.name||'No brand'} · {task.type}</div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                  <Chip status={task.status} />
                  <PriBadge p={task.priority||'Low'} />
                  {dl!==null && <span style={{ color:late?'#F87171':'#6B6B8A', fontSize:11 }}>{late?`${Math.abs(dl)}d late`:dl===0?'Today':`${dl}d`}</span>}
                </div>
              </div>
            )
          })}
          {filtered.length===0 && <div style={{ color:'#4A4A6A', textAlign:'center', padding:40 }}>No tasks match your filters.</div>}
        </div>
      ) : (
        <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:12 }}>
          {(['Not Started','In Progress','Under Review','Revision Needed','Completed','On Hold'] as TaskStatus[]).map(col => {
            const colTasks = filtered.filter(t => t.status===col)
            return (
              <div key={col} style={{ minWidth:220, flex:'0 0 220px', background:'#111120', border:'1px solid #1E1E35', borderRadius:12, padding:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                  <span style={{ color:'#A0A0C0', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{col}</span>
                  <span style={{ background:'#1A1A2E', color:'#6B6B8A', fontSize:10, padding:'1px 6px', borderRadius:4 }}>{colTasks.length}</span>
                </div>
                {colTasks.map(task => (
                  <div key={task.id} style={{ background:'#16162A', border:'1px solid #2A2A45', borderRadius:9, padding:10, marginBottom:7 }}>
                    <div style={{ color:'white', fontSize:12, fontWeight:600, marginBottom:4 }}>{task.title}</div>
                    <div style={{ color:'#6B6B8A', fontSize:10, marginBottom:6 }}>{task.brand?.name||'—'}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <PriBadge p={task.priority||'Low'} />
                      {task.due_date && <span style={{ color:'#6B6B8A', fontSize:10 }}>{Math.ceil((new Date(task.due_date).getTime()-Date.now())/86400000)}d</span>}
                    </div>
                  </div>
                ))}
                {colTasks.length===0 && <div style={{ color:'#3A3A5A', fontSize:11, textAlign:'center', padding:'14px 0' }}>Empty</div>}
              </div>
            )
          })}
        </div>
      )}

      {showCreate && canCreate && (
        <CreateModal session={session} brands={brands} users={users} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} canSeeBilling={canSeeBilling} />
      )}
    </div>
  )
}

function CreateModal({ session, brands, users, onClose, onSaved, canSeeBilling }: any) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [brandId, setBrandId] = useState(brands[0]?.id||'')
  const [assignedTo, setAssignedTo] = useState<string[]>([])
  const [type, setType] = useState('Design')
  const [priority, setPriority] = useState('Medium')
  const [taskMode, setTaskMode] = useState('standard')
  const [dueDate, setDueDate] = useState('')
  const [isBillable, setIsBillable] = useState(false)
  const [requiresReview, setRequiresReview] = useState(true)
  const [recurring, setRecurring] = useState(false)
  const [recurFreq, setRecurFreq] = useState('monthly')
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  const teamUsers = users.filter((u:any) => ['team','developer'].includes(u.role))

  async function aiWrite() {
    if (!title) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/task-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          brand_id: brandId || null,
          type,
        }),
      })
      const data = await res.json()
      if (data.description) setDesc(data.description)
    } catch {}
    setAiLoading(false)
  }

  async function save() {
    if (!title||!dueDate) return
    setSaving(true)
    await fetch('/api/tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
      title, description:desc, brand_id:brandId||null, assigned_to:assignedTo,
      assigned_managers:[session.id], type, task_mode:taskMode, priority, due_date:dueDate,
      requires_review:requiresReview, is_billable:isBillable,
      recurring_config: recurring ? { enabled:true, frequency:recurFreq, next_due:dueDate } : null,
    })})
    setSaving(false)
    onSaved()
  }

  const sInp = { width:'100%', padding:'9px 12px', background:'#1A1A2E', border:'1px solid #2A2A45', borderRadius:8, color:'white', fontSize:13, outline:'none', fontFamily:"'DM Sans',sans-serif" }
  const sSel = { ...sInp, cursor:'pointer' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }} onClick={onClose}>
      <div style={{ background:'#111120', border:'1px solid #1E1E35', borderRadius:16, padding:28, width:'100%', maxWidth:560, maxHeight:'88vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ color:'white', fontFamily:"'Space Grotesk',sans-serif", fontSize:18, fontWeight:700 }}>Create New Task</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6B6B8A', cursor:'pointer', fontSize:22 }}>×</button>
        </div>

        {/* Mode */}
        <div style={{ display:'flex', background:'#16162A', borderRadius:9, overflow:'hidden', marginBottom:16 }}>
          {[['standard','Standard Task'],['project','Project Task (Sub-tasks)']].map(([m,l]) => (
            <button key={m} onClick={() => setTaskMode(m)} style={{ flex:1, padding:'9px', background:taskMode===m?(m==='project'?'#06B6D4':'#E8630A'):'transparent', border:'none', color:taskMode===m?'white':'#6B6B8A', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>{l}</button>
          ))}
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ color:'#8888AA', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, display:'block' }}>Task Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Dinamoo Instagram Campaign" style={sInp} />
        </div>

        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
            <label style={{ color:'#8888AA', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>Description</label>
            <button onClick={aiWrite} disabled={!title||aiLoading} style={{ background:'rgba(232,99,10,0.15)', border:'1px solid rgba(232,99,10,0.3)', borderRadius:6, color:'#E8630A', fontSize:11, fontWeight:700, padding:'3px 9px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              {aiLoading?'Writing…':'✦ AI Write'}
            </button>
          </div>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe the task…" rows={3} style={{ ...sInp, resize:'vertical' }} />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <div>
            <label style={{ color:'#8888AA', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, display:'block' }}>Brand</label>
            <select value={brandId} onChange={e => setBrandId(e.target.value)} style={sSel}>
              <option value="">No brand</option>
              {brands.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color:'#8888AA', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, display:'block' }}>Type</label>
            <select value={type} onChange={e => setType(e.target.value)} style={sSel}>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color:'#8888AA', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, display:'block' }}>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)} style={sSel}>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color:'#8888AA', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, display:'block' }}>Due Date *</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={sInp} />
          </div>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ color:'#8888AA', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:7, display:'block' }}>Assign To</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {teamUsers.map((u:any) => (
              <button key={u.id} onClick={() => setAssignedTo(p => p.includes(u.id)?p.filter(x=>x!==u.id):[...p,u.id])}
                style={{ padding:'5px 10px', background:assignedTo.includes(u.id)?'rgba(16,185,129,0.15)':'#1A1A2E', border:`1px solid ${assignedTo.includes(u.id)?'#10B981':'#2A2A45'}`, borderRadius:7, color:assignedTo.includes(u.id)?'#10B981':'#6B6B8A', cursor:'pointer', fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>
                {u.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background:'#16162A', borderRadius:10, padding:14, marginBottom:16, display:'flex', flexDirection:'column', gap:10 }}>
          {[
            ['Billable Task', isBillable, setIsBillable, '#EC4899', canSeeBilling],
            ['Requires Review', requiresReview, setRequiresReview, '#F59E0B', true],
            ['Recurring Task', recurring, setRecurring, '#8B5CF6', true],
          ].filter(([,,,,show]) => show).map(([label, val, set, color]: any) => (
            <label key={label} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
              <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} style={{ accentColor:color, width:14, height:14 }} />
              <span style={{ color, fontWeight:600, fontSize:13 }}>{label}</span>
            </label>
          ))}
          {recurring && (
            <select value={recurFreq} onChange={e => setRecurFreq(e.target.value)} style={{ ...sSel, width:180, marginTop:4 }}>
              {['daily','weekly','monthly','yearly'].map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
            </select>
          )}
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={save} disabled={!title||!dueDate||saving} style={{ padding:'10px 20px', background:'#E8630A', border:'none', borderRadius:9, color:'white', fontWeight:700, fontSize:13, cursor:(!title||!dueDate||saving)?'not-allowed':'pointer', opacity:(!title||!dueDate)?0.5:1, fontFamily:"'DM Sans',sans-serif" }}>
            {saving?'Creating…':'Create Task'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 20px', background:'#1A1A2E', border:'1px solid #2A2A45', borderRadius:9, color:'#A0A0C0', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}