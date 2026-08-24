// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser } from '@/types'
import { PageHeader, PageShell, Section, StatCard, StatGrid } from '@/components/app/Section'
import { Modal } from '@/components/app/Modal'
import { formatApiError } from '@/lib/apiErrors'

const STAFF_ROLES = ['team', 'manager', 'hr', 'accountant']

export default function LeaveClient({ session }: { session: SessionUser }) {
  const [leaves, setLeaves] = useState<any[]>([])
  const [balance, setBalance] = useState<{ total: number; taken: number; remaining: number } | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rejectTarget, setRejectTarget] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [deciding, setDeciding] = useState(false)
  const [error, setError] = useState('')

  function load() {
    return Promise.all([
      fetch('/api/leave').then(r => r.json()),
      fetch('/api/leave/balance').then(r => r.json()),
    ]).then(([leaveData, balanceData]) => {
      setLeaves(Array.isArray(leaveData) ? leaveData : [])
      if (balanceData && typeof balanceData.total === 'number') {
        setBalance(balanceData)
      }
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  const canApprove = ['owner', 'manager', 'hr'].includes(session.role)
  const canRequest = STAFF_ROLES.includes(session.role)
  const myLeaves = leaves.filter(l => l.user_id === session.id)
  const STAT: Record<string, { bg: string; c: string }> = {
    Pending: { bg: '#FBBF2420', c: '#FBBF24' },
    Approved: { bg: '#10B98120', c: '#10B981' },
    Rejected: { bg: '#EF444420', c: '#F87171' },
  }

  async function approve(id: string, status: string, rejection_reason?: string) {
    setError('')
    setDeciding(true)
    const res = await fetch(`/api/leave/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejection_reason }),
    })
    const data = await res.json().catch(() => ({}))
    setDeciding(false)
    if (!res.ok) {
      setError(formatApiError(data, 'Could not update leave'))
      return
    }
    setRejectTarget(null)
    setRejectReason('')
    load()
  }

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>

  const displayed = ['team', 'accountant'].includes(session.role) ? myLeaves : leaves
  const pendingCount = displayed.filter((l: any) => l.status === 'Pending').length
  const total = balance?.total ?? 21
  const taken = ['team', 'accountant'].includes(session.role)
    ? myLeaves.filter((l: any) => l.status === 'Approved').reduce((s: number, l: any) => s + (l.days || 0), 0)
    : (balance?.taken ?? 0)
  const remaining = Math.max(0, total - taken)
  const rejectedMine = myLeaves.filter((l: any) => l.status === 'Rejected').length

  return (
    <PageShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <PageHeader
          title="Leave Management"
          subtitle={`${pendingCount} pending · ${displayed.length} on record · email sent on approve/reject`}
        />
        {canRequest && (
          <button onClick={() => setShowCreate(true)} className="sf-btn sf-btn-primary" style={{ marginTop: 4 }}>
            Request leave
          </button>
        )}
      </div>

      {canRequest && rejectedMine > 0 && (
        <div className="sf-notice sf-notice-warn">
          You have {rejectedMine} rejected request{rejectedMine === 1 ? '' : 's'}. Submit a new request if you still need time off — rejected days do not count against your balance.
        </div>
      )}

      {error && <div className="sf-notice sf-notice-error">{error}</div>}

      {(canRequest || canApprove) && (
        <StatGrid>
          <StatCard label="Pending" value={pendingCount} accent="#FBBF24" />
          <StatCard label="Total allowance" value={total} accent="#8B5CF6" />
          <StatCard label="Taken (approved)" value={taken} accent="#EF4444" />
          <StatCard label="Remaining" value={remaining} accent="#10B981" />
        </StatGrid>
      )}

      <Section
        title={canApprove ? 'Team leave requests' : 'Leave requests'}
        subtitle="Rejected leave does not count as taken. Decisions notify the employee by email."
        flush
        flex={1}
      >
        <div className="sf-list-scroll">
          <div className="sf-list-table" style={{ minWidth: 720 }}>
            <div
              className="sf-list-head"
              style={{ gridTemplateColumns: canApprove ? '1.5fr 1fr 1fr 1fr 1fr 1.2fr' : '1.5fr 1fr 1fr 1fr 1fr' }}
            >
              {['Employee', 'Type', 'Dates', 'Days', 'Status', ...(canApprove ? ['Action'] : [])].map(h => (
                <div key={h}>{h}</div>
              ))}
            </div>
            {displayed.map((req: any) => {
              const u = req.user || {}
              const s = STAT[req.status] || STAT.Pending
              return (
                <div
                  key={req.id}
                  className="sf-list-row"
                  style={{ gridTemplateColumns: canApprove ? '1.5fr 1fr 1fr 1fr 1fr 1.2fr' : '1.5fr 1fr 1fr 1fr 1fr' }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div className="sf-list-avatar">{u.avatar || (u.name || 'U').slice(0, 2)}</div>
                    <div>
                      <div className="sf-list-primary">{u.name || 'You'}</div>
                      <div className="sf-list-secondary">{(req.reason || '').slice(0, 40)}{(req.reason?.length || 0) > 40 ? '…' : ''}</div>
                      {req.status === 'Rejected' && req.rejection_reason && (
                        <div className="sf-list-danger">Rejected: {req.rejection_reason}</div>
                      )}
                    </div>
                  </div>
                  <div className="sf-list-cell">{req.leave_type}</div>
                  <div className="sf-list-muted">
                    {req.start_date}{req.end_date !== req.start_date ? ` → ${req.end_date}` : ''}
                  </div>
                  <div className="sf-list-cell">{req.days}d</div>
                  <span className="sf-list-badge" style={{ background: s.bg, color: s.c }}>{req.status}</span>
                  {canApprove && (
                    <div style={{ display: 'flex', gap: 5 }}>
                      {req.status === 'Pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => approve(req.id, 'Approved')}
                            disabled={deciding}
                            className="sf-btn sf-btn-ghost"
                            style={{ fontSize: 11, padding: '5px 9px', color: '#10B981', borderColor: '#10B981' }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRejectTarget(req); setRejectReason('') }}
                            disabled={deciding}
                            className="sf-btn sf-btn-ghost"
                            style={{ fontSize: 11, padding: '5px 9px', color: 'var(--sf-danger)' }}
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="sf-list-muted">—</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {displayed.length === 0 && (
              <div className="sf-list-empty">No leave requests.</div>
            )}
          </div>
        </div>
      </Section>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Request leave"
        subtitle="Submit a new request for manager/HR review"
        width={460}
        footer={
          <>
            <button type="button" className="sf-btn sf-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" form="sf-leave-request" className="sf-btn sf-btn-primary">Submit request</button>
          </>
        }
      >
        <LeaveFormFields session={session} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />
      </Modal>

      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => { setRejectTarget(null); setRejectReason('') }}
        title="Reject leave request"
        subtitle={rejectTarget ? `${rejectTarget.user?.name || 'Employee'} · ${rejectTarget.leave_type}` : ''}
        width={480}
        footer={
          <>
            <button type="button" className="sf-btn sf-btn-ghost" onClick={() => { setRejectTarget(null); setRejectReason('') }}>Cancel</button>
            <button
              type="button"
              className="sf-btn sf-btn-primary"
              disabled={deciding || rejectReason.trim().length < 2}
              onClick={() => rejectTarget && approve(rejectTarget.id, 'Rejected', rejectReason.trim())}
            >
              {deciding ? 'Saving…' : 'Reject & notify'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--sf-text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
          The employee will receive an email with your reason and can submit a new request if needed.
        </p>
        <label className="sf-label">Rejection reason *</label>
        <textarea
          className="sf-input"
          rows={4}
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
          placeholder="Explain why this leave cannot be approved…"
          style={{ resize: 'vertical' }}
        />
      </Modal>
    </PageShell>
  )
}

function LeaveFormFields({ onClose, onSaved }: { session: SessionUser; onClose: () => void; onSaved: () => void }) {
  const [lt, setLt] = useState('Casual')
  const [sd, setSd] = useState('')
  const [ed, setEd] = useState('')
  const [r, setR] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!sd || !ed || !r.trim()) return
    const days = Math.ceil((new Date(ed).getTime() - new Date(sd).getTime()) / 86400000) + 1
    setSaving(true)
    setError('')
    const res = await fetch('/api/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leave_type: lt, start_date: sd, end_date: ed, days, reason: r }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(formatApiError(data, 'Could not submit leave'))
      return
    }
    onSaved()
  }

  return (
    <form id="sf-leave-request" onSubmit={save}>
      {error && <div className="sf-notice sf-notice-error" style={{ marginBottom: 12 }}>{error}</div>}
      <label className="sf-label">Leave type</label>
      <select className="sf-input" value={lt} onChange={e => setLt(e.target.value)} style={{ marginBottom: 12 }}>
        {['Casual', 'Sick', 'Earned', 'Comp-Off', 'Other'].map(o => <option key={o}>{o}</option>)}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label className="sf-label">Start date</label>
          <input type="date" className="sf-input" required value={sd} onChange={e => setSd(e.target.value)} />
        </div>
        <div>
          <label className="sf-label">End date</label>
          <input type="date" className="sf-input" required value={ed} onChange={e => setEd(e.target.value)} />
        </div>
      </div>
      <label className="sf-label">Reason *</label>
      <textarea className="sf-input" value={r} onChange={e => setR(e.target.value)} placeholder="Briefly explain…" rows={3} required style={{ resize: 'vertical' }} />
      <div style={{ display: 'none' }}>
        <button type="button" onClick={onClose} />
        <button type="submit" disabled={!sd || !ed || !r || saving}>{saving ? 'Submitting…' : 'Submit'}</button>
      </div>
    </form>
  )
}
