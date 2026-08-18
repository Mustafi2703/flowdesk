// @ts-nocheck
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { SessionUser, ROLE_COLORS } from '@/types'
import { PageHeader, PageShell } from '@/components/app/Section'
import { StatusBadge } from '@/components/app/StatusBadge'
import { TASK_STATUSES, isClockedInToday, isTaskAssignee, sameUserId } from '@/lib/tasks'

const URL_RE = /(https?:\/\/[^\s]+)/g

function MessageText({ text }: { text: string }) {
  if (!text) return null
  const parts = text.split(URL_RE)
  return (
    <>
      {parts.map((part, i) => {
        if (/^https?:\/\//.test(part)) {
          const href = part.replace(/[),.;]+$/, '')
          return (
            <a key={i} href={href} target="_blank" rel="noreferrer" style={{ color: '#60A5FA', wordBreak: 'break-all' }}>
              {part}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

/**
 * Updates = task channels + chat only (no brand panels).
 */
export default function UpdatesClient({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const [updates, setUpdates] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [thread, setThread] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [closing, setClosing] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [savingLink, setSavingLink] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDriveForm, setShowDriveForm] = useState(false)
  const channelScrollRef = useRef<HTMLDivElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const isMgmt = ['owner', 'manager'].includes(session.role)
  const deepLinkHandled = useRef(false)
  const today = new Date().toISOString().split('T')[0]
  const clockedIn = isClockedInToday(attendance, session.id, today)

  async function loadFeed() {
    const [u, t, peeps, att] = await Promise.all([
      fetch('/api/updates').then((r) => r.json()),
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()).catch(() => []),
      fetch('/api/attendance').then((r) => r.json()).catch(() => []),
    ])
    setUpdates(Array.isArray(u) ? u : [])
    setTasks(Array.isArray(t) ? t : [])
    setUsers(Array.isArray(peeps) ? peeps : [])
    setAttendance(Array.isArray(att) ? att : [])
    setLoading(false)
  }

  async function loadThread(taskId: string, soft = false) {
    if (!soft) setSelectedTaskId(taskId)
    const res = await fetch(`/api/tasks/${taskId}/chat`)
    const data = await res.json().catch(() => [])
    setThread(Array.isArray(data) ? data : [])
  }

  useEffect(() => { loadFeed() }, [])

  useEffect(() => {
    const id = setInterval(() => {
      loadFeed()
      if (selectedTaskId) loadThread(selectedTaskId, true)
    }, 8000)
    return () => clearInterval(id)
  }, [selectedTaskId])

  useEffect(() => {
    if (loading || deepLinkHandled.current) return
    const taskId = searchParams.get('task')
    if (!taskId) return
    const task = tasks.find((t) => String(t.id) === String(taskId))
    if (!task) return
    deepLinkHandled.current = true
    loadThread(task.id)
  }, [loading, tasks, searchParams])

  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [thread.length, selectedTaskId])

  async function send() {
    if (!selectedTaskId || !message.trim()) return
    setSending(true)
    const res = await fetch(`/api/tasks/${selectedTaskId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim(), type: 'text' }),
    })
    setSending(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not send')
      return
    }
    setMessage('')
    await loadThread(selectedTaskId)
    loadFeed()
  }

  async function closeChannel(purge = true) {
    if (!selectedTaskId || !isMgmt) return
    const msg = purge
      ? 'Close this channel and delete chat history?'
      : 'Close this channel (keep history, no new messages)?'
    if (!window.confirm(msg)) return
    setClosing(true)
    const res = await fetch(`/api/tasks/${selectedTaskId}/updates/close?purge=${purge ? 'true' : 'false'}`, { method: 'POST' })
    setClosing(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not close channel')
      return
    }
    if (purge) setThread([])
    await loadFeed()
  }

  async function reopenChannel() {
    if (!selectedTaskId || !isMgmt) return
    setClosing(true)
    const res = await fetch(`/api/tasks/${selectedTaskId}/updates/reopen`, { method: 'POST' })
    setClosing(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not reopen')
      return
    }
    await loadFeed()
  }

  async function updateStatus(status: string) {
    if (!selectedTaskId) return
    const res = await fetch(`/api/tasks/${selectedTaskId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not update status')
      return
    }
    await loadFeed()
  }

  async function addDriveLink() {
    if (!selectedTaskId || !selectedTask || !linkUrl.trim()) return
    setSavingLink(true)
    const next = [...(selectedTask.external_links || []), { label: linkLabel.trim() || 'Drive folder', url: linkUrl.trim() }]
    const res = await fetch(`/api/tasks/${selectedTaskId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ external_links: next }),
    })
    setSavingLink(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not add Drive link')
      return
    }
    setLinkLabel('')
    setLinkUrl('')
    await loadFeed()
  }

  async function removeDriveLink(idx: number) {
    if (!selectedTaskId || !selectedTask) return
    const next = (selectedTask.external_links || []).filter((_: any, i: number) => i !== idx)
    const res = await fetch(`/api/tasks/${selectedTaskId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ external_links: next }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not remove link')
      return
    }
    await loadFeed()
  }

  async function decideReview(decision: 'approved' | 'rejected') {
    if (!selectedTaskId) return
    if (decision === 'rejected' && reviewNotes.trim().length < 2) {
      alert('Add comments when rejecting')
      return
    }
    const res = await fetch(`/api/tasks/${selectedTaskId}/review`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision, notes: reviewNotes }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not review')
      return
    }
    setReviewNotes('')
    await loadFeed()
  }

  const channels = useMemo(() => {
    const byTask = new Map()
    for (const u of updates) {
      const prev = byTask.get(u.task_id)
      if (!prev || new Date(u.created_at) > new Date(prev.created_at)) byTask.set(u.task_id, u)
    }
    let list = tasks
    if (!showClosed) {
      list = list.filter((t) => !t.updates_closed && t.status !== 'Completed')
    }
    const rows = list.map((t) => {
      const last = byTask.get(t.id)
      return {
        task: t,
        lastMessage: last?.message || null,
        lastAt: last?.created_at || t.updated_at || t.created_at,
        lastSender: last?.sender?.name || null,
        msgCount: updates.filter((x) => x.task_id === t.id).length,
      }
    })
    rows.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      r.task.title?.toLowerCase().includes(q) ||
      (r.lastMessage || '').toLowerCase().includes(q)
    )
  }, [tasks, updates, query, showClosed])

  const selectedTask = tasks.find((t) => t.id === selectedTaskId)
  const assigneeNames = (selectedTask?.assigned_to || [])
    .map((id: string) => users.find((u) => sameUserId(u.id, id))?.name)
    .filter(Boolean)
  const canChangeStatus = Boolean(selectedTask && clockedIn && (isMgmt || isTaskAssignee(selectedTask, session.id)))

  if (loading) {
    return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading chat…</div>
  }

  return (
    <PageShell fill>
      <div className="sf-updates">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
          <PageHeader
            title="Updates"
            subtitle="One chat per task — message the people on that work"
          />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--sf-muted)', fontSize: 12, cursor: 'pointer', marginTop: 8 }}>
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
            Show closed / done
          </label>
        </div>

        <div className="sf-updates-board">
          <div className="sf-updates-channels">
            <div style={{ padding: 12, borderBottom: '1px solid var(--sf-border)', flexShrink: 0 }}>
              <div style={{ color: 'var(--sf-text)', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                Task chats
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks…"
                className="sf-input"
                style={{ fontSize: 12, padding: '8px 10px' }}
              />
            </div>
            <div ref={channelScrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
              {channels.length === 0 && (
                <div style={{ padding: 24, color: 'var(--sf-muted-2)', fontSize: 12, textAlign: 'center' }}>
                  No open task chats yet. Create a task to start one.
                </div>
              )}
              {channels.map(({ task, lastMessage, lastAt, lastSender, msgCount }) => {
                const active = selectedTaskId === task.id
                const assignees = (task.assigned_to || []).length
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => { setMenuOpen(false); loadThread(task.id) }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      border: 'none',
                      borderBottom: '1px solid var(--sf-border)',
                      background: active ? 'rgba(232,99,10,0.12)' : 'transparent',
                      borderLeft: active ? '3px solid var(--sf-accent)' : '3px solid transparent',
                      cursor: 'pointer',
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3, minWidth: 0 }}>
                      <span style={{ color: 'var(--sf-text)', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        # {task.title}
                      </span>
                      <span style={{ color: 'var(--sf-muted)', fontSize: 10, flexShrink: 0 }}>
                        {new Date(lastAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
                      <StatusBadge status={task.status} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {assignees} assignee{assignees === 1 ? '' : 's'}
                        {msgCount ? ` · ${msgCount} msg` : ''}
                        {task.updates_closed ? ' · Closed' : ''}
                      </span>
                    </div>
                    <div style={{ color: 'var(--sf-text-secondary)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lastMessage ? `${lastSender || 'Someone'}: ${lastMessage}` : 'No messages yet'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="sf-updates-thread">
            {!selectedTaskId || !selectedTask ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sf-muted)', fontSize: 14, padding: 32, textAlign: 'center' }}>
                Select a task chat on the left to open the conversation.
              </div>
            ) : (
              <>
                <div className="sf-upd-head">
                  <div className="sf-upd-head-row">
                    <div className="sf-upd-head-copy">
                      <h2 className="sf-upd-title" title={selectedTask.title}># {selectedTask.title}</h2>
                      <p className="sf-upd-meta" title={`${selectedTask.type || 'Task'} · Due ${selectedTask.due_date || '—'}${selectedTask.assigned_by?.name ? ` · Assigned by ${selectedTask.assigned_by.name}` : ''}`}>
                        {selectedTask.type || 'Task'}
                        {selectedTask.due_date ? ` · Due ${selectedTask.due_date}` : ''}
                        {selectedTask.assigned_by?.name ? ` · Assigned by ${selectedTask.assigned_by.name}` : ''}
                        {selectedTask.updates_closed ? ' · Closed' : ''}
                      </p>
                      <p className="sf-upd-people" title={assigneeNames.join(', ')}>
                        {assigneeNames.length ? assigneeNames.join(', ') : 'Nobody assigned yet'}
                      </p>
                    </div>
                    <div className="sf-upd-head-tools">
                      <StatusBadge status={selectedTask.status} />
                      <Link href={`/tasks/${selectedTask.id}`} className="sf-btn sf-btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }}>Open task</Link>
                      {isMgmt && (
                        <div className="sf-upd-menu">
                          <button
                            type="button"
                            className="sf-btn sf-btn-ghost"
                            style={{ fontSize: 12, padding: '6px 10px' }}
                            onClick={() => setMenuOpen((v) => !v)}
                            aria-label="More actions"
                          >
                            More
                          </button>
                          {menuOpen && (
                            <div className="sf-upd-menu-list">
                              {selectedTask.updates_closed ? (
                                <button type="button" disabled={closing} onClick={() => { setMenuOpen(false); reopenChannel() }}>
                                  {closing ? '…' : 'Reopen channel'}
                                </button>
                              ) : (
                                <button type="button" disabled={closing} onClick={() => { setMenuOpen(false); closeChannel(true) }} style={{ color: 'var(--sf-danger)' }}>
                                  {closing ? '…' : 'Close & purge'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="sf-upd-toolbar">
                    {canChangeStatus ? (
                      <select
                        value={selectedTask.status}
                        onChange={(e) => updateStatus(e.target.value)}
                        className="sf-input"
                      >
                        {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : !clockedIn ? (
                      <span className="sf-upd-hint">Clock in to change status</span>
                    ) : (
                      <span style={{ color: 'var(--sf-muted)', fontSize: 12 }}>Status is read-only</span>
                    )}
                    {(isMgmt || isTaskAssignee(selectedTask, session.id)) && (
                      <button type="button" className="sf-btn sf-btn-ghost" style={{ fontSize: 12, padding: '6px 10px', marginLeft: 'auto' }} onClick={() => setShowDriveForm((v) => !v)}>
                        {showDriveForm ? 'Hide Drive' : 'Add Drive'}
                      </button>
                    )}
                  </div>
                  {isMgmt && selectedTask.requires_review && (
                    <div className="sf-upd-review">
                      <div className="sf-upd-label">Review</div>
                      <div className="sf-upd-review-row">
                        <input
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          placeholder="Comments required when rejecting"
                          className="sf-input"
                        />
                        <button type="button" className="sf-btn sf-btn-primary" style={{ fontSize: 12, padding: '7px 12px', flexShrink: 0 }} onClick={() => decideReview('approved')}>Approve</button>
                        <button type="button" className="sf-btn sf-btn-ghost" style={{ fontSize: 12, padding: '7px 12px', flexShrink: 0, color: 'var(--sf-danger)' }} onClick={() => decideReview('rejected')}>Reject</button>
                      </div>
                    </div>
                  )}
                  {((selectedTask.external_links || []).length > 0 || showDriveForm) && (
                    <div className="sf-upd-drive">
                      <div className="sf-upd-label">Google Drive</div>
                      <div className="sf-upd-chips">
                        {(selectedTask.external_links || []).map((lnk: any, i: number) => (
                          <span key={`${lnk.url}-${i}`} className="sf-upd-chip">
                            <a href={lnk.url} target="_blank" rel="noreferrer">{lnk.label || 'Drive folder'}</a>
                            {(isMgmt || isTaskAssignee(selectedTask, session.id)) && (
                              <button type="button" onClick={() => removeDriveLink(i)} style={{ background: 'none', border: 'none', color: 'var(--sf-muted)', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
                            )}
                          </span>
                        ))}
                      </div>
                      {showDriveForm && (
                        <div className="sf-upd-review-row" style={{ marginTop: 8 }}>
                          <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label" className="sf-input" style={{ maxWidth: 140, flex: '0 0 140px' }} />
                          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://drive.google.com/…" className="sf-input" />
                          <button type="button" className="sf-btn sf-btn-primary" style={{ fontSize: 12, padding: '7px 12px', flexShrink: 0 }} disabled={savingLink || !linkUrl.trim()} onClick={addDriveLink}>
                            {savingLink ? '…' : 'Save'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div ref={chatScrollRef} className="sf-upd-messages">
                  {thread.length === 0 && (
                    <div style={{ color: 'var(--sf-muted-2)', fontSize: 13, textAlign: 'center', padding: 32 }}>
                      This is the start of #{selectedTask.title}. Post an update for the assigned team.
                    </div>
                  )}
                  {thread.map((m) => {
                    const mine = sameUserId(m.sender_id, session.id) || sameUserId(m.sender?.id, session.id)
                    return (
                      <div key={m.id} style={{ display: 'flex', gap: 10, flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: ROLE_COLORS[m.sender?.role] || 'var(--sf-accent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 11, fontWeight: 700,
                        }}>
                          {m.sender?.avatar || m.sender?.name?.slice(0, 2) || '?'}
                        </div>
                        <div style={{ maxWidth: '75%', minWidth: 0 }}>
                          <div style={{ color: 'var(--sf-muted)', fontSize: 10, marginBottom: 3, textAlign: mine ? 'right' : 'left' }}>
                            {m.sender?.name || 'User'} · {new Date(m.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div style={{
                            background: mine ? 'rgba(232,99,10,0.2)' : 'var(--sf-surface-2)',
                            border: `1px solid ${mine ? 'rgba(232,99,10,0.35)' : 'var(--sf-border)'}`,
                            borderRadius: 12,
                            padding: '10px 12px',
                            color: 'var(--sf-text)',
                            fontSize: 13,
                            lineHeight: 1.5,
                            wordBreak: 'break-word',
                          }}>
                            <MessageText text={m.message || ''} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="sf-upd-composer">
                  {selectedTask.updates_closed ? (
                    <div style={{ color: 'var(--sf-muted)', fontSize: 13, padding: '6px 0' }}>
                      This channel is closed.
                      {isMgmt ? ' Use More → Reopen channel to allow messages.' : ''}
                    </div>
                  ) : (
                    <div className="sf-upd-composer-row">
                      <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                        placeholder={`Message # ${selectedTask.title}`}
                        className="sf-input"
                      />
                      <button type="button" onClick={send} disabled={sending || !message.trim()} className="sf-btn sf-btn-primary" style={{ flexShrink: 0 }}>
                        {sending ? '…' : 'Send'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
