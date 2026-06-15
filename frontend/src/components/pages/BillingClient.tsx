// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser, STATUS_BG, STATUS_TEXT } from '@/types'
import { PageHeader, PageShell, Section, StatCard, StatGrid } from '@/components/app/Section'

export default function BillingClient({ session }: { session: SessionUser }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [filter, setFilter] = useState('unbilled')
  const [pricing, setPricing] = useState<any>(null)
  const [priceIn, setPriceIn] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState('')

  const canEdit = ['owner', 'accountant'].includes(session.role)
  const isManagerView = session.role === 'manager'

  function taskUnpriced(task: any) {
    return canEdit ? !task.billable_amount : !task.has_price
  }

  async function load() {
    setError('')
    const [listRes, summaryRes] = await Promise.all([
      fetch('/api/billing'),
      fetch('/api/billing/summary'),
    ])
    if (listRes.status === 403 || summaryRes.status === 403) {
      setForbidden(true)
      setLoading(false)
      return
    }
    if (!listRes.ok || !summaryRes.ok) {
      setError('Could not load billing data. Please refresh.')
      setLoading(false)
      return
    }
    const listData = await listRes.json()
    const summaryData = await summaryRes.json()
    setTasks(Array.isArray(listData) ? listData : [])
    setSummary(summaryData)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const billed = tasks.filter(t => t.billed_at)
  const unbilled = tasks.filter(t => !t.billed_at)
  const unpriced = tasks.filter(taskUnpriced)
  const displayed = filter === 'all' ? tasks : filter === 'unbilled' ? unbilled : billed
  const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`

  async function setPrice() {
    if (!pricing || !priceIn) return
    setSaving(true)
    setError('')
    const res = await fetch(`/api/billing/${pricing.id}/price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(priceIn) }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.detail || 'Failed to save price.')
      return
    }
    setPricing(null)
    setPriceIn('')
    load()
  }

  async function markBilled(id: string) {
    setError('')
    const res = await fetch(`/api/billing/${id}/bill`, { method: 'PATCH' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.detail || 'Failed to mark as billed.')
      return
    }
    load()
  }

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>
  if (forbidden) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>You do not have access to billing.</div>

  const gridCols = isManagerView
    ? '2.5fr 1fr 1fr 1fr'
    : '2.5fr 1fr 1fr 1fr 1fr 1.2fr'
  const headers = isManagerView
    ? ['Task', 'Brand', 'Status', 'Billed On']
    : ['Task', 'Brand', 'Status', 'Amount', 'Billed On', 'Actions']

  return (
    <PageShell>
      <PageHeader title="Billing & Accounting" subtitle={`${tasks.length} billable tasks`} />

      {error && (
        <Section title="Error" style={{ flexShrink: 0 }}>
          <div style={{ color: '#F87171', fontSize: 13, fontWeight: 600 }}>{error}</div>
        </Section>
      )}

      {(canEdit ? unpriced.length > 0 : (summary?.unpriced || 0) > 0) && (
        <Section title="Action needed" style={{ flexShrink: 0 }}>
          <div style={{ color: '#FBBF24', fontSize: 13, fontWeight: 600 }}>
            ⚠ {canEdit ? unpriced.length : summary?.unpriced} billable task{(canEdit ? unpriced.length : summary?.unpriced) !== 1 ? 's' : ''} have no price set.
          </div>
        </Section>
      )}

      <StatGrid>
        {isManagerView ? (
          <>
            <StatCard label="Billable tasks" value={summary?.total_count ?? tasks.length} accent="#EC4899" />
            <StatCard label="Pending billing" value={summary?.pending_count ?? unbilled.length} accent="#F59E0B" />
            <StatCard label="Billed" value={summary?.billed_count ?? billed.length} accent="#10B981" />
            <StatCard label="Unpriced" value={summary?.unpriced ?? unpriced.length} accent="#EF4444" />
          </>
        ) : (
          <>
            <StatCard label="Total billable" value={fmt(Number(summary?.total_billable ?? 0))} accent="#EC4899" />
            <StatCard label="Pending" value={fmt(Number(summary?.pending ?? 0))} accent="#F59E0B" />
            <StatCard label="Billed" value={fmt(Number(summary?.billed ?? 0))} accent="#10B981" />
            <StatCard label="Unpriced" value={summary?.unpriced ?? unpriced.length} accent="#EF4444" />
          </>
        )}
      </StatGrid>

      <Section
        title="Billable tasks"
        subtitle={`Showing ${displayed.length} tasks`}
        flex={1}
        flush
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              ['all', 'All Billable'],
              ['unbilled', `Pending (${unbilled.length})`],
              ['billed', `Billed (${billed.length})`],
            ].map(([v, l]) => (
              <button
                key={String(v)}
                onClick={() => setFilter(v)}
                className="sf-btn"
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  background: filter === v ? '#EC4899' : 'var(--sf-surface-2)',
                  color: filter === v ? 'white' : 'var(--sf-muted)',
                  border: filter === v ? 'none' : '1px solid var(--sf-border)',
                }}
              >
                {l}
              </button>
            ))}
          </div>
        }
      >
        <div style={{ minWidth: isManagerView ? 720 : 900 }}>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, padding: '12px 20px', borderBottom: '1px solid var(--sf-border)', background: 'var(--sf-surface-2)' }}>
            {headers.map(h => (
              <div key={h} style={{ color: 'var(--sf-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
            ))}
          </div>
          {displayed.map((task: any) => {
            const np = taskUnpriced(task)
            return (
              <div
                key={task.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridCols,
                  padding: '13px 20px',
                  borderBottom: '1px solid #1A1A2E',
                  alignItems: 'center',
                  background: np && canEdit ? 'rgba(239,68,68,0.02)' : 'transparent',
                }}
              >
                <div>
                  <div style={{ color: 'var(--sf-text)', fontSize: 13, fontWeight: 600 }}>{task.title}</div>
                  <div style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{task.type}</div>
                </div>
                <div style={{ color: '#A0A0C0', fontSize: 12 }}>{task.brand?.name || '—'}</div>
                <span style={{ background: STATUS_BG[task.status] || '#F3F4F6', color: STATUS_TEXT[task.status] || '#374151', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, display: 'inline-block' }}>{task.status}</span>
                {!isManagerView && (
                  <div>
                    {task.billable_amount ? (
                      <span style={{ color: '#EC4899', fontWeight: 700, fontSize: 14 }}>{fmt(task.billable_amount)}</span>
                    ) : (
                      <span style={{ color: '#EF4444', fontSize: 11, fontStyle: 'italic' }}>Not set</span>
                    )}
                  </div>
                )}
                <div style={{ color: task.billed_at ? '#10B981' : '#F59E0B', fontSize: 12 }}>
                  {task.billed_at ? new Date(task.billed_at).toLocaleDateString('en-IN') : 'Pending'}
                </div>
                {!isManagerView && (
                  <div style={{ display: 'flex', gap: 5 }}>
                    {canEdit && (
                      <button
                        onClick={() => { setPricing(task); setPriceIn(task.billable_amount?.toString() || '') }}
                        style={{ padding: '5px 9px', background: 'var(--sf-surface-2)', border: '1px solid #2A2A45', borderRadius: 6, color: np ? '#EC4899' : '#A0A0C0', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}
                      >
                        {np ? '₹ Set' : '₹ Edit'}
                      </button>
                    )}
                    {!task.billed_at && canEdit && task.billable_amount && (
                      <button
                        onClick={() => markBilled(task.id)}
                        style={{ padding: '5px 9px', background: 'var(--sf-accent)', border: 'none', borderRadius: 6, color: 'var(--sf-text)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}
                      >
                        Mark Billed
                      </button>
                    )}
                    {task.billed_at && (
                      <span style={{ background: '#10B98120', color: '#10B981', fontSize: 10, padding: '3px 7px', borderRadius: 5, fontWeight: 700 }}>✓ Billed</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {displayed.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--sf-muted-2)', fontSize: 13 }}>
              {tasks.length === 0
                ? 'No billable tasks yet. Mark tasks as billable when creating them.'
                : 'No tasks in this filter.'}
            </div>
          )}
        </div>
      </Section>

      {pricing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setPricing(null)}>
          <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--sf-text)', fontFamily: "'Space Grotesk',sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Set Price</h3>
            <p style={{ color: 'var(--sf-muted)', fontSize: 13, marginBottom: 18 }}>{pricing.title}</p>
            <div style={{ marginBottom: 18 }}>
              <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5, display: 'block' }}>Amount (₹)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={priceIn}
                onChange={e => setPriceIn(e.target.value)}
                placeholder="e.g. 15000"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--sf-surface-2)', border: '1px solid #EC489950', borderRadius: 9, color: 'var(--sf-text)', fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={setPrice} disabled={!priceIn || saving} style={{ padding: '10px 20px', background: 'var(--sf-accent)', border: 'none', borderRadius: 9, color: 'var(--sf-text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>{saving ? 'Saving…' : 'Save Price'}</button>
              <button onClick={() => setPricing(null)} style={{ padding: '10px 20px', background: 'var(--sf-surface-2)', border: '1px solid #2A2A45', borderRadius: 9, color: '#A0A0C0', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
