// @ts-nocheck
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SessionUser, ROLE_COLORS, STATUS_BG, STATUS_TEXT } from '@/types'
import { PageHeader, PageShell } from '@/components/app/Section'
import { sameUserId } from '@/lib/tasks'

/**
 * Updates = task channels + chat only (no brand panels).
 */
export default function UpdatesClient({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const [updates, setUpdates] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [thread, setThread] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [closing, setClosing] = useState(false)
  const channelScrollRef = useRef<HTMLDivElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const isMgmt = ['owner', 'manager'].includes(session.role)
  const deepLinkHandled = useRef(false)

  async function loadFeed() {
    const [u, t, peeps] = await Promise.all([
      fetch('/api/updates').then((r) => r.json()),
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()).catch(() => []),
    ])
    setUpdates(Array.isArray(u) ? u : [])
    setTasks(Array.isArray(t) ? t : [])
    setUsers(Array.isArray(peeps) ? peeps : [])
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
    .map((id) => users.find((u) => sameUserId(u.id, id))?.name || 'Member')
    .filter(Boolean)

  if (loading) {
    return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading chat…</div>
  }

  return (
    <PageShell fill>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
          <PageHeader
            title="Updates"
            subtitle="Task channels — open a chat to message the people on that task"
          />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--sf-muted)', fontSize: 12, cursor: 'pointer', marginTop: 8 }}>
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
            Show closed / done
          </label>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 340px) minmax(0, 1fr)',
          gap: 0,
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          border: '1px solid var(--sf-border)',
          borderRadius: 14,
          background: 'var(--sf-surface)',
        }}>
          {/* Channel list */}
          <div style={{ borderRight: '1px solid var(--sf-border)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', background: 'var(--sf-surface-2)' }}>
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
                    onClick={() => loadThread(task.id)}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                      <span style={{ color: 'var(--sf-text)', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        # {task.title}
                      </span>
                      <span style={{ color: 'var(--sf-muted)', fontSize: 10, flexShrink: 0 }}>
                        {new Date(lastAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginBottom: 4 }}>
                      {assignees} assignee{assignees === 1 ? '' : 's'}
                      {msgCount ? ` · ${msgCount} msg` : ''}
                      {task.updates_closed ? ' · Closed' : ''}
                      {task.status === 'Completed' && !task.updates_closed ? ' · Done' : ''}
                    </div>
                    <div style={{ color: 'var(--sf-text-secondary)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lastMessage ? `${lastSender || 'Someone'}: ${lastMessage}` : 'No messages yet'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Thread pane */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
            {!selectedTaskId || !selectedTask ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sf-muted)', fontSize: 14, padding: 32, textAlign: 'center' }}>
                Select a task chat on the left to open the conversation.
              </div>
            ) : (
              <>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--sf-border)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: 'var(--sf-text)', fontWeight: 700, fontSize: 16, fontFamily: "'Space Grotesk',sans-serif" }}>
                        # {selectedTask.title}
                      </div>
                      <div style={{ color: 'var(--sf-muted)', fontSize: 12, marginTop: 4 }}>
                        {selectedTask.type || 'Task'} · {selectedTask.status}
                        {selectedTask.due_date ? ` · Due ${selectedTask.due_date}` : ''}
                        {selectedTask.assigned_by?.name ? ` · Assigned by ${selectedTask.assigned_by.name}` : ''}
                      </div>
                      <div style={{ color: 'var(--sf-text-secondary)', fontSize: 12, marginTop: 4 }}>
                        Assigned: {assigneeNames.length ? assigneeNames.join(', ') : 'Nobody yet'}
                        {selectedTask.updates_closed ? ' · Channel closed' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{
                        background: STATUS_BG[selectedTask.status] || '#F3F4F6',
                        color: STATUS_TEXT[selectedTask.status] || '#374151',
                        fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap',
                      }}>
                        {selectedTask.status}
                      </span>
                      {isMgmt && (
                        selectedTask.updates_closed ? (
                          <button type="button" className="sf-btn sf-btn-ghost" disabled={closing} onClick={reopenChannel} style={{ fontSize: 11 }}>
                            {closing ? '…' : 'Reopen'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="sf-btn sf-btn-ghost"
                            disabled={closing}
                            onClick={() => closeChannel(true)}
                            style={{ fontSize: 11, color: 'var(--sf-danger)' }}
                          >
                            {closing ? '…' : 'Close & purge'}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div
                  ref={chatScrollRef}
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    minHeight: 0,
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
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
                        <div style={{ maxWidth: '75%' }}>
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
                            {m.message}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{
                  padding: 12,
                  borderTop: '1px solid var(--sf-border)',
                  display: 'flex',
                  gap: 8,
                  background: 'var(--sf-surface)',
                  flexShrink: 0,
                }}>
                  {selectedTask.updates_closed ? (
                    <div style={{ flex: 1, color: 'var(--sf-muted)', fontSize: 13, padding: '10px 4px' }}>
                      This channel is closed.
                      {isMgmt ? ' Reopen to allow new messages.' : ''}
                    </div>
                  ) : (
                    <>
                      <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                        placeholder={`Message # ${selectedTask.title}`}
                        className="sf-input"
                        style={{ flex: 1 }}
                      />
                      <button type="button" onClick={send} disabled={sending || !message.trim()} className="sf-btn sf-btn-primary">
                        {sending ? '…' : 'Send'}
                      </button>
                    </>
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
