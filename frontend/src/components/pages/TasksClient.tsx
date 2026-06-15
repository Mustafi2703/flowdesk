// @ts-nocheck
'use client'
import { useEffect, useMemo, useState } from 'react'
import { SessionUser, TaskStatus } from '@/types'
import { Icon } from '@/components/app/Icons'
import { PageHeader, PageShell, Section } from '@/components/app/Section'

const STATUSES: TaskStatus[] = ['Not Started','In Progress','Under Review','Revision Needed','Completed','On Hold','Struggling','Needs Attention']
const PRIORITIES = ['Critical','High','Medium','Low']
const TYPES = ['Design','Content','Development','Strategy','Operations','Other']
const PRIORITY_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }
type SortKey = 'due_date' | 'priority' | 'status' | 'title' | 'brand'

function statusClass(status: string) {
  const map: Record<string, string> = {
    'Not Started': 'sf-status-neutral',
    'In Progress': 'sf-status-progress',
    'Under Review': 'sf-status-review',
    'Revision Needed': 'sf-status-warning',
    Completed: 'sf-status-done',
    'On Hold': 'sf-status-neutral',
    Struggling: 'sf-status-danger',
    'Needs Attention': 'sf-status-warning',
  }
  return map[status] || 'sf-status-neutral'
}

function priorityLabel(p: string) {
  return p || 'Low'
}

const inputSt = { width:'100%', padding:'9px 12px', background:'var(--sf-surface-2)', border:'1px solid var(--sf-border)', borderRadius:8, color:'var(--sf-text)', fontSize:13, outline:'none', fontFamily:"'DM Sans',sans-serif" }

