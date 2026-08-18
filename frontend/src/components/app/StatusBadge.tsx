'use client'

import { STATUS_BG, STATUS_TEXT } from '@/types'

export function StatusBadge({ status }: { status?: string | null }) {
  const label = status || 'Not Started'
  return (
    <span style={{
      background: STATUS_BG[label] || '#F3F4F6',
      color: STATUS_TEXT[label] || '#374151',
      fontSize: 10,
      fontWeight: 700,
      padding: '3px 8px',
      borderRadius: 5,
      whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      {label}
    </span>
  )
}
