'use client'

import { useEffect, useState } from 'react'
import { SessionUser } from '@/types'
import { PageHeader, PageShell, PageTabs, PageToolbar, Section, StatCard, StatGrid } from '@/components/app/Section'
import { Modal } from '@/components/app/Modal'
import { DocumentViewer } from '@/components/app/DocumentViewer'
import { formatApiError } from '@/lib/apiErrors'

const STATUS_COLORS: Record<string, { bg: string; c: string }> = {
  pending: { bg: 'rgba(234,179,8,0.15)', c: '#EAB308' },
  approved: { bg: 'rgba(16,185,129,0.15)', c: '#10B981' },
  rejected: { bg: 'rgba(239,68,68,0.15)', c: '#F87171' },
}

function lastReview(history: any[] | undefined) {
  if (!history?.length) return null
  const h = history[history.length - 1]
  return h
}

export default function ReviewClient({ session }: { session: SessionUser }) {
  const [items, setItems] = useState<any[]>([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState<any | null>(null)
  const [historyItem, setHistoryItem] = useState<any | null>(null)
  const [reviewModal, setReviewModal] = useState<{ item: any; status: 'approved' | 'rejected' } | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')

  async function load(status = filter) {
    setError('')
    const q = status === 'all' ? '' : `?status_filter=${status}`
    const res = await fetch(`/api/attachments/review-queue${q}`)
    const data = await res.json().catch(() => [])
    if (!res.ok) {
      setError(formatApiError(data, 'Could not load review queue'))
      setItems([])
    } else {
      setItems(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function submitReview() {
    if (!reviewModal) return
    const { item, status } = reviewModal
    const notes = reviewNotes.trim()
    if (status === 'rejected' && notes.length < 2) return
    setSaving(item.id)
    const res = await fetch(`/api/attachments/${item.id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_status: status, review_notes: notes }),
    })
    setSaving(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(formatApiError(data, 'Could not update review'))
      return
    }
    setReviewModal(null)
    setReviewNotes('')
    load(filter)
  }

  function changeFilter(next: string) {
    setFilter(next)
    setLoading(true)
    load(next)
  }

  const pending = items.filter(i => (i.review_status || 'pending') === 'pending').length
  const tabs = [
    { id: 'pending', label: 'Pending', count: filter === 'pending' ? items.length : undefined },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'all', label: 'All' },
  ]

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading review queue…</div>

  return (
    <PageShell>
      <PageToolbar>
        <PageHeader
          title="Review queue"
          subtitle={`File deliverables · ${session.name} · assignees emailed on approve/reject`}
        />
      </PageToolbar>

      <PageTabs tabs={tabs} active={filter} onChange={changeFilter} />

      {error && <div className="sf-notice sf-notice-error">{error}</div>}

      <StatGrid>
        <StatCard label="Showing" value={items.length} accent="#3B82F6" />
        <StatCard label="Pending in view" value={filter === 'pending' ? items.length : pending} accent="#EAB308" />
      </StatGrid>

      <Section title="Files awaiting review" subtitle="Scroll the list · open history or preview in modals" flush flex={1}>
        <div className="sf-list-scroll">
          <div className="sf-list-table" style={{ minWidth: 960 }}>
            <div
              className="sf-list-head"
              style={{ gridTemplateColumns: '1.6fr 1fr 0.9fr 0.5fr 1fr 0.7fr 1fr 1.1fr' }}
            >
              {['File', 'Task', 'Uploader', 'Ver', 'Uploaded', 'Status', 'Last review', 'Actions'].map(h => (
                <div key={h}>{h}</div>
              ))}
            </div>
            {items.length === 0 ? (
              <div className="sf-list-empty">No files in this filter.</div>
            ) : (
              items.map(f => {
                const st = f.review_status || 'pending'
                const c = STATUS_COLORS[st] || STATUS_COLORS.pending
                const last = lastReview(f.review_history)
                return (
                  <div
                    key={f.id}
                    className="sf-list-row"
                    style={{ gridTemplateColumns: '1.6fr 1fr 0.9fr 0.5fr 1fr 0.7fr 1fr 1.1fr' }}
                  >
                    <div>
                      <button type="button" className="sf-list-link" onClick={() => setViewing(f)}>
                        {f.file_name}
                      </button>
                    </div>
                    <div>
                      {f.entity_type === 'task' && f.entity_id ? (
                        <a href={`/tasks/${f.entity_id}`} className="sf-list-link sf-list-link-muted">
                          {f.task_title || 'Open task'}
                        </a>
                      ) : (
                        <span className="sf-list-muted">{f.entity_type || '—'}</span>
                      )}
                    </div>
                    <div className="sf-list-cell">{f.uploader?.name || 'Unknown'}</div>
                    <div className="sf-list-cell">v{f.review_version || '1'}</div>
                    <div className="sf-list-muted">
                      {f.created_at ? new Date(f.created_at).toLocaleString() : '—'}
                    </div>
                    <span className="sf-list-badge" style={{ background: c.bg, color: c.c, textTransform: 'uppercase' }}>{st}</span>
                    <div className="sf-list-muted" style={{ fontSize: 11 }}>
                      {last ? (
                        <>
                          v{last.version} {last.status}
                          <br />
                          {last.at ? new Date(last.at).toLocaleString() : ''}
                        </>
                      ) : (
                        '—'
                      )}
                      {(f.review_history || []).length > 0 && (
                        <button type="button" className="sf-list-link sf-list-link-muted" style={{ display: 'block', marginTop: 4 }} onClick={() => setHistoryItem(f)}>
                          Full history
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button type="button" className="sf-btn sf-btn-ghost" style={{ fontSize: 10, padding: '4px 7px' }} onClick={() => setViewing(f)}>View</button>
                      <button
                        type="button"
                        disabled={saving === f.id}
                        className="sf-btn sf-btn-primary"
                        style={{ fontSize: 10, padding: '4px 7px' }}
                        onClick={() => { setReviewModal({ item: f, status: 'approved' }); setReviewNotes('') }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={saving === f.id}
                        className="sf-btn sf-btn-ghost"
                        style={{ fontSize: 10, padding: '4px 7px', color: 'var(--sf-danger)' }}
                        onClick={() => { setReviewModal({ item: f, status: 'rejected' }); setReviewNotes('') }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </Section>

      <Modal
        open={Boolean(historyItem)}
        onClose={() => setHistoryItem(null)}
        title="Revision history"
        subtitle={historyItem?.file_name}
        width={560}
        footer={
          <button type="button" className="sf-btn sf-btn-primary" onClick={() => setHistoryItem(null)}>Close</button>
        }
      >
        {(historyItem?.review_history || []).length === 0 ? (
          <p style={{ color: 'var(--sf-muted)', fontSize: 13 }}>No review events yet.</p>
        ) : (
          <ul className="sf-review-history">
            {[...(historyItem.review_history || [])].reverse().map((h: any, i: number) => (
              <li key={`${h.version}-${h.at}-${i}`} className={`sf-review-history-item sf-review-history-${h.status}`}>
                <div className="sf-review-history-head">
                  <span>v{h.version} · {h.status}</span>
                  <span>{h.at ? new Date(h.at).toLocaleString() : '—'}</span>
                </div>
                {h.by_name && <div className="sf-review-history-by">{h.by_name}</div>}
                {h.notes && <div className="sf-review-history-notes">{h.notes}</div>}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={Boolean(reviewModal)}
        onClose={() => { setReviewModal(null); setReviewNotes('') }}
        title={reviewModal?.status === 'approved' ? 'Approve file' : 'Reject file — revision needed'}
        subtitle={reviewModal?.item?.file_name}
        width={520}
        footer={
          <>
            <button type="button" className="sf-btn sf-btn-ghost" onClick={() => { setReviewModal(null); setReviewNotes('') }}>Cancel</button>
            <button
              type="button"
              className="sf-btn sf-btn-primary"
              disabled={
                saving === reviewModal?.item?.id ||
                (reviewModal?.status === 'rejected' && reviewNotes.trim().length < 2)
              }
              onClick={submitReview}
            >
              {saving === reviewModal?.item?.id ? 'Saving…' : reviewModal?.status === 'approved' ? 'Approve & notify' : 'Reject & notify'}
            </button>
          </>
        }
      >
        {reviewModal?.status === 'rejected' ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--sf-text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
              Task moves to <strong>Revision Needed</strong>. Assignees get an email and must upload a new version.
            </p>
            <label className="sf-label">Feedback / suggestions *</label>
            <textarea
              className="sf-input"
              rows={4}
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              placeholder="What should be changed in the next revision?"
              style={{ resize: 'vertical' }}
            />
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--sf-text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
              Optional comments are included in the email to assignees.
            </p>
            <label className="sf-label">Review comments (optional)</label>
            <textarea
              className="sf-input"
              rows={3}
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              placeholder="Looks good — approved for delivery"
              style={{ resize: 'vertical' }}
            />
          </>
        )}
      </Modal>

      <DocumentViewer file={viewing} open={!!viewing} onClose={() => setViewing(null)} />
    </PageShell>
  )
}
