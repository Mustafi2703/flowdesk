// @ts-nocheck
'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionUser, STATUS_BG, STATUS_TEXT } from '@/types'
import { EmptyState, Icon } from '@/components/app/Icons'
import { PageHeader, PageShell, PageTabs, PageToolbar, Section } from '@/components/app/Section'
import { TaskFormModal } from '@/components/pages/TasksClient'
import { TASK_STATUSES, canManageTasks, canSetTaskPrice, isClockedInToday, isTaskAssignee } from '@/lib/tasks'
import { todayIST } from '@/lib/clock'
import { FileAttachmentsPanel } from '@/components/app/FileAttachmentsPanel'
import { PeoplePicker } from '@/components/app/PeoplePicker'
import { BrandBadge, BrandLogoMark, BrandTag, brandAccent } from '@/components/app/BrandBadge'

const WORKFLOW_STAGES = [
  { id: 'assigned', label: 'Assigned' },
  { id: 'design', label: 'Design' },
  { id: 'content', label: 'Content' },
  { id: 'editing', label: 'Editing' },
  { id: 'approval', label: 'Approval' },
  { id: 'delivered', label: 'Delivered' },
]

function logoAttachmentId(logoUrl?: string | null) {
  if (!logoUrl?.includes('/api/attachments/')) return null
  return logoUrl.split('/').pop()?.split('?')[0] || null
}

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
  const [identityEditNonce, setIdentityEditNonce] = useState(0)
  const [brandSearch, setBrandSearch] = useState('')
  const [brandStageFilter, setBrandStageFilter] = useState('all')
  const canEdit = ['owner', 'manager'].includes(session.role)
  const isOwner = session.role === 'owner'
  const isReadOnlyRole = ['hr', 'accountant'].includes(session.role)

  function patchBrand(updated: any) {
    setBrands(prev => prev.map(b => (sameId(b.id, updated.id) ? { ...b, ...updated } : b)))
  }

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
    () => {
      if (session.role !== 'team') return brands
      return brands.filter(b =>
        (b.assigned_members || []).some((id: string) => sameId(id, session.id)) ||
        (b.assigned_managers || []).some((id: string) => sameId(id, session.id))
      )
    },
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

  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase()
    return visible.filter((b) => {
      if (brandStageFilter !== 'all' && (b.workflow_stage || 'assigned') !== brandStageFilter) return false
      if (!q) return true
      return b.name?.toLowerCase().includes(q)
        || b.client_type?.toLowerCase().includes(q)
        || b.priority?.toLowerCase().includes(q)
    })
  }, [visible, brandSearch, brandStageFilter])

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
          title={session.role === 'team' ? 'My brands' : isReadOnlyRole ? 'Brands (view)' : 'Brands'}
          subtitle={`${visible.length} client${visible.length === 1 ? '' : 's'}${isReadOnlyRole ? ' · read-only' : ''}`}
        />
        {canEdit && selected && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowCreate(true)} className="sf-btn sf-btn-primary">
              Add brand
            </button>
            <button type="button" className="sf-btn sf-btn-ghost" onClick={() => { setSection('identity'); setIdentityEditNonce((n) => n + 1) }}>
              Edit identity
            </button>
            <button type="button" className="sf-btn sf-btn-ghost" style={{ color: 'var(--sf-danger)' }} onClick={async () => {
              if (!window.confirm(`Delete brand "${selected.name}"? Tasks stay but will be unlinked.`)) return
              const res = await fetch(`/api/brands/${selected.id}`, { method: 'DELETE' })
              const data = await res.json().catch(() => ({}))
              if (!res.ok) { alert(data.error || data.detail || 'Could not delete brand'); return }
              setSelectedId(null)
              load()
            }}>Delete brand</button>
          </div>
        )}
        {canEdit && !selected && (
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
        <div className="sf-brand-workspace">
          <aside className="sf-brand-roster" aria-label="Client roster">
            <div className="sf-brand-roster-head">
              <h2 className="sf-brand-roster-title">Client roster</h2>
              <span className="sf-brand-roster-count">{visible.length}</span>
            </div>
            <div className="sf-brand-roster-search-wrap">
              <input
                type="search"
                className="sf-brand-roster-search"
                placeholder="Search clients…"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                aria-label="Search clients"
              />
              <div className="sf-brand-roster-filters" role="tablist" aria-label="Filter by stage">
                <button
                  type="button"
                  className={`sf-brand-roster-filter${brandStageFilter === 'all' ? ' is-active' : ''}`}
                  onClick={() => setBrandStageFilter('all')}
                >
                  All
                </button>
                {WORKFLOW_STAGES.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    className={`sf-brand-roster-filter${brandStageFilter === stage.id ? ' is-active' : ''}`}
                    onClick={() => setBrandStageFilter(stage.id)}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sf-brand-roster-list">
              {filteredBrands.length === 0 ? (
                <div className="sf-brand-roster-empty">No clients match &ldquo;{brandSearch}&rdquo;</div>
              ) : filteredBrands.map((b) => {
                const bt = tasks.filter(t => sameId(t.brand_id, b.id))
                const active = selected && sameId(selected.id, b.id)
                const stageLabel = WORKFLOW_STAGES.find(s => s.id === (b.workflow_stage || 'assigned'))?.label || 'Assigned'
                return (
                  <BrandBadge
                    key={b.id}
                    brand={b}
                    variant="roster"
                    active={!!active}
                    taskCount={bt.length}
                    stageLabel={stageLabel}
                    onClick={() => selectBrand(b)}
                  />
                )
              })}
            </div>
          </aside>

          <div className="sf-brand-workspace-main">
            {selected ? (
              <>
                <PageTabs tabs={brandTabs} active={section} onChange={setSection} />
                <BrandDetail
                  brand={selected}
                  tasks={brandTasks}
                  users={users}
                  session={session}
                  canEdit={canEdit}
                  canAssignManagers={isOwner}
                  canAssignTeam={canEdit}
                  tab={section}
                  onTabChange={setSection}
                  onRefresh={load}
                  onBrandUpdated={patchBrand}
                  attendance={attendance}
                  identityEditNonce={identityEditNonce}
                />
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--sf-muted)' }}>
                Select a client from the roster to view projects, tasks, and brand identity.
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && canEdit && <CreateBrand onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />}
    </PageShell>
  )
}

function BrandDetail({ brand, tasks, users, session, canEdit, canAssignManagers, canAssignTeam, tab, onTabChange, onRefresh, onBrandUpdated, attendance, identityEditNonce = 0 }: any) {
  const router = useRouter()
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [createAsProject, setCreateAsProject] = useState(false)
  const [managerIds, setManagerIds] = useState<string[]>(() => (brand.assigned_managers || []).map(String))
  const [memberIds, setMemberIds] = useState<string[]>(() => (brand.assigned_members || []).map(String))
  const [savingMembers, setSavingMembers] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [editingIdentity, setEditingIdentity] = useState(false)
  const [identityDraft, setIdentityDraft] = useState({
    name: brand.name || '',
    logo: brand.logo || '',
    description: brand.description || '',
    short_term_goals: (brand.short_term_goals || []).join('\n'),
    long_term_goals: (brand.long_term_goals || []).join('\n'),
    journey: (brand.journey || []).join('\n'),
    responsibilities: brand.responsibilities || '',
    fonts: brand.fonts || '',
    logo_variants: (brand.logo_variants || []).join('\n'),
    brand_colors: brand.brand_colors || '',
    photography_style: brand.photography_style || '',
    brand_voice: brand.brand_voice || '',
    workflow_stage: brand.workflow_stage || 'assigned',
    priority: brand.priority || 'P3',
    client_type: brand.client_type || 'Retainer',
  })
  const [savingIdentity, setSavingIdentity] = useState(false)
  const today = todayIST()
  const clockedIn = isClockedInToday(attendance || [], session.id, today)
  const canSetPrice = canSetTaskPrice(session.role)
  const canSeeBilling = ['owner', 'manager', 'accountant'].includes(session.role)
  const statusSelectStyle = { padding: '4px 8px', background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 6, color: 'var(--sf-text)', fontSize: 11, fontFamily: 'inherit' }
  const assignableManagers = users.filter((u: any) => u.role === 'manager' && u.is_active !== false)
  const assignableTeam = users.filter((u: any) => u.role === 'team' && u.is_active !== false)
  const isAllocated =
    (brand.assigned_members || []).some((id: string) => sameId(id, session.id)) ||
    (brand.assigned_managers || []).some((id: string) => sameId(id, session.id))
  const canUploadDocs = canEdit || (session.role === 'team' && isAllocated)

  useEffect(() => {
    setManagerIds((brand.assigned_managers || []).map(String))
    setMemberIds((brand.assigned_members || []).map(String))
    setIdentityDraft({
      name: brand.name || '',
      logo: brand.logo || '',
      description: brand.description || '',
      short_term_goals: (brand.short_term_goals || []).join('\n'),
      long_term_goals: (brand.long_term_goals || []).join('\n'),
      journey: (brand.journey || []).join('\n'),
      responsibilities: brand.responsibilities || '',
      fonts: brand.fonts || '',
      logo_variants: (brand.logo_variants || []).join('\n'),
      brand_colors: brand.brand_colors || '',
      photography_style: brand.photography_style || '',
      brand_voice: brand.brand_voice || '',
      workflow_stage: brand.workflow_stage || 'assigned',
      priority: brand.priority || 'P3',
      client_type: brand.client_type || 'Retainer',
    })
    setLogoError('')
  }, [brand.id, brand.assigned_members, brand.assigned_managers, brand.name, brand.logo, brand.logo_url, brand.description, brand.workflow_stage, brand.priority, brand.client_type, brand.short_term_goals, brand.long_term_goals, brand.journey, brand.responsibilities, brand.fonts, brand.logo_variants, brand.brand_colors, brand.photography_style, brand.brand_voice])

  useEffect(() => {
    if (identityEditNonce > 0) setEditingIdentity(true)
  }, [identityEditNonce])

  async function saveMembers() {
    setSavingMembers(true)
    const body: Record<string, string[]> = {}
    if (canAssignTeam) body.assigned_members = memberIds
    if (canAssignManagers) body.assigned_managers = managerIds
    const res = await fetch(`/api/brands/${brand.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSavingMembers(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not update brand allocation')
      return
    }
    alert('Brand allocation saved. Assigned managers and team can open brand documents.')
    onRefresh()
  }

  async function uploadLogo(e: any) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    setLogoError('')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/brands/${brand.id}/logo`, { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    setUploadingLogo(false)
    e.target.value = ''
    if (!res.ok) {
      setLogoError(data.error || data.detail || 'Logo upload failed')
      return
    }
    onBrandUpdated?.(data)
  }

  async function saveIdentity() {
    setSavingIdentity(true)
    const lines = (s: string) => s.split('\n').map((x: string) => x.trim()).filter(Boolean)
    const res = await fetch(`/api/brands/${brand.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: identityDraft.name?.trim() || brand.name,
        logo: (identityDraft.logo || brand.name.slice(0, 2)).toUpperCase().slice(0, 8),
        description: identityDraft.description || null,
        short_term_goals: lines(identityDraft.short_term_goals),
        long_term_goals: lines(identityDraft.long_term_goals),
        journey: lines(identityDraft.journey),
        responsibilities: identityDraft.responsibilities || null,
        fonts: identityDraft.fonts || null,
        logo_variants: lines(identityDraft.logo_variants),
        brand_colors: identityDraft.brand_colors || null,
        photography_style: identityDraft.photography_style || null,
        brand_voice: identityDraft.brand_voice || null,
        workflow_stage: identityDraft.workflow_stage,
        priority: identityDraft.priority,
        client_type: identityDraft.client_type,
      }),
    })
    setSavingIdentity(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not save brand')
      return
    }
    setEditingIdentity(false)
    onRefresh()
  }

  function canUpdateStatus(task: any) {
    if (!clockedIn) return false
    if (canEdit) return true
    return isTaskAssignee(task, session.id)
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
        <select value={task.status} onChange={e => updateTaskStatus(task.id, e.target.value)} style={{ ...statusSelectStyle, background: STATUS_BG[task.status] || statusSelectStyle.background, color: STATUS_TEXT[task.status] || statusSelectStyle.color }}>
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
    setCreateAsProject(true)
    setShowTaskModal(true)
  }

  function openCreateTask() {
    setCreateAsProject(false)
    setShowTaskModal(true)
  }

  function openEditTask(t: any) {
    router.push(`/tasks/${t.id}`)
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
      <div className="sf-brand-hero" style={{ '--brand-accent': brandAccent(brand.priority) } as React.CSSProperties}>
        <div className="sf-brand-hero-body">
          <BrandLogoMark brand={brand} size={56} />
          <div className="sf-brand-hero-main">
            <h1 className="sf-brand-hero-name" title={brand.name}>{brand.name}</h1>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              {brand.client_type && <BrandTag label={brand.client_type} tone="type" />}
              {brand.priority && <BrandTag label={brand.priority} tone="priority" />}
              <BrandTag
                label={WORKFLOW_STAGES.find(s => s.id === (brand.workflow_stage || 'assigned'))?.label || 'Assigned'}
                tone="stage"
              />
            </div>
            <p className="sf-brand-hero-desc">{brand.description}</p>
            {canEdit && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '4px 10px', cursor: uploadingLogo ? 'wait' : 'pointer' }}>
                  {uploadingLogo ? 'Uploading logo…' : brand.logo_url ? 'Replace logo' : 'Upload logo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden disabled={uploadingLogo} onChange={uploadLogo} />
                </label>
                <button type="button" className="sf-btn sf-btn-ghost" style={{ fontSize: 11 }} onClick={() => { setEditingIdentity(true); onTabChange('identity') }}>Edit brand</button>
                {logoError && <span style={{ color: '#F87171', fontSize: 11 }}>{logoError}</span>}
              </div>
            )}
          </div>
          <div className="sf-brand-hero-stats">
            {[['Total', tasks.length, '#3B82F6'], ['Projects', projects.length, '#06B6D4'], ['Done', done, '#10B981'], ['Flagged', fl.length, '#EF4444']].map(([l, v, c]) => (
              <div key={String(l)} style={{ background: 'var(--sf-bg)', borderRadius: 10, padding: '8px 12px', textAlign: 'center', border: '1px solid var(--sf-border)' }}>
                <div style={{ color: String(c), fontWeight: 700, fontSize: 18 }}>{v}</div>
                <div style={{ color: 'var(--sf-muted)', fontSize: 10 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 16, minWidth: 0, gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <PageHeader
            title={BRAND_SECTIONS.find(s => s.id === tab)?.label || 'Overview'}
            subtitle={brand.name}
          />
        </div>
        {canEdit && tab === 'projects' && (
          <button type="button" onClick={openCreateProject} className="sf-btn sf-btn-primary">Add project</button>
        )}
        {canEdit && tab === 'tasks' && (
          <button type="button" onClick={openCreateTask} className="sf-btn sf-btn-primary">Add task</button>
        )}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1/-1', background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--sf-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Brand identity</div>
              {canEdit && (
                <button type="button" className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => { setEditingIdentity(true); onTabChange('identity') }}>
                  Edit identity
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14, minWidth: 0 }}>
              <BrandLogoMark brand={brand} size={56} />
              <div style={{ minWidth: 0 }}>
                <div className="sf-truncate" style={{ color: 'var(--sf-text)', fontWeight: 700 }} title={brand.name}>{brand.name}</div>
                <div style={{ color: 'var(--sf-muted)', fontSize: 12 }}>{brand.client_type} · {brand.priority}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {[
                ['Fonts', brand.fonts],
                ['Colors', brand.brand_colors],
                ['Voice', brand.brand_voice],
                ['Photography', brand.photography_style],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                  <div style={{ color: 'var(--sf-text)', fontSize: 13, overflowWrap: 'anywhere' }}>{value || 'Not specified — add this on the Identity tab'}</div>
                </div>
              ))}
            </div>
          </div>
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
            <div style={{ color: 'var(--sf-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Allocated people</div>
            <div style={{ color: 'var(--sf-muted)', fontSize: 12, marginBottom: 12 }}>
              With roles. Owner assigns managers; managers add team. Allocated people see brand documents.
            </div>

            {/* Always list current allocation with roles */}
            <div style={{ marginBottom: (canAssignManagers || canAssignTeam) ? 14 : 0 }}>
              {[
                ...((brand.assigned_managers || []).map((uid: string) => ({ uid, roleLabel: 'Manager' }))),
                ...((brand.assigned_members || []).map((uid: string) => ({ uid, roleLabel: 'Team' }))),
              ].map(({ uid, roleLabel }) => {
                const u = users.find((x: any) => sameId(x.id, uid))
                if (!u) return null
                return (
                  <div key={`${roleLabel}-${uid}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', background: 'var(--sf-surface-2)', borderRadius: 7, marginBottom: 5 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: roleLabel === 'Manager' ? '#3B82F6' : 'var(--sf-accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: 10,
                    }}>{u.avatar || u.name?.slice(0, 2)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--sf-text)', fontSize: 12, fontWeight: 600 }}>{u.name}</div>
                      <div style={{ color: 'var(--sf-muted)', fontSize: 10 }}>
                        {[u.designation, u.department].filter(Boolean).join(' · ') || roleLabel}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, flexShrink: 0,
                      background: roleLabel === 'Manager' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                      color: roleLabel === 'Manager' ? '#3B82F6' : '#10B981',
                    }}>{roleLabel}</span>
                  </div>
                )
              })}
              {!(brand.assigned_managers?.length || brand.assigned_members?.length) && (
                <div style={{ color: 'var(--sf-muted-2)', fontSize: 12, marginBottom: 8 }}>Nobody allocated yet.</div>
              )}
            </div>

            {(canAssignManagers || canAssignTeam) && (
              <>
                <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Add / update allocation</div>
                {canAssignManagers && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: 'var(--sf-text)', fontSize: 12, fontWeight: 650, marginBottom: 6 }}>Managers</div>
                    <PeoplePicker
                      users={assignableManagers}
                      selectedIds={managerIds}
                      onChange={setManagerIds}
                      variant="dropdown"
                      placeholder="Add managers…"
                      emptyLabel="No Manager users yet."
                      groupByRole={false}
                    />
                  </div>
                )}
                {canAssignTeam && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: 'var(--sf-text)', fontSize: 12, fontWeight: 650, marginBottom: 6 }}>Team members</div>
                    <PeoplePicker
                      users={assignableTeam}
                      selectedIds={memberIds}
                      onChange={setMemberIds}
                      variant="dropdown"
                      placeholder="Add team members…"
                      emptyLabel="No Team users yet."
                      groupByRole={false}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={saveMembers}
                  disabled={savingMembers}
                  className="sf-btn sf-btn-primary"
                  style={{ marginTop: 8, fontSize: 12 }}
                >
                  {savingMembers ? 'Saving…' : 'Save allocation'}
                </button>
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
                    <button type="button" onClick={() => router.push(`/tasks/${t.id}`)} className="sf-btn sf-btn-primary" style={{ fontSize: 11, padding: '4px 8px' }}>Open</button>
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
              <button type="button" onClick={() => router.push(`/tasks/${t.id}`)} className="sf-btn sf-btn-primary" style={{ fontSize: 11, padding: '4px 8px' }}>Open</button>
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
        <div className="sf-brand-identity-grid">
          <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ color: 'var(--sf-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Brand info</div>
              {canEdit && (
                <button type="button" className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setEditingIdentity(v => !v)}>
                  {editingIdentity ? 'Cancel' : 'Edit'}
                </button>
              )}
            </div>
            {!editingIdentity ? (
              <>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, minWidth: 0 }}>
                  <BrandLogoMark brand={brand} size={64} />
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div className="sf-truncate" style={{ color: 'var(--sf-text)', fontWeight: 700 }} title={brand.name}>{brand.name}</div>
                    <div className="sf-truncate" style={{ color: 'var(--sf-muted)', fontSize: 12 }} title={brand.logo || ''}>
                      {brand.logo_url ? 'Image logo set' : `Initials: ${brand.logo || '—'}`}
                    </div>
                  </div>
                </div>
                {[['Client Type', brand.client_type], ['Priority', brand.priority], ['Workflow stage', WORKFLOW_STAGES.find(s => s.id === (brand.workflow_stage || 'assigned'))?.label], ['Allocated', `${(brand.assigned_managers?.length || 0) + (brand.assigned_members?.length || 0)} people`]].map(([l, v]) => (
                  <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--sf-border)', minWidth: 0 }}>
                    <span style={{ color: 'var(--sf-muted)', fontSize: 12, flexShrink: 0 }}>{l}</span>
                    <span className="sf-truncate" style={{ color: 'var(--sf-text)', fontSize: 12, fontWeight: 600, textAlign: 'right' }} title={String(v ?? '')}>{v}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                  <div>
                    <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Fonts</div>
                    <div style={{ color: 'var(--sf-text)', fontSize: 13, overflowWrap: 'anywhere' }}>{brand.fonts || 'Not specified'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Brand colors</div>
                    <div style={{ color: 'var(--sf-text)', fontSize: 13, overflowWrap: 'anywhere' }}>{brand.brand_colors || 'Not specified'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Photography style</div>
                    <div style={{ color: 'var(--sf-text)', fontSize: 13, overflowWrap: 'anywhere' }}>{brand.photography_style || 'Not specified'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Brand voice</div>
                    <div style={{ color: 'var(--sf-text)', fontSize: 13, overflowWrap: 'anywhere' }}>{brand.brand_voice || 'Not specified'}</div>
                  </div>
                </div>
                {(brand.logo_variants || []).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Logo variants</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(brand.logo_variants || []).map((v: string) => (
                        <span key={v} style={{
                          padding: '5px 8px', borderRadius: 7, fontSize: 11, fontWeight: 650,
                          background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', color: 'var(--sf-text)',
                        }}>{v}</span>
                      ))}
                    </div>
                  </div>
                )}
                {canEdit && (
                  <label className="sf-btn sf-btn-primary" style={{ marginTop: 14, fontSize: 12, display: 'inline-block', cursor: uploadingLogo ? 'wait' : 'pointer' }}>
                    {uploadingLogo ? 'Uploading…' : 'Upload / update logo'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden disabled={uploadingLogo} onChange={uploadLogo} />
                  </label>
                )}
                {logoError && <div style={{ color: '#F87171', fontSize: 12, marginTop: 8 }}>{logoError}</div>}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Brand name
                  <input value={identityDraft.name} onChange={e => setIdentityDraft(d => ({ ...d, name: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)' }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Initials fallback
                  <input value={identityDraft.logo} onChange={e => setIdentityDraft(d => ({ ...d, logo: e.target.value.slice(0, 8) }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)' }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Client type
                  <select value={identityDraft.client_type} onChange={e => setIdentityDraft(d => ({ ...d, client_type: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)' }}>
                    {['Retainer', 'Project', 'One-off'].map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Priority
                  <select value={identityDraft.priority} onChange={e => setIdentityDraft(d => ({ ...d, priority: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)' }}>
                    {['P1', 'P2', 'P3', 'P4'].map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Workflow stage
                  <select value={identityDraft.workflow_stage} onChange={e => setIdentityDraft(d => ({ ...d, workflow_stage: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)' }}>
                    {WORKFLOW_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Description
                  <textarea value={identityDraft.description} onChange={e => setIdentityDraft(d => ({ ...d, description: e.target.value }))} rows={3} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)', resize: 'vertical' }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Short-term goals (one per line)
                  <textarea value={identityDraft.short_term_goals} onChange={e => setIdentityDraft(d => ({ ...d, short_term_goals: e.target.value }))} rows={3} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)', resize: 'vertical' }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Long-term goals (one per line)
                  <textarea value={identityDraft.long_term_goals} onChange={e => setIdentityDraft(d => ({ ...d, long_term_goals: e.target.value }))} rows={3} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)', resize: 'vertical' }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Journey milestones (one per line)
                  <textarea value={identityDraft.journey} onChange={e => setIdentityDraft(d => ({ ...d, journey: e.target.value }))} rows={3} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)', resize: 'vertical' }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Brand fonts
                  <input value={identityDraft.fonts} onChange={e => setIdentityDraft(d => ({ ...d, fonts: e.target.value }))} placeholder="e.g. Syne / DM Sans" style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)' }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Brand colors
                  <input value={identityDraft.brand_colors} onChange={e => setIdentityDraft(d => ({ ...d, brand_colors: e.target.value }))} placeholder="e.g. #0a0a0f · #d4a574 · #20b2aa" style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)' }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Logo variants (one per line)
                  <textarea value={identityDraft.logo_variants} onChange={e => setIdentityDraft(d => ({ ...d, logo_variants: e.target.value }))} rows={2} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)', resize: 'vertical' }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Photography style
                  <textarea value={identityDraft.photography_style} onChange={e => setIdentityDraft(d => ({ ...d, photography_style: e.target.value }))} rows={2} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)', resize: 'vertical' }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Brand voice
                  <textarea value={identityDraft.brand_voice} onChange={e => setIdentityDraft(d => ({ ...d, brand_voice: e.target.value }))} rows={2} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)', resize: 'vertical' }} />
                </label>
                <label style={{ fontSize: 11, color: 'var(--sf-muted)' }}>Responsibilities
                  <textarea value={identityDraft.responsibilities} onChange={e => setIdentityDraft(d => ({ ...d, responsibilities: e.target.value }))} rows={2} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 8, color: 'var(--sf-text)', resize: 'vertical' }} />
                </label>
                <button type="button" className="sf-btn sf-btn-primary" disabled={savingIdentity} onClick={saveIdentity} style={{ fontSize: 12 }}>
                  {savingIdentity ? 'Saving…' : 'Save brand details'}
                </button>
              </div>
            )}
          </div>
          <FileAttachmentsPanel
            key={`brand-files-${brand.id}-${logoAttachmentId(brand.logo_url) || 'none'}`}
            entityType="brand"
            entityId={brand.id}
            canUpload={canUploadDocs}
            title="Brand files & documents"
            excludeIds={[logoAttachmentId(brand.logo_url)].filter(Boolean)}
          />
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

      {showTaskModal && canEdit && (
        <TaskFormModal
          session={session}
          brands={[brand]}
          users={users}
          initialBrandId={brand.id}
          forceProjectMode={createAsProject}
          onClose={() => { setShowTaskModal(false); setCreateAsProject(false) }}
          onSaved={() => { setShowTaskModal(false); setCreateAsProject(false); onRefresh() }}
          canSeeBilling={canSeeBilling}
          canSetPrice={canSetPrice}
          canDelete={false}
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
  const [createdBrand, setCreatedBrand] = useState<any | null>(null)
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
    const brand = await res.json().catch(() => null)
    if (brand?.id) {
      setCreatedBrand(brand)
      return
    }
    onSaved()
  }

  function finish() {
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={createdBrand ? undefined : onClose}>
      <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ color: 'var(--sf-text)', fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700 }}>
            {createdBrand ? `Documents · ${createdBrand.name}` : 'Add new brand'}
          </h3>
          <button type="button" onClick={createdBrand ? finish : onClose} style={{ background: 'none', border: 'none', color: 'var(--sf-muted)', cursor: 'pointer', fontSize: 22 }}>×</button>
        </div>

        {!createdBrand ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Brand Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Quick Furnish" style={sInp} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Logo initials (fallback)</label>
              <input value={logo} onChange={e => setLogo(e.target.value.slice(0, 8))} placeholder="e.g. QF (max 8)" style={sInp} />
              <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginTop: 4 }}>After create you can upload logo + brand documents in the next step.</div>
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
          </>
        ) : (
          <>
            <div style={{ color: 'var(--sf-success)', fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
              Brand created. Upload guidelines, logos, and briefs — click any file to view.
            </div>
            <FileAttachmentsPanel entityType="brand" entityId={createdBrand.id} canUpload title="Brand documents" />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={finish} className="sf-btn sf-btn-primary">Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
