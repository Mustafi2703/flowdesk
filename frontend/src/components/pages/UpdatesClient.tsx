// @ts-nocheck
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { SessionUser, ROLE_COLORS } from '@/types'
import { PageHeader, PageShell } from '@/components/app/Section'
import { StatusBadge, statusTint } from '@/components/app/StatusBadge'
import { todayIST } from '@/lib/clock'
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
  const [showTools, setShowTools] = useState(false)
  const channelScrollRef = useRef<HTMLDivElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const isMgmt = ['owner', 'manager'].includes(session.role)
  const deepLinkHandled = useRef(false)
  const today = todayIST()
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
    if (!soft) {
      setSelectedTaskId(taskId)
      setShowTools(false)
      setShowDriveForm(false)
      setMenuOpen(false)
    }
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
        <div className="sf-upd-pagehead">
          <PageHeader
            title="Updates"
            subtitle="Slack-style chats, one per task"
          />
          <label className="sf-upd-closed-toggle">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
            Show closed / done
          </label>
        </div>

        <div className="sf-updates-board">
          <div className="sf-updates-channels">
            <div className="sf-upd-channel-search">
              <div className="sf-upd-channel-heading">Channels</div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks"
                className="sf-input"
              />
            </div>
            <div ref={channelScrollRef} className="sf-upd-channel-list">
              {channels.length === 0 && (
                <div className="sf-upd-empty">No open task chats yet.</div>
              )}
              {channels.map(({ task, lastMessage, lastAt, lastSender, msgCount }) => {
                const active = selectedTaskId === task.id
                return (
                  <button
                    key={task.id}
                    type="button"
                    className={`sf-upd-channel${active ? ' is-active' : ''}`}
                    onClick={() => loadThread(task.id)}
                  >
                    <span className="sf-upd-channel-name"># {task.title}</span>
                    <span className="sf-upd-channel-meta">
                      <StatusBadge status={task.status} />
                      <span>{new Date(lastAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    </span>
                    <span className="sf-upd-channel-preview">
                      {lastMessage ? `${lastSender || 'Someone'}: ${lastMessage}` : 'No messages yet'}
                      {msgCount ? ` · ${msgCount}` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="sf-updates-thread">
            {!selectedTaskId || !selectedTask ? (
              <div className="sf-upd-empty sf-upd-empty-pane">
                Pick a task channel to talk about that work.
              </div>
            ) : (
              <>
                <div className="sf-upd-head">
                  <div className="sf-upd-head-row">
                    <div className="sf-upd-head-copy">
                      <h2 className="sf-upd-title"># {selectedTask.title}</h2>
                      <p className="sf-upd-people">
                        {assigneeNames.length ? assigneeNames.join(', ') : 'Nobody assigned yet'}
                        {selectedTask.due_date ? ` · due ${selectedTask.due_date}` : ''}
                        {selectedTask.updates_closed ? ' · closed' : ''}
                      </p>
                    </div>
                    <div className="sf-upd-head-tools">
                      <StatusBadge status={selectedTask.status} />
                      <Link href={`/tasks/${selectedTask.id}`} className="sf-btn sf-btn-ghost">Open</Link>
                      <button type="button" className="sf-btn sf-btn-ghost" onClick={() => setShowTools((v) => !v)}>
                        {showTools ? 'Hide tools' : 'Task tools'}
                      </button>
                      {isMgmt && (
                        <div className="sf-upd-menu">
                          <button type="button" className="sf-btn sf-btn-ghost" onClick={() => setMenuOpen((v) => !v)}>···</button>
                          {menuOpen && (
                            <div className="sf-upd-menu-list">
                              {selectedTask.updates_closed ? (
                                <button type="button" disabled={closing} onClick={() => { setMenuOpen(false); reopenChannel() }}>
                                  {closing ? '…' : 'Reopen channel'}
                                </button>
                              ) : (
                                <button type="button" disabled={closing} onClick={() => { setMenuOpen(false); closeChannel(true) }} style={{ color: 'var(--sf-danger)' }}>
                                  {closing ? '…' : 'Close channel'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {showTools && (
                    <div className="sf-upd-tools">
                      <div className="sf-upd-tool-row">
                        {canChangeStatus ? (
                          <select
                            value={selectedTask.status}
                            onChange={(e) => updateStatus(e.target.value)}
                            className="sf-input"
                            style={statusTint(selectedTask.status)}
                          >
                            {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className="sf-upd-hint">{clockedIn ? 'Status is read-only' : 'Clock in to change status'}</span>
                        )}
                        {(isMgmt || isTaskAssignee(selectedTask, session.id)) && (
                          <button type="button" className="sf-btn sf-btn-ghost" onClick={() => setShowDriveForm((v) => !v)}>
                            {showDriveForm ? 'Hide Drive' : 'Add Drive'}
                          </button>
                        )}
                      </div>

                      {isMgmt && selectedTask.requires_review && (
                        <div className="sf-upd-tool-block">
                          <div className="sf-upd-label">Review · v{selectedTask.review_version || '1'} · {selectedTask.review_status && selectedTask.review_status !== 'none' ? selectedTask.review_status : 'pending'}</div>
                          {clockedIn ? (
                            <div className="sf-upd-tool-row">
                              <input
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                                placeholder="Comment (required to reject)"
                                className="sf-input"
                              />
                              <button type="button" className="sf-btn sf-btn-primary" onClick={() => decideReview('approved')}>Approve</button>
                              <button type="button" className="sf-btn sf-btn-ghost" style={{ color: 'var(--sf-danger)' }} onClick={() => decideReview('rejected')}>Reject</button>
                            </div>
                          ) : (
                            <div className="sf-upd-hint">Clock in to approve or reject.</div>
                          )}
                        </div>
                      )}

                      {((selectedTask.external_links || []).length > 0 || showDriveForm) && (
                        <div className="sf-upd-tool-block">
                          <div className="sf-upd-label">Google Drive</div>
                          <div className="sf-upd-chips">
                            {(selectedTask.external_links || []).map((lnk: any, i: number) => (
                              <span key={`${lnk.url}-${i}`} className="sf-upd-chip">
                                <a href={lnk.url} target="_blank" rel="noreferrer">{lnk.label || 'Drive folder'}</a>
                                {(isMgmt || isTaskAssignee(selectedTask, session.id)) && (
                                  <button type="button" onClick={() => removeDriveLink(i)}>×</button>
                                )}
                              </span>
                            ))}
                          </div>
                          {showDriveForm && (
                            <div className="sf-upd-tool-row" style={{ marginTop: 8 }}>
                              <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label" className="sf-input sf-upd-link-label" />
                              <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://drive.google.com/…" className="sf-input" />
                              <button type="button" className="sf-btn sf-btn-primary" disabled={savingLink || !linkUrl.trim()} onClick={addDriveLink}>
                                {savingLink ? '…' : 'Save'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div ref={chatScrollRef} className="sf-upd-messages">
                  {thread.length === 0 && (
                    <div className="sf-upd-empty">This is the start of #{selectedTask.title}.</div>
                  )}
                  {thread.map((m) => (
                    <div key={m.id} className="sf-upd-msg">
                      <div
                        className="sf-upd-msg-avatar"
                        style={{ background: ROLE_COLORS[m.sender?.role] || 'var(--sf-accent)' }}
                      >
                        {m.sender?.avatar || m.sender?.name?.slice(0, 2) || '?'}
                      </div>
                      <div className="sf-upd-msg-body">
                        <div className="sf-upd-msg-meta">
                          <strong>{m.sender?.name || 'User'}</strong>
                          <span>{new Date(m.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="sf-upd-msg-text">
                          <MessageText text={m.message || ''} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="sf-upd-composer">
                  {selectedTask.updates_closed ? (
                    <div className="sf-upd-hint">This channel is closed.{isMgmt ? ' Reopen it from ···' : ''}</div>
                  ) : (
                    <div className="sf-upd-composer-row">
                      <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                        placeholder={`Message # ${selectedTask.title}`}
                        className="sf-input"
                      />
                      <button type="button" onClick={send} disabled={sending || !message.trim()} className="sf-btn sf-btn-primary">
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
