'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
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
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const syncMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const gap = 6
    const menuMaxH = 320
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow
    const maxHeight = Math.min(menuMaxH, openUp ? spaceAbove - gap : spaceBelow - gap)

    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(160, maxHeight),
      zIndex: 10050,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    })
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    syncMenuPosition()
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onReposition() {
      syncMenuPosition()
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, syncMenuPosition])

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

  const menu = open ? (
    <div
      ref={menuRef}
      className="sf-people-picker-menu"
      style={menuStyle}
      role="listbox"
      aria-multiselectable="true"
    >
      <div className="sf-people-picker-menu-search">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, designation, department…"
          className="sf-input"
          style={{ fontSize: 12, padding: '8px 10px' }}
        />
      </div>
      <div className="sf-people-picker-menu-list">
        {filtered.length === 0 && (
          <div className="sf-people-picker-menu-empty">No matches</div>
        )}
        {groups.map((g) => (
          <div key={g.key}>
            {groupByRole && g.items.length > 0 && (
              <div className="sf-people-picker-menu-group">{g.label}</div>
            )}
            {g.items.map((u) => {
              const on = selectedIds.some((x) => sameUserId(x, u.id))
              return (
                <button
                  key={u.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(u.id)}
                  className={`sf-people-picker-menu-item${on ? ' is-selected' : ''}`}
                >
                  <div className={`sf-people-picker-check${on ? ' is-on' : ''}`}>
                    {on ? '✓' : ''}
                  </div>
                  <div className="sf-people-picker-avatar">
                    {u.avatar || u.name?.slice(0, 2) || '?'}
                  </div>
                  <div className="sf-people-picker-meta">
                    <div className="sf-people-picker-name">{u.name}</div>
                    <div className="sf-people-picker-sub">
                      {[u.designation || ROLE_LABEL[u.role || ''] || u.role, u.department].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="sf-people-picker-menu-foot">
        <span>{selectedIds.length} selected</span>
        <button type="button" className="sf-btn sf-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setOpen(false)}>Done</button>
      </div>
    </div>
  ) : null

  return (
    <div ref={rootRef} className="sf-people-picker">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
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

      {typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
