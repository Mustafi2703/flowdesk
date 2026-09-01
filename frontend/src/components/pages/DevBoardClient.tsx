// @ts-nocheck
'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { SessionUser, STATUS_BG, STATUS_TEXT } from '@/types'
import { PageHeader, PageShell, StatCard } from '@/components/app/Section'
import { BrandLogoMark } from '@/components/app/BrandBadge'
import { Modal } from '@/components/app/Modal'

const STAGES = [
  { id: 'all', label: 'All' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'design', label: 'Design' },
  { id: 'content', label: 'Content' },
  { id: 'editing', label: 'Editing' },
  { id: 'approval', label: 'Approval' },
  { id: 'delivered', label: 'Delivered' },
]

const STAGE_ORDER = ['assigned', 'design', 'content', 'editing', 'approval', 'delivered']

const STAGE_COLORS: Record<string, string> = {
  assigned: '#4a69bd',
  design: '#8854d0',
  content: '#20b2aa',
  editing: '#ff6b6b',
  approval: '#ffa502',
  delivered: '#26de81',
}

function stageLabel(id: string) {
  return STAGES.find(s => s.id === id)?.label || id
}

function WorkflowBrandDetail({
  brand,
  tasks,
  users,
  canEdit,
  savingStage,
  onSetStage,
  inModal = false,
}: {
  brand: any
  tasks: any[]
  users: any[]
  canEdit: boolean
  savingStage: boolean
  onSetStage: (stage: string) => void
  inModal?: boolean
}) {
  const stage = brand.workflow_stage || 'assigned'
  const brandTasks = tasks.filter(t => String(t.brand_id) === String(brand.id))
  const open = brandTasks.filter(t => t.status !== 'Completed').length
  const members = (brand.assigned_members || [])
    .map((id: string) => users.find(u => String(u.id) === String(id)))
    .filter(Boolean)
  const managers = (brand.assigned_managers || [])
    .map((id: string) => users.find(u => String(u.id) === String(id)))
    .filter(Boolean)
  const done = brandTasks.filter(t => t.status === 'Completed').length

  const inner = (
    <>
      {inModal && (
        <div className="sf-workflow-modal-hero">
          <BrandLogoMark brand={brand} size={52} />
          <div className="sf-workflow-modal-hero-copy">
            <div className="sf-workflow-modal-statline">
              {brandTasks.length} tasks · {open} open · {done} done · {brand.priority || 'P3'}
            </div>
            {(brand.contact_email || managers.length > 0) && (
              <div className="sf-workflow-modal-contact">
                {brand.contact_email && (
                  <span>Client: <a href={`mailto:${brand.contact_email}`}>{brand.contact_email}</a></span>
                )}
                {managers.length > 0 && (
                  <span>Managers: {managers.map((u: any) => u.name).join(', ')}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <span className="sf-workflow-row-stage" style={{ '--wf-stage': STAGE_COLORS[stage] || '#20b2aa' } as React.CSSProperties}>
          {stageLabel(stage)}
        </span>
        {brand.client_type && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', color: 'var(--sf-muted)' }}>
            {brand.client_type}
          </span>
        )}
        {(members.length + managers.length) > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', color: 'var(--sf-muted)' }}>
            {members.length + managers.length} people
          </span>
        )}
      </div>

      {brand.description && (
        <p className="sf-workflow-modal-desc">{brand.description}</p>
      )}

      {!inModal && (brand.contact_email || managers.length > 0) && (
        <div style={{ display: 'grid', gap: 6, marginBottom: 14, fontSize: 12 }}>
          {brand.contact_email && (
            <div><span style={{ color: 'var(--sf-muted)' }}>Client: </span><a href={`mailto:${brand.contact_email}`} style={{ color: 'var(--sf-accent)' }}>{brand.contact_email}</a></div>
          )}
          {managers.length > 0 && (
            <div style={{ color: 'var(--sf-text-secondary)' }}><span style={{ color: 'var(--sf-muted)' }}>Managers: </span>{managers.map((u: any) => u.name).join(', ')}</div>
          )}
        </div>
      )}

      {canEdit && (
        <>
          <div className="sf-workflow-section-label">Update stage</div>
          <div className="sf-workflow-stage-grid">
            {STAGE_ORDER.map(s => {
              const active = stage === s
              return (
                <button
                  key={s}
                  type="button"
                  disabled={savingStage}
                  onClick={() => onSetStage(s)}
                  className={`sf-workflow-stage-btn${active ? ' is-active' : ''}`}
                  style={active ? { background: STAGE_COLORS[s], borderColor: STAGE_COLORS[s] } : undefined}
                >
                  {stageLabel(s)}
                </button>
              )
            })}
          </div>
        </>
      )}

      <div className="sf-workflow-section-label">Team ({members.length})</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {members.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--sf-muted)' }}>No team allocated — assign on Brands page.</span>
        ) : members.map((u: any) => (
          <span key={u.id} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)' }}>
            {u.name}
          </span>
        ))}
      </div>

      <div className="sf-workflow-section-label">Tasks ({brandTasks.length})</div>
      {brandTasks.length === 0 ? (
        <div style={{ color: 'var(--sf-muted)', fontSize: 13 }}>No tasks on this brand yet.</div>
      ) : (
        <div className="sf-workflow-modal-tasks">
          {brandTasks.map(t => (
            <Link
              key={t.id}
              href={`/tasks/${t.id}`}
              className="sf-workflow-modal-task-row"
            >
              <span className="sf-workflow-modal-task-title">{t.title}</span>
              <span style={{ background: STATUS_BG[t.status] || '#F3F4F6', color: STATUS_TEXT[t.status] || '#374151', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, flexShrink: 0 }}>{t.status}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  )

  if (inModal) {
    return <div className="sf-workflow-modal-detail">{inner}</div>
  }

  return (
    <>
      <div className="sf-workflow-detail-head">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
          <BrandLogoMark brand={brand} size={48} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--sf-text)' }}>
              {brand.name}
            </div>
            <div style={{ color: 'var(--sf-muted)', fontSize: 12, marginTop: 2 }}>
              {brandTasks.length} tasks · {open} open · {done} done · {brand.priority || 'P3'}
            </div>
          </div>
        </div>
        <Link href="/brands" className="sf-btn sf-btn-ghost" style={{ fontSize: 11, flexShrink: 0 }}>
          Open brand →
        </Link>
      </div>
      <div className="sf-workflow-detail-body">{inner}</div>
    </>
  )
}

export default function DevBoardClient({ session }: { session: SessionUser }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stageFilter, setStageFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [savingStage, setSavingStage] = useState(false)
  const [showCapacity, setShowCapacity] = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)
  const canEdit = ['owner', 'manager'].includes(session.role)

  function load() {
    return Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/brands').then(r => r.json()),
    ]).then(([t, u, b]) => {
      setTasks(Array.isArray(t) ? t : [])
      setUsers(Array.isArray(u) ? u : [])
      setBrands(Array.isArray(b) ? b : [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase()
    return brands.filter((b) => {
      const stage = b.workflow_stage || 'assigned'
      if (stageFilter !== 'all' && stage !== stageFilter) return false
      if (q && !String(b.name || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [brands, stageFilter, search])

  const activeTasks = tasks.filter(t => t.status !== 'Completed')
  const awaitingApproval = brands.filter(b => (b.workflow_stage || 'assigned') === 'approval').length
  const completedToday = tasks.filter(t => {
    if (t.status !== 'Completed') return false
    const d = t.updated_at || t.completed_at
    if (!d) return false
    return String(d).slice(0, 10) === new Date().toISOString().slice(0, 10)
  }).length

  const capacity = useMemo(() => {
    const team = users.filter(u => u.role === 'team' && u.is_active !== false)
    return team.map(u => {
      const open = tasks.filter(t =>
        t.status !== 'Completed' &&
        (t.assigned_to || []).some((id: string) => String(id) === String(u.id))
      ).length
      const cap = 8
      const pct = Math.min(100, Math.round((open / cap) * 100))
      return { user: u, open, cap, pct }
    }).sort((a, b) => b.pct - a.pct)
  }, [users, tasks])

  const stageAnalytics = useMemo(() => {
    return STAGE_ORDER.map(stageId => {
      const count = brands.filter(b => (b.workflow_stage || 'assigned') === stageId).length
      const withTasks = brands.filter(b => {
        if ((b.workflow_stage || 'assigned') !== stageId) return false
        return tasks.some(t => String(t.brand_id) === String(b.id))
      }).length
      return { stageId, count, withTasks, label: stageLabel(stageId), color: STAGE_COLORS[stageId] }
    })
  }, [brands, tasks])

  const brandsWithOpenTasks = useMemo(() => {
    return brands.filter(b => tasks.some(t => String(t.brand_id) === String(b.id) && t.status !== 'Completed')).length
  }, [brands, tasks])

  async function setStage(brandId: string, workflow_stage: string) {
    if (!canEdit) return
    setSavingStage(true)
    const res = await fetch(`/api/brands/${brandId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_stage }),
    })
    setSavingStage(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not update stage')
      return
    }
    await load()
  }

  const selected = brands.find(b => String(b.id) === String(selectedId))

  function selectBrand(id: string) {
    setSelectedId(id)
    setDetailOpen(true)
  }

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading workflow…</div>

  return (
    <PageShell className="sf-workflow-page">
      <PageHeader
        title="Workflow Dashboard"
        subtitle="Pick a brand from the list — stages, tasks, and capacity in one place"
      />

      <div className="sf-workflow-summary">
        <StatCard label="Total brands" value={brands.length} accent="#d4a574" />
        <StatCard label="Brands with open work" value={brandsWithOpenTasks} accent="#20b2aa" />
        <StatCard label="Active tasks" value={activeTasks.length} accent="#3B82F6" />
        <StatCard label="Awaiting approval" value={awaitingApproval} accent="#ffa502" />
      </div>

      <div className="sf-workflow-analytics">
        {stageAnalytics.map(({ stageId, count, withTasks, label, color }) => (
          <button
            key={stageId}
            type="button"
            className="sf-workflow-analytics-card"
            onClick={() => setStageFilter(stageId)}
            style={{ borderColor: stageFilter === stageId ? color : undefined }}
          >
            <div className="sf-workflow-analytics-val" style={{ color }}>{count}</div>
            <div className="sf-workflow-analytics-label">{label}</div>
            <div className="sf-workflow-analytics-label">{withTasks} with tasks</div>
          </button>
        ))}
      </div>

      <div className={`sf-workflow-capacity${showCapacity ? ' is-open' : ''}`}>
        <button type="button" className="sf-workflow-capacity-toggle" onClick={() => setShowCapacity(v => !v)}>
          <span>Team capacity ({capacity.length} members · {capacity.filter(c => c.pct >= 85).length} near limit)</span>
          <span style={{ fontSize: 11, color: 'var(--sf-muted)' }}>{showCapacity ? 'Hide' : 'Show'}</span>
        </button>
        {showCapacity && (
          capacity.length === 0 ? (
            <div style={{ color: 'var(--sf-muted)', fontSize: 13, paddingTop: 8 }}>No team members yet.</div>
          ) : (
            <div className="sf-workflow-capacity-grid">
              {capacity.map(({ user, open, cap, pct }) => (
                <div key={user.id} className="sf-workflow-capacity-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{user.name}</span>
                    <span style={{ color: 'var(--sf-muted)', flexShrink: 0 }}>{open}/{cap} · {pct}%</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--sf-muted)', marginBottom: 6 }}>{user.designation || 'Team'}</div>
                  <div style={{ height: 6, background: 'var(--sf-border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: pct >= 85 ? '#ff6b6b' : 'linear-gradient(90deg,#20b2aa,#d4a574)',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <section className="sf-workflow-brand-section" aria-label="Brand list">
        <div className="sf-workflow-brand-head">
          <h2 className="sf-workflow-roster-title">Brands ({filteredBrands.length}{search.trim() || stageFilter !== 'all' ? ` of ${brands.length}` : ''})</h2>
          <div className="sf-workflow-brand-filters">
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              aria-label="Filter by workflow stage"
              className="sf-workflow-brand-select"
            >
              {STAGES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <div className="sf-perf-search-wrap">
              <input
                type="search"
                className="sf-perf-search"
                placeholder="Search brands…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Search brands"
              />
            </div>
          </div>
        </div>
        <div className="sf-workflow-brand-grid">
          {filteredBrands.length === 0 ? (
            <div className="sf-workflow-empty sf-workflow-empty--wide">No brands match this filter.</div>
          ) : filteredBrands.map((brand) => {
            const stage = brand.workflow_stage || 'assigned'
            const brandTasks = tasks.filter(t => String(t.brand_id) === String(brand.id))
            const open = brandTasks.filter(t => t.status !== 'Completed').length
            const done = brandTasks.filter(t => t.status === 'Completed').length
            const people = (brand.assigned_members || []).length + (brand.assigned_managers || []).length
            return (
              <button
                key={brand.id}
                type="button"
                className="sf-workflow-brand-card"
                style={{ '--wf-stage': STAGE_COLORS[stage] || '#20b2aa' } as React.CSSProperties}
                onClick={() => selectBrand(String(brand.id))}
              >
                <BrandLogoMark brand={brand} size={36} />
                <div className="sf-workflow-row-copy">
                  <div className="sf-workflow-row-name">{brand.name}</div>
                  <div className="sf-workflow-row-meta">
                    {brandTasks.length} tasks · {open} open · {done} done · {brand.priority || 'P3'}
                  </div>
                  <div className="sf-workflow-row-sub">
                    {[brand.client_type, people > 0 ? `${people} people` : null, stageLabel(stage)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className="sf-workflow-row-stage">{stageLabel(stage)}</span>
              </button>
            )
          })}
        </div>
      </section>

      {detailOpen && selected && (
        <Modal
          open
          onClose={() => setDetailOpen(false)}
          title={selected.name}
          subtitle={`${selected.priority || 'P3'} · ${stageLabel(selected.workflow_stage || 'assigned')} · ${selected.client_type || 'Client'}`}
          size="full"
          panelClassName="sf-workflow-brand-modal"
          zIndex={90}
          footer={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
              <Link href="/brands" className="sf-btn sf-btn-ghost" onClick={() => setDetailOpen(false)}>
                Open full brand page →
              </Link>
              <button type="button" className="sf-btn sf-btn-primary" onClick={() => setDetailOpen(false)}>
                Close
              </button>
            </div>
          }
        >
          <WorkflowBrandDetail
            brand={selected}
            tasks={tasks}
            users={users}
            canEdit={canEdit}
            savingStage={savingStage}
            onSetStage={(s) => setStage(selected.id, s)}
            inModal
          />
        </Modal>
      )}
    </PageShell>
  )
}
