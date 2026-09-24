// @ts-nocheck
'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { SessionUser, STATUS_BG, STATUS_TEXT } from '@/types'
import { PageHeader, PageShell, StatCard } from '@/components/app/Section'
import { BrandLogoMark } from '@/components/app/BrandBadge'
import { Modal } from '@/components/app/Modal'
import {
  PHASE_COLORS,
  PHASE_ORDER,
  WORKFLOW_PHASES,
  phaseLabel,
  taskWorkflowPhase,
} from '@/lib/workflowPhases'

function priorityTone(p: string) {
  const x = (p || 'P3').toUpperCase()
  if (x === 'P1' || x === 'HIGH' || x === 'URGENT') return { label: 'HIGH', color: '#ff4757' }
  if (x === 'P4' || x === 'LOW') return { label: 'LOW', color: '#26de81' }
  return { label: 'MED', color: '#ffa502' }
}

function stageDisplay(id: string) {
  if (id === 'approval') return 'Client Approval'
  return phaseLabel(id)
}

function WorkflowBrandDetail({
  brand,
  tasks,
  users,
  inModal = false,
}: {
  brand: any
  tasks: any[]
  users: any[]
  inModal?: boolean
}) {
  const brandTasks = tasks.filter((t) => String(t.brand_id) === String(brand.id))
  const open = brandTasks.filter((t) => t.status !== 'Completed')
  const activeThreads = open.filter((t) => !t.updates_closed).length
  const members = (brand.assigned_members || [])
    .map((id: string) => users.find((u) => String(u.id) === String(id)))
    .filter(Boolean)
  const managers = (brand.assigned_managers || [])
    .map((id: string) => users.find((u) => String(u.id) === String(id)))
    .filter(Boolean)

  const inner = (
    <>
      {inModal && (
        <div className="sf-workflow-modal-hero">
          <BrandLogoMark brand={brand} size={52} />
          <div className="sf-workflow-modal-hero-copy">
            <div className="sf-workflow-modal-statline">
              {brandTasks.length} tasks · {open.length} open · {activeThreads} active chat{activeThreads === 1 ? '' : 's'}
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
        <Link href={`/updates?brand=${encodeURIComponent(brand.name || '')}`} className="sf-btn sf-btn-primary" style={{ fontSize: 11 }}>
          Active threads ({activeThreads})
        </Link>
        {brand.client_type && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 2, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', color: 'var(--sf-muted)' }}>
            {brand.client_type}
          </span>
        )}
      </div>

      {brand.description && (
        <p className="sf-workflow-modal-desc">{brand.description}</p>
      )}

      <div className="sf-workflow-section-label">Team ({members.length})</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {members.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--sf-muted)' }}>No team allocated — assign on Brands page.</span>
        ) : members.map((u: any) => (
          <span key={u.id} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 2, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)' }}>
            {u.name}
          </span>
        ))}
      </div>

      <div className="sf-workflow-section-label">Open tasks ({open.length})</div>
      {open.length === 0 ? (
        <div style={{ color: 'var(--sf-muted)', fontSize: 13 }}>No open tasks on this brand.</div>
      ) : (
        <div className="sf-workflow-modal-tasks">
          {open.map((t) => {
            const phase = taskWorkflowPhase(t)
            return (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                className="sf-workflow-modal-task-row"
              >
                <span className="sf-workflow-modal-task-title">{t.title}</span>
                <span className="sf-workflow-row-stage" style={{ '--wf-stage': PHASE_COLORS[phase] || '#20b2aa' } as React.CSSProperties}>
                  {phaseLabel(phase)}
                </span>
                <span style={{ background: STATUS_BG[t.status] || '#F3F4F6', color: STATUS_TEXT[t.status] || '#374151', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 2, flexShrink: 0 }}>{t.status}</span>
              </Link>
            )
          })}
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
              {brandTasks.length} tasks · {open.length} open · {activeThreads} active threads
            </div>
          </div>
        </div>
        <Link href={`/brands?brand=${brand.id}&tab=tasks`} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, flexShrink: 0 }}>
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
  const [modalFind, setModalFind] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCapacity, setShowCapacity] = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)
  const [stageBrandId, setStageBrandId] = useState<string | null>(null)
  const [flagBrandId, setFlagBrandId] = useState<string | null>(null)
  const [flagNote, setFlagNote] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const canEdit = session.role === 'owner' || session.role === 'manager'

  function load() {
    return Promise.all([
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/brands').then((r) => r.json()),
    ]).then(([t, u, b]) => {
      setTasks(Array.isArray(t) ? t : [])
      setUsers(Array.isArray(u) ? u : [])
      setBrands(Array.isArray(b) ? b : [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const openTasks = useMemo(() => tasks.filter((t) => t.status !== 'Completed'), [tasks])

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase()
    return brands.filter((brand) => {
      const stage = brand.workflow_stage || 'assigned'
      if (stageFilter !== 'all' && stage !== stageFilter) return false
      if (!q) return true
      const memberNames = [...(brand.assigned_members || []), ...(brand.assigned_managers || [])]
        .map((id: string) => users.find((u) => String(u.id) === String(id))?.name || '')
        .join(' ')
        .toLowerCase()
      return String(brand.name || '').toLowerCase().includes(q) || memberNames.includes(q)
    })
  }, [brands, stageFilter, search, users])

  const awaitingApproval = brands.filter((b) => (b.workflow_stage || 'assigned') === 'approval').length
  const completedToday = tasks.filter((t) => {
    if (t.status !== 'Completed') return false
    const d = t.updated_at || t.completed_at
    if (!d) return false
    return String(d).slice(0, 10) === new Date().toISOString().slice(0, 10)
  }).length

  const capacity = useMemo(() => {
    const team = users.filter((u) => u.role === 'team' && u.is_active !== false)
    return team.map((u) => {
      const open = tasks.filter(
        (t) =>
          t.status !== 'Completed' &&
          (t.assigned_to || []).some((id: string) => String(id) === String(u.id))
      ).length
      const cap = 8
      const pct = Math.min(100, Math.round((open / cap) * 100))
      return { user: u, open, cap, pct }
    }).sort((a, b) => b.pct - a.pct)
  }, [users, tasks])

  const brandsWithOpenTasks = useMemo(() => {
    const ids = new Set(openTasks.map((t) => String(t.brand_id)).filter(Boolean))
    return ids.size
  }, [openTasks])

  const selected = brands.find((b) => String(b.id) === String(selectedId))

  const modalHits = useMemo(() => {
    const q = modalFind.trim().toLowerCase()
    if (!q) return []
    return brands.filter((b) => String(b.name || '').toLowerCase().includes(q)).slice(0, 8)
  }, [modalFind, brands])

  function selectBrand(id: string) {
    setSelectedId(id)
    setDetailOpen(true)
    setModalFind('')
  }

  function brandPeople(brand: any) {
    const ids = [...(brand.assigned_members || []), ...(brand.assigned_managers || [])]
    const people = ids
      .map((id: string) => users.find((u) => String(u.id) === String(id)))
      .filter(Boolean)
    const seen = new Set<string>()
    return people.filter((u: any) => {
      const key = String(u.id)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  function initials(name: string) {
    return String(name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  }

  async function saveStage(brandId: string, stage: string) {
    setSaving(true)
    setActionError('')
    const res = await fetch(`/api/brands/${brandId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_stage: stage }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setActionError(body.detail || 'Could not update stage')
      return
    }
    const updated = await res.json()
    setBrands((rows) => rows.map((b) => (String(b.id) === String(brandId) ? { ...b, ...updated } : b)))
    setStageBrandId(null)
  }

  async function submitFlag() {
    if (!flagBrandId) return
    setSaving(true)
    setActionError('')
    const res = await fetch(`/api/brands/${flagBrandId}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: flagNote }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setActionError(body.detail || 'Could not flag this campaign')
      return
    }
    setFlagBrandId(null)
    setFlagNote('')
  }

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading workflow…</div>

  return (
    <PageShell className="sf-workflow-page">
      <PageHeader
        title="Workflow Dashboard"
        subtitle="Real-time view of all active campaigns · Last updated: just now"
      />

      <div className="sf-workflow-stage-pills" role="tablist" aria-label="Filter by task phase">
        {WORKFLOW_PHASES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={stageFilter === s.id}
            className={`sf-workflow-stage-pill${stageFilter === s.id ? ' is-active' : ''}`}
            onClick={() => setStageFilter(s.id)}
          >
            {s.label}
          </button>
        ))}
        <div className="sf-workflow-stage-search">
          <input
            type="search"
            className="sf-perf-search"
            placeholder="Search brands…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search tasks and brands"
          />
        </div>
      </div>

      <div className="sf-workflow-summary">
        <StatCard label="Total brands" value={brands.length} accent="#e8630a" />
        <StatCard label="Active tasks" value={openTasks.length} accent="#e8630a" />
        <StatCard label="Awaiting approval" value={awaitingApproval} accent="#e8630a" />
        <StatCard label="Completed today" value={completedToday} accent="#e8630a" />
      </div>

      <div className={`sf-workflow-capacity${showCapacity ? ' is-open' : ''}`}>
        <h2 className="sf-workflow-section-title">Team Capacity</h2>
        <button type="button" className="sf-workflow-capacity-toggle" onClick={() => setShowCapacity((v) => !v)}>
          <span>{capacity.filter((c) => c.pct >= 85).length} near limit · {brandsWithOpenTasks} brands with open work</span>
          <span style={{ fontSize: 11, color: 'var(--sf-muted)' }}>{showCapacity ? 'Hide' : 'Show'}</span>
        </button>
        {showCapacity && (
          capacity.length === 0 ? (
            <div style={{ color: 'var(--sf-muted)', fontSize: 13, paddingTop: 8 }}>No team members yet.</div>
          ) : (
            <div className="sf-workflow-capacity-grid">
              {capacity.map(({ user, pct }) => (
                <div key={user.id} className="sf-workflow-capacity-card">
                  <div className="sf-workflow-capacity-card-top">
                    <span className="sf-workflow-capacity-name">{user.name}</span>
                    <span className="sf-workflow-capacity-pct">{pct}%</span>
                  </div>
                  <div className="sf-workflow-capacity-bar">
                    <div
                      className={`sf-workflow-capacity-fill${pct >= 85 ? ' is-hot' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <section className="sf-workflow-active-section" aria-label="Active campaigns">
        <div className="sf-brand-list-head">
          <h2 className="sf-workflow-section-title">Brands</h2>
          <input
            type="search"
            className="sf-input sf-brand-list-search"
            placeholder="Search brands…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search brands"
          />
        </div>
        <div className="sf-brand-scroll-list">
          {filteredBrands.length === 0 ? (
            <div className="sf-workflow-empty sf-workflow-empty--wide">No brands match this filter.</div>
          ) : filteredBrands.map((brand) => {
            const stage = brand.workflow_stage || 'assigned'
            const pri = priorityTone(brand.priority)
            const deliverables = tasks.filter((t) => String(t.brand_id) === String(brand.id)).length
            const open = tasks.filter((t) => String(t.brand_id) === String(brand.id) && t.status !== 'Completed').length
            return (
              <button
                key={brand.id}
                type="button"
                className="sf-brand-scroll-row"
                onClick={() => selectBrand(String(brand.id))}
              >
                <span className="sf-brand-scroll-name">{brand.name}</span>
                <span className="sf-brand-scroll-meta">{open} open · {deliverables} tasks</span>
                <span className="sf-brand-scroll-stage">{stageDisplay(stage)}</span>
                <span className="sf-workflow-active-pri">{pri.label}</span>
                {canEdit && (
                  <span className="sf-brand-scroll-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="sf-btn sf-btn-ghost" onClick={() => { setActionError(''); setStageBrandId(String(brand.id)) }}>Stage</button>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {detailOpen && selected && (
        <Modal
          open
          onClose={() => { setDetailOpen(false); setModalFind('') }}
          title={selected.name}
          subtitle={`${selected.priority || 'P3'} · ${selected.client_type || 'Client'}`}
          size="full"
          panelClassName="sf-brand-screen-modal"
          zIndex={90}
          footer={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
              <Link href={`/brands?brand=${selected.id}&tab=tasks`} className="sf-btn sf-btn-ghost" onClick={() => setDetailOpen(false)}>
                Open full brand page →
              </Link>
              <button type="button" className="sf-btn sf-btn-primary" onClick={() => setDetailOpen(false)}>
                Close
              </button>
            </div>
          }
        >
          <div className="sf-brand-modal-search">
            <input
              type="search"
              className="sf-input"
              placeholder="Find another brand…"
              value={modalFind}
              onChange={(e) => setModalFind(e.target.value)}
              aria-label="Find another brand"
            />
            {modalFind.trim() && (
              <div className="sf-brand-modal-hits">
                {modalHits.length === 0 ? (
                  <span className="sf-brand-scroll-meta">No brand matches.</span>
                ) : modalHits.map((b) => (
                  <button key={b.id} type="button" className="sf-brand-modal-hit" onClick={() => selectBrand(String(b.id))}>
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <WorkflowBrandDetail brand={selected} tasks={tasks} users={users} inModal />
        </Modal>
      )}

      {stageBrandId && (
        <Modal
          open
          onClose={() => setStageBrandId(null)}
          title="Update Stage"
          subtitle={brands.find((b) => String(b.id) === stageBrandId)?.name || 'Campaign'}
          zIndex={100}
        >
          <div className="sf-workflow-stage-picker">
            {PHASE_ORDER.map((id) => {
              const current = (brands.find((b) => String(b.id) === stageBrandId)?.workflow_stage || 'assigned') === id
              return (
                <button
                  key={id}
                  type="button"
                  className={`sf-workflow-stage-option${current ? ' is-current' : ''}`}
                  disabled={saving}
                  onClick={() => saveStage(stageBrandId, id)}
                >
                  {stageDisplay(id)}
                </button>
              )
            })}
          </div>
          {actionError && <p className="sf-workflow-action-error">{actionError}</p>}
        </Modal>
      )}

      {flagBrandId && (
        <Modal
          open
          onClose={() => setFlagBrandId(null)}
          title="Flag Issue"
          subtitle={brands.find((b) => String(b.id) === flagBrandId)?.name || 'Campaign'}
          zIndex={100}
          footer={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
              <button type="button" className="sf-btn sf-btn-ghost" onClick={() => setFlagBrandId(null)}>Cancel</button>
              <button type="button" className="sf-btn sf-btn-primary" disabled={saving} onClick={submitFlag}>
                {saving ? 'Sending…' : 'Notify team'}
              </button>
            </div>
          }
        >
          <label className="sf-workflow-section-label" htmlFor="flag-note">What should the team know?</label>
          <textarea
            id="flag-note"
            className="sf-input"
            rows={4}
            value={flagNote}
            onChange={(e) => setFlagNote(e.target.value)}
            placeholder="Blocked on assets, client delay, capacity…"
          />
          {actionError && <p className="sf-workflow-action-error">{actionError}</p>}
        </Modal>
      )}
    </PageShell>
  )
}
