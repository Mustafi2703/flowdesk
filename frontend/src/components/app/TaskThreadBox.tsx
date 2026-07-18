'use client'

import { useEffect, useState } from 'react'
import { ROLE_COLORS } from '@/types'

/** Slack-style comment thread for a single task (also used on Updates page). */
export function TaskThreadBox({
  taskId,
  sessionId,
  compact = false,
}: {
  taskId: string
  sessionId: string
  compact?: boolean
}) {
  const [thread, setThread] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  async function load() {
    const res = await fetch(`/api/tasks/${taskId}/chat`)
    const data = await res.json().catch(() => [])
    setThread(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    if (taskId) load()
  }, [taskId])

  async function send() {
    if (!message.trim()) return
    setSending(true)
    const res = await fetch(`/api/tasks/${taskId}/chat`, {
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
    load()
  }

  return (
    <div style={{ background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 10, padding: compact ? 10 : 14 }}>
      <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
        Thread
      </div>
      <div style={{ maxHeight: compact ? 180 : 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        {loading && <div style={{ color: 'var(--sf-muted)', fontSize: 12 }}>Loading…</div>}
        {!loading && thread.length === 0 && (
          <div style={{ color: 'var(--sf-muted-2)', fontSize: 12 }}>No comments yet. Start the thread.</div>
        )}
        {thread.map((m: any) => {
          const mine = m.sender_id === sessionId || m.sender?.id === sessionId
          return (
            <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: mine ? 'row-reverse' : 'row' }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                background: ROLE_COLORS[m.sender?.role] || 'var(--sf-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 9, fontWeight: 700,
              }}>
                {m.sender?.avatar || m.sender?.name?.slice(0, 2) || '?'}
              </div>
              <div style={{ maxWidth: '80%' }}>
                <div style={{ color: 'var(--sf-muted)', fontSize: 10, marginBottom: 2, textAlign: mine ? 'right' : 'left' }}>
                  {m.sender?.name || 'User'} · {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{
                  background: mine ? 'rgba(232,99,10,0.18)' : 'var(--sf-bg)',
                  border: `1px solid ${mine ? 'rgba(232,99,10,0.3)' : 'var(--sf-border)'}`,
                  borderRadius: 8, padding: '6px 10px', color: 'var(--sf-text)', fontSize: 12, lineHeight: 1.4,
                }}>
                  {m.message}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Write a comment…"
          className="sf-input"
          style={{ flex: 1, fontSize: 12, padding: '7px 10px' }}
        />
        <button type="button" onClick={send} disabled={sending || !message.trim()} className="sf-btn sf-btn-primary" style={{ fontSize: 11, padding: '6px 12px' }}>
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
