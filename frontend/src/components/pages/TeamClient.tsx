// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser, ROLE_COLORS, ROLE_LABELS } from '@/types'
import { PageHeader, PageShell, PageTabs, PageToolbar, Section, StatCard, StatGrid } from '@/components/app/Section'
import { Modal } from '@/components/app/Modal'
import { PeoplePicker } from '@/components/app/PeoplePicker'

const TEAM_PANELS = [
  { id: 'members', label: 'Team members' },
  { id: 'departments', label: 'Departments' },
]

const PRIORITY_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }
const PRIORITY_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  Critical: { bg: 'rgba(239,68,68,0.18)', text: '#F87171', bar: '#EF4444' },
  High: { bg: 'rgba(249,115,22,0.18)', text: '#FB923C', bar: '#F97316' },
  Medium: { bg: 'rgba(234,179,8,0.18)', text: '#EAB308', bar: '#EAB308' },
  Low: { bg: 'rgba(148,163,184,0.18)', text: '#94A3B8', bar: '#64748B' },
}

function sameId(a: unknown, b: unknown) {
  return String(a || '') === String(b || '')
}

function priorityStyle(p?: string | null) {
  return PRIORITY_COLORS[p || 'Medium'] || PRIORITY_COLORS.Medium
}

function PriorityBadge({ priority }: { priority?: string | null }) {
  const c = priorityStyle(priority)
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap' }}>
      {priority || 'Medium'}
    </span>
  )
}

