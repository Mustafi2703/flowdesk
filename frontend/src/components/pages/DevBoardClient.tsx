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
  compact = false,
}: {
  brand: any
  tasks: any[]
  users: any[]
  canEdit: boolean
  savingStage: boolean
  onSetStage: (stage: string) => void
  compact?: boolean
}) {
  const stage = brand.workflow_stage || 'assigned'
  const brandTasks = tasks.filter(t => String(t.brand_id) === String(brand.id))
  const open = brandTasks.filter(t => t.status !== 'Completed').length
  const members = (brand.assigned_members || [])
    .map((id: string) => users.find(u => String(u.id) === String(id)))
    .filter(Boolean)

  return (
    <>
      {!compact && (
        <div className="sf-workflow-detail-head">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
            <BrandLogoMark brand={brand} size={48} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--sf-text)' }}>
                {brand.name}
              </div>
              <div style={{ color: 'var(--sf-muted)', fontSize: 12, marginTop: 2 }}>
                {brandTasks.length} tasks · {open} open · {brand.priority || 'P3'}
              </div>
            </div>
          </div>
          <Link href="/brands" className="sf-btn sf-btn-ghost" style={{ fontSize: 11, flexShrink: 0 }}>
            Open brand →
          </Link>
        </div>
      )}

      <div className={compact ? undefined : 'sf-workflow-detail-body'}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <span className="sf-workflow-row-stage" style={{ '--wf-stage': STAGE_COLORS[stage] || '#20b2aa' } as React.CSSProperties}>
            {stageLabel(stage)}
          </span>
          {brand.client_type && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', color: 'var(--sf-muted)' }}>
              {brand.client_type}
            </span>
          )}
        </div>

        {canEdit && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--sf-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Update stage
            </div>
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

        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--sf-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Team ({members.length})
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {members.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--sf-muted)' }}>No team allocated — assign on Brands page.</span>
          ) : members.map((u: any) => (
            <span key={u.id} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)' }}>
              {u.name}
            </span>
          ))}
        </div>

        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--sf-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Tasks
        </div>
        {brandTasks.length === 0 ? (
          <div style={{ color: 'var(--sf-muted)', fontSize: 13 }}>No tasks on this brand yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {brandTasks.slice(0, 20).map(t => (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--sf-border)',
                  background: 'var(--sf-surface-2)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--sf-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                <span style={{ background: STATUS_BG[t.status] || '#F3F4F6', color: STATUS_TEXT[t.status] || '#374151', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, flexShrink: 0 }}>{t.status}</span>
              </Link>
            ))}
            {brandTasks.length > 20 && (
              <div style={{ fontSize: 11, color: 'var(--sf-muted)', marginTop: 4 }}>+{brandTasks.length - 20} more on Brands / Tasks</div>
            )}
          </div>
        )}
      </div>
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
  const [showCapacity, setShowCapacity] = useState(false)
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

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 960px)')
    const sync = () => {
      if (!mq.matches) setDetailOpen(false)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase()
    return brands.filter((b) => {
      const stage = b.workflow_stage || 'assigned'
      if (stageFilter !== 'all' && stage !== stageFilter) return false
      if (q && !String(b.name || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [brands, stageFilter, search])

  useEffect(() => {
    if (filteredBrands.length === 0) {
      setSelectedId(null)
      return
    }
    const stillVisible = selectedId && filteredBrands.some(b => String(b.id) === String(selectedId))
    if (!stillVisible) setSelectedId(String(filteredBrands[0].id))
  }, [filteredBrands, selectedId])

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

  function selectBrand(id: string, openDetail = false) {
    setSelectedId(id)
    if (openDetail && typeof window !== 'undefined' && window.matchMedia('(max-width: 960px)').matches) {
      setDetailOpen(true)
    }
  }

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading workflow…</div>

  return (
    <PageShell fill className="sf-workflow-page">
      <PageHeader
        title="Workflow Dashboard"
        subtitle="Pick a brand from the list — stages, tasks, and capacity in one place"
      />

      <div className="sf-workflow-summary">
        <StatCard label="Total brands" value={brands.length} accent="#d4a574" />
        <StatCard label="Active tasks" value={activeTasks.length} accent="#20b2aa" />
        <StatCard label="Awaiting approval" value={awaitingApproval} accent="#ffa502" />
        <StatCard label="Completed today" value={completedToday} accent="#26de81" />
      </div>

      <div className="sf-workflow-capacity">
        <button type="button" className="sf-workflow-capacity-toggle" onClick={() => setShowCapacity(v => !v)}>
          <span>Team capacity</span>
          <span style={{ fontSize: 11, color: 'var(--sf-muted)' }}>{showCapacity ? 'Hide' : 'Show'}</span>
        </button>
        {showCapacity && (
          capacity.length === 0 ? (
            <div style={{ color: 'var(--sf-muted)', fontSize: 13 }}>No team members yet.</div>
          ) : (
            <div className="sf-workflow-capacity-track">
              {capacity.map(({ user, open, cap, pct }) => (
                <div key={user.id} className="sf-workflow-capacity-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{user.name}</span>
                    <span style={{ color: 'var(--sf-muted)' }}>{open}/{cap} · {pct}%</span>
                  </div>
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

      <div className="sf-workflow-workspace">
        <aside className="sf-workflow-roster" aria-label="Brand list">
          <div className="sf-workflow-roster-head">
            <h2 className="sf-workflow-roster-title">Brands ({filteredBrands.length})</h2>
            <div className="sf-workflow-stage-tabs" role="tablist" aria-label="Filter by stage">
              {STAGES.map(s => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={stageFilter === s.id}
                  className={`sf-workflow-stage-tab${stageFilter === s.id ? ' is-active' : ''}`}
                  onClick={() => setStageFilter(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              className="sf-workflow-roster-search"
              placeholder="Search brands…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search brands"
            />
          </div>
          <div className="sf-workflow-roster-list">
            {filteredBrands.length === 0 ? (
              <div className="sf-workflow-empty">No brands match this filter.</div>
            ) : filteredBrands.map((brand) => {
              const stage = brand.workflow_stage || 'assigned'
              const brandTasks = tasks.filter(t => String(t.brand_id) === String(brand.id))
              const open = brandTasks.filter(t => t.status !== 'Completed').length
              const active = String(selectedId) === String(brand.id)
              return (
                <button
                  key={brand.id}
                  type="button"
                  className={`sf-workflow-row${active ? ' is-active' : ''}`}
                  style={{ '--wf-stage': STAGE_COLORS[stage] || '#20b2aa' } as React.CSSProperties}
                  onClick={() => selectBrand(String(brand.id), true)}
                >
                  <BrandLogoMark brand={brand} size={32} />
                  <div className="sf-workflow-row-copy">
                    <div className="sf-workflow-row-name">{brand.name}</div>
                    <div className="sf-workflow-row-meta">
                      {brandTasks.length} tasks · {open} open · {brand.priority || 'P3'}
                    </div>
                  </div>
                  <span className="sf-workflow-row-stage">{stageLabel(stage)}</span>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="sf-workflow-detail sf-workflow-detail--desktop">
          {selected ? (
            <WorkflowBrandDetail
              brand={selected}
              tasks={tasks}
              users={users}
              canEdit={canEdit}
              savingStage={savingStage}
              onSetStage={(s) => setStage(selected.id, s)}
            />
          ) : (
            <div className="sf-workflow-empty">Select a brand from the list to view stage and tasks.</div>
          )}
        </div>
      </div>

      {detailOpen && selected && (
        <Modal
          open
          onClose={() => setDetailOpen(false)}
          title={selected.name}
          subtitle={`${selected.priority || 'P3'} · ${stageLabel(selected.workflow_stage || 'assigned')}`}
          size="wide"
          zIndex={90}
        >
          <WorkflowBrandDetail
            brand={selected}
            tasks={tasks}
            users={users}
            canEdit={canEdit}
            savingStage={savingStage}
            onSetStage={(s) => setStage(selected.id, s)}
            compact
          />
        </Modal>
      )}
    </PageShell>
  )
}
