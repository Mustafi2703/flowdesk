// @ts-nocheck
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SessionUser } from '@/types'
import { PageHeader, PageShell } from '@/components/app/Section'
import { StatusBadge, statusTint } from '@/components/app/StatusBadge'
import { FileAttachmentsPanel } from '@/components/app/FileAttachmentsPanel'
import { PeoplePicker } from '@/components/app/PeoplePicker'
import { todayIST } from '@/lib/clock'
import { TASK_STATUSES, canManageTasks, isClockedInToday, isTaskAssignee, sameUserId } from '@/lib/tasks'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'subtasks', label: 'Sub-tasks' },
  { id: 'files', label: 'Files & links' },
  { id: 'review', label: 'Review' },
  { id: 'timeline', label: 'History' },
]

function newSubTaskId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `st-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function TaskDetailClient({ session, taskId }: { session: SessionUser; taskId: string }) {
  const router = useRouter()
  const [task, setTask] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [emailing, setEmailing] = useState(false)
  const today = todayIST()
  const clockedIn = isClockedInToday(attendance, session.id, today)
  const canEdit = canManageTasks(session.role)
  const isAssignee = task ? isTaskAssignee(task, session.id) : false
  const canWork = clockedIn && (canEdit || isAssignee)
  const teamUsers = users.filter((u) => u.role === 'team' || u.role === 'manager')

  async function load() {
    setError('')
    const [t, u, a] = await Promise.all([
      fetch(`/api/tasks/${taskId}`).then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()).catch(() => []),
      fetch('/api/attendance').then((r) => r.json()).catch(() => []),
    ])
    if (t?.error || t?.detail || !t?.id) {
      setError(t?.error || t?.detail || 'Task not found')
      setTask(null)
    } else {
      setTask(t)
    }
    setUsers(Array.isArray(u) ? u : [])
    setAttendance(Array.isArray(a) ? a : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [taskId])

  async function patch(body: any) {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(data.error || data.detail || 'Could not save')
      return false
    }
    setTask(data)
    return true
  }

  async function decideReview(decision: 'approved' | 'rejected') {
    if (decision === 'rejected' && reviewNotes.trim().length < 2) {
      setError('Add comments / suggestions when rejecting')
      return
    }
    setSaving(true)
    const res = await fetch(`/api/tasks/${taskId}/review`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision, notes: reviewNotes }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(data.error || data.detail || 'Could not submit review')
      return
    }
    setTask(data)
    setReviewNotes('')
    setTab('review')
  }

  async function emailBrief() {
    setEmailing(true)
    setError('')
    const res = await fetch(`/api/tasks/${taskId}/email-brief`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setEmailing(false)
    if (!res.ok) {
      setError(data.error || data.detail || 'Could not send task email')
      return
    }
    alert(data.sent ? `Task email sent (${data.sent}).` : 'No assignees to email.')
  }

  const assignees = useMemo(() => {
    if (!task) return []
    return (task.assigned_to || [])
      .map((id: string) => users.find((u) => sameUserId(u.id, id))?.name)
      .filter(Boolean)
  }, [task, users])

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading task…</div>
  if (!task) {
    return (
      <PageShell>
        <PageHeader title="Task" subtitle={error || 'Not found'} />
        <Link href="/tasks" className="sf-btn sf-btn-ghost">Back to tasks</Link>
      </PageShell>
    )
  }

  const visibleTabs = TABS.filter((t) => t.id !== 'review' || task.requires_review)

  return (
    <PageShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <Link href="/tasks" style={{ color: 'var(--sf-muted)', fontSize: 12, textDecoration: 'none' }}>← Tasks</Link>
          <PageHeader title={task.title} subtitle={`${task.brand?.name || 'No brand'} · v${task.review_version || '1'}`} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge status={task.status} />
          {task.review_status && task.review_status !== 'none' && (
            <StatusBadge status={task.review_status === 'approved' ? 'Completed' : task.review_status === 'rejected' ? 'Revision Needed' : 'Under Review'} />
          )}
          {canWork ? (
            <>
              {task.status === 'Not Started' && (
                <button type="button" className="sf-btn sf-btn-primary" style={{ fontSize: 12 }} onClick={() => patch({ status: 'In Progress' })}>
                  Start work → In Progress
                </button>
              )}
              <select
                value={task.status}
                onChange={(e) => patch({ status: e.target.value })}
                className="sf-input"
                style={{ fontSize: 12, padding: '6px 8px', ...statusTint(task.status) }}
              >
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </>
          ) : (
            <span style={{ color: '#FBBF24', fontSize: 12 }}>{clockedIn ? '' : 'Clock in to update status'}</span>
          )}
          {canEdit && task.requires_review && (
            <button type="button" className="sf-btn sf-btn-primary" style={{ fontSize: 12 }} onClick={() => setTab('review')}>Review</button>
          )}
          {canEdit && (
            <button type="button" className="sf-btn sf-btn-ghost" style={{ fontSize: 12 }} disabled={emailing} onClick={emailBrief}>
              {emailing ? 'Sending…' : 'Email brief'}
            </button>
          )}
          <Link href={`/updates?task=${task.id}`} className="sf-btn sf-btn-ghost" style={{ fontSize: 12 }}>Updates chat</Link>
        </div>
      </div>

      {!clockedIn && (
        <div style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)', color: '#FBBF24', borderRadius: 10, padding: 12, fontSize: 13 }}>
          Clock in from the top bar before starting work, updating status, or reviewing this task.
        </div>
      )}
      {error && <div style={{ background: '#3B0A0A', border: '1px solid #EF4444', color: '#FEE2E2', borderRadius: 10, padding: 12, fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--sf-border)', paddingBottom: 8 }}>
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="sf-btn"
            style={{
              fontSize: 12,
              background: tab === t.id ? 'var(--sf-accent)' : 'transparent',
              color: tab === t.id ? '#fff' : 'var(--sf-muted)',
              border: 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr', gap: 16 }}>
          <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18 }}>
            <div style={{ color: 'var(--sf-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Description</div>
            {canEdit ? (
              <textarea
                defaultValue={task.description || ''}
                key={task.updated_at}
                rows={6}
                className="sf-input"
                onBlur={(e) => { if (e.target.value !== (task.description || '')) patch({ description: e.target.value }) }}
                style={{ width: '100%', resize: 'vertical' }}
              />
            ) : (
              <p style={{ color: 'var(--sf-text-secondary)', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{task.description || 'No description.'}</p>
            )}
            {canEdit && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, fontSize: 13, color: '#F59E0B' }}>
                <input type="checkbox" checked={!!task.requires_review} onChange={(e) => patch({ requires_review: e.target.checked })} />
                Requires review
              </label>
            )}
          </div>
          <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18 }}>
            {[
              ['Brand', task.brand?.name || '—'],
              ['Type', task.type || '—'],
              ['Priority', task.priority || '—'],
              ['Due', task.due_date || '—'],
              ['Assignees', assignees.join(', ') || '—'],
              ['Assigned by', task.assigned_by?.name || '—'],
              ['Review', task.requires_review ? `Required · ${task.review_status || 'none'} · v${task.review_version || '1'}` : 'Not required'],
            ].map(([l, v]) => (
              <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--sf-border)' }}>
                <span style={{ color: 'var(--sf-muted)', fontSize: 12 }}>{l}</span>
                <span style={{ color: 'var(--sf-text)', fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
            {canEdit && (
              <button type="button" className="sf-btn sf-btn-ghost" style={{ marginTop: 12, fontSize: 12, color: 'var(--sf-danger)' }} onClick={async () => {
                if (!window.confirm(`Delete "${task.title}"?`)) return
                const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
                if (res.ok) router.push('/tasks')
                else {
                  const data = await res.json().catch(() => ({}))
                  setError(data.error || 'Could not delete')
                }
              }}>Delete task</button>
            )}
          </div>
        </div>
      )}

      {tab === 'subtasks' && (
        <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ color: 'var(--sf-text)', fontWeight: 700 }}>Sub-tasks</div>
              <div style={{ color: 'var(--sf-muted)', fontSize: 12 }}>Each row is a sub-task of this task — not a project.</div>
            </div>
            {canEdit && (
              <button type="button" className="sf-btn sf-btn-primary" style={{ fontSize: 12 }} onClick={() => {
                const next = [...(task.sub_tasks || []), { id: newSubTaskId(), title: '', assigned_to: [], status: 'Not Started', due_date: '' }]
                setTask({ ...task, sub_tasks: next })
              }}>+ Add sub-task</button>
            )}
          </div>
          {(task.sub_tasks || []).length === 0 && <div style={{ color: 'var(--sf-muted)', fontSize: 13 }}>No sub-tasks yet.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(task.sub_tasks || []).map((st: any, idx: number) => {
              const mine = (st.assigned_to || []).some((id: string) => sameUserId(id, session.id))
              return (
                <div key={st.id || idx} style={{ border: '1px solid var(--sf-border)', borderRadius: 10, padding: 12, background: 'var(--sf-surface-2)' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span style={{ color: 'var(--sf-muted)', fontSize: 11, fontWeight: 700, paddingTop: 8 }}>SUB-TASK</span>
                    <input
                      value={st.title}
                      disabled={!canEdit}
                      onChange={(e) => {
                        const next = [...task.sub_tasks]
                        next[idx] = { ...st, title: e.target.value }
                        setTask({ ...task, sub_tasks: next })
                      }}
                      className="sf-input"
                      style={{ flex: 1 }}
                      placeholder="Sub-task title"
                    />
                    {canEdit && (
                      <button type="button" className="sf-btn sf-btn-ghost" style={{ color: 'var(--sf-danger)' }} onClick={() => {
                        const next = task.sub_tasks.filter((_: any, i: number) => i !== idx)
                        patch({ sub_tasks: next })
                      }}>×</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <select
                      value={st.status}
                      disabled={!(canEdit || (mine && clockedIn))}
                      onChange={(e) => {
                        const next = task.sub_tasks.map((row: any, i: number) => i === idx ? { ...row, status: e.target.value } : row)
                        patch({ sub_tasks: next })
                      }}
                      className="sf-input"
                    >
                      {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <input type="date" value={st.due_date || ''} disabled={!canEdit} className="sf-input" onChange={(e) => {
                      const next = [...task.sub_tasks]
                      next[idx] = { ...st, due_date: e.target.value }
                      setTask({ ...task, sub_tasks: next })
                    }} />
                  </div>
                  {canEdit && (
                    <div style={{ marginTop: 8 }}>
                      <PeoplePicker
                        users={teamUsers}
                        selectedIds={st.assigned_to || []}
                        onChange={(ids) => {
                          const next = [...task.sub_tasks]
                          next[idx] = { ...st, assigned_to: ids }
                          setTask({ ...task, sub_tasks: next })
                        }}
                        variant="dropdown"
                        placeholder="Assign sub-task…"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {canEdit && (task.sub_tasks || []).length > 0 && (
            <button type="button" className="sf-btn sf-btn-primary" disabled={saving} style={{ marginTop: 12, fontSize: 12 }} onClick={() => patch({ sub_tasks: task.sub_tasks })}>
              {saving ? 'Saving…' : 'Save sub-tasks'}
            </button>
          )}
        </div>
      )}

      {tab === 'files' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FileAttachmentsPanel entityType="task" entityId={task.id} canUpload={canWork} title="Uploads (any file type)" />
          <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18 }}>
            <div style={{ color: 'var(--sf-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>Google Drive / external links</div>
            {(task.external_links || []).length === 0 && <div style={{ color: 'var(--sf-muted)', fontSize: 12, marginBottom: 10 }}>No links yet. Paste a Drive, Dropbox, or Figma URL.</div>}
            {(task.external_links || []).map((lnk: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--sf-border)' }}>
                <a href={lnk.url} target="_blank" rel="noreferrer" style={{ color: '#60A5FA', fontSize: 13 }}>{lnk.label || lnk.url}</a>
                {canWork && (
                  <button type="button" className="sf-btn sf-btn-ghost" style={{ fontSize: 11, color: 'var(--sf-danger)' }} onClick={() => {
                    const next = (task.external_links || []).filter((_: any, idx: number) => idx !== i)
                    patch({ external_links: next })
                  }}>Remove</button>
                )}
              </div>
            ))}
            {canWork && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label (optional)" className="sf-input" />
                <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://drive.google.com/…" className="sf-input" />
                <button type="button" className="sf-btn sf-btn-primary" style={{ fontSize: 12 }} onClick={() => {
                  if (!linkUrl.trim()) return
                  const next = [...(task.external_links || []), { label: linkLabel.trim() || 'Drive link', url: linkUrl.trim() }]
                  patch({ external_links: next })
                  setLinkUrl(''); setLinkLabel('')
                }}>Add link</button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'review' && task.requires_review && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Review this task</div>
            <div style={{ color: 'var(--sf-muted)', fontSize: 12, marginBottom: 12 }}>
              Current version {task.review_version || '1'} · {task.review_status || 'none'}
            </div>
            {canEdit && clockedIn ? (
              <>
                <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={4} className="sf-input" placeholder="Suggestion / comments" style={{ width: '100%', resize: 'vertical', marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="sf-btn sf-btn-primary" disabled={saving} onClick={() => decideReview('approved')}>Approve</button>
                  <button type="button" className="sf-btn sf-btn-ghost" disabled={saving} style={{ color: 'var(--sf-danger)' }} onClick={() => decideReview('rejected')}>Reject (revision needed)</button>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--sf-muted)', fontSize: 13 }}>
                {canEdit ? 'Clock in to approve or reject.' : 'Only managers can decide reviews. You can read the history on the right.'}
              </div>
            )}
          </div>
          <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Version history</div>
            {(task.review_history || []).length === 0 && <div style={{ color: 'var(--sf-muted)', fontSize: 13 }}>No review decisions yet.</div>}
            {[...(task.review_history || [])].reverse().map((h: any, i: number) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--sf-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>v{h.version} · {h.status}</strong>
                  <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{h.at ? new Date(h.at).toLocaleString() : ''}</span>
                </div>
                <div style={{ color: 'var(--sf-text-secondary)', fontSize: 12, marginTop: 4 }}>{h.notes || '—'}</div>
                <div style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{h.by_name || h.by}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 12, padding: 18 }}>
          {(task.timeline || []).length === 0 && <div style={{ color: 'var(--sf-muted)' }}>No history yet.</div>}
          {[...(task.timeline || [])].reverse().map((ev: any, i: number) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--sf-border)', fontSize: 13 }}>
              <div style={{ color: 'var(--sf-text)', fontWeight: 600 }}>{ev.action}</div>
              {ev.notes && <div style={{ color: 'var(--sf-text-secondary)', fontSize: 12 }}>{ev.notes}</div>}
              <div style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{ev.at ? new Date(ev.at).toLocaleString() : ''}</div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
