// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser, ROLE_COLORS, ROLE_LABELS } from '@/types'
import { PageHeader, PageShell, PageTabs, PageToolbar, Section, StatCard, StatGrid } from '@/components/app/Section'

const TEAM_PANELS = [
  { id: 'members', label: 'Team members' },
  { id: 'departments', label: 'Departments' },
]

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
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'team', department: '', department_id: '', designation: '', password: '', manager_id: '', is_active: true })
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
      is_active: u.is_active !== false,
    })
    setShowAdd(false)
    setShowDept(false)
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
    if (role === 'owner' && userForm.manager_id) payload.manager_id = userForm.manager_id
    const res = await fetch('/api/team', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error || data.detail || 'Could not create user'); return }
    setNotice(`User created. Temporary password: ${data.temporary_password}`)
    setUserForm({ name: '', email: '', role: assignableRoles[0] || 'team', department: '', department_id: '', designation: '', password: '', manager_id: '', is_active: true })
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
      payload.is_active = userForm.is_active
      if (userForm.manager_id) payload.manager_id = userForm.manager_id
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

  function load(uid: string) {
    const active = tasks.filter(t => t.assigned_to?.includes(uid) && !['Completed', 'On Hold'].includes(t.status))
    if (active.length === 0) return { label: 'Available', color: '#10B981' }
    if (active.length <= 2) return { label: 'Moderate', color: '#FBBF24' }
    return { label: 'Fully Loaded', color: '#EF4444' }
  }

  function memberPerf(uid: string) {
    const all = tasks.filter(t => t.assigned_to?.includes(uid))
    const allocated = all.length
    const completed = all.filter(t => t.status === 'Completed')
    const delayed = all.filter(t => t.due_date && t.due_date < today && t.status !== 'Completed')
    const onTimeCount = completed.filter(t => {
      if (!t.due_date) return true
      const doneDay = (t.updated_at || '').slice(0, 10)
      return !doneDay || doneDay <= t.due_date
    }).length
    const onTimePct = completed.length ? Math.round((onTimeCount / completed.length) * 100) : 0
    return { allocated, completed: completed.length, delayed: delayed.length, onTimePct, all }
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
          <button type="button" onClick={() => { setShowAdd(true); setShowDept(false); setNotice(''); setError('') }} className="sf-btn sf-btn-primary">
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

      {showDept && panel === 'departments' && (
        <Section title={editingDeptId ? 'Edit department' : 'Create department'} style={{ flexShrink: 0, marginBottom: 16 }}>
          <form onSubmit={saveDepartment}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
              <select required value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} className="sf-input">
                <option value="">Select department</option>
                {['Owner', 'Manager', 'Team', 'Accounts', 'HR'].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <input placeholder="Description (optional)" value={deptForm.description} onChange={e => setDeptForm({ ...deptForm, description: e.target.value })} className="sf-input" />
              <select value={deptForm.manager_id} onChange={e => setDeptForm({ ...deptForm, manager_id: e.target.value })} className="sf-input">
                <option value="">Assign manager (optional)</option>
                {sortedManagers.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
              </select>
            </div>
            <p style={{ color: 'var(--sf-muted)', fontSize: 12, marginTop: 10 }}>
              Only Owner, Manager, Team, Accounts, and HR departments are allowed.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button type="button" onClick={() => { setShowDept(false); setEditingDeptId(null) }} className="sf-btn sf-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="sf-btn sf-btn-primary">{saving ? 'Saving...' : (editingDeptId ? 'Save Department' : 'Create Department')}</button>
            </div>
          </form>
        </Section>
      )}

      {editingUser && panel === 'members' && (
        <Section title={`Edit ${editingUser.name}`} style={{ flexShrink: 0, marginBottom: 16 }}>
          <form onSubmit={saveUser}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
              <input required placeholder="Full name" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} className="sf-input" />
              {role === 'owner' && (
                <>
                  <input disabled value={userForm.email} className="sf-input" style={{ opacity: 0.7 }} />
                  <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })} className="sf-input">
                    {CORE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <select value={userForm.manager_id} onChange={e => setUserForm({ ...userForm, manager_id: e.target.value })} className="sf-input">
                    <option value="">No manager</option>
                    {sortedManagers.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sf-text-secondary)', fontSize: 13 }}>
                    <input type="checkbox" checked={userForm.is_active} onChange={e => setUserForm({ ...userForm, is_active: e.target.checked })} />
                    Active account
                  </label>
                </>
              )}
              {sortedDepartments.length > 0 ? (
                <select value={userForm.department_id} onChange={e => pickDepartmentForUser(e.target.value)} className="sf-input">
                  <option value="">Select department</option>
                  {sortedDepartments.map((d: any) => <option key={d.id} value={d.id}>{d.name}{d.manager ? ` · ${d.manager.name}` : ''}</option>)}
                </select>
              ) : (
                <input placeholder="Department" value={userForm.department} onChange={e => setUserForm({ ...userForm, department: e.target.value })} className="sf-input" />
              )}
              <input placeholder="Designation / responsibility" value={userForm.designation} onChange={e => setUserForm({ ...userForm, designation: e.target.value })} className="sf-input" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button type="button" onClick={() => setEditingUser(null)} className="sf-btn sf-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="sf-btn sf-btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </Section>
      )}

      {showAdd && panel === 'members' && (
        <Section title="Onboard new user" style={{ flexShrink: 0, marginBottom: 16 }}>
          <form onSubmit={addUser}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
              <input required placeholder="Full name" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} className="sf-input" />
              <input required type="email" placeholder="Email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className="sf-input" />
              <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })} className="sf-input">
                {(assignableRoles.length ? assignableRoles : ['team']).map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
              </select>
              {sortedDepartments.length > 0 ? (
                <select value={userForm.department_id} onChange={e => pickDepartmentForUser(e.target.value)} className="sf-input">
                  <option value="">Select department</option>
                  {sortedDepartments.map((d: any) => <option key={d.id} value={d.id}>{d.name}{d.manager ? ` · ${d.manager.name}` : ''}</option>)}
                </select>
              ) : (
                <input placeholder="Department" value={userForm.department} onChange={e => setUserForm({ ...userForm, department: e.target.value })} className="sf-input" />
              )}
              <input placeholder="Designation / responsibility" value={userForm.designation} onChange={e => setUserForm({ ...userForm, designation: e.target.value })} className="sf-input" />
              <input type="password" placeholder="Password (blank = auto generate)" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className="sf-input" />
              {role === 'owner' && (
                <select value={userForm.manager_id} onChange={e => setUserForm({ ...userForm, manager_id: e.target.value })} className="sf-input">
                  <option value="">No manager (optional)</option>
                  {sortedManagers.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                </select>
              )}
            </div>
            {role === 'manager' && (
              <p style={{ color: 'var(--sf-muted)', fontSize: 12, marginTop: 10 }}>New hires will report to you automatically.</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button type="button" onClick={() => setShowAdd(false)} className="sf-btn sf-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="sf-btn sf-btn-primary">{saving ? 'Creating...' : 'Create User'}</button>
            </div>
          </form>
        </Section>
      )}

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

          {viewingUser && (() => {
            const perf = memberPerf(viewingUser.id)
            return (
              <Section title={`${viewingUser.name}'s tasks`} subtitle={`${perf.allocated} allocated · ${perf.delayed} delayed · ${perf.onTimePct}% on-time`} style={{ marginTop: 16, flexShrink: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 14 }}>
                  {[['Allocated', perf.allocated, '#3B82F6'], ['Completed', perf.completed, '#10B981'], ['Delayed', perf.delayed, '#EF4444'], ['On-time', `${perf.onTimePct}%`, '#FBBF24']].map(([l, v, c]) => (
                    <div key={String(l)} style={{ background: 'var(--sf-surface-2)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                      <div style={{ color: String(c), fontWeight: 700, fontSize: 16 }}>{v}</div>
                      <div style={{ color: 'var(--sf-muted)', fontSize: 10 }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button type="button" onClick={() => setViewingUser(null)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11 }}>Close</button>
                </div>
                {perf.all.length === 0 ? (
                  <div style={{ color: 'var(--sf-muted)', fontSize: 13, padding: 12 }}>No tasks assigned.</div>
                ) : (
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {perf.all.map((t: any) => {
                      const late = t.due_date && t.due_date < today && t.status !== 'Completed'
                      return (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--sf-border)' }}>
                          <div>
                            <div style={{ color: 'var(--sf-text)', fontSize: 13, fontWeight: 600 }}>{t.title}</div>
                            <div style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{t.brand?.name || 'No brand'} · {t.type || 'Task'} · Due {t.due_date || '—'}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {late && <span style={{ color: '#EF4444', fontSize: 10, fontWeight: 700 }}>Delayed</span>}
                            <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{t.status}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>
            )
          })()}

          <Section title="All members" subtitle="Click a member to see all assigned tasks & performance" flex={1} style={{ marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(258px,1fr))', gap: 14 }}>
              {team.map((u: any) => {
                const l = load(u.id)
                const perf = memberPerf(u.id)
                const all = perf.all
                const active = all.filter(t => !['Completed', 'On Hold'].includes(t.status))
                const done = perf.completed
                const rate = all.length > 0 ? Math.round(done / all.length * 100) : 0
                const memberOnline = isOnline(u.id)
                return (
                  <div
                    key={u.id}
                    onClick={() => setViewingUser(u)}
                    style={{ background: 'var(--sf-surface)', border: `1px solid ${viewingUser?.id === u.id ? 'var(--sf-accent)' : (u.is_active ? 'var(--sf-border)' : '#3A2430')}`, borderRadius: 14, padding: 18, opacity: u.is_active ? 1 : 0.65, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', gap: 11, marginBottom: 12, alignItems: 'center' }}>
                      <div style={{ position: 'relative' }}>
                        <div style={{ width: 42, height: 42, borderRadius: 10, background: ROLE_COLORS[u.role] || 'var(--sf-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sf-text)', fontWeight: 700, fontSize: 13 }}>{u.avatar || u.name?.slice(0, 2)}</div>
                        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 11, height: 11, borderRadius: '50%', background: memberOnline ? '#10B981' : 'var(--sf-muted-2)', border: '2px solid var(--sf-surface)' }} />
                      </div>
                      <div>
                        <div style={{ color: 'var(--sf-text)', fontWeight: 700, fontSize: 13 }}>{u.name}</div>
                        <div style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{u.designation || u.department || ROLE_LABELS[u.role]}</div>
                        {u.manager_id && <div style={{ color: 'var(--sf-muted-2)', fontSize: 10, marginTop: 2 }}>Reports to {managerName(u.manager_id) || '—'}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ background: l.color + '20', color: l.color, fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>{l.label}</span>
                      <span style={{ color: u.is_active ? 'var(--sf-muted)' : '#EF4444', fontSize: 11 }}>{u.is_active ? `${active.length} active` : 'Inactive'}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
                      {[['Alloc', perf.allocated, 'var(--sf-text)'], ['Done', done, '#10B981'], ['Late', perf.delayed, '#EF4444'], ['On-time', `${perf.onTimePct}%`, '#FBBF24']].map(([lbl, v, c]) => (
                        <div key={String(lbl)} style={{ background: 'var(--sf-surface-2)', borderRadius: 7, padding: '7px', textAlign: 'center' }}>
                          <div style={{ color: String(c), fontWeight: 700, fontSize: 12 }}>{v}</div>
                          <div style={{ color: 'var(--sf-muted)', fontSize: 9 }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                      {canEditUser(u) && <button type="button" onClick={() => startEditUser(u)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '6px 8px' }}>Edit</button>}
                      {canReset && u.id !== session.id && <button type="button" onClick={() => resetPassword(u.id, u.name)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '6px 8px' }}>Reset Password</button>}
                      {role === 'owner' && u.id !== session.id && u.is_active && <button type="button" onClick={() => deactivateUser(u.id, u.name)} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '6px 8px', color: 'var(--sf-danger)' }}>Deactivate</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        </>
      )}
    </PageShell>
  )
}
