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
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [deptError, setDeptError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', role: 'team', department: '', department_id: '', designation: '', password: '', manager_id: '' })
  const [deptForm, setDeptForm] = useState({ name: '', description: '', manager_id: '' })
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

  function pickDepartment(departmentId: string) {
    const dept = departments.find((d: any) => d.id === departmentId)
    setForm(f => ({
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
      name: form.name,
      email: form.email,
      role: form.role,
      designation: form.designation || null,
    }
    if (form.department_id) payload.department_id = form.department_id
    else if (form.department) payload.department = form.department
    if (form.password) payload.password = form.password
    if (role === 'owner' && form.manager_id) payload.manager_id = form.manager_id
    const res = await fetch('/api/team', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error || data.detail || 'Could not create user'); return }
    setNotice(`User created. Temporary password: ${data.temporary_password}`)
    setForm({ name: '', email: '', role: assignableRoles[0] || 'team', department: '', department_id: '', designation: '', password: '', manager_id: '' })
    setShowAdd(false)
    refresh()
  }

  async function addDepartment(e: any) {
    e.preventDefault()
    setSaving(true); setError(''); setNotice('')
    const payload: any = {
      name: deptForm.name,
      description: deptForm.description || null,
    }
    if (deptForm.manager_id) payload.manager_id = deptForm.manager_id
    const res = await fetch('/api/team/departments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error || data.detail || 'Could not create department'); return }
    setNotice(`Department "${data.name}" created${data.manager ? ` · Manager: ${data.manager.name}` : ''}.`)
    setDeptForm({ name: '', description: '', manager_id: '' })
    setShowDept(false)
    setPanel('departments')
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
          <button type="button" onClick={() => { setShowDept(true); setShowAdd(false); setNotice(''); setError('') }} className="sf-btn sf-btn-primary">
            Add department
          </button>
        )}
      </PageToolbar>

      {notice && <div style={{ background: '#052E1A', border: '1px solid #10B981', color: '#D1FAE5', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}>{notice}</div>}
      {error && <div style={{ background: '#3B0A0A', border: '1px solid #EF4444', color: '#FEE2E2', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {showDept && panel === 'departments' && (
        <Section title="Create department" style={{ flexShrink: 0, marginBottom: 16 }}>
          <form onSubmit={addDepartment}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
              <input required placeholder="Department name" value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} className="sf-input" />
              <input placeholder="Description (optional)" value={deptForm.description} onChange={e => setDeptForm({ ...deptForm, description: e.target.value })} className="sf-input" />
              <select value={deptForm.manager_id} onChange={e => setDeptForm({ ...deptForm, manager_id: e.target.value })} className="sf-input">
                <option value="">Assign manager (optional)</option>
                {sortedManagers.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
              </select>
            </div>
            <p style={{ color: 'var(--sf-muted)', fontSize: 12, marginTop: 10 }}>
              New hires assigned to this department will default to the department manager.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button type="button" onClick={() => setShowDept(false)} className="sf-btn sf-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="sf-btn sf-btn-primary">{saving ? 'Creating...' : 'Create Department'}</button>
            </div>
          </form>
        </Section>
      )}

      {showAdd && panel === 'members' && (
        <Section title="Onboard new user" style={{ flexShrink: 0, marginBottom: 16 }}>
          <form onSubmit={addUser}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
              <input required placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="sf-input" />
              <input required type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="sf-input" />
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="sf-input">
                {(assignableRoles.length ? assignableRoles : ['team']).map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
              </select>
              {sortedDepartments.length > 0 ? (
                <select value={form.department_id} onChange={e => pickDepartment(e.target.value)} className="sf-input">
                  <option value="">Select department</option>
                  {sortedDepartments.map((d: any) => <option key={d.id} value={d.id}>{d.name}{d.manager ? ` · ${d.manager.name}` : ''}</option>)}
                </select>
              ) : (
                <input placeholder="Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="sf-input" />
              )}
              <input placeholder="Designation / responsibility" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} className="sf-input" />
              <input type="password" placeholder="Password (blank = auto generate)" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="sf-input" />
              {role === 'owner' && (
                <select value={form.manager_id} onChange={e => setForm({ ...form, manager_id: e.target.value })} className="sf-input">
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
                <button type="button" onClick={() => setShowDept(true)} className="sf-btn sf-btn-primary">Create department</button>
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
            <StatCard label="Departments" value={sortedDepartments.length} accent="#8B5CF6" />
            <StatCard label="Flagged tasks" value={tasks.filter(t => ['Struggling', 'Needs Attention'].includes(t.status)).length} accent="#F59E0B" />
          </StatGrid>
          <Section title="All members" subtitle="Workload and status per person" flex={1} style={{ marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(258px,1fr))', gap: 14 }}>
              {team.map((u: any) => {
                const l = load(u.id)
                const all = tasks.filter(t => t.assigned_to?.includes(u.id))
                const active = all.filter(t => !['Completed', 'On Hold'].includes(t.status))
                const done = all.filter(t => t.status === 'Completed').length
                const rate = all.length > 0 ? Math.round(done / all.length * 100) : 0
                const memberOnline = isOnline(u.id)
                return (
                  <div key={u.id} style={{ background: 'var(--sf-surface)', border: `1px solid ${u.is_active ? 'var(--sf-border)' : '#3A2430'}`, borderRadius: 14, padding: 18, opacity: u.is_active ? 1 : 0.65 }}>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginBottom: 10 }}>
                      {[['Total', all.length, 'var(--sf-text)'], ['Done', done, '#10B981'], ['Rate', `${rate}%`, '#FBBF24']].map(([lbl, v, c]) => (
                        <div key={String(lbl)} style={{ background: 'var(--sf-surface-2)', borderRadius: 7, padding: '7px', textAlign: 'center' }}>
                          <div style={{ color: String(c), fontWeight: 700, fontSize: 13 }}>{v}</div>
                          <div style={{ color: 'var(--sf-muted)', fontSize: 10 }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
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
