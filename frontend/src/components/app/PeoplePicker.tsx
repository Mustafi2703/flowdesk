'use client'

import { sameUserId } from '@/lib/tasks'

/** Click-to-toggle assignee chips — safer than multi-select HTML. */
export function PeoplePicker({
  users,
  selectedIds,
  onChange,
  emptyLabel = 'No people available',
}: {
  users: Array<{ id: string; name: string; department?: string | null; role?: string }>
  selectedIds: string[]
  onChange: (ids: string[]) => void
  emptyLabel?: string
}) {
  function toggle(id: string) {
    const has = selectedIds.some((x) => sameUserId(x, id))
    onChange(has ? selectedIds.filter((x) => !sameUserId(x, id)) : [...selectedIds, id])
  }

  if (!users.length) {
    return <div style={{ color: 'var(--sf-muted-2)', fontSize: 12 }}>{emptyLabel}</div>
  }

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
              style={{
                padding: '6px 10px',
                background: on ? 'rgba(16,185,129,0.15)' : 'var(--sf-surface-2)',
                border: `1px solid ${on ? '#10B981' : 'var(--sf-border-strong)'}`,
                borderRadius: 7,
                color: on ? '#10B981' : 'var(--sf-muted)',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              {u.name}
            </button>
          )
        })}
      </div>
      <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginTop: 6 }}>
        {selectedIds.length} selected
        {selectedIds.length > 0 &&
          `: ${selectedIds.map((id) => users.find((u) => sameUserId(u.id, id))?.name || 'Member').join(', ')}`}
      </div>
    </div>
  )
}
