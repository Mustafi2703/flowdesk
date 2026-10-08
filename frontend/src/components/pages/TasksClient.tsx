// @ts-nocheck
'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionUser, STATUS_TEXT, TaskStatus } from '@/types'
import { Icon } from '@/components/app/Icons'
import { PageHeader, PageShell, Section } from '@/components/app/Section'
import { StatusBadge, statusTint } from '@/components/app/StatusBadge'
import { todayIST } from '@/lib/clock'
import { TASK_STATUSES, allowedTaskStatuses, canManageTasks, canManualStatusChange, canSetTaskPrice, isClockedInToday, isTaskAssignee, sameUserId } from '@/lib/tasks'
import { ATTENDANCE_CHANGED } from '@/lib/attendance'
import { FileAttachmentsPanel } from '@/components/app/FileAttachmentsPanel'
import { TaskThreadBox } from '@/components/app/TaskThreadBox'
import { PeoplePicker } from '@/components/app/PeoplePicker'
import { BrandBadge } from '@/components/app/BrandBadge'

const STATUSES = TASK_STATUSES
const PRIORITIES = ['Critical','High','Medium','Low']
const TYPES = ['Design','Content','Development','Strategy','Operations','Other']
const BOARD_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'Not Started', label: 'To Do' },
  { status: 'In Progress', label: 'Doing' },
  { status: 'Under Review', label: 'In Review' },
  { status: 'Revision Needed', label: 'Revisions' },
  { status: 'Completed', label: 'Done' },
  { status: 'On Hold', label: 'On Hold' },
  { status: 'Struggling', label: 'Struggling' },
  { status: 'Needs Attention', label: 'Attention' },
]
const PRIORITY_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }
const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Critical: { bg: 'rgba(239,68,68,0.2)', text: '#F87171' },
  High: { bg: 'rgba(249,115,22,0.2)', text: '#FB923C' },
  Medium: { bg: 'rgba(234,179,8,0.2)', text: '#EAB308' },
  Low: { bg: 'rgba(100,116,139,0.25)', text: '#94A3B8' },
}
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

