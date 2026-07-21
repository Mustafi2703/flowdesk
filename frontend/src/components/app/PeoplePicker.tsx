'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { sameUserId } from '@/lib/tasks'

type Person = {
  id: string
  name: string
  department?: string | null
  designation?: string | null
  role?: string
  avatar?: string | null
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  team: 'Team',
  hr: 'HR',
  accountant: 'Accounts',
}

/** Multi-select people picker — dropdown (default) or chip list, with designation. */
export function PeoplePicker({
  users,
  selectedIds,
  onChange,
  emptyLabel = 'No people available',
  variant = 'dropdown',
  placeholder = 'Assign people…',
  groupByRole = true,
}: {
  users: Person[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  emptyLabel?: string
  variant?: 'dropdown' | 'chips'
  placeholder?: string
  groupByRole?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function toggle(id: string) {
    const has = selectedIds.some((x) => sameUserId(x, id))
    onChange(has ? selectedIds.filter((x) => !sameUserId(x, id)) : [...selectedIds, id])
  }

  function remove(id: string) {
    onChange(selectedIds.filter((x) => !sameUserId(x, id)))
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const hay = [u.name, u.designation, u.department, u.role, ROLE_LABEL[u.role || '']].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [users, query])

  const groups = useMemo(() => {
    if (!groupByRole) return [{ key: 'all', label: 'People', items: filtered }]
    const order = ['manager', 'team', 'owner', 'hr', 'accountant']
    const map = new Map<string, Person[]>()
    for (const u of filtered) {
      const key = u.role || 'other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(u)
    }
    const keys = [...map.keys()].sort((a, b) => {
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    return keys.map((key) => ({
      key,
      label: ROLE_LABEL[key] || key,
      items: map.get(key) || [],
    }))
  }, [filtered, groupByRole])

  const selectedPeople = selectedIds
    .map((id) => users.find((u) => sameUserId(u.id, id)))
    .filter(Boolean) as Person[]

  if (!users.length) {
    return <div style={{ color: 'var(--sf-muted-2)', fontSize: 12 }}>{emptyLabel}</div>
  }

  if (variant === 'chips') {
    return (
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {users.map((u) => {
            const on = selectedIds.some((x) => sameUserId(x, u.id))
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                title={[u.designation, u.department].filter(Boolean).join(' · ') || u.role}
                style={{
                  padding: '7px 11px',
                  background: on ? 'rgba(16,185,129,0.15)' : 'var(--sf-surface-2)',
                  border: `1px solid ${on ? '#10B981' : 'var(--sf-border-strong)'}`,
                  borderRadius: 8,
                  color: on ? '#10B981' : 'var(--sf-text-secondary)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: "'DM Sans',sans-serif",
                  textAlign: 'left',
                  maxWidth: 220,
                }}
              >
                <div style={{ fontWeight: 650 }}>{u.name}</div>
                {(u.designation || u.department) && (
                  <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[u.designation, u.department].filter(Boolean).join(' · ')}
                  </div>
                )}
              </button>
            )
          })}
        </div>
        <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginTop: 6 }}>
          {selectedIds.length} selected
          {selectedPeople.length > 0 && `: ${selectedPeople.map((u) => u.name).join(', ')}`}
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="sf-input"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          cursor: 'pointer',
          textAlign: 'left',
          minHeight: 42,
          padding: '8px 12px',
        }}
      >
        <span style={{ color: selectedPeople.length ? 'var(--sf-text)' : 'var(--sf-muted)', fontSize: 13 }}>
          {selectedPeople.length
            ? `${selectedPeople.length} assigned`
            : placeholder}
        </span>
        <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>

      {selectedPeople.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {selectedPeople.map((u) => (
            <span
              key={u.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 8px',
                background: 'rgba(232,99,10,0.12)',
                border: '1px solid rgba(232,99,10,0.35)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--sf-text)',
              }}
            >
              <span style={{ fontWeight: 650 }}>{u.name}</span>
              {u.designation && <span style={{ color: 'var(--sf-muted)', fontSize: 10 }}>{u.designation}</span>}
              <button
                type="button"
                onClick={() => remove(u.id)}
                aria-label={`Remove ${u.name}`}
                style={{ background: 'none', border: 'none', color: 'var(--sf-muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 40,
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 6,
            background: 'var(--sf-surface)',
            border: '1px solid var(--sf-border)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 10, borderBottom: '1px solid var(--sf-border)' }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, designation, department…"
              className="sf-input"
              style={{ fontSize: 12, padding: '8px 10px' }}
            />
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: 16, color: 'var(--sf-muted)', fontSize: 12, textAlign: 'center' }}>No matches</div>
            )}
            {groups.map((g) => (
              <div key={g.key}>
                {groupByRole && g.items.length > 0 && (
                  <div style={{
                    padding: '8px 12px 4px',
                    color: 'var(--sf-muted)',
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    background: 'var(--sf-surface-2)',
                    position: 'sticky',
                    top: 0,
                  }}>
                    {g.label}
                  </div>
                )}
                {g.items.map((u) => {
                  const on = selectedIds.some((x) => sameUserId(x, u.id))
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggle(u.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        border: 'none',
                        borderBottom: '1px solid var(--sf-border)',
                        background: on ? 'rgba(16,185,129,0.1)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        border: `1.5px solid ${on ? '#10B981' : 'var(--sf-border-strong)'}`,
                        background: on ? '#10B981' : 'transparent',
                        color: '#fff', fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {on ? '✓' : ''}
                      </div>
                      <div style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        background: 'var(--sf-accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 11, fontWeight: 700,
                      }}>
                        {u.avatar || u.name?.slice(0, 2) || '?'}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: 'var(--sf-text)', fontSize: 13, fontWeight: 650 }}>{u.name}</div>
                        <div style={{ color: 'var(--sf-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[u.designation || ROLE_LABEL[u.role || ''] || u.role, u.department].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--sf-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{selectedIds.length} selected</span>
            <button type="button" className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  )
}
