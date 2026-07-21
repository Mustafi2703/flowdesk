// @ts-nocheck
'use client'
import { useEffect, useMemo, useState } from 'react'
import { SessionUser, STATUS_BG, STATUS_TEXT } from '@/types'
import { PageHeader, PageShell, StatCard, StatGrid } from '@/components/app/Section'

const STAGES = [
  { id: 'all', label: 'All Brands' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'design', label: 'Design Phase' },
  { id: 'content', label: 'Content Phase' },
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

function priorityClass(p: string) {
  if (p === 'P1') return 'high'
  if (p === 'P2') return 'medium'
  return 'low'
}

function BrandAvatar({ brand }: { brand: any }) {
  if (brand.logo_url) {
    return <img src={brand.logo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
  }
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#d4a574,#20b2aa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#0a0a0f' }}>
      {(brand.logo || brand.name || '?').slice(0, 2)}
    </div>
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
  const selectedTasks = selected
    ? tasks.filter(t => String(t.brand_id) === String(selected.id))
    : []

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading workflow…</div>

  return (
    <PageShell>
      <PageHeader
        title="Workflow Dashboard"
        subtitle="Brand campaign board · stages, capacity, and live tasks"
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {STAGES.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStageFilter(s.id)}
            className="sf-btn"
            style={{
              background: stageFilter === s.id ? 'var(--sf-accent)' : 'var(--sf-surface)',
              color: stageFilter === s.id ? '#fff' : 'var(--sf-text)',
              border: '1px solid var(--sf-border)',
              fontSize: 12,
              padding: '8px 14px',
            }}
          >
            {s.label}
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search brands…"
          style={{
            flex: 1,
            minWidth: 200,
            padding: '10px 14px',
            background: 'var(--sf-surface)',
            border: '1px solid var(--sf-border)',
            borderRadius: 8,
            color: 'var(--sf-text)',
            fontSize: 13,
          }}
        />
      </div>

      <StatGrid>
        <StatCard label="Total brands" value={brands.length} accent="#d4a574" />
        <StatCard label="Active tasks" value={activeTasks.length} accent="#20b2aa" />
        <StatCard label="Awaiting approval" value={awaitingApproval} accent="#ffa502" />
        <StatCard label="Completed today" value={completedToday} accent="#26de81" />
      </StatGrid>

      <div style={{ marginBottom: 28 }}>
        <div style={{ color: 'var(--sf-accent)', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Team capacity</div>
        {capacity.length === 0 ? (
          <div style={{ color: 'var(--sf-muted)', fontSize: 13 }}>No team members yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
            {capacity.map(({ user, open, cap, pct }) => (
              <div key={user.id} style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{user.name}</span>
                  <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{open}/{cap} · {pct}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--sf-border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: pct >= 85 ? 'linear-gradient(90deg,#ff4757,#ff6b6b)' : 'linear-gradient(90deg,#20b2aa,#d4a574)',
                    transition: 'width .4s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ color: 'var(--sf-accent)', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 12 }}>
        Active campaigns
      </div>
      {filteredBrands.length === 0 ? (
        <div style={{ color: 'var(--sf-muted)', padding: 32, textAlign: 'center' }}>No brands match this filter.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {filteredBrands.map((brand) => {
            const stage = brand.workflow_stage || 'assigned'
            const stageIdx = STAGE_ORDER.indexOf(stage)
            const brandTasks = tasks.filter(t => String(t.brand_id) === String(brand.id))
            const open = brandTasks.filter(t => t.status !== 'Completed').length
            const done = brandTasks.filter(t => t.status === 'Completed').length
            const members = (brand.assigned_members || [])
              .map((id: string) => users.find(u => String(u.id) === String(id)))
              .filter(Boolean)
            const pc = priorityClass(brand.priority || 'P3')
            const barColor = pc === 'high' ? '#ff4757' : pc === 'medium' ? '#ffa502' : '#d4a574'
            return (
              <button
                key={brand.id}
                type="button"
                onClick={() => setSelectedId(brand.id)}
                style={{
                  textAlign: 'left',
                  background: 'var(--sf-surface)',
                  border: '1px solid var(--sf-border)',
                  borderRadius: 12,
                  padding: 18,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  color: 'inherit',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: barColor }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                    <BrandAvatar brand={brand} />
                    <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brand.name}</div>
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '4px 8px',
                    borderRadius: 10,
                    background: pc === 'high' ? 'rgba(255,71,87,.15)' : pc === 'medium' ? 'rgba(255,165,2,.15)' : 'rgba(38,222,129,.12)',
                    color: pc === 'high' ? '#ff4757' : pc === 'medium' ? '#ffa502' : '#26de81',
                    flexShrink: 0,
                  }}>{brand.priority || 'P3'}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, padding: '4px 8px', background: 'rgba(255,255,255,.04)', borderRadius: 6, color: 'var(--sf-muted)' }}>{brandTasks.length} tasks</span>
                  <span style={{ fontSize: 11, padding: '4px 8px', background: 'rgba(255,255,255,.04)', borderRadius: 6, color: 'var(--sf-muted)' }}>{open} open</span>
                  <span style={{ fontSize: 11, padding: '4px 8px', background: 'rgba(255,255,255,.04)', borderRadius: 6, color: 'var(--sf-muted)' }}>{done} done</span>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  {STAGE_ORDER.map((s, i) => (
                    <div
                      key={s}
                      title={s}
                      style={{
                        flex: 1,
                        height: i === stageIdx ? 8 : 6,
                        borderRadius: 3,
                        background: i < stageIdx ? STAGE_COLORS.delivered : i === stageIdx ? STAGE_COLORS[s] : 'var(--sf-border)',
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--sf-muted)', marginBottom: 10 }}>
                  Current stage: <strong style={{ color: STAGE_COLORS[stage] || '#20b2aa' }}>{STAGES.find(x => x.id === stage)?.label || stage}</strong>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {members.slice(0, 5).map((u: any) => (
                    <div key={u.id} title={u.name} style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#d4a574,#20b2aa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#0a0a0f' }}>
                      {(u.avatar || u.name || '?').slice(0, 2)}
                    </div>
                  ))}
                  {members.length === 0 && <span style={{ fontSize: 11, color: 'var(--sf-muted-2)' }}>No team allocated</span>}
                  {members.length > 5 && <span style={{ fontSize: 11, color: 'var(--sf-muted)' }}>+{members.length - 5}</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <div
          onClick={() => setSelectedId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(8px)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 16, padding: 28, maxWidth: 560, width: '100%', maxHeight: '80vh', overflow: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <BrandAvatar brand={selected} />
                <div>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--sf-accent)' }}>{selected.name}</div>
                  <div style={{ color: 'var(--sf-muted)', fontSize: 12 }}>{selectedTasks.length} tasks · {selected.priority}</div>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: 'var(--sf-muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            {canEdit && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sf-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Update stage</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {STAGE_ORDER.map(s => {
                    const active = (selected.workflow_stage || 'assigned') === s
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={savingStage}
                        onClick={() => setStage(selected.id, s)}
                        style={{
                          padding: 12,
                          textAlign: 'left',
                          borderRadius: 8,
                          border: `1px solid ${active ? STAGE_COLORS[s] : 'var(--sf-border)'}`,
                          background: active ? STAGE_COLORS[s] : 'rgba(255,255,255,.03)',
                          color: active ? '#0a0a0f' : 'var(--sf-text)',
                          cursor: 'pointer',
                          fontWeight: active ? 700 : 500,
                          fontSize: 13,
                        }}
                      >
                        {STAGES.find(x => x.id === s)?.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sf-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Tasks</div>
            {selectedTasks.length === 0 ? (
              <div style={{ color: 'var(--sf-muted-2)', fontSize: 13 }}>No tasks on this brand yet.</div>
            ) : (
              selectedTasks.slice(0, 12).map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--sf-border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--sf-text-secondary)' }}>{t.title}</span>
                  <span style={{ background: STATUS_BG[t.status] || '#F3F4F6', color: STATUS_TEXT[t.status] || '#374151', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, height: 'fit-content' }}>{t.status}</span>
                </div>
              ))
            )}

            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--sf-muted)' }}>
              Open Brands → {selected.name} to upload logo, documents, and allocate team.
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
