'use client'

import { useEffect, useMemo, useState } from 'react'
import { SessionUser } from '@/types'
import { PageHeader, PageShell } from '@/components/app/Section'

const RECURRENCE_OPTIONS = [
  { id: 'none', label: 'One-time (adhoc)' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
]

export function BrandMeetingsPanel({
  session,
  brand,
  canEdit,
  onBrandPatch,
}: {
  session: SessionUser
  brand: any
  canEdit: boolean
  onBrandPatch?: (updated: any) => void
}) {
  return (
    <MeetingsScheduleCore
      session={session}
      brandId={brand.id}
      brandName={brand.name}
      defaultClientEmail={brand.contact_email || ''}
      canEdit={canEdit}
      compact
      onClientEmailSaved={(email) => onBrandPatch?.({ ...brand, contact_email: email })}
    />
  )
}

export default function MeetingsClient({ session }: { session: SessionUser }) {
  return (
    <PageShell>
      <PageHeader
        title="Client meetings"
        subtitle="Schedule Google Meet syncs per brand — adhoc or recurring (weekly, monthly, quarterly, yearly)."
      />
      <MeetingsScheduleCore session={session} canEdit={['owner', 'manager'].includes(session.role)} />
    </PageShell>
  )
}

function MeetingsScheduleCore({
  session,
  brandId,
  brandName,
  defaultClientEmail = '',
  canEdit,
  compact = false,
  onClientEmailSaved,
}: {
  session: SessionUser
  brandId?: string
  brandName?: string
  defaultClientEmail?: string
  canEdit: boolean
  compact?: boolean
  onClientEmailSaved?: (email: string) => void
}) {
  const [brands, setBrands] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    brand_id: brandId || '',
    title: '',
    description: '',
    client_email: defaultClientEmail,
    attendee_emails: '',
    start_at: '',
    duration_minutes: 30,
    recurrence: 'none',
    recurrence_count: '',
  })

  const isOwner = session.role === 'owner'

  async function load() {
    setLoading(true)
    const q = brandId ? `?brand_id=${brandId}` : ''
    const [b, m, s] = await Promise.all([
      brandId ? Promise.resolve([]) : fetch('/api/brands').then((r) => r.json()),
      fetch(`/api/meetings${q}`).then((r) => r.json()),
      fetch('/api/meetings/status').then((r) => r.json()),
    ])
    if (!brandId) setBrands(Array.isArray(b) ? b : [])
    setMeetings(Array.isArray(m) ? m : [])
    setStatus(s)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId])

  useEffect(() => {
    setForm((f) => ({
      ...f,
      brand_id: brandId || f.brand_id,
      client_email: defaultClientEmail || f.client_email,
    }))
  }, [brandId, defaultClientEmail])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('calendar') === 'connected') {
      setNotice('Google Calendar connected — you can schedule Meet links now.')
      window.history.replaceState({}, '', window.location.pathname)
      load()
    }
  }, [])

  const brandOptions = useMemo(() => {
    if (brandId && brandName) return [{ id: brandId, name: brandName }]
    return brands
  }, [brands, brandId, brandName])

  async function connectCalendar() {
    setBusy(true)
    const res = await fetch('/api/meetings/connect')
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (data.url) window.location.href = data.url
    else setError(data.detail || data.error || 'Could not start Google connect')
  }

  async function schedule(e: React.FormEvent) {
    e.preventDefault()
    if (!canEdit) return
    setBusy(true)
    setError('')
    setNotice('')
    const selectedBrand = brandOptions.find((b) => b.id === form.brand_id)
    const extra = form.attendee_emails
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean)
    const body = {
      brand_id: form.brand_id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      client_email: form.client_email.trim() || null,
      attendee_emails: extra,
      start_at: new Date(form.start_at).toISOString(),
      duration_minutes: Number(form.duration_minutes) || 30,
      recurrence: form.recurrence,
      recurrence_count: form.recurrence_count ? Number(form.recurrence_count) : null,
    }
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.detail || data.error || 'Could not schedule meeting')
      return
    }
    setNotice(`Scheduled "${data.title}" for ${selectedBrand?.name || 'client'} — invite sent.`)
    if (form.client_email.trim() && onClientEmailSaved) onClientEmailSaved(form.client_email.trim())
    setForm((f) => ({ ...f, title: '', description: '', attendee_emails: '' }))
    load()
  }

  async function cancelMeeting(id: string) {
    if (!window.confirm('Cancel this meeting and remove the calendar event?')) return
    setBusy(true)
    const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.detail || data.error || 'Could not cancel')
      return
    }
    load()
  }

  if (loading) {
    return <div style={{ color: 'var(--sf-muted)', padding: compact ? 12 : 24 }}>Loading meetings…</div>
  }

  return (
    <div className={`sf-meetings${compact ? ' sf-meetings--compact' : ''}`}>
      {!compact && status && (
        <div className="sf-meetings-connect">
          <div>
            <div className="sf-meetings-connect-title">Google Calendar + Meet</div>
            <p className="sf-meetings-connect-sub">
              {status.connected
                ? `Connected as ${status.account_email || 'Google account'}. New meetings get a Meet link and calendar invites.`
                : status.configured
                  ? 'Owner connects once — then managers can schedule client syncs with Meet links.'
                  : 'Set GOOGLE_OAUTH_CLIENT_ID on the backend (same Google Cloud project as Drive). Enable Calendar API.'}
            </p>
          </div>
          {isOwner && status.configured && !status.connected && (
            <button type="button" className="sf-btn sf-btn-primary" disabled={busy} onClick={connectCalendar}>
              Connect Google Calendar
            </button>
          )}
          {status.connected && (
            <span className="sf-admin-badge sf-admin-badge-ok">Calendar linked</span>
          )}
        </div>
      )}

      {error && <div className="sf-meetings-alert sf-meetings-alert--error">{error}</div>}
      {notice && <div className="sf-meetings-alert sf-meetings-alert--ok">{notice}</div>}

      {canEdit && (
        <form className="sf-meetings-form" onSubmit={schedule}>
          <div className="sf-meetings-form-grid">
            {!brandId && (
              <label className="sf-meetings-field">
                <span>Brand / client</span>
                <select
                  required
                  className="sf-input"
                  value={form.brand_id}
                  onChange={(e) => {
                    const b = brandOptions.find((x) => x.id === e.target.value)
                    setForm((f) => ({
                      ...f,
                      brand_id: e.target.value,
                      client_email: b?.contact_email || f.client_email,
                    }))
                  }}
                >
                  <option value="">Select brand</option>
                  {brandOptions.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="sf-meetings-field">
              <span>Meeting title</span>
              <input required className="sf-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Monthly review" />
            </label>
            <label className="sf-meetings-field">
              <span>Client email</span>
              <input
                required
                type="email"
                className="sf-input"
                value={form.client_email}
                onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                placeholder="client@company.com"
              />
            </label>
            <label className="sf-meetings-field">
              <span>Start (local time)</span>
              <input required type="datetime-local" className="sf-input" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
            </label>
            <label className="sf-meetings-field">
              <span>Duration (minutes)</span>
              <input type="number" min={15} max={480} step={15} className="sf-input" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
            </label>
            <label className="sf-meetings-field">
              <span>Cadence</span>
              <select className="sf-input" value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
                {RECURRENCE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            {form.recurrence !== 'none' && (
              <label className="sf-meetings-field">
                <span>Occurrences (optional)</span>
                <input type="number" min={1} max={52} className="sf-input" value={form.recurrence_count} onChange={(e) => setForm({ ...form, recurrence_count: e.target.value })} placeholder="e.g. 12" />
              </label>
            )}
          </div>
          <label className="sf-meetings-field sf-meetings-field--full">
            <span>Notes / agenda</span>
            <textarea className="sf-input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Agenda for the client" />
          </label>
          <label className="sf-meetings-field sf-meetings-field--full">
            <span>Extra attendees (comma-separated)</span>
            <input className="sf-input" value={form.attendee_emails} onChange={(e) => setForm({ ...form, attendee_emails: e.target.value })} placeholder="manager@scrumfolks.com" />
          </label>
          <button type="submit" className="sf-btn sf-btn-primary" disabled={busy || !status?.connected}>
            {busy ? 'Scheduling…' : 'Schedule Google Meet'}
          </button>
          {!status?.connected && canEdit && (
            <p className="sf-meetings-hint">Connect Google Calendar first to create Meet links and send invites.</p>
          )}
        </form>
      )}

      <div className="sf-meetings-list">
        <div className="sf-meetings-list-head">
          <h3>{compact ? 'Scheduled' : 'Upcoming & recent'}</h3>
          <span className="sf-meetings-count">{meetings.length}</span>
        </div>
        {meetings.length === 0 ? (
          <p className="sf-meetings-empty">No client meetings yet. Schedule an adhoc sync or set up a recurring cadence.</p>
        ) : (
          meetings.map((m) => (
            <div key={m.id} className="sf-meetings-row">
              <div className="sf-meetings-row-main">
                <div className="sf-meetings-row-title">{m.title}</div>
                <div className="sf-meetings-row-meta">
                  {m.brand_name && <span>{m.brand_name}</span>}
                  <span>{new Date(m.start_at).toLocaleString('en-IN')}</span>
                  <span>{m.duration_minutes}m</span>
                  <span className="sf-meetings-rec">{m.recurrence === 'none' ? 'Adhoc' : m.recurrence}</span>
                  <span>{m.client_email}</span>
                </div>
              </div>
              <div className="sf-meetings-row-actions">
                {m.google_meet_link && (
                  <a href={m.google_meet_link} target="_blank" rel="noreferrer" className="sf-btn sf-btn-ghost">Meet</a>
                )}
                {m.google_calendar_link && (
                  <a href={m.google_calendar_link} target="_blank" rel="noreferrer" className="sf-btn sf-btn-ghost">Calendar</a>
                )}
                {canEdit && (
                  <button type="button" className="sf-btn sf-btn-ghost" style={{ color: 'var(--sf-danger)' }} disabled={busy} onClick={() => cancelMeeting(m.id)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