function newSubTaskId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `st-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function normalizeSubTasks(raw: any[] | undefined) {
  return (raw || []).map((st) => ({
    id: st.id || newSubTaskId(),
    title: st.title || '',
    assigned_to: st.assigned_to || [],
    status: st.status || 'Not Started',
    due_date: st.due_date || '',
  }))
}

export default function TasksClient({ session }: { session: SessionUser }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [view, setView] = useState<'list'|'kanban'>('list')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterBrand, setFilterBrand] = useState('All')
  const [sortBy, setSortBy] = useState<SortKey>('due_date')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [showCreate, setShowCreate] = useState(false)
  const [editingTask, setEditingTask] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const canCreate = ['owner','manager'].includes(session.role)
  const canEdit = canCreate
  const canDelete = canCreate
  const canSeeBilling = ['owner','manager','accountant'].includes(session.role)

  function isAssigned(task: any) {
    return (task.assigned_to || []).includes(session.id)
  }

  function canUpdateStatus(task: any) {
    return canEdit || isAssigned(task)
  }

  function openTask(task: any) {
    if (canEdit) setEditingTask(task)
  }

  async function deleteTask(task: any) {
    if (!canDelete) return
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return
    const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not delete task')
      return
    }
    if (editingTask?.id === task.id) setEditingTask(null)
    load()
  }

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

  const filtered = useMemo(() => {
    const rows = tasks.filter(t =>
      (filterStatus==='All'||t.status===filterStatus) &&
      (filterBrand==='All'||t.brand_id===filterBrand)
    )
    rows.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'due_date') {
        const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity
        const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity
        cmp = ad - bd
      } else if (sortBy === 'priority') {
        cmp = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
      } else if (sortBy === 'status') {
        cmp = a.status.localeCompare(b.status)
      } else if (sortBy === 'title') {
        cmp = a.title.localeCompare(b.title)
      } else if (sortBy === 'brand') {
        cmp = (a.brand?.name || '').localeCompare(b.brand?.name || '')
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [tasks, filterStatus, filterBrand, sortBy, sortDir])

  if (loading) return <div style={{ color:'var(--sf-muted)', padding:40, textAlign:'center' }}>Loading tasks…</div>

  return (
    <PageShell>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexShrink:0 }}>
        <PageHeader
          title={['team','developer'].includes(session.role) ? 'My Tasks' : 'Tasks'}
          subtitle={`${filtered.length} items`}
        />
        {canCreate && (
          <button onClick={() => setShowCreate(true)} className="sf-btn sf-btn-primary" style={{ marginTop:4 }}>New task</button>
        )}
      </div>
      {canEdit && (
        <p style={{ color:'var(--sf-muted)', fontSize:12, margin:'-8px 0 12px', flexShrink:0 }}>
          Click a task row or use Edit to update details. Delete removes the task permanently.
        </p>
      )}

      <Section title="Filters & view" subtitle="Sort and filter the task list" flush style={{ flexShrink:0 }}>
        <div style={{ padding:'0.75rem 1rem', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', background:'var(--sf-surface)', border:'1px solid var(--sf-border)', borderRadius:8, overflow:'hidden' }}>
          {(['list','kanban'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding:'7px 14px', background:view===v?'var(--sf-accent)':'transparent', border:'none', color:view===v?'#fff':'var(--sf-muted)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
              {v === 'list' ? 'List' : 'Board'}
            </button>
          ))}
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={toolbarSelect}>
          <option value="All">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={toolbarSelect}>
          <option value="All">All brands</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} style={toolbarSelect}>
          <option value="due_date">Sort: Due date</option>
          <option value="priority">Sort: Priority</option>
          <option value="status">Sort: Status</option>
          <option value="title">Sort: Title</option>
          <option value="brand">Sort: Brand</option>
        </select>
        <button
          type="button"
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          style={{ ...toolbarSelect, cursor:'pointer' }}
        >
          {sortDir === 'asc' ? 'Ascending' : 'Descending'}
        </button>
        </div>
      </Section>

      {view === 'list' ? (
        <Section title="Task list" subtitle={`${filtered.length} tasks`} flush flex={1}>
          <div className="sf-table-wrap" style={{ border:'none', borderRadius:0, boxShadow:'none', height:'100%' }}>
            <table className="sf-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Brand</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Due</th>
                  {canEdit && <th style={{ width:120 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(task => {
                  const dl = task.due_date ? Math.ceil((new Date(task.due_date).getTime()-Date.now())/86400000) : null
                  const late = dl !== null && dl < 0 && task.status !== 'Completed'
                  return (
                    <tr key={task.id}>
                      <td
                        onClick={() => openTask(task)}
                        style={{ cursor: canEdit ? 'pointer' : 'default' }}
                      >
                        <div style={{ fontWeight:600 }}>{task.title}</div>
                        {task.task_mode === 'project' && (
                          <div style={{ color:'#06B6D4', fontSize:10, fontWeight:700, marginTop:2 }}>PROJECT</div>
                        )}
                        {task.is_billable && canSeeBilling && (
                          <div style={{ color:'var(--sf-muted)', fontSize:11, marginTop:2 }}>Billable</div>
                        )}
                      </td>
                      <td onClick={() => openTask(task)} style={{ cursor: canEdit ? 'pointer' : 'default' }}>{task.brand?.name || '—'}</td>
                      <td onClick={() => openTask(task)} style={{ cursor: canEdit ? 'pointer' : 'default' }}>{task.type || '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        {canUpdateStatus(task) ? (
                          <select
                            value={task.status}
                            onChange={async e => {
                              await fetch(`/api/tasks/${task.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: e.target.value }),
                              })
                              load()
                            }}
                            style={{ ...toolbarSelect, padding: '4px 8px', fontSize: 11 }}
                          >
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className={statusClass(task.status)}>{task.status}</span>
                        )}
                      </td>
                      <td>{priorityLabel(task.priority)}</td>
                      <td style={{ color: late ? 'var(--sf-danger)' : 'var(--sf-text-secondary)' }}>
                        {task.due_date
                          ? late
                            ? `${Math.abs(dl)}d overdue`
                            : dl === 0
                              ? 'Today'
                              : new Date(task.due_date).toLocaleDateString()
                          : '—'}
                      </td>
                      {canEdit && (
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button
                              type="button"
                              onClick={() => openTask(task)}
                              className="sf-btn sf-btn-ghost"
                              style={{ fontSize:11, padding:'4px 8px' }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTask(task)}
                              className="sf-btn sf-btn-ghost"
                              style={{ fontSize:11, padding:'4px 8px', color:'var(--sf-danger)' }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ color:'var(--sf-muted)', textAlign:'center', padding:48 }}>No tasks match your filters.</div>
            )}
          </div>
        </Section>
      ) : (
        <Section title="Task board" subtitle="Kanban by status" flush flex={1}>
          <div style={{ display:'flex', gap:10, overflowX:'auto', overflowY:'auto', height:'100%', padding:'0.75rem' }}>
          {(['Not Started','In Progress','Under Review','Revision Needed','Completed','On Hold'] as TaskStatus[]).map(col => {
            const colTasks = filtered.filter(t => t.status===col)
            return (
              <div key={col} style={{ minWidth:220, flex:'0 0 220px', background:'var(--sf-surface)', border:'1px solid var(--sf-border)', borderRadius:12, padding:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                  <span style={{ color:'#A0A0C0', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{col}</span>
                  <span style={{ background:'var(--sf-surface-2)', color:'var(--sf-muted)', fontSize:10, padding:'1px 6px', borderRadius:4 }}>{colTasks.length}</span>
                </div>
                {colTasks.map(task => (
                  <div
                    key={task.id}
                    style={{ background:'var(--sf-surface-2)', border:'1px solid var(--sf-border)', borderRadius:9, padding:10, marginBottom:7 }}
                  >
                    <div
                      onClick={() => openTask(task)}
                      style={{ cursor: canEdit ? 'pointer' : 'default' }}
                    >
                      <div style={{ color:'var(--sf-text)', fontSize:12, fontWeight:600, marginBottom:4 }}>{task.title}</div>
                      <div style={{ color:'var(--sf-muted)', fontSize:10, marginBottom:6 }}>{task.brand?.name||'—'}</div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: canEdit ? 8 : 0 }}>
                        <span style={{ color:'var(--sf-muted)', fontSize:10 }}>{priorityLabel(task.priority)}</span>
                        {task.due_date && <span style={{ color:'var(--sf-muted)', fontSize:10 }}>{Math.ceil((new Date(task.due_date).getTime()-Date.now())/86400000)}d</span>}
                      </div>
                    </div>
                    {canEdit && (
                      <div style={{ display:'flex', gap:6 }}>
                        <button type="button" onClick={() => openTask(task)} className="sf-btn sf-btn-ghost" style={{ flex:1, fontSize:10, padding:'4px 6px' }}>Edit</button>
                        <button type="button" onClick={() => deleteTask(task)} className="sf-btn sf-btn-ghost" style={{ flex:1, fontSize:10, padding:'4px 6px', color:'var(--sf-danger)' }}>Delete</button>
                      </div>
                    )}
                  </div>
                ))}
                {colTasks.length===0 && <div style={{ color:'var(--sf-muted-2)', fontSize:11, textAlign:'center', padding:'14px 0' }}>Empty</div>}
              </div>
            )
          })}
          </div>
        </Section>
      )}

      {showCreate && canCreate && (
        <TaskFormModal session={session} brands={brands} users={users} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} canSeeBilling={canSeeBilling} canDelete={false} />
      )}
      {editingTask && canEdit && (
        <TaskFormModal
          session={session}
          brands={brands}
          users={users}
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={() => { setEditingTask(null); load() }}
          canSeeBilling={canSeeBilling}
          canDelete={canDelete}
        />
      )}
    </PageShell>
  )
}

