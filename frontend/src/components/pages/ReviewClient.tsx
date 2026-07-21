'use client'

import { useEffect, useState } from 'react'
import { SessionUser } from '@/types'
import { PageHeader, PageShell, PageToolbar, Section, StatCard, StatGrid } from '@/components/app/Section'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'rgba(234,179,8,0.15)', text: '#EAB308' },
  approved: { bg: 'rgba(16,185,129,0.15)', text: '#10B981' },
  rejected: { bg: 'rgba(239,68,68,0.15)', text: '#EF4444' },
}

export default function ReviewClient({ session }: { session: SessionUser }) {
  const [items, setItems] = useState<any[]>([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load(status = filter) {
    setError('')
    const q = status === 'all' ? '' : `?status_filter=${status}`
    const res = await fetch(`/api/attachments/review-queue${q}`)
    const data = await res.json().catch(() => [])
    if (!res.ok) {
      setError(data.error || data.detail || 'Could not load review queue')
      setItems([])
    } else {
      setItems(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function setStatus(id: string, review_status: string) {
    setSaving(id)
    const res = await fetch(`/api/attachments/${id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_status }),
    })
    setSaving(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not update review')
      return
    }
    load(filter)
  }

  function changeFilter(next: string) {
    setFilter(next)
    setLoading(true)
    load(next)
  }

  const pending = items.filter(i => (i.review_status || 'pending') === 'pending').length

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading review queue…</div>

  return (
    <PageShell>
      <PageToolbar>
        <PageHeader
          title="Review"
          subtitle={`File & document reviews · signed in as ${session.name}`}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['pending', 'approved', 'rejected', 'all'].map(s => (
            <button
              key={s}
              type="button"
              className="sf-btn"
              onClick={() => changeFilter(s)}
              style={{
                fontSize: 12,
                background: filter === s ? 'var(--sf-accent)' : 'var(--sf-surface)',
                color: filter === s ? '#fff' : 'var(--sf-text)',
                border: '1px solid var(--sf-border)',
                textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </PageToolbar>

      {error && <div style={{ background: '#3B0A0A', border: '1px solid #EF4444', color: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 12 }}>{error}</div>}

      <StatGrid>
        <StatCard label="In queue" value={items.length} accent="#3B82F6" />
        <StatCard label="Pending" value={filter === 'pending' ? items.length : pending} accent="#EAB308" />
      </StatGrid>

      <Section title="Uploads" subtitle="Approve or reject brand and task files" style={{ marginTop: 16 }}>
        {items.length === 0 ? (
          <div style={{ color: 'var(--sf-muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>No files in this filter.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(f => {
              const st = f.review_status || 'pending'
              const c = STATUS_COLORS[st] || STATUS_COLORS.pending
              return (
                <div key={f.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a href={`/api/attachments/${f.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--sf-text)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                      {f.file_name}
                    </a>
                    <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginTop: 3 }}>
                      {f.entity_type} · {f.uploader?.name || 'Unknown'} · {f.created_at ? new Date(f.created_at).toLocaleString() : '—'}
                    </div>
                  </div>
                  <span style={{ background: c.bg, color: c.text, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>{st}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" disabled={saving === f.id} className="sf-btn sf-btn-primary" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setStatus(f.id, 'approved')}>Approve</button>
                    <button type="button" disabled={saving === f.id} className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '5px 10px', color: 'var(--sf-danger)' }} onClick={() => setStatus(f.id, 'rejected')}>Reject</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </PageShell>
  )
}
