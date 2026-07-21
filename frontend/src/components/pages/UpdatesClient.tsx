// @ts-nocheck
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SessionUser, ROLE_COLORS, STATUS_BG, STATUS_TEXT } from '@/types'
import { PageHeader, PageShell } from '@/components/app/Section'
import { FileAttachmentsPanel } from '@/components/app/FileAttachmentsPanel'
import { sameUserId } from '@/lib/tasks'

const TASK_STATUSES = ['Not Started', 'In Progress', 'Under Review', 'Revision Needed', 'Completed', 'On Hold', 'Struggling', 'Needs Attention']
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']
const WORKFLOW_STAGES = ['assigned', 'design', 'content', 'editing', 'approval', 'delivered']

/**
 * Slack-style Updates: brand filter → task channels → chat.
 * When a brand is selected, brand fields are editable (owner/manager).
 */
export default function UpdatesClient({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const [updates, setUpdates] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [thread, setThread] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [savingBrand, setSavingBrand] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [brandDraft, setBrandDraft] = useState<any>(null)
  const [docsOpen, setDocsOpen] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [closing, setClosing] = useState(false)
  const channelScrollRef = useRef<HTMLDivElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const isMgmt = ['owner', 'manager'].includes(session.role)
  const deepLinkHandled = useRef(false)

  async function loadFeed() {
    const [u, t, peeps, b] = await Promise.all([
      fetch('/api/updates').then((r) => r.json()),
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()).catch(() => []),
      fetch('/api/brands').then((r) => r.json()).catch(() => []),
    ])
    setUpdates(Array.isArray(u) ? u : [])
    setTasks(Array.isArray(t) ? t : [])
    setUsers(Array.isArray(peeps) ? peeps : [])
    setBrands(Array.isArray(b) ? b : [])
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

  // Open task from /updates?task=… (notification deep link)
  useEffect(() => {
    if (loading || deepLinkHandled.current) return
    const taskId = searchParams.get('task')
    if (!taskId) return
    const task = tasks.find((t) => String(t.id) === String(taskId))
    if (!task) return
    deepLinkHandled.current = true
    if (task.brand_id) setBrandFilter(String(task.brand_id))
    loadThread(task.id)
  }, [loading, tasks, searchParams])

  useEffect(() => {
    setDocsOpen(false)
  }, [selectedTaskId])

  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [thread.length, selectedTaskId])

  const selectedBrand = useMemo(() => {
    if (brandFilter === 'all' || brandFilter === 'none') return null
    return brands.find((b) => String(b.id) === String(brandFilter)) || null
  }, [brands, brandFilter])

  useEffect(() => {
    if (!selectedBrand) {
      setBrandDraft(null)
      return
    }
    setBrandDraft({
      description: selectedBrand.description || '',
      responsibilities: selectedBrand.responsibilities || '',
      priority: selectedBrand.priority || 'P2',
      client_type: selectedBrand.client_type || 'Retainer',
      workflow_stage: selectedBrand.workflow_stage || 'assigned',
      short_term_goals: (selectedBrand.short_term_goals || []).join('\n'),
      long_term_goals: (selectedBrand.long_term_goals || []).join('\n'),
    })
  }, [selectedBrand?.id, selectedBrand?.updated_at])

  useEffect(() => {
    if (!selectedTaskId) return
    const stillVisible = tasks.some((t) => {
      if (t.id !== selectedTaskId) return false
      if (brandFilter === 'all') return true
      if (brandFilter === 'none') return !t.brand_id
      return String(t.brand_id) === String(brandFilter)
    })
    if (!stillVisible) {
      setSelectedTaskId(null)
      setThread([])
    }
  }, [brandFilter, tasks, selectedTaskId])

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

  async function saveBrand() {
    if (!selectedBrand || !brandDraft || !isMgmt) return
    setSavingBrand(true)
    const res = await fetch(`/api/brands/${selectedBrand.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: brandDraft.description,
        responsibilities: brandDraft.responsibilities,
        priority: brandDraft.priority,
        client_type: brandDraft.client_type,
        workflow_stage: brandDraft.workflow_stage,
        short_term_goals: brandDraft.short_term_goals.split('\n').map((s: string) => s.trim()).filter(Boolean),
        long_term_goals: brandDraft.long_term_goals.split('\n').map((s: string) => s.trim()).filter(Boolean),
      }),
    })
    setSavingBrand(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not save brand')
      return
    }
    loadFeed()
  }

  async function patchTask(fields: Record<string, unknown>) {
    if (!selectedTaskId || !isMgmt) return
    setSavingTask(true)
    const res = await fetch(`/api/tasks/${selectedTaskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    setSavingTask(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not update task')
      return
    }
    loadFeed()
  }

  async function closeChannel(purge = true) {
    if (!selectedTaskId || !isMgmt) return
    const msg = purge
      ? 'Close this Updates channel and delete chat history to free storage?'
      : 'Close this Updates channel (keep chat history, no new messages)?'
    if (!window.confirm(msg)) return
    setClosing(true)
    const res = await fetch(`/api/tasks/${selectedTaskId}/updates/close?purge=${purge ? 'true' : 'false'}`, { method: 'POST' })
    setClosing(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not close channel')
      return
    }
    const data = await res.json().catch(() => ({}))
    if (purge) setThread([])
    await loadFeed()
    if (data.purged_messages) {
      alert(`Channel closed. Removed ${data.purged_messages} message(s).`)
    }
  }

  async function reopenChannel() {
    if (!selectedTaskId || !isMgmt) return
    setClosing(true)
    const res = await fetch(`/api/tasks/${selectedTaskId}/updates/reopen`, { method: 'POST' })
    setClosing(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || data.detail || 'Could not reopen channel')
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
    if (brandFilter === 'none') list = tasks.filter((t) => !t.brand_id)
    else if (brandFilter !== 'all') list = tasks.filter((t) => String(t.brand_id) === String(brandFilter))

    // Hide closed / completed channels by default to save clutter & storage focus
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
      r.task.brand?.name?.toLowerCase().includes(q) ||
      (r.lastMessage || '').toLowerCase().includes(q)
    )
  }, [tasks, updates, query, brandFilter, showClosed])

  const selectedTask = tasks.find((t) => t.id === selectedTaskId)
  const assigneeNames = (selectedTask?.assigned_to || [])
    .map((id) => users.find((u) => sameUserId(u.id, id))?.name || 'Member')
    .filter(Boolean)

  const brandTabs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of tasks) {
      const key = t.brand_id ? String(t.brand_id) : 'none'
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return [
      { id: 'all', label: 'All', count: tasks.length },
      ...brands.map((b) => ({ id: String(b.id), label: b.name, count: counts.get(String(b.id)) || 0 })),
      { id: 'none', label: 'No brand', count: counts.get('none') || 0 },
    ]
  }, [brands, tasks])

  const inp = {
    width: '100%',
    padding: '8px 10px',
    background: 'var(--sf-surface)',
    border: '1px solid var(--sf-border)',
    borderRadius: 8,
    color: 'var(--sf-text)',
    fontSize: 12,
    fontFamily: "'DM Sans',sans-serif",
  }

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading chat…</div>

  return (
    <PageShell fill>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden', gap: '0.75rem' }}>
      <PageHeader
        title="Updates"
        subtitle={isMgmt ? 'Brand channels · close completed chats to free storage · who assigned is tracked' : 'Your assigned task channels'}
      />

      {/* Brand filter strip */}
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 4,
        flexShrink: 0,
        WebkitOverflowScrolling: 'touch',
        alignItems: 'center',
      }}>
        {brandTabs.map((tab) => {
          const active = brandFilter === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setBrandFilter(tab.id)}
              className="sf-btn"
              style={{
                flexShrink: 0,
                fontSize: 12,
                padding: '7px 12px',
                background: active ? 'var(--sf-accent)' : 'var(--sf-surface)',
                color: active ? '#fff' : 'var(--sf-text)',
                border: `1px solid ${active ? 'var(--sf-accent)' : 'var(--sf-border)'}`,
              }}
            >
              {tab.label}
              <span style={{ opacity: 0.75, marginLeft: 6 }}>{tab.count}</span>
            </button>
          )
        })}
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto', color: 'var(--sf-muted)', fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          Show closed / done
        </label>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedBrand ? 'minmax(240px, 300px) minmax(260px, 320px) minmax(0, 1fr)' : 'minmax(260px, 340px) minmax(0, 1fr)',
        gap: 0,
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        border: '1px solid var(--sf-border)',
        borderRadius: 14,
        background: 'var(--sf-surface)',
      }}>
        {/* Brand edit panel when selected */}
        {selectedBrand && brandDraft && (
          <div style={{
            borderRight: '1px solid var(--sf-border)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
            background: 'var(--sf-bg)',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--sf-border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {selectedBrand.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedBrand.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'linear-gradient(135deg,#E8630A,#1A1A2E)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 12, fontWeight: 700,
                  }}>
                    {(selectedBrand.logo || selectedBrand.name || '?').slice(0, 2)}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--sf-text)', fontWeight: 700, fontSize: 14, fontFamily: "'Space Grotesk',sans-serif" }}>{selectedBrand.name}</div>
                  <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginTop: 2 }}>
                    {isMgmt ? 'Edit brand · docs · logos' : 'Brand overview · docs'}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
              {(selectedBrand.logo_variants || []).length > 0 && (
                <div>
                  <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Logo variants</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(selectedBrand.logo_variants || []).map((v: string) => (
                      <span key={v} style={{
                        padding: '5px 8px', borderRadius: 7, fontSize: 11, fontWeight: 650,
                        background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', color: 'var(--sf-text)',
                      }}>{v}</span>
                    ))}
                  </div>
                </div>
              )}
              {[
                ['Client type', 'client_type', 'select', ['Retainer', 'Project-Based', 'One-Time', 'Internal']],
                ['Priority', 'priority', 'select', ['P1', 'P2', 'P3', 'P4']],
                ['Workflow', 'workflow_stage', 'select', WORKFLOW_STAGES],
              ].map(([label, key, , opts]) => (
                <div key={String(key)}>
                  <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
                  <select
                    disabled={!isMgmt}
                    value={brandDraft[key as string]}
                    onChange={(e) => setBrandDraft((d: any) => ({ ...d, [key as string]: e.target.value }))}
                    style={{ ...inp, cursor: isMgmt ? 'pointer' : 'default', opacity: isMgmt ? 1 : 0.85 }}
                  >
                    {(opts as string[]).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Description</label>
                <textarea
                  disabled={!isMgmt}
                  value={brandDraft.description}
                  onChange={(e) => setBrandDraft((d: any) => ({ ...d, description: e.target.value }))}
                  rows={3}
                  style={{ ...inp, resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Responsibilities</label>
                <textarea
                  disabled={!isMgmt}
                  value={brandDraft.responsibilities}
                  onChange={(e) => setBrandDraft((d: any) => ({ ...d, responsibilities: e.target.value }))}
                  rows={2}
                  style={{ ...inp, resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Short-term goals</label>
                <textarea
                  disabled={!isMgmt}
                  value={brandDraft.short_term_goals}
                  onChange={(e) => setBrandDraft((d: any) => ({ ...d, short_term_goals: e.target.value }))}
                  rows={2}
                  style={{ ...inp, resize: 'vertical' }}
                  placeholder="One per line"
                />
              </div>
              <div>
                <label style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Long-term goals</label>
                <textarea
                  disabled={!isMgmt}
                  value={brandDraft.long_term_goals}
                  onChange={(e) => setBrandDraft((d: any) => ({ ...d, long_term_goals: e.target.value }))}
                  rows={2}
                  style={{ ...inp, resize: 'vertical' }}
                  placeholder="One per line"
                />
              </div>
              {isMgmt && (
                <button type="button" className="sf-btn sf-btn-primary" disabled={savingBrand} onClick={saveBrand} style={{ fontSize: 12 }}>
                  {savingBrand ? 'Saving…' : 'Save brand'}
                </button>
              )}
              <FileAttachmentsPanel
                entityType="brand"
                entityId={selectedBrand.id}
                canUpload={isMgmt || (session.role === 'team' && (
                  (selectedBrand.assigned_members || []).some((id: string) => sameUserId(id, session.id)) ||
                  (selectedBrand.assigned_managers || []).some((id: string) => sameUserId(id, session.id))
                ))}
                title="Brand documents"
              />
            </div>
          </div>
        )}

        {/* Channel list */}
        <div style={{ borderRight: '1px solid var(--sf-border)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', background: 'var(--sf-surface-2)' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--sf-border)', flexShrink: 0 }}>
            <div style={{ color: 'var(--sf-text)', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
              Channels{selectedBrand ? ` · ${selectedBrand.name}` : ''}
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
                No task channels for this filter.
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
                    {task.brand?.name || 'No brand'} · {assignees} assignee{assignees === 1 ? '' : 's'}
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
              {selectedBrand
                ? `Select a ${selectedBrand.name} channel — or edit the brand on the left.`
                : 'Select a brand above, then open a task channel to chat.'}
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
                      {selectedTask.brand?.name || 'No brand'} · {selectedTask.type || 'Task'} · Due {selectedTask.due_date || '—'}
                      {selectedTask.assigned_by?.name ? ` · Assigned by ${selectedTask.assigned_by.name}` : ''}
                    </div>
                    <div style={{ color: 'var(--sf-text-secondary)', fontSize: 12, marginTop: 4 }}>
                      Assigned: {assigneeNames.length ? assigneeNames.join(', ') : 'Nobody yet'}
                      {selectedTask.updates_closed ? ' · Channel closed' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {isMgmt ? (
                    <>
                      <select
                        value={selectedTask.status}
                        disabled={savingTask}
                        onChange={(e) => patchTask({ status: e.target.value })}
                        style={{ ...inp, width: 'auto', cursor: 'pointer' }}
                      >
                        {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select
                        value={selectedTask.priority || 'Medium'}
                        disabled={savingTask}
                        onChange={(e) => patchTask({ priority: e.target.value })}
                        style={{ ...inp, width: 'auto', cursor: 'pointer' }}
                      >
                        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                      {selectedTask.updates_closed ? (
                        <button type="button" className="sf-btn sf-btn-ghost" disabled={closing} onClick={reopenChannel} style={{ fontSize: 11 }}>
                          {closing ? '…' : 'Reopen updates'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="sf-btn sf-btn-ghost"
                          disabled={closing}
                          onClick={() => closeChannel(true)}
                          style={{ fontSize: 11, color: 'var(--sf-danger)' }}
                          title="Close channel and delete chat history"
                        >
                          {closing ? '…' : 'Close & purge chat'}
                        </button>
                      )}
                    </>
                  ) : (
                    <span style={{
                      background: STATUS_BG[selectedTask.status] || '#F3F4F6',
                      color: STATUS_TEXT[selectedTask.status] || '#374151',
                      fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap',
                    }}>
                      {selectedTask.status}
                    </span>
                  )}
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => setDocsOpen((v) => !v)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--sf-muted)',
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      cursor: 'pointer',
                      padding: 0,
                      marginBottom: docsOpen ? 8 : 0,
                    }}
                  >
                    Task documents {docsOpen ? '▾' : '▸'}
                  </button>
                  {docsOpen && (
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      <FileAttachmentsPanel
                        entityType="task"
                        entityId={selectedTask.id}
                        canUpload
                        title="Files for this channel"
                      />
                    </div>
                  )}
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
                <div ref={bottomRef} />
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
                    This Updates channel is closed{selectedTask.status === 'Completed' ? ' (task completed)' : ''}.
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
