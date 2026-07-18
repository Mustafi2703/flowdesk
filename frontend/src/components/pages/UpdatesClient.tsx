// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { SessionUser, ROLE_COLORS } from '@/types'
import { PageHeader, PageShell, Section } from '@/components/app/Section'

export default function UpdatesClient({ session }: { session: SessionUser }) {
  const [updates, setUpdates] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [thread, setThread] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  async function loadFeed() {
    const [u, t] = await Promise.all([
      fetch('/api/updates').then(r => r.json()),
      fetch('/api/tasks').then(r => r.json()),
    ])
    setUpdates(Array.isArray(u) ? u : [])
    setTasks(Array.isArray(t) ? t : [])
    setLoading(false)
  }

  async function loadThread(taskId: string) {
    setSelectedTaskId(taskId)
    const res = await fetch(`/api/tasks/${taskId}/chat`)
    const data = await res.json().catch(() => [])
    setThread(Array.isArray(data) ? data : [])
  }

  useEffect(() => { loadFeed() }, [])

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

  const selectedTask = tasks.find((t: any) => t.id === selectedTaskId)

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading updates…</div>

  return (
    <PageShell>
      <PageHeader title="Updates" subtitle="All task comments in one place — Slack-style" />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)', gap: 16, flex: 1, minHeight: 0 }}>
        <Section title="Activity feed" subtitle={`${updates.length} recent`} flex={1} flush>
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            {updates.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--sf-muted-2)', fontSize: 13 }}>
                No comments yet. Open a task thread on the right to start chatting.
              </div>
            )}
            {updates.map((u: any) => (
              <button
                key={u.id}
                type="button"
                onClick={() => loadThread(u.task_id)}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  border: 'none',
                  borderBottom: '1px solid var(--sf-border)',
                  background: selectedTaskId === u.task_id ? 'rgba(232,99,10,0.08)' : 'transparent',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: ROLE_COLORS[u.sender?.role] || 'var(--sf-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 11, fontWeight: 700,
                  }}>
                    {u.sender?.avatar || u.sender?.name?.slice(0, 2) || '?'}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                      <span style={{ color: 'var(--sf-text)', fontWeight: 700, fontSize: 12 }}>{u.sender?.name || 'Someone'}</span>
                      <span style={{ color: 'var(--sf-muted)', fontSize: 10, flexShrink: 0 }}>
                        {new Date(u.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ color: 'var(--sf-accent)', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>#{u.task_title}</div>
                    <div style={{ color: 'var(--sf-text-secondary)', fontSize: 13, lineHeight: 1.45 }}>{u.message}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Section>

        <Section
          title={selectedTask ? selectedTask.title : 'Thread'}
          subtitle={selectedTask ? selectedTask.status : 'Pick a task or feed item'}
          flex={1}
        >
          {!selectedTaskId ? (
            <div>
              <p style={{ color: 'var(--sf-muted)', fontSize: 13, marginBottom: 12 }}>Start or continue a conversation on any task:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
                {tasks.slice(0, 40).map((t: any) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => loadThread(t.id)}
                    className="sf-btn sf-btn-ghost"
                    style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: 12 }}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 420 }}>
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {thread.length === 0 && (
                  <div style={{ color: 'var(--sf-muted-2)', fontSize: 13, textAlign: 'center', padding: 24 }}>No messages yet — say hello.</div>
                )}
                {thread.map((m: any) => {
                  const mine = m.sender_id === session.id || m.sender?.id === session.id
                  return (
                    <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      <div style={{ color: 'var(--sf-muted)', fontSize: 10, marginBottom: 3 }}>
                        {m.sender?.name || 'User'} · {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{
                        background: mine ? 'rgba(232,99,10,0.2)' : 'var(--sf-surface-2)',
                        border: `1px solid ${mine ? 'rgba(232,99,10,0.35)' : 'var(--sf-border)'}`,
                        borderRadius: 10,
                        padding: '8px 12px',
                        color: 'var(--sf-text)',
                        fontSize: 13,
                        lineHeight: 1.45,
                      }}>
                        {m.message}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="Write a comment…"
                  className="sf-input"
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={send} disabled={sending || !message.trim()} className="sf-btn sf-btn-primary">
                  {sending ? '…' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </Section>
      </div>
    </PageShell>
  )
}