function PriorityBadge({ priority }: { priority?: string | null }) {
  const p = priority || 'Low'
  const c = PRIORITY_COLORS[p] || PRIORITY_COLORS.Low
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>
      {p}
    </span>
  )
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
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [view, setView] = useState<'list'|'kanban'>('kanban')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterBrand, setFilterBrand] = useState('All')
  const [sortBy, setSortBy] = useState<SortKey>('due_date')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [showCreate, setShowCreate] = useState(false)
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [emailingId, setEmailingId] = useState<string | null>(null)
  const today = todayIST()
  const clockedIn = isClockedInToday(attendance, session.id, today)

  const canCreate = canManageTasks(session.role)
  const canEdit = canCreate
  const canDelete = false
  const canSeeBilling = ['owner','manager','accountant'].includes(session.role)
  const canSetPrice = canSetTaskPrice(session.role)

  async function emailBrief(task: any) {
    if (!canEdit) return
    setEmailingId(task.id)
    const res = await fetch(`/api/emails/task-brief/${task.id}`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setEmailingId(null)
    if (!res.ok) {
      alert(data.error || data.detail || 'Could not send email')
      return
    }
    alert(data.sent ? `Brief emailed to ${data.sent} assignee(s).` : 'No assignees to email.')
  }

  function isAssigned(task: any) {
    return isTaskAssignee(task, session.id)
  }

  function canUpdateStatus(task: any) {
    if (!clockedIn) return false
    if (canEdit) return true
    return isAssigned(task) && canManualStatusChange(task, session.role, session.id)
  }

  function statusOptions(task: any) {
    return allowedTaskStatuses(task, session.role)
  }

  function assigneeInitials(task: any) {
    const ids = task.assigned_to || []
    return ids.slice(0, 3).map((id: string) => {
      const u = users.find((x) => sameUserId(x.id, id))
      const name = u?.name || '?'
      return name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
    })
  }

  function dueChip(task: any) {
    if (!task.due_date) return null
    const dl = Math.ceil((new Date(task.due_date).getTime() - Date.now()) / 86400000)
    const late = dl < 0 && task.status !== 'Completed'
    return { dl, late }
  }

  function canUpdateProgress(task: any) {
    return isAssigned(task) && clockedIn
  }

  async function updateTaskStatus(taskId: string, status: string) {
    if (!clockedIn) {
      alert('Clock in from the top bar before starting or updating tasks.')
      return
    }
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data.error || data.detail || 'Could not update status')
      return
    }
    load()
  }

  function openTask(task: any) {
    router.push(`/tasks/${task.id}`)
  }

  async function deleteTask(task: any) {
    if (!canDelete) return
    if (task.status === 'Completed' && session.role !== 'owner') {
      alert('Completed tasks can only be deleted by the owner. See DATA_RETENTION.md in the repo.')
      return
    }
    const msg = task.status === 'Completed'
      ? `Delete completed task "${task.title}"? This permanently removes files and revision history. Only the owner should do this.`
      : `Delete "${task.title}"? This removes the task and all uploaded files.`
    if (!window.confirm(msg)) return
    const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not delete task')
      return
    }
    load()
  }

  function load() {
    return Promise.all([
      fetch('/api/tasks').then(r=>r.json()),
      fetch('/api/brands').then(r=>r.json()),
      fetch('/api/users').then(r=>r.json()),
      fetch('/api/attendance').then(r=>r.json()),
    ]).then(([t,b,u,a]) => {
      setTasks(Array.isArray(t)?t:[])
      setBrands(Array.isArray(b)?b:[])
      setUsers(Array.isArray(u)?u:[])
      setAttendance(Array.isArray(a)?a:[])
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    function refreshAttendance() {
      fetch('/api/attendance')
        .then((r) => r.json())
        .then((a) => setAttendance(Array.isArray(a) ? a : []))
        .catch(() => {})
    }
    window.addEventListener(ATTENDANCE_CHANGED, refreshAttendance)
    return () => window.removeEventListener(ATTENDANCE_CHANGED, refreshAttendance)
  }, [])

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
    <PageShell fill={view === 'kanban'} className={`sf-tasks-page${view === 'kanban' ? ' sf-tasks-page--board' : ''}`}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexShrink:0 }}>
        <PageHeader
          title={session.role === 'team' ? 'My Tasks' : 'Tasks'}
          subtitle={`${filtered.length} items`}
        />
        {canCreate && (
          <button onClick={() => setShowCreate(true)} className="sf-btn sf-btn-primary" style={{ marginTop:4 }}>New task</button>
        )}
      </div>
      {canEdit && (
        <p style={{ color:'var(--sf-muted)', fontSize:12, margin:'-8px 0 12px', flexShrink:0 }}>
          Owners and managers can edit tasks and set prices. Assigned members upload files to send review tasks forward — status moves automatically.
        </p>
      )}
      {!clockedIn && (
        <p style={{ color:'#FBBF24', fontSize:12, margin:'-8px 0 12px', flexShrink:0 }}>
          Clock in from the top bar before updating task progress or status.
        </p>
      )}
      {clockedIn && (
        <p style={{ color:'var(--sf-muted)', fontSize:12, margin:'-8px 0 12px', flexShrink:0 }}>
          Open a task for the full page. Status, review, and files live there — not in a popup.
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
          <div className="sf-list-scroll">
          <div className="sf-table-wrap" style={{ border:'none', borderRadius:0, boxShadow:'none' }}>
            <table className="sf-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Brand</th>
                  <th>Assignees</th>
                  <th>Assigned by</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Review</th>
                  <th>Priority</th>
                  <th>Due</th>
                  {canEdit && <th style={{ width:200 }}>Actions</th>}
                  {!canEdit && <th style={{ width:140 }}>Open</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(task => {
                  const dl = task.due_date ? Math.ceil((new Date(task.due_date).getTime()-Date.now())/86400000) : null
                  const late = dl !== null && dl < 0 && task.status !== 'Completed'
                  const assigneeLabel = (task.assigned_to || [])
                    .map((id: string) => users.find((u: any) => sameUserId(u.id, id))?.name)
                    .filter(Boolean)
                    .join(', ') || '—'
                  return (
                    <tr key={task.id}>
                      <td
                        onClick={() => openTask(task)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ fontWeight:600, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          {task.title}
                          {task.recurring_config?.enabled && <span className="sf-recur-badge">Recurring</span>}
                        </div>
                        {task.task_mode === 'project' && (
                          <div style={{ color:'#06B6D4', fontSize:10, fontWeight:700, marginTop:2 }}>PROJECT</div>
                        )}
                        {task.is_billable && canSeeBilling && (
                          <div style={{ color:'var(--sf-muted)', fontSize:11, marginTop:2 }}>
                            Billable{task.billable_amount ? ` · ₹${Number(task.billable_amount).toLocaleString('en-IN')}` : task.has_price ? ' · priced' : ' · no price'}
                          </div>
                        )}
                      </td>
                      <td onClick={() => openTask(task)} style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                        <BrandBadge brand={task.brand} />
                      </td>
                      <td onClick={() => openTask(task)} style={{ cursor: canEdit ? 'pointer' : 'default', color: 'var(--sf-text-secondary)', fontSize: 12, maxWidth: 160 }}>
                        {assigneeLabel}
                      </td>
                      <td onClick={() => openTask(task)} style={{ cursor: canEdit ? 'pointer' : 'default', color: 'var(--sf-muted)', fontSize: 12 }}>
                        {task.assigned_by?.name || '—'}
                      </td>
                      <td onClick={() => openTask(task)} style={{ cursor: canEdit ? 'pointer' : 'default' }}>{task.type || '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        {canUpdateStatus(task) ? (
                          <select
                            value={task.status}
                            onChange={e => updateTaskStatus(task.id, e.target.value)}
                            style={{ ...toolbarSelect, padding: '4px 8px', fontSize: 11, ...statusTint(task.status) }}
                          >
                            {statusOptions(task).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <StatusBadge status={task.status} />
                        )}
                      </td>
                      <td>
                        {task.requires_review ? (
                          <span style={{ fontSize: 10, fontWeight: 700, color: task.review_status === 'approved' ? '#15803D' : task.review_status === 'rejected' ? '#C2410C' : '#7E22CE' }}>
                            v{task.review_version || '1'} · {task.review_status && task.review_status !== 'none' ? task.review_status : 'pending'}
                          </span>
                        ) : <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>—</span>}
                      </td>
                      <td><PriorityBadge priority={task.priority} /></td>
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
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                            <button type="button" onClick={() => openTask(task)} className="sf-btn sf-btn-ghost" style={{ fontSize:11, padding:'4px 8px' }}>Open</button>
                            {canUpdateStatus(task) && task.status === 'Not Started' && (
                              <button type="button" onClick={() => updateTaskStatus(task.id, 'In Progress')} className="sf-btn sf-btn-primary" style={{ fontSize:11, padding:'4px 8px' }}>Start</button>
                            )}
                            <button
                              type="button"
                              onClick={() => emailBrief(task)}
                              disabled={emailingId === task.id || !(task.assigned_to || []).length}
                              className="sf-btn sf-btn-ghost"
                              style={{ fontSize:11, padding:'4px 8px' }}
                              title="Email assignment brief to assignees"
                            >
                              {emailingId === task.id ? '…' : 'Email'}
                            </button>
                            {canEdit && task.requires_review && task.status === 'Under Review' && (
                              <button type="button" onClick={() => router.push(`/tasks/${task.id}?tab=review`)} className="sf-btn sf-btn-primary" style={{ fontSize:11, padding:'4px 8px' }}>Review</button>
                            )}
                          </div>
                        </td>
                      )}
                      {!canEdit && (
                        <td onClick={e => e.stopPropagation()}>
                          <button type="button" onClick={() => openTask(task)} className="sf-btn sf-btn-ghost" style={{ fontSize:11, padding:'4px 8px' }}>Open</button>
                          {canUpdateStatus(task) && task.status === 'Not Started' && (
                            <button type="button" onClick={() => updateTaskStatus(task.id, 'In Progress')} className="sf-btn sf-btn-primary" style={{ fontSize:11, padding:'4px 8px', marginLeft: 6 }}>Start</button>
                          )}
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
          </div>
        </Section>
      ) : (
        <Section
          title="Task board"
          subtitle="Scroll each column for the full list — swipe sideways for more statuses"
          flush
          flex={1}
          className="sf-tasks-board-section"
        >
          <div className="sf-trello-board">
          {BOARD_COLUMNS.map(({ status: col, label }) => {
            const colTasks = filtered.filter(t => t.status === col)
            return (
              <div key={col} className="sf-trello-col">
                <div className="sf-trello-col-head">
                  <span className="sf-trello-col-title">{label}</span>
                  <span className="sf-trello-col-count" title={`${colTasks.length} in ${label}`}>{colTasks.length}</span>
                </div>
                <div
                  className="sf-trello-col-body"
                  aria-label={`${label} tasks`}
                  data-count={colTasks.length}
                >
                {colTasks.map(task => {
                  const due = dueChip(task)
                  const initials = assigneeInitials(task)
                  return (
                  <div key={task.id} className={`sf-trello-card${due?.late ? ' is-late' : ''}`}>
                    <button type="button" className="sf-trello-card-title" onClick={() => openTask(task)}>
                      {task.title}
                    </button>
                    <div className="sf-trello-card-meta">
                      <span className="sf-trello-brand"><BrandBadge brand={task.brand} /></span>
                      <span className="sf-trello-pri">{task.priority || 'Medium'}</span>
                      {due && (
                        <span className={`sf-trello-due${due.late ? ' sf-trello-due-late' : ''}`}>
                          {due.late ? `${Math.abs(due.dl)}d late` : due.dl === 0 ? 'Today' : `${due.dl}d`}
                        </span>
                      )}
                    </div>
                    <div className="sf-trello-card-foot">
                      <div className="sf-trello-avatars">
                        {initials.map((ini: string, i: number) => (
                          <span key={i} className="sf-trello-avatar" title="Assignee">{ini}</span>
                        ))}
                      </div>
                      {canUpdateStatus(task) && task.status === 'Not Started' && (
                        <button type="button" onClick={() => updateTaskStatus(task.id, 'In Progress')} className="sf-btn sf-btn-primary sf-trello-start">Start</button>
                      )}
                    </div>
                    {canUpdateStatus(task) && task.status !== 'Not Started' && (
                      <select
                        value={task.status}
                        onChange={e => updateTaskStatus(task.id, e.target.value)}
                        className="sf-trello-status"
                      >
                        {statusOptions(task).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                    <div className="sf-trello-card-actions">
                      <button type="button" onClick={() => openTask(task)} className="sf-btn sf-btn-ghost">Open</button>
                      {canEdit && task.requires_review && task.status === 'Under Review' && (
                        <button type="button" onClick={() => openTask(task)} className="sf-btn sf-btn-primary">Review</button>
                      )}
                    </div>
                  </div>
                  )
                })}
                {colTasks.length === 0 && <div className="sf-trello-empty">No cards</div>}
                </div>
              </div>
            )
          })}
          </div>
        </Section>
      )}

      {showCreate && canCreate && (
        <TaskFormModal session={session} brands={brands} users={users} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} canSeeBilling={canSeeBilling} canSetPrice={canSetPrice} canDelete={false} />
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

export function TaskFormModal({ session, brands, users, task, onClose, onSaved, canSeeBilling, canSetPrice, canDelete, initialBrandId, forceProjectMode }: any) {
  const isEdit = Boolean(task)
  const [title, setTitle] = useState(task?.title || '')
  const [desc, setDesc] = useState(task?.description || '')
  const [brandId, setBrandId] = useState(task?.brand_id || initialBrandId || brands[0]?.id || '')
  const [newBrandName, setNewBrandName] = useState('')
  const [assignedTo, setAssignedTo] = useState<string[]>(task?.assigned_to || [])
  const [type, setType] = useState(task?.type || (forceProjectMode ? 'Development' : 'Design'))
  const [priority, setPriority] = useState(task?.priority || 'Medium')
  const [status, setStatus] = useState(task?.status || 'Not Started')
  const [taskMode, setTaskMode] = useState(forceProjectMode ? 'project' : (task?.task_mode || 'standard'))
  const [subTasks, setSubTasks] = useState(() => normalizeSubTasks(task?.sub_tasks))
  const [dueDate, setDueDate] = useState(task?.due_date || '')
  const [isBillable, setIsBillable] = useState(Boolean(task?.is_billable))
  const [billableAmount, setBillableAmount] = useState(task?.billable_amount != null ? String(task.billable_amount) : '')
  const [requiresReview, setRequiresReview] = useState(task?.requires_review ?? true)
  const [recurring, setRecurring] = useState(Boolean(task?.recurring_config?.enabled))
  const [recurFreq, setRecurFreq] = useState(task?.recurring_config?.frequency || 'monthly')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  // Assignable people: Team department only (Developer is not a department).
  const teamUsers = users.filter((u:any) => u.role === 'team' && u.is_active !== false)
  const needsBrandName = !brandId && !isEdit

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
    if (needsBrandName && !newBrandName.trim()) {
      alert('Enter a name for the new project/brand (No brand selected).')
      return
    }
    setSaving(true)
    let resolvedBrandId = brandId || null
    if (needsBrandName && newBrandName.trim()) {
      const brandRes = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBrandName.trim(),
          logo: newBrandName.trim().slice(0, 2).toUpperCase(),
          description: `Created from task: ${title}`,
          client_type: 'Project-Based',
          priority: 'P2',
          short_term_goals: [],
          long_term_goals: [],
          journey: [],
          assigned_members: [],
        }),
      })
      const brandData = await brandRes.json().catch(() => ({}))
      if (!brandRes.ok) {
        alert(brandData.error || brandData.detail || 'Could not create project/brand')
        setSaving(false)
        return
      }
      resolvedBrandId = brandData.id
      // Auto-switch to project mode when creating under a new named project.
      if (taskMode === 'standard') setTaskMode('project')
    }
    const cleanedSubTasks = subTasks.filter((st) => st.title.trim()).map((st) => ({
          id: st.id,
          title: st.title.trim(),
          assigned_to: st.assigned_to || [],
          status: st.status || 'Not Started',
          due_date: st.due_date || null,
        }))
    const effectiveMode = forceProjectMode || needsBrandName ? 'project' : 'standard'
    const body: any = {
      title, description:desc, brand_id:resolvedBrandId, assigned_to:assignedTo,
      type, task_mode:effectiveMode, priority, status, due_date:dueDate,
      requires_review:requiresReview, is_billable:isBillable,
      recurring_config: recurring ? { enabled:true, frequency:recurFreq, next_due:dueDate } : null,
    }
    if (isEdit) {
      body.sub_tasks = cleanedSubTasks
    }
    // Preserve existing managers on edit; on create set current user as manager.
    if (isEdit) {
      body.assigned_managers = Array.from(new Set([
        ...(task?.assigned_managers || []),
        session.id,
      ].map(String)))
    } else {
      body.assigned_managers = [session.id]
    }
    if (canSetPrice && isBillable && billableAmount.trim()) {
      body.billable_amount = parseFloat(billableAmount)
    } else if (canSetPrice && isBillable && isEdit && billableAmount.trim() === '') {
      body.billable_amount = null
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
    <div className="sf-modal-overlay" style={{ zIndex: 1000 }} onClick={onClose}>
      <div className="sf-modal-panel sf-task-form-modal" onClick={e => e.stopPropagation()}>
        <div className="sf-modal-header">
          <div className="sf-modal-header-copy">
            <h3 className="sf-modal-title">
              {forceProjectMode && !isEdit ? 'Create Project' : (isEdit && task?.task_mode === 'project' ? 'Edit Project' : (isEdit ? 'Edit Task' : 'Create New Task'))}
            </h3>
          </div>
          <button type="button" className="sf-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="sf-modal-body sf-task-form-body">
          <div className="sf-task-form-main">
            {!isEdit && !forceProjectMode && (
              <div className="sf-task-form-note">
                After creating the task, add sub-tasks on the task page (Sub-tasks tab). They stay on this task — they are not a separate project.
              </div>
            )}

            {(forceProjectMode || taskMode === 'project') && !isEdit && (
              <div className="sf-task-form-note is-project">
                Project container — use this only to group work. Sub-tasks belong on each task’s Sub-task tab.
              </div>
            )}

            <div className="sf-task-form-field">
              <label>Task Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Dinamoo Instagram Campaign" style={sInp} />
            </div>

            <div className="sf-task-form-field">
              <div className="sf-task-form-label-row">
                <label>Description</label>
                <button onClick={aiWrite} disabled={!title||aiLoading} type="button" className="sf-task-form-ai">
                  <Icon name="sparkles" size={12} />
                  {aiLoading ? 'Writing…' : 'AI Write'}
                </button>
              </div>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe the task…" rows={8} style={{ ...sInp, resize:'vertical', minHeight: 160 }} />
            </div>

            <div className="sf-task-form-field">
              <label>Assign To</label>
              <PeoplePicker
                users={teamUsers}
                selectedIds={assignedTo}
                onChange={setAssignedTo}
                variant="dropdown"
                placeholder="Assign team members…"
                emptyLabel="No Team members found. Owner/Manager: add people under Team first."
              />
            </div>

            {isEdit && task?.id && (
              <div className="sf-task-form-field">
                <FileAttachmentsPanel entityType="task" entityId={task.id} title="Task files & review uploads" />
              </div>
            )}

            {isEdit && task?.id && (
              <div className="sf-task-form-field">
                <TaskThreadBox taskId={task.id} sessionId={session.id} />
              </div>
            )}
          </div>

          <aside className="sf-task-form-side">
            {isEdit && (
              <div className="sf-task-form-field">
                <label>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} style={sSel}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            <div className="sf-task-form-field">
              <label>Brand</label>
              <select value={brandId} onChange={e => { setBrandId(e.target.value); if (e.target.value) setNewBrandName('') }} style={sSel}>
                <option value="">No brand</option>
                {brands.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {needsBrandName && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ color:'var(--sf-warning)' }}>New project / brand name *</label>
                  <input
                    value={newBrandName}
                    onChange={e => setNewBrandName(e.target.value)}
                    placeholder="e.g. Internal Q3 Campaign"
                    style={sInp}
                  />
                  <div className="sf-task-form-hint">Creates a project brand and opens this as a project task.</div>
                </div>
              )}
            </div>

            <div className="sf-task-form-field">
              <label>Type</label>
              <select value={type} onChange={e => setType(e.target.value)} style={sSel}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div className="sf-task-form-field">
              <label>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} style={sSel}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="sf-task-form-field">
              <label>Due Date *</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={sInp} />
            </div>

            <div className="sf-task-form-options">
              {[
                ['Billable Task', isBillable, setIsBillable, canSeeBilling],
                ['Requires Review', requiresReview, setRequiresReview, true],
                ['Recurring Task', recurring, setRecurring, true],
              ].filter(([,,,show]) => show).map(([label, val, set]: any) => (
                <label key={label} className="sf-task-form-check">
                  <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} />
                  <span>{label}</span>
                </label>
              ))}
              {recurring && (
                <select value={recurFreq} onChange={e => setRecurFreq(e.target.value)} style={{ ...sSel, marginTop: 4 }}>
                  {['daily','weekly','monthly','yearly'].map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
                </select>
              )}
              {canSetPrice && isBillable && (
                <div className="sf-task-form-field" style={{ marginTop: 8, marginBottom: 0 }}>
                  <label>Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={billableAmount}
                    onChange={e => setBillableAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    style={sInp}
                  />
                </div>
              )}
              {!canSetPrice && canSeeBilling && isBillable && (
                <div className="sf-task-form-hint">Marked billable — price is set by Admin / Accounts only.</div>
              )}
            </div>

            <div className="sf-task-form-actions">
              <button type="button" onClick={save} disabled={!title||!dueDate||saving||deleting||(needsBrandName&&!newBrandName.trim())} className="sf-btn sf-btn-primary" style={{ width: '100%' }}>
                {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : (forceProjectMode ? 'Create Project' : 'Create Task'))}
              </button>
              <button type="button" onClick={onClose} className="sf-btn sf-btn-ghost" style={{ width: '100%' }}>Cancel</button>
              {isEdit && canDelete && (
                <button type="button" onClick={remove} disabled={deleting||saving} className="sf-btn sf-btn-ghost" style={{ width: '100%', color: 'var(--sf-danger)' }}>
                  {deleting ? 'Deleting…' : 'Delete Task'}
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export function TaskProgressModal({ session, task, onClose, onSaved }: any) {
  const isParentAssignee = (task.assigned_to || []).some((id: string) => sameUserId(id, session.id))
  const [status, setStatus] = useState(task.status || 'Not Started')
  const [desc, setDesc] = useState(task.description || '')
  const [checklist, setChecklist] = useState<any[]>(task.checklist || [])
  const [subTasks, setSubTasks] = useState<any[]>(normalizeSubTasks(task.sub_tasks))
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)
  const sInp = { width:'100%', padding:'9px 12px', background:'var(--sf-surface-2)', border:'1px solid var(--sf-border)', borderRadius:8, color:'var(--sf-text)', fontSize:13, outline:'none', fontFamily:"'DM Sans',sans-serif" }
  const sSel = { ...sInp, cursor:'pointer' }

  function toggleCheck(id: string) {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item))
  }

  function addChecklistItem() {
    if (!newItem.trim()) return
    setChecklist(prev => [...prev, { id: newSubTaskId(), text: newItem.trim(), done: false }])
    setNewItem('')
  }

  async function save() {
    setSaving(true)
    const body: any = { description: desc, checklist }
    if (isParentAssignee) body.status = status
    const mySubTasks = subTasks.map(st => {
      const mine = (st.assigned_to || []).some((id: string) => sameUserId(id, session.id))
      return mine ? st : (task.sub_tasks || []).find((x: any) => x.id === st.id) || st
    })
    if ((task.sub_tasks || []).length > 0) body.sub_tasks = mySubTasks
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not save progress')
      return
    }
    onSaved()
  }

  return (
    <div className="sf-modal-overlay" style={{ zIndex: 1000 }} onClick={onClose}>
      <div className="sf-modal-panel sf-task-form-modal" onClick={e => e.stopPropagation()}>
        <div className="sf-modal-header">
          <div className="sf-modal-header-copy">
            <h3 className="sf-modal-title">Update progress</h3>
            <p className="sf-modal-subtitle">{task.title}</p>
          </div>
          <button type="button" className="sf-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="sf-modal-body" style={{ padding: '20px 28px 28px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {isParentAssignee && (
          <div style={{ marginBottom:12 }}>
            <label style={{ color:'var(--sf-muted)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, display:'block' }}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={sSel}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div style={{ marginBottom:12 }}>
          <label style={{ color:'var(--sf-muted)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:5, display:'block' }}>Progress notes</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="What did you work on?" style={{ ...sInp, resize:'vertical' }} />
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={{ color:'var(--sf-muted)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, display:'block' }}>Checklist</label>
          {checklist.map(item => (
            <label key={item.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, cursor:'pointer' }}>
              <input type="checkbox" checked={Boolean(item.done)} onChange={() => toggleCheck(item.id)} />
              <span style={{ color: item.done ? 'var(--sf-muted)' : 'var(--sf-text)', textDecoration: item.done ? 'line-through' : 'none', fontSize:13 }}>{item.text}</span>
            </label>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Add checklist item" style={{ ...sInp, flex:1 }} />
            <button type="button" onClick={addChecklistItem} className="sf-btn sf-btn-ghost">Add</button>
          </div>
        </div>
        {subTasks.some(st => (st.assigned_to || []).some((id: string) => sameUserId(id, session.id))) && (
          <div style={{ marginBottom:16 }}>
            <label style={{ color:'#06B6D4', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, display:'block' }}>Your sub-tasks</label>
            {subTasks.filter(st => (st.assigned_to || []).some((id: string) => sameUserId(id, session.id))).map(st => (
              <div key={st.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                <span style={{ flex:1, color:'var(--sf-text)', fontSize:13 }}>{st.title}</span>
                <select value={st.status} onChange={e => setSubTasks(prev => prev.map(x => x.id === st.id ? { ...x, status: e.target.value } : x))} style={{ ...sSel, width:160 }}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <FileAttachmentsPanel entityType="task" entityId={task.id} title="Files for review" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <TaskThreadBox taskId={task.id} sessionId={session.id} compact />
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={save} disabled={saving} className="sf-btn sf-btn-primary">{saving ? 'Saving…' : 'Save progress'}</button>
          <button onClick={onClose} className="sf-btn sf-btn-ghost">Cancel</button>
        </div>
        </div>
      </div>
    </div>
  )
}