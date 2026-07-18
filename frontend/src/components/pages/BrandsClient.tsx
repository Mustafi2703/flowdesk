// @ts-nocheck
'use client'
import { useEffect, useMemo, useState } from 'react'
import { SessionUser, STATUS_BG, STATUS_TEXT } from '@/types'
import { EmptyState, Icon } from '@/components/app/Icons'
import { PageHeader, PageShell, PageTabs, PageToolbar, Section } from '@/components/app/Section'
import { TaskFormModal, TaskProgressModal } from '@/components/pages/TasksClient'
import { TASK_STATUSES, canManageTasks, canSetTaskPrice, isClockedInToday, isTaskAssignee } from '@/lib/tasks'
import { FileAttachmentsPanel } from '@/components/app/FileAttachmentsPanel'

const sameId = (a: string | null | undefined, b: string | null | undefined) => String(a || '') === String(b || '')

const BRAND_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'projects', label: 'Projects' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'goals', label: 'Goals' },
  { id: 'identity', label: 'Identity' },
  { id: 'journey', label: 'Journey' },
]

export default function BrandsClient({ session }: { session: SessionUser }) {
  const [brands, setBrands] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [section, setSection] = useState('overview')
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const canEdit = ['owner', 'manager'].includes(session.role)

  function load() {
    return Promise.all([
      fetch('/api/brands').then(r => r.json()),
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/attendance').then(r => r.json()),
    ]).then(([b, t, u, a]) => {
      setBrands(Array.isArray(b) ? b : [])
      setTasks(Array.isArray(t) ? t : [])
      setUsers(Array.isArray(u) ? u : [])
      setAttendance(Array.isArray(a) ? a : [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const visible = useMemo(
    () => (session.role === 'team' ? brands.filter(b => (b.assigned_members || []).some((id: string) => sameId(id, session.id))) : brands),
    [brands, session.id, session.role]
  )

  useEffect(() => {
    if (visible.length > 0 && !selectedId) {
      setSelectedId(String(visible[0].id))
    }
  }, [visible, selectedId])

  const selected = useMemo(
    () => visible.find(b => sameId(b.id, selectedId)) || null,
    [visible, selectedId]
  )

  const brandTasks = useMemo(
    () => (selected ? tasks.filter(t => sameId(t.brand_id, selected.id)) : []),
    [tasks, selected]
  )

  function selectBrand(brand: any) {
    setSelectedId(String(brand.id))
    setSection('overview')
  }

  if (loading) {
    return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading brands…</div>
  }

  const brandTabs = selected
    ? BRAND_SECTIONS.map(s => {
        const count = s.id === 'projects'
          ? brandTasks.filter(t => t.task_mode === 'project').length
          : s.id === 'tasks'
            ? brandTasks.filter(t => t.task_mode !== 'project').length
            : undefined
        return {
          id: s.id,
          label: count != null ? `${s.label} (${count})` : s.label,
        }
      })
    : []

  return (
    <PageShell>
      <PageToolbar>
        <PageHeader
          title={session.role === 'team' ? 'My brands' : 'Brands'}
          subtitle={`${visible.length} client${visible.length === 1 ? '' : 's'}`}
        />
        {canEdit && (
          <button type="button" onClick={() => setShowCreate(true)} className="sf-btn sf-btn-primary">
            Add brand
          </button>
        )}
      </PageToolbar>

      {visible.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--sf-muted)' }}>
          <EmptyState icon="brands" title="No brands yet. Add your first client to get started." />
          {canEdit && (
            <button type="button" onClick={() => setShowCreate(true)} className="sf-btn sf-btn-primary" style={{ marginTop: 16 }}>
              Add brand
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="sf-brand-picker">
            {visible.map(b => {
              const bt = tasks.filter(t => sameId(t.brand_id, b.id))
              const active = selected && sameId(selected.id, b.id)
              return (
                <button
                  key={b.id}
                  type="button"
                  className={`sf-brand-chip${active ? ' sf-brand-chip-active' : ''}`}
                  onClick={() => selectBrand(b)}
                >
                  <span className="sf-brand-chip-logo">{b.logo || b.name?.slice(0, 2)}</span>
                  <span>
                    <span style={{ display: 'block', lineHeight: 1.2 }}>{b.name}</span>
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--sf-muted)', fontWeight: 400, marginTop: 2 }}>
                      {bt.length} tasks
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          {selected ? (
            <>
              <PageTabs tabs={brandTabs} active={section} onChange={setSection} />
              <BrandDetail
                brand={selected}
                tasks={brandTasks}
                users={users}
                session={session}
                canEdit={canEdit}
                tab={section}
                onTabChange={setSection}
              onRefresh={load}
              attendance={attendance}
            />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--sf-muted)' }}>
              Select a brand above to view projects, tasks, and goals.
            </div>
          )}
        </>
      )}

      {showCreate && canEdit && <CreateBrand onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />}
    </PageShell>
  )
}

function BrandDetail({ brand, tasks, users, session, canEdit, tab, onTabChange, onRefresh, attendance }: any) {
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<any>(null)
  const [progressTask, setProgressTask] = useState<any>(null)
  const [createAsProject, setCreateAsProject] = useState(false)
  const [memberIds, setMemberIds] = useState<string[]>(() => (brand.assigned_members || []).map(String))
  const [savingMembers, setSavingMembers] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const clockedIn = isClockedInToday(attendance || [], session.id, today)
  const canSetPrice = canSetTaskPrice(session.role)
  const canSeeBilling = ['owner', 'manager', 'accountant'].includes(session.role)
  const statusSelectStyle = { padding: '4px 8px', background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 6, color: 'var(--sf-text)', fontSize: 11, fontFamily: 'inherit' }
  const assignable = users.filter((u: any) => ['team', 'developer', 'manager'].includes(u.role) && u.is_active !== false)

  useEffect(() => {
    setMemberIds((brand.assigned_members || []).map(String))
  }, [brand.id, brand.assigned_members])

  async function saveMembers() {
    setSavingMembers(true)
    const res = await fetch(`/api/brands/${brand.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_members: memberIds }),
    })
    setSavingMembers(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not update brand team')
      return
    }
    onRefresh()
  }

  function canUpdateStatus(task: any) {
    if (canEdit) return true
    return isTaskAssignee(task, session.id) && clockedIn
  }

  function canUpdateProgress(task: any) {
    return !canEdit && isTaskAssignee(task, session.id) && clockedIn
  }

  async function updateTaskStatus(taskId: string, status: string) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not update status')
      return
    }
    onRefresh()
  }

  function renderStatus(task: any) {
    if (canUpdateStatus(task)) {
      return (
        <select value={task.status} onChange={e => updateTaskStatus(task.id, e.target.value)} style={statusSelectStyle}>
          {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )
    }
    return (
      <span style={{ background: STATUS_BG[task.status] || '#F3F4F6', color: STATUS_TEXT[task.status] || '#374151', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5 }}>{task.status}</span>
    )
  }

  const projects = tasks.filter((t: any) => t.task_mode === 'project')
  const standardTasks = tasks.filter((t: any) => t.task_mode !== 'project')
  const fl = tasks.filter((t: any) => ['Struggling', 'Needs Attention'].includes(t.status))
  const done = tasks.filter((t: any) => t.status === 'Completed').length

  function openCreateProject() {
    setEditingTask(null)
    setCreateAsProject(true)
    setShowTaskModal(true)
  }

  function openCreateTask() {
    setEditingTask(null)
    setCreateAsProject(false)
    setShowTaskModal(true)
  }

  function openEditTask(t: any) {
    setEditingTask(t)
    setCreateAsProject(false)
    setShowTaskModal(true)
  }

  async function deleteTask(t: any) {
    if (!canEdit) return
    if (!window.confirm(`Delete "${t.title}"?`)) return
    const res = await fetch(`/api/tasks/${t.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not delete task')
      return
    }
    onRefresh()
  }

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg,var(--sf-surface),var(--sf-surface-2))', border: '1px solid var(--sf-border)', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg,#E8630A,#FF9A4A)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sf-text)', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
            {brand.logo || brand.name?.slice(0, 2)}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ color: 'var(--sf-text)', fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{brand.name}</h1>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ background: '#3B82F620', color: '#3B82F6', fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>{brand.client_type}</span>
              <span style={{ background: '#8B5CF620', color: '#8B5CF6', fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>{brand.priority}</span>
            </div>
            <p style={{ color: 'var(--sf-text-secondary)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{brand.description}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(70px, 1fr))', gap: 8, flexShrink: 0 }}>
            {[['Total', tasks.length, '#3B82F6'], ['Projects', projects.length, '#06B6D4'], ['Done', done, '#10B981'], ['Flagged', fl.length, '#EF4444']].map(([l, v, c]) => (
              <div key={String(l)} style={{ background: 'var(--sf-bg)', borderRadius: 10, padding: '8px 12px', textAlign: 'center', border: '1px solid var(--sf-border)' }}>
                <div style={{ color: String(c), fontWeight: 700, fontSize: 18 }}>{v}</div>
                <div style={{ color: 'var(--sf-muted)', fontSize: 10 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 16 }}>
        <PageHeader
          title={BRAND_SECTIONS.find(s => s.id === tab)?.label || 'Overview'}
          subtitle={brand.name}
        />
        {canEdit && tab === 'projects' && (
          <button type="button" onClick={openCreateProject} className="sf-btn sf-btn-primary">Add project</button>
        )}
        {canEdit && tab === 'tasks' && (
          <button type="button" onClick={openCreateTask} className="sf-btn sf-btn-primary">Add task</button>
        )}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {fl.length > 0 && (
            <div style={{ gridColumn: '1/-1', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: 16 }}>
              <div style={{ color: '#F87171', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>⚠ Flagged Tasks ({fl.length})</div>
              {fl.map((t: any) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
                  <span style={{ color: 'var(--sf-text-secondary)', fontSize: 13 }}>{t.title}</span>
                  <span style={{ background: STATUS_BG[t.status] || '#F3F4F6', color: STATUS_TEXT[t.status] || '#374151', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5 }}>{t.status}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18 }}>
            <div style={{ color: 'var(--sf-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Recent work</div>
            {tasks.slice(0, 5).map((t: any) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--sf-surface-2)', borderRadius: 7, marginBottom: 5 }}>
                <span style={{ color: 'var(--sf-text-secondary)', fontSize: 12 }}>{t.title}</span>
                <span style={{ background: STATUS_BG[t.status] || '#F3F4F6', color: STATUS_TEXT[t.status] || '#374151', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{t.status}</span>
              </div>
            ))}
            {tasks.length === 0 && <div style={{ color: 'var(--sf-muted-2)', fontSize: 12 }}>No tasks yet — add a project or task from the tabs above.</div>}
          </div>
          <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18 }}>
            <div style={{ color: 'var(--sf-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Assigned team</div>
            {canEdit ? (
              <>
                <select
                  multiple
                  value={memberIds}
                  onChange={e => setMemberIds(Array.from(e.target.selectedOptions).map(o => o.value))}
                  style={{ width: '100%', minHeight: 120, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)', fontSize: 12, fontFamily: 'inherit' }}
                >
                  {assignable.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} · {u.role}{u.department ? ` · ${u.department}` : ''}</option>
                  ))}
                </select>
                <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginTop: 6 }}>
                  Hold Cmd/Ctrl to multi-select · {memberIds.length} allocated
                </div>
                <button
                  type="button"
                  onClick={saveMembers}
                  disabled={savingMembers}
                  className="sf-btn sf-btn-primary"
                  style={{ marginTop: 10, fontSize: 12 }}
                >
                  {savingMembers ? 'Saving…' : 'Save team allocation'}
                </button>
              </>
            ) : (
              <>
                {(brand.assigned_members || []).map((uid: string) => {
                  const u = users.find((u: any) => sameId(u.id, uid))
                  if (!u) return null
                  return (
                    <div key={uid} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', background: 'var(--sf-surface-2)', borderRadius: 7, marginBottom: 5 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--sf-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sf-text)', fontWeight: 700, fontSize: 10 }}>{u.avatar || u.name?.slice(0, 2)}</div>
                      <div>
                        <div style={{ color: 'var(--sf-text)', fontSize: 12, fontWeight: 600 }}>{u.name}</div>
                        <div style={{ color: 'var(--sf-muted)', fontSize: 10 }}>{u.designation}</div>
                      </div>
                    </div>
                  )
                })}
                {!(brand.assigned_members?.length > 0) && <div style={{ color: 'var(--sf-muted-2)', fontSize: 12 }}>No team assigned.</div>}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'projects' && (
        <div>
          {projects.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--sf-muted-2)' }}>
              <div style={{ marginBottom: 12, fontSize: 15, fontWeight: 600, color: 'var(--sf-muted)' }}>No projects for {brand.name} yet.</div>
              {canEdit && <button type="button" onClick={openCreateProject} className="sf-btn sf-btn-primary">Create first project</button>}
            </div>
          )}
          {projects.map((t: any) => {
            const sub = t.sub_tasks || []
            const stDone = sub.filter((s: any) => s.status === 'Completed').length
            return (
              <div key={t.id} style={{ padding: '16px 18px', background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ background: 'rgba(6,182,212,0.15)', color: '#06B6D4', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>PROJECT</span>
                      <span style={{ color: 'var(--sf-text)', fontSize: 14, fontWeight: 700 }}>{t.title}</span>
                    </div>
                    <div style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{t.type} · Due {t.due_date || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {renderStatus(t)}
                    {canUpdateProgress(t) && (
                      <button type="button" onClick={() => setProgressTask(t)} className="sf-btn sf-btn-primary" style={{ fontSize: 11, padding: '4px 8px' }}>Progress</button>
                    )}
                    {canEdit && (
                      <>
                        <button type="button" onClick={() => openEditTask(t)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>Edit</button>
                        <button type="button" onClick={() => deleteTask(t)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--sf-danger)' }}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
                {sub.length > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>Sub-tasks</span>
                      <span style={{ color: '#06B6D4', fontWeight: 700, fontSize: 11 }}>{stDone}/{sub.length} done</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--sf-surface-2)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
                      <div style={{ width: `${sub.length ? (stDone / sub.length) * 100 : 0}%`, height: '100%', background: '#06B6D4' }} />
                    </div>
                    {sub.map((st: any) => (
                      <div key={st.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'var(--sf-surface-2)', borderRadius: 7, marginBottom: 5 }}>
                        <span style={{ color: 'var(--sf-text)', fontSize: 12 }}>{st.title}</span>
                        <span style={{ background: STATUS_BG[st.status] || '#F3F4F6', color: STATUS_TEXT[st.status] || '#374151', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{st.status}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'tasks' && (
        <div>
          {standardTasks.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--sf-muted-2)' }}>
              No standard tasks for {brand.name}.
              {canEdit && <div style={{ marginTop: 12 }}><button type="button" onClick={openCreateTask} className="sf-btn sf-btn-primary">Add task</button></div>}
            </div>
          )}
          {standardTasks.map((t: any) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 10, marginBottom: 8, gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--sf-text)', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{t.title}</div>
                <div style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{t.type} · Due {t.due_date}</div>
              </div>
              {renderStatus(t)}
              {canUpdateProgress(t) && (
                <button type="button" onClick={() => setProgressTask(t)} className="sf-btn sf-btn-primary" style={{ fontSize: 11, padding: '4px 8px' }}>Progress</button>
              )}
              {canEdit && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => openEditTask(t)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>Edit</button>
                  <button type="button" onClick={() => deleteTask(t)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--sf-danger)' }}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'goals' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[['Short-Term Goals', 'var(--sf-accent)', brand.short_term_goals || []], ['Long-Term Goals', '#3B82F6', brand.long_term_goals || []]].map(([title, color, items]) => (
            <div key={String(title)} style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18 }}>
              <div style={{ color: String(color), fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>{title}</div>
              {(items as string[]).map((g, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--sf-border)' }}>
                  <span style={{ color: String(color) }}>→</span>
                  <span style={{ color: 'var(--sf-text-secondary)', fontSize: 13 }}>{g}</span>
                </div>
              ))}
              {!(items as string[]).length && <div style={{ color: 'var(--sf-muted-2)', fontSize: 12 }}>None set yet.</div>}
            </div>
          ))}
          <div style={{ gridColumn: '1/-1', background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18 }}>
            <div style={{ color: '#10B981', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Responsibilities</div>
            <p style={{ color: 'var(--sf-text-secondary)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>{brand.responsibilities || 'Not specified.'}</p>
          </div>
        </div>
      )}

      {tab === 'identity' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18 }}>
            <div style={{ color: 'var(--sf-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Brand info</div>
            {[['Name', brand.name], ['Client Type', brand.client_type], ['Priority', brand.priority], ['Team', `${brand.assigned_members?.length || 0} members`], ['Logo', brand.logo || '—']].map(([l, v]) => (
              <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--sf-border)' }}>
                <span style={{ color: 'var(--sf-muted)', fontSize: 12 }}>{l}</span>
                <span style={{ color: 'var(--sf-text)', fontSize: 12, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <FileAttachmentsPanel entityType="brand" entityId={brand.id} canUpload={canEdit} title="Brand files & assets" />
        </div>
      )}

      {tab === 'journey' && (
        <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18 }}>
          <div style={{ color: '#8B5CF6', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Brand journey</div>
          {(brand.journey || []).length === 0 ? (
            <div style={{ color: 'var(--sf-muted-2)', fontSize: 13 }}>No journey milestones yet. Add them when creating or editing the brand.</div>
          ) : (
            (brand.journey || []).map((item: string, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--sf-border)' }}>
                <span style={{ color: '#8B5CF6', fontWeight: 700, fontSize: 12 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ color: 'var(--sf-text-secondary)', fontSize: 13 }}>{item}</span>
              </div>
            ))
          )}
        </div>
      )}

      {progressTask && (
        <TaskProgressModal
          session={session}
          task={progressTask}
          onClose={() => setProgressTask(null)}
          onSaved={() => { setProgressTask(null); onRefresh() }}
        />
      )}
      {showTaskModal && (canEdit || editingTask) && (
        <TaskFormModal
          session={session}
          brands={[brand]}
          users={users}
          task={editingTask || undefined}
          initialBrandId={brand.id}
          forceProjectMode={createAsProject && !editingTask}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); setCreateAsProject(false) }}
          onSaved={() => { setShowTaskModal(false); setEditingTask(null); setCreateAsProject(false); onRefresh() }}
          canSeeBilling={canSeeBilling}
          canSetPrice={canSetPrice}
          canDelete={canEdit}
        />
      )}
    </div>
  )
}

function CreateBrand({ onClose, onSaved }: any) {
  const [name, setName] = useState('')
  const [logo, setLogo] = useState('')
  const [desc, setDesc] = useState('')
  const [ct, setCt] = useState('Retainer')
  const [priority, setPriority] = useState('P2')
  const [resp, setResp] = useState('')
  const [shortGoals, setShortGoals] = useState('')
  const [longGoals, setLongGoals] = useState('')
  const [journey, setJourney] = useState('')
  const [saving, setSaving] = useState(false)
  const sInp = { width: '100%', padding: '9px 12px', background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)', fontSize: 13, outline: 'none', fontFamily: "'DM Sans',sans-serif" }

  function lines(text: string) {
    return text.split('\n').map(s => s.trim()).filter(Boolean)
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const logoVal = (logo.trim() || name.trim().slice(0, 2)).toUpperCase().slice(0, 8)
    const res = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        logo: logoVal,
        description: desc,
        client_type: ct,
        priority,
        responsibilities: resp,
        short_term_goals: lines(shortGoals),
        long_term_goals: lines(longGoals),
        journey: lines(journey),
        assigned_members: [],
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not create brand')
      return
    }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ color: 'var(--sf-text)', fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700 }}>Add new brand</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--sf-muted)', cursor: 'pointer', fontSize: 22 }}>×</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Brand Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Quick Furnish" style={sInp} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Logo initials</label>
          <input value={logo} onChange={e => setLogo(e.target.value.slice(0, 8))} placeholder="e.g. QF (max 8)" style={sInp} />
          <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginTop: 4 }}>Upload logo files after create under Identity → Brand files.</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Description</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief description…" rows={2} style={{ ...sInp, resize: 'vertical' as const }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Responsibilities</label>
          <textarea value={resp} onChange={e => setResp(e.target.value)} placeholder="What does the agency handle?" rows={2} style={{ ...sInp, resize: 'vertical' as const }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Short-term goals</label>
            <textarea value={shortGoals} onChange={e => setShortGoals(e.target.value)} placeholder="One goal per line" rows={3} style={{ ...sInp, resize: 'vertical' as const }} />
          </div>
          <div>
            <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Long-term goals</label>
            <textarea value={longGoals} onChange={e => setLongGoals(e.target.value)} placeholder="One goal per line" rows={3} style={{ ...sInp, resize: 'vertical' as const }} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Journey milestones</label>
          <textarea value={journey} onChange={e => setJourney(e.target.value)} placeholder="One milestone per line — e.g. Onboarded · First campaign · Retainer signed" rows={3} style={{ ...sInp, resize: 'vertical' as const }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[['Client Type', ct, setCt, ['Retainer', 'Project-Based', 'One-Time', 'Internal']], ['Priority', priority, setPriority, ['P1', 'P2', 'P3', 'P4']]].map(([label, val, set, opts]) => (
            <div key={String(label)}>
              <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>{label}</label>
              <select value={String(val)} onChange={e => (set as any)(e.target.value)} style={{ ...sInp, cursor: 'pointer' }}>{(opts as string[]).map(o => <option key={o}>{o}</option>)}</select>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={save} disabled={!name || saving} className="sf-btn sf-btn-primary">{saving ? 'Creating…' : 'Create brand'}</button>
          <button type="button" onClick={onClose} className="sf-btn sf-btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  )
}