export default function TeamClient({ session }: { session: SessionUser }) {
  const role = String(session.role || '').toLowerCase()
  const [users, setUsers] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [assignableRoles, setAssignableRoles] = useState<string[]>([])
  const [managers, setManagers] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [panel, setPanel] = useState('members')
  const [showAdd, setShowAdd] = useState(false)
  const [showDept, setShowDept] = useState(false)
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [viewingUser, setViewingUser] = useState<any | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [deptError, setDeptError] = useState('')
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'team', department: '', department_id: '', designation: '', password: '', manager_id: '', manager_ids: [] as string[], is_active: true })
  const [deptForm, setDeptForm] = useState({ name: '', description: '', manager_id: '' })
  const CORE_ROLES = ['owner', 'manager', 'team', 'hr', 'accountant']
  const today = new Date().toISOString().split('T')[0]
  const canOnboard = ['owner', 'manager'].includes(role)
  const canManageDepartments = role === 'owner'
  const canViewDepartments = ['owner', 'manager', 'hr'].includes(role)
  const canReset = ['owner', 'hr'].includes(role)

  async function refresh() {
    setDeptError('')
    try {
      const teamUrl = `/api/team${role === 'owner' ? '?include_inactive=true' : ''}`
      const [teamRes, tasksRes, attRes, rolesRes] = await Promise.all([
        fetch(teamUrl),
        fetch('/api/tasks'),
        fetch('/api/attendance'),
        fetch('/api/team/assignable-roles'),
      ])
      const u = await teamRes.json().catch(() => [])
      const t = await tasksRes.json().catch(() => [])
      const a = await attRes.json().catch(() => [])
      const roles = await rolesRes.json().catch(() => ({ roles: [] }))
      setUsers(Array.isArray(u) ? u : [])
      setTasks(Array.isArray(t) ? t : [])
      setAttendance(Array.isArray(a) ? a : [])
      setAssignableRoles(Array.isArray(roles.roles) ? roles.roles : [])

      if (role === 'owner') {
        const mgrRes = await fetch('/api/team/managers')
        const mgr = await mgrRes.json().catch(() => [])
        setManagers(Array.isArray(mgr) ? mgr : [])
      } else {
        setManagers([])
      }

      if (canViewDepartments) {
        const deptRes = await fetch('/api/team/departments')
        const deptData = await deptRes.json().catch(() => ({}))
        if (!deptRes.ok) {
          const msg = deptData.error || deptData.detail || 'Could not load departments'
          setDeptError(typeof msg === 'string' ? msg : 'Could not load departments')
          setDepartments([])
        } else {
          setDepartments(Array.isArray(deptData) ? deptData : [])
        }
      }
    } catch {
      setDeptError('Could not load team data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const canEditUser = (u: any) => {
    if (u.id === session.id) return false
    if (role === 'owner') return true
    if (role === 'manager') return u.role === 'team' && String(u.manager_id || '') === String(session.id)
    return false
  }

  function startCreateUser() {
    setUserForm({ name: '', email: '', role: assignableRoles[0] || 'team', department: '', department_id: '', designation: '', password: '', manager_id: '', manager_ids: [], is_active: true })
    setEditingUser(null)
    setShowAdd(true)
    setShowDept(false)
    setViewingUser(null)
    setNotice('')
    setError('')
  }

  function startCreateDept() {
    setEditingDeptId(null)
    setDeptForm({ name: '', description: '', manager_id: '' })
    setShowDept(true)
    setShowAdd(false)
    setEditingUser(null)
    setNotice('')
    setError('')
  }

  function startEditDept(d: any) {
    setEditingDeptId(d.id)
    setDeptForm({ name: d.name, description: d.description || '', manager_id: d.manager_id || '' })
    setShowDept(true)
    setNotice('')
    setError('')
  }

  function startEditUser(u: any) {
    const deptMatch = departments.find((d: any) => (d.name || '').toLowerCase() === (u.department || '').toLowerCase())
    const mgrIds = (u.manager_ids || []).map(String)
    if (u.manager_id && !mgrIds.includes(String(u.manager_id))) mgrIds.unshift(String(u.manager_id))
    setEditingUser(u)
    setUserForm({
      name: u.name || '',
      email: u.email || '',
      role: u.role || 'team',
      department: u.department || '',
      department_id: deptMatch?.id || '',
      designation: u.designation || '',
      password: '',
      manager_id: u.manager_id || '',
      manager_ids: mgrIds,
      is_active: u.is_active !== false,
    })
    setShowAdd(false)
    setShowDept(false)
    setViewingUser(null)
    setNotice('')
    setError('')
  }

  function pickDepartmentForUser(departmentId: string) {
    const dept = departments.find((d: any) => d.id === departmentId)
    setUserForm(f => ({
      ...f,
      department_id: departmentId,
      department: dept?.name || '',
      manager_id: role === 'owner' && dept?.manager_id ? dept.manager_id : f.manager_id,
    }))
  }

  async function addUser(e: any) {
    e.preventDefault()
    setSaving(true); setError(''); setNotice('')
    const payload: any = {
      name: userForm.name,
      email: userForm.email,
      role: userForm.role,
      designation: userForm.designation || null,
    }
    if (userForm.department_id) payload.department_id = userForm.department_id
    else if (userForm.department) payload.department = userForm.department
    if (userForm.password) payload.password = userForm.password
    if (role === 'owner') {
      if (userForm.manager_ids?.length) payload.manager_ids = userForm.manager_ids
      else if (userForm.manager_id) payload.manager_id = userForm.manager_id
    }
    const res = await fetch('/api/team', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error || data.detail || 'Could not create user'); return }
    setNotice(`User created. Temporary password: ${data.temporary_password}`)
    setUserForm({ name: '', email: '', role: assignableRoles[0] || 'team', department: '', department_id: '', designation: '', password: '', manager_id: '', manager_ids: [], is_active: true })
    setShowAdd(false)
    refresh()
  }

  async function saveUser(e: any) {
    e.preventDefault()
    if (!editingUser) return
    setSaving(true); setError(''); setNotice('')
    const payload: any = {
      name: userForm.name,
      designation: userForm.designation || null,
    }
    if (userForm.department_id) payload.department_id = userForm.department_id
    else if (userForm.department) payload.department = userForm.department
    if (role === 'owner') {
      payload.role = userForm.role
      payload.email = userForm.email
      payload.is_active = userForm.is_active
      payload.manager_ids = userForm.manager_ids || []
    }
    const res = await fetch(`/api/team/${editingUser.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error || data.detail || 'Could not update user'); return }
    setNotice(`${userForm.name} updated successfully.`)
    setEditingUser(null)
    refresh()
  }

  async function saveDepartment(e: any) {
    e.preventDefault()
    setSaving(true); setError(''); setNotice('')
    const payload: any = {
      name: deptForm.name,
      description: deptForm.description || null,
      manager_id: deptForm.manager_id || null,
    }
    const url = editingDeptId ? `/api/team/departments/${editingDeptId}` : '/api/team/departments'
    const method = editingDeptId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error || data.detail || `Could not ${editingDeptId ? 'update' : 'create'} department`); return }
    setNotice(`Department "${data.name}" ${editingDeptId ? 'updated' : 'created'}${data.manager ? ` · Manager: ${data.manager.name}` : ''}.`)
    setDeptForm({ name: '', description: '', manager_id: '' })
    setEditingDeptId(null)
    setShowDept(false)
    setPanel('departments')
    refresh()
  }

  async function deleteDepartment(d: any) {
    if (!window.confirm(`Delete department "${d.name}"? Users keep their department label until reassigned.`)) return
    setError(''); setNotice('')
    const res = await fetch(`/api/team/departments/${d.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || data.detail || 'Could not delete department'); return }
    setNotice(`Department "${d.name}" deleted.`)
    if (editingDeptId === d.id) { setEditingDeptId(null); setShowDept(false) }
    refresh()
  }

  async function resetPassword(id: string, name: string) {
    setError(''); setNotice('')
    const res = await fetch(`/api/team/${id}/reset-password`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || 'Could not reset password'); return }
    setNotice(`${name}'s temporary password: ${data.temporary_password}`)
  }

  async function deactivateUser(id: string, name: string) {
    if (!confirm(`Deactivate ${name}? They will no longer be able to log in.`)) return
    setError(''); setNotice('')
    const method = role === 'owner' ? 'DELETE' : 'PATCH'
    const opts: any = { method }
    if (method === 'PATCH') {
      opts.headers = { 'content-type': 'application/json' }
      opts.body = JSON.stringify({ is_active: false })
    }
    const res = await fetch(`/api/team/${id}`, opts)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || 'Could not deactivate user'); return }
    setNotice(`${name} has been deactivated.`)
    refresh()
  }

  async function hardDeleteUser(id: string, name: string) {
    if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return
    setError(''); setNotice('')
    const res = await fetch(`/api/team/${id}?hard=true`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || data.detail || 'Could not delete user'); return }
    setNotice(`${name} permanently deleted.`)
    setViewingUser(null)
    refresh()
  }

  function isAssigned(task: any, uid: string) {
    return (task.assigned_to || []).some((id: unknown) => sameId(id, uid))
      || (task.sub_tasks || []).some((st: any) => (st.assigned_to || []).some((id: unknown) => sameId(id, uid)))
  }

  function load(uid: string) {
    const active = tasks.filter(t => isAssigned(t, uid) && !['Completed', 'On Hold'].includes(t.status))
    if (active.length === 0) return { label: 'Available', color: '#10B981' }
    if (active.length <= 2) return { label: 'Moderate', color: '#FBBF24' }
    return { label: 'Fully Loaded', color: '#EF4444' }
  }

  function sortByImportance(list: any[]) {
    return [...list].sort((a, b) => {
      const ra = PRIORITY_RANK[a.priority] ?? 9
      const rb = PRIORITY_RANK[b.priority] ?? 9
      if (ra !== rb) return ra - rb
      const da = a.due_date || '9999-99-99'
      const db = b.due_date || '9999-99-99'
      return da.localeCompare(db)
    })
  }

  function memberPerf(uid: string) {
    const all = sortByImportance(tasks.filter(t => isAssigned(t, uid)))
    const allocated = all.length
    const completed = all.filter(t => t.status === 'Completed')
    const delayed = all.filter(t => t.due_date && t.due_date < today && t.status !== 'Completed')
    const critical = all.filter(t => t.priority === 'Critical' && t.status !== 'Completed').length
    const high = all.filter(t => t.priority === 'High' && t.status !== 'Completed').length
    const onTimeCount = completed.filter(t => {
      if (!t.due_date) return true
      const doneDay = (t.updated_at || '').slice(0, 10)
      return !doneDay || doneDay <= t.due_date
    }).length
    const onTimePct = completed.length ? Math.round((onTimeCount / completed.length) * 100) : 0
    const monthKey = today.slice(0, 7)
    const thisMonth = all.filter(t => (t.created_at || '').slice(0, 7) === monthKey || (t.due_date || '').slice(0, 7) === monthKey)
    const monthDone = thisMonth.filter(t => t.status === 'Completed').length
    const monthLate = thisMonth.filter(t => t.due_date && t.due_date < today && t.status !== 'Completed').length
    return { allocated, completed: completed.length, delayed: delayed.length, onTimePct, critical, high, all, thisMonth: thisMonth.length, monthDone, monthLate }
  }

  const isOnline = (uid: string) => attendance.some(a => a.user_id === uid && a.date === today && !a.logout_time)

  if (loading) {
    return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading team…</div>
  }

  const byName = (a: any, b: any) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  const team = [...users].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
    return byName(a, b)
  })
  const sortedDepartments = [...departments].sort(byName)
  const sortedManagers = [...managers].sort(byName)
  const online = team.filter(u => isOnline(u.id)).length
  const managerName = (id: string | null) => team.find(u => u.id === id)?.name

  const teamTabs = TEAM_PANELS
    .filter(p => p.id !== 'departments' || canViewDepartments)
    .map(p => ({
      id: p.id,
      label: p.label,
      count: p.id === 'departments' ? sortedDepartments.length : team.filter(u => u.is_active).length,
    }))

  return (
    <PageShell>
      <PageToolbar>
        <div>
          <PageHeader
            title="Team"
            subtitle={panel === 'departments' ? 'Org units with assigned managers' : `${team.filter(u => u.is_active).length} members · ${online} online`}
          />
          {canViewDepartments && (
            <PageTabs
              tabs={teamTabs}
              active={panel}
              onChange={id => { setPanel(id); setShowAdd(false); setShowDept(false) }}
            />
          )}
        </div>
        {panel === 'members' && canOnboard && (
          <button type="button" onClick={startCreateUser} className="sf-btn sf-btn-primary">
            Add user
          </button>
        )}
        {panel === 'departments' && canManageDepartments && (
          <button type="button" onClick={startCreateDept} className="sf-btn sf-btn-primary">
            Add department
          </button>
        )}
      </PageToolbar>

      {notice && <div style={{ background: '#052E1A', border: '1px solid #10B981', color: '#D1FAE5', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}>{notice}</div>}
      {error && <div style={{ background: '#3B0A0A', border: '1px solid #EF4444', color: '#FEE2E2', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <Modal
        open={showDept && panel === 'departments'}
        onClose={() => { setShowDept(false); setEditingDeptId(null) }}
        title={editingDeptId ? 'Edit department' : 'Create department'}
        subtitle="Only Owner, Manager, Team, Accounts, and HR are allowed"
        footer={
          <>
            <button type="button" onClick={() => { setShowDept(false); setEditingDeptId(null) }} className="sf-btn sf-btn-ghost">Cancel</button>
            <button type="submit" form="team-dept-form" disabled={saving} className="sf-btn sf-btn-primary">{saving ? 'Saving...' : (editingDeptId ? 'Save Department' : 'Create Department')}</button>
          </>
        }
      >
        <form id="team-dept-form" onSubmit={saveDepartment}>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Department
              <select required value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} className="sf-input" style={{ marginTop: 6 }}>
                <option value="">Select department</option>
                {['Owner', 'Manager', 'Team', 'Accounts', 'HR'].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Description
              <input placeholder="Optional" value={deptForm.description} onChange={e => setDeptForm({ ...deptForm, description: e.target.value })} className="sf-input" style={{ marginTop: 6 }} />
            </label>
            <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Manager
              <select value={deptForm.manager_id} onChange={e => setDeptForm({ ...deptForm, manager_id: e.target.value })} className="sf-input" style={{ marginTop: 6 }}>
                <option value="">Assign manager (optional)</option>
                {sortedManagers.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
              </select>
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editingUser && panel === 'members'}
        onClose={() => setEditingUser(null)}
        title={editingUser ? `Edit ${editingUser.name}` : 'Edit user'}
        subtitle="Update role, department, and reporting line"
        footer={
          <>
            <button type="button" onClick={() => setEditingUser(null)} className="sf-btn sf-btn-ghost">Cancel</button>
            <button type="submit" form="team-edit-user-form" disabled={saving} className="sf-btn sf-btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
          </>
        }
      >
        <form id="team-edit-user-form" onSubmit={saveUser}>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Full name
              <input required placeholder="Full name" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} className="sf-input" style={{ marginTop: 6 }} />
            </label>
            {role === 'owner' && (
              <>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Email
                  <input required type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className="sf-input" style={{ marginTop: 6 }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Role
                  <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })} className="sf-input" style={{ marginTop: 6 }}>
                    {CORE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </label>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Managers (multi)</div>
                  <PeoplePicker
                    users={sortedManagers}
                    selectedIds={userForm.manager_ids || []}
                    onChange={(ids) => setUserForm({ ...userForm, manager_ids: ids, manager_id: ids[0] || '' })}
                    variant="dropdown"
                    placeholder="Select managers…"
                    emptyLabel="No managers available"
                    groupByRole={false}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sf-text-secondary)', fontSize: 13 }}>
                  <input type="checkbox" checked={userForm.is_active} onChange={e => setUserForm({ ...userForm, is_active: e.target.checked })} />
                  Active account
                </label>
              </>
            )}
            {sortedDepartments.length > 0 ? (
              <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Department
                <select value={userForm.department_id} onChange={e => pickDepartmentForUser(e.target.value)} className="sf-input" style={{ marginTop: 6 }}>
                  <option value="">Select department</option>
                  {sortedDepartments.map((d: any) => <option key={d.id} value={d.id}>{d.name}{d.manager ? ` · ${d.manager.name}` : ''}</option>)}
                </select>
              </label>
            ) : (
              <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Department
                <input placeholder="Department" value={userForm.department} onChange={e => setUserForm({ ...userForm, department: e.target.value })} className="sf-input" style={{ marginTop: 6 }} />
              </label>
            )}
            <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Designation
              <input placeholder="Designation / responsibility" value={userForm.designation} onChange={e => setUserForm({ ...userForm, designation: e.target.value })} className="sf-input" style={{ marginTop: 6 }} />
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        open={showAdd && panel === 'members'}
        onClose={() => setShowAdd(false)}
        title="Onboard new user"
        subtitle={role === 'manager' ? 'New hires will report to you automatically' : 'Create a login for Owner, Manager, Team, HR, or Accounts'}
        footer={
          <>
            <button type="button" onClick={() => setShowAdd(false)} className="sf-btn sf-btn-ghost">Cancel</button>
            <button type="submit" form="team-create-user-form" disabled={saving} className="sf-btn sf-btn-primary">{saving ? 'Creating...' : 'Create User'}</button>
          </>
        }
      >
        <form id="team-create-user-form" onSubmit={addUser}>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Full name
              <input required placeholder="Full name" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} className="sf-input" style={{ marginTop: 6 }} />
            </label>
            <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Email
              <input required type="email" placeholder="Email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className="sf-input" style={{ marginTop: 6 }} />
            </label>
            <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Role
              <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })} className="sf-input" style={{ marginTop: 6 }}>
                {(assignableRoles.length ? assignableRoles : ['team']).map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
              </select>
            </label>
            {sortedDepartments.length > 0 ? (
              <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Department
                <select value={userForm.department_id} onChange={e => pickDepartmentForUser(e.target.value)} className="sf-input" style={{ marginTop: 6 }}>
                  <option value="">Select department</option>
                  {sortedDepartments.map((d: any) => <option key={d.id} value={d.id}>{d.name}{d.manager ? ` · ${d.manager.name}` : ''}</option>)}
                </select>
              </label>
            ) : (
              <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Department
                <input placeholder="Department" value={userForm.department} onChange={e => setUserForm({ ...userForm, department: e.target.value })} className="sf-input" style={{ marginTop: 6 }} />
              </label>
            )}
            <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Designation
              <input placeholder="Designation / responsibility" value={userForm.designation} onChange={e => setUserForm({ ...userForm, designation: e.target.value })} className="sf-input" style={{ marginTop: 6 }} />
            </label>
            <label style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Password
              <input type="password" placeholder="Blank = auto generate" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className="sf-input" style={{ marginTop: 6 }} />
            </label>
            {role === 'owner' && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--sf-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Managers (multi)</div>
                <PeoplePicker
                  users={sortedManagers}
                  selectedIds={userForm.manager_ids || []}
                  onChange={(ids) => setUserForm({ ...userForm, manager_ids: ids, manager_id: ids[0] || '' })}
                  variant="dropdown"
                  placeholder="Select managers…"
                  emptyLabel="No managers available"
                  groupByRole={false}
                />
              </div>
            )}
          </div>
        </form>
      </Modal>

      {panel === 'departments' && canViewDepartments && (
        <>
          {deptError && (
            <div style={{ background: '#3B0A0A', border: '1px solid #EF4444', color: '#FEE2E2', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}>
              {deptError}
              <div style={{ marginTop: 8 }}>
                <button type="button" onClick={() => refresh()} className="sf-btn sf-btn-ghost" style={{ fontSize: 11 }}>Retry</button>
              </div>
            </div>
          )}
          {sortedDepartments.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
              {sortedDepartments.map((d: any) => (
                <div key={d.id} style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 16 }}>
                  <div style={{ color: 'var(--sf-text)', fontWeight: 700, fontSize: 15 }}>{d.name}</div>
                  {d.description && <div style={{ color: 'var(--sf-muted)', fontSize: 12, marginTop: 6 }}>{d.description}</div>}
                  <div style={{ color: 'var(--sf-muted-2)', fontSize: 11, marginTop: 10 }}>
                    Manager: {d.manager?.name || '—'}
                  </div>
                  <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginTop: 4 }}>
                    {d.member_count} member{d.member_count === 1 ? '' : 's'}
                  </div>
                  {canManageDepartments && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button type="button" onClick={() => startEditDept(d)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '6px 8px' }}>Edit</button>
                      <button type="button" onClick={() => deleteDepartment(d)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '6px 8px', color: 'var(--sf-danger)' }}>Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : !deptError && (
            <div style={{ background: 'var(--sf-surface-2)', border: '1px dashed var(--sf-border)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
              <p style={{ color: 'var(--sf-muted)', fontSize: 14, margin: '0 0 14px' }}>
                {canManageDepartments
                  ? 'No departments yet. Create one to group team members and assign a department manager.'
                  : 'No departments configured yet.'}
              </p>
                  {canManageDepartments && (
                    <button type="button" onClick={startCreateDept} className="sf-btn sf-btn-primary">Create department</button>
                  )}
            </div>
          )}
        </>
      )}

          {panel === 'members' && (
        <>
          <StatGrid>
            <StatCard label="Members" value={team.filter(u => u.is_active).length} accent="var(--sf-accent)" />
            <StatCard label="Online" value={online} accent="#10B981" />
            <StatCard label="Allocated tasks" value={tasks.filter(t => (t.assigned_to || []).length > 0).length} accent="#3B82F6" />
            <StatCard label="Delayed" value={tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'Completed').length} accent="#EF4444" />
          </StatGrid>

          <Section title="Team directory" subtitle="Uniform cards · open a member for full task & performance modal" style={{ marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14, alignItems: 'stretch' }}>
              {team.map((u: any) => {
                const l = load(u.id)
                const perf = memberPerf(u.id)
                const active = perf.all.filter(t => !['Completed', 'On Hold'].includes(t.status))
                const memberOnline = isOnline(u.id)
                const mgrLabels = (u.manager_ids?.length ? u.manager_ids : (u.manager_id ? [u.manager_id] : []))
                  .map((id: string) => managerName(id))
                  .filter(Boolean)
                return (
                  <div
                    key={u.id}
                    onClick={() => setViewingUser(u)}
                    style={{
                      background: 'var(--sf-surface)',
                      border: `1px solid ${viewingUser?.id === u.id ? 'var(--sf-accent)' : (u.is_active ? 'var(--sf-border)' : '#3A2430')}`,
                      borderRadius: 14,
                      padding: 18,
                      opacity: u.is_active ? 1 : 0.65,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 210,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 11, marginBottom: 12, alignItems: 'center' }}>
                      <div style={{ position: 'relative' }}>
                        <div style={{ width: 42, height: 42, borderRadius: 10, background: ROLE_COLORS[u.role] || 'var(--sf-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sf-text)', fontWeight: 700, fontSize: 13 }}>{u.avatar || u.name?.slice(0, 2)}</div>
                        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 11, height: 11, borderRadius: '50%', background: memberOnline ? '#10B981' : 'var(--sf-muted-2)', border: '2px solid var(--sf-surface)' }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--sf-text)', fontWeight: 700, fontSize: 13 }}>{u.name}</div>
                        <div style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{u.designation || u.department || ROLE_LABELS[u.role]}</div>
                        {mgrLabels.length > 0 && <div style={{ color: 'var(--sf-muted-2)', fontSize: 10, marginTop: 2 }}>Reports to {mgrLabels.join(', ')}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ background: l.color + '20', color: l.color, fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>{l.label}</span>
                      <span style={{ color: u.is_active ? 'var(--sf-muted)' : '#EF4444', fontSize: 11 }}>{u.is_active ? `${active.length} active` : 'Inactive'}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 'auto' }}>
                      {[['Alloc', perf.allocated, 'var(--sf-text)'], ['Done', perf.completed, '#10B981'], ['Late', perf.delayed, '#EF4444'], ['On-time', `${perf.onTimePct}%`, '#FBBF24']].map(([lbl, v, c]) => (
                        <div key={String(lbl)} style={{ background: 'var(--sf-surface-2)', borderRadius: 7, padding: '7px', textAlign: 'center' }}>
                          <div style={{ color: String(c), fontWeight: 700, fontSize: 12 }}>{v}</div>
                          <div style={{ color: 'var(--sf-muted)', fontSize: 9 }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                      {canEditUser(u) && <button type="button" onClick={() => startEditUser(u)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '6px 8px' }}>Edit</button>}
                      {canReset && u.id !== session.id && <button type="button" onClick={() => resetPassword(u.id, u.name)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '6px 8px' }}>Reset</button>}
                      {role === 'owner' && u.id !== session.id && u.is_active && <button type="button" onClick={() => deactivateUser(u.id, u.name)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '6px 8px', color: 'var(--sf-danger)' }}>Deactivate</button>}
                      {role === 'owner' && u.id !== session.id && <button type="button" onClick={() => hardDeleteUser(u.id, u.name)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '6px 8px', color: '#F87171' }}>Delete</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          {(() => {
            const perf = viewingUser ? memberPerf(viewingUser.id) : null
            const memberIsOnline = viewingUser ? isOnline(viewingUser.id) : false
            return (
              <Modal
                open={!!viewingUser}
                onClose={() => setViewingUser(null)}
                title={viewingUser?.name || 'Member'}
                subtitle={viewingUser ? `${viewingUser.designation || ROLE_LABELS[viewingUser.role]} · ${memberIsOnline ? 'Online' : 'Offline'}` : undefined}
                width={640}
                footer={
                  <>
                    {viewingUser && canEditUser(viewingUser) && (
                      <button
                        type="button"
                        className="sf-btn sf-btn-ghost"
                        onClick={() => { const u = viewingUser; setViewingUser(null); startEditUser(u) }}
                      >
                        Edit member
                      </button>
                    )}
                    <button type="button" className="sf-btn sf-btn-primary" onClick={() => setViewingUser(null)}>Close</button>
                  </>
                }
              >
                {perf && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 8, marginBottom: 14 }}>
                      {[
                        ['Allocated', perf.allocated, '#3B82F6'],
                        ['Completed', perf.completed, '#10B981'],
                        ['Delayed', perf.delayed, '#EF4444'],
                        ['Critical', perf.critical, '#F87171'],
                        ['High', perf.high, '#FB923C'],
                        ['On-time', `${perf.onTimePct}%`, '#FBBF24'],
                        ['This month', perf.thisMonth, '#8B5CF6'],
                        ['Month done', perf.monthDone, '#06B6D4'],
                        ['Month late', perf.monthLate, '#F97316'],
                      ].map(([label, value, color]) => (
                        <div key={String(label)} style={{ background: 'var(--sf-surface-2)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                          <div style={{ color: String(color), fontWeight: 700, fontSize: 15 }}>{value}</div>
                          <div style={{ color: 'var(--sf-muted)', fontSize: 10 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ color: 'var(--sf-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Assigned tasks</div>
                    {perf.all.length === 0 ? (
                      <div style={{ color: 'var(--sf-muted)', fontSize: 13, padding: 16, textAlign: 'center' }}>No tasks assigned to this member.</div>
                    ) : (
                      perf.all.map((t: any) => {
                        const late = t.due_date && t.due_date < today && t.status !== 'Completed'
                        const c = priorityStyle(t.priority)
                        return (
                          <div
                            key={t.id}
                            style={{
                              display: 'flex',
                              gap: 12,
                              padding: '12px 10px',
                              borderBottom: '1px solid var(--sf-border)',
                              borderLeft: `3px solid ${late ? '#EF4444' : c.bar}`,
                              marginBottom: 2,
                              background: late ? 'rgba(239,68,68,0.06)' : 'transparent',
                              borderRadius: 6,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: 'var(--sf-text)', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t.title}</div>
                              <div style={{ color: 'var(--sf-muted)', fontSize: 11 }}>
                                {t.brand?.name || 'No brand'} · {t.type || 'Task'} · Due {t.due_date || '—'}
                                {t.assigned_by?.name ? ` · Assigned by ${t.assigned_by.name}` : ''}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                              <PriorityBadge priority={t.priority} />
                              {late && <span style={{ color: '#EF4444', fontSize: 10, fontWeight: 700 }}>Delayed</span>}
                              <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{t.status}</span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </>
                )}
              </Modal>
            )
          })()}
        </>
      )}
    </PageShell>
  )
}

function badgeFromPriority(priority: string) {
  const c = priorityStyle(priority)
  return { background: c.bg, color: c.text }
}