const toolbarSelect: any = {
  padding: '7px 10px',
  background: 'var(--sf-surface)',
  border: '1px solid var(--sf-border)',
  borderRadius: 8,
  color: 'var(--sf-text-secondary)',
  fontSize: 12,
  fontFamily: 'inherit',
}

export function TaskFormModal({ session, brands, users, task, onClose, onSaved, canSeeBilling, canDelete, initialBrandId, forceProjectMode }: any) {
  const isEdit = Boolean(task)
  const [title, setTitle] = useState(task?.title || '')
  const [desc, setDesc] = useState(task?.description || '')
  const [brandId, setBrandId] = useState(task?.brand_id || initialBrandId || brands[0]?.id || '')
  const [assignedTo, setAssignedTo] = useState<string[]>(task?.assigned_to || [])
  const [type, setType] = useState(task?.type || (forceProjectMode ? 'Development' : 'Design'))
  const [priority, setPriority] = useState(task?.priority || 'Medium')
  const [status, setStatus] = useState(task?.status || 'Not Started')
  const [taskMode, setTaskMode] = useState(forceProjectMode ? 'project' : (task?.task_mode || 'standard'))
  const [subTasks, setSubTasks] = useState(() => normalizeSubTasks(task?.sub_tasks))
  const [dueDate, setDueDate] = useState(task?.due_date || '')
  const [isBillable, setIsBillable] = useState(Boolean(task?.is_billable))
  const [requiresReview, setRequiresReview] = useState(task?.requires_review ?? true)
  const [recurring, setRecurring] = useState(Boolean(task?.recurring_config?.enabled))
  const [recurFreq, setRecurFreq] = useState(task?.recurring_config?.frequency || 'monthly')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  const teamUsers = users.filter((u:any) => ['team','developer'].includes(u.role))

  function addSubTask() {
    setSubTasks((prev) => [...prev, { id: newSubTaskId(), title: '', assigned_to: [], status: 'Not Started', due_date: '' }])
  }

  function updateSubTask(idx: number, patch: Record<string, unknown>) {
    setSubTasks((prev) => prev.map((st, i) => (i === idx ? { ...st, ...patch } : st)))
  }

  function removeSubTask(idx: number) {
    setSubTasks((prev) => prev.filter((_, i) => i !== idx))
  }

  function toggleSubAssignee(idx: number, userId: string) {
    setSubTasks((prev) => prev.map((st, i) => {
      if (i !== idx) return st
      const cur = st.assigned_to || []
      return { ...st, assigned_to: cur.includes(userId) ? cur.filter((x: string) => x !== userId) : [...cur, userId] }
    }))
  }

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
    const cleanedSubTasks = taskMode === 'project'
      ? subTasks.filter((st) => st.title.trim()).map((st) => ({
          id: st.id,
          title: st.title.trim(),
          assigned_to: st.assigned_to || [],
          status: st.status || 'Not Started',
          due_date: st.due_date || null,
        }))
      : []
    const body = {
      title, description:desc, brand_id:brandId||null, assigned_to:assignedTo,
      assigned_managers:[session.id], type, task_mode:taskMode, priority, status, due_date:dueDate,
      requires_review:requiresReview, is_billable:isBillable,
      recurring_config: recurring ? { enabled:true, frequency:recurFreq, next_due:dueDate } : null,
      sub_tasks: cleanedSubTasks,
    }
    if (isEdit) {
      const res = await fetch(`/api/tasks/${task.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || data.detail || 'Could not save task')
        setSaving(false)
        return
      }
    } else {
      const res = await fetch('/api/tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || data.detail || 'Could not create task')
        setSaving(false)
        return
      }
    }
    setSaving(false)
    onSaved()
  }

  async function remove() {
    if (!isEdit || !canDelete) return
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return
    setDeleting(true)
    const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not delete task')
      return
    }
    onSaved()
  }

  const sInp = { width:'100%', padding:'9px 12px', background:'var(--sf-surface-2)', border:'1px solid #2A2A45', borderRadius:8, color:'var(--sf-text)', fontSize:13, outline:'none', fontFamily:"'DM Sans',sans-serif" }
  const sSel = { ...sInp, cursor:'pointer' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }} onClick={onClose}>
      <div style={{ background:'var(--sf-surface)', border:'1px solid var(--sf-border)', borderRadius:16, padding:28, width:'100%', maxWidth:560, maxHeight:'88vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ color:'var(--sf-text)', fontFamily:"'Space Grotesk',sans-serif", fontSize:18, fontWeight:700 }}>
            {forceProjectMode && !isEdit ? 'Create Project' : (isEdit && task?.task_mode === 'project' ? 'Edit Project' : (isEdit ? 'Edit Task' : 'Create New Task'))}
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--sf-muted)', cursor:'pointer', fontSize:22 }}>×</button>
        </div>

        {!isEdit && !forceProjectMode && (
        <div style={{ display:'flex', background:'var(--sf-surface-2)', borderRadius:9, overflow:'hidden', marginBottom:16 }}>
          {[['standard','Standard Task'],['project','Project Task (Sub-tasks)']].map(([m,l]) => (
            <button key={m} onClick={() => setTaskMode(m)} style={{ flex:1, padding:'9px', background:taskMode===m?(m==='project'?'#06B6D4':'var(--sf-accent)'):'transparent', border:'none', color:taskMode===m?'white':'var(--sf-muted)', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>{l}</button>
          ))}
        </div>
        )}

        {(forceProjectMode || taskMode === 'project') && !isEdit && (
          <div style={{ background:'rgba(6,182,212,0.1)', border:'1px solid rgba(6,182,212,0.25)', borderRadius:9, padding:'8px 12px', marginBottom:14, color:'#06B6D4', fontSize:12, fontWeight:600 }}>
            Project mode — add sub-tasks below to break work into phases.
          </div>
        )}

        {isEdit && (
          <div style={{ marginBottom:12 }}>
            <label style={{ color:'var(--sf-muted)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, display:'block' }}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={sSel}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div style={{ marginBottom:12 }}>
          <label style={{ color:'var(--sf-muted)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, display:'block' }}>Task Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Dinamoo Instagram Campaign" style={sInp} />
        </div>

        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
            <label style={{ color:'var(--sf-muted)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>Description</label>
            <button onClick={aiWrite} disabled={!title||aiLoading} type="button" style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(232,99,10,0.15)', border:'1px solid rgba(232,99,10,0.3)', borderRadius:6, color:'var(--sf-accent)', fontSize:11, fontWeight:700, padding:'3px 9px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              <Icon name="sparkles" size={12} />
              {aiLoading ? 'Writing…' : 'AI Write'}
            </button>
          </div>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe the task…" rows={3} style={{ ...sInp, resize:'vertical' }} />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <div>
            <label style={{ color:'var(--sf-muted)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, display:'block' }}>Brand</label>
            <select value={brandId} onChange={e => setBrandId(e.target.value)} style={sSel}>
              <option value="">No brand</option>
              {brands.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color:'var(--sf-muted)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, display:'block' }}>Type</label>
            <select value={type} onChange={e => setType(e.target.value)} style={sSel}>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color:'var(--sf-muted)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, display:'block' }}>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)} style={sSel}>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color:'var(--sf-muted)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, display:'block' }}>Due Date *</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={sInp} />
          </div>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ color:'var(--sf-muted)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:7, display:'block' }}>Assign To</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {teamUsers.map((u:any) => (
              <button key={u.id} onClick={() => setAssignedTo(p => p.includes(u.id)?p.filter(x=>x!==u.id):[...p,u.id])}
                style={{ padding:'5px 10px', background:assignedTo.includes(u.id)?'rgba(16,185,129,0.15)':'var(--sf-surface-2)', border:`1px solid ${assignedTo.includes(u.id)?'#10B981':'var(--sf-border-strong)'}`, borderRadius:7, color:assignedTo.includes(u.id)?'#10B981':'var(--sf-muted)', cursor:'pointer', fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>
                {u.name}
              </button>
            ))}
          </div>
        </div>

        {taskMode === 'project' && (
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <label style={{ color:'#06B6D4', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>Sub-tasks</label>
              <button type="button" onClick={addSubTask} className="sf-btn sf-btn-ghost" style={{ fontSize:11, padding:'4px 10px' }}>+ Add sub-task</button>
            </div>
            {subTasks.length === 0 && (
              <div style={{ background:'var(--sf-surface-2)', border:'1px dashed var(--sf-border)', borderRadius:9, padding:14, color:'var(--sf-muted)', fontSize:12, textAlign:'center' }}>
                No sub-tasks yet. Add phases like Wireframes, Development, QA.
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {subTasks.map((st, idx) => (
                <div key={st.id} style={{ background:'var(--sf-surface-2)', border:'1px solid var(--sf-border)', borderRadius:9, padding:12 }}>
                  <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                    <input
                      value={st.title}
                      onChange={(e) => updateSubTask(idx, { title: e.target.value })}
                      placeholder="Sub-task title"
                      style={{ ...sInp, flex:1 }}
                    />
                    <button type="button" onClick={() => removeSubTask(idx)} style={{ background:'none', border:'none', color:'var(--sf-danger)', cursor:'pointer', fontSize:18, lineHeight:1 }}>×</button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                    <select value={st.status} onChange={(e) => updateSubTask(idx, { status: e.target.value })} style={sSel}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input type="date" value={st.due_date || ''} onChange={(e) => updateSubTask(idx, { due_date: e.target.value })} style={sInp} />
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {teamUsers.map((u:any) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleSubAssignee(idx, u.id)}
                        style={{ padding:'4px 8px', background:(st.assigned_to||[]).includes(u.id)?'rgba(6,182,212,0.15)':'var(--sf-bg)', border:`1px solid ${(st.assigned_to||[]).includes(u.id)?'#06B6D4':'var(--sf-border)'}`, borderRadius:6, color:(st.assigned_to||[]).includes(u.id)?'#06B6D4':'var(--sf-muted)', cursor:'pointer', fontSize:11 }}
                      >
                        {u.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ background:'var(--sf-surface-2)', borderRadius:10, padding:14, marginBottom:16, display:'flex', flexDirection:'column', gap:10 }}>
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

        <div style={{ display:'flex', gap:8, justifyContent:'space-between', flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={save} disabled={!title||!dueDate||saving||deleting} style={{ padding:'10px 20px', background: forceProjectMode ? '#06B6D4' : 'var(--sf-accent)', border:'none', borderRadius:9, color:'var(--sf-text)', fontWeight:700, fontSize:13, cursor:(!title||!dueDate||saving)?'not-allowed':'pointer', opacity:(!title||!dueDate)?0.5:1, fontFamily:"'DM Sans',sans-serif" }}>
              {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : (forceProjectMode ? 'Create Project' : 'Create Task'))}
            </button>
            <button onClick={onClose} style={{ padding:'10px 20px', background:'var(--sf-surface-2)', border:'1px solid #2A2A45', borderRadius:9, color:'#A0A0C0', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Cancel</button>
          </div>
          {isEdit && canDelete && (
            <button onClick={remove} disabled={deleting||saving} style={{ padding:'10px 20px', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.35)', borderRadius:9, color:'#F87171', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              {deleting ? 'Deleting…' : 'Delete Task'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}