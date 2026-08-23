'use client'

import type { CSSProperties } from 'react'
import { STATUS_BG, STATUS_TEXT } from '@/types'

const STATUS_CLASS: Record<string, string> = {
  'Not Started': 'sf-status-pill-neutral',
  'In Progress': 'sf-status-pill-progress',
  'Under Review': 'sf-status-pill-review',
  'Revision Needed': 'sf-status-pill-revision',
  Completed: 'sf-status-pill-done',
  'On Hold': 'sf-status-pill-neutral',
  Struggling: 'sf-status-pill-danger',
  'Needs Attention': 'sf-status-pill-warning',
}

export function statusTint(status?: string | null): CSSProperties {
  const label = status || 'Not Started'
  return {
    background: STATUS_BG[label] || 'var(--sf-surface-2)',
    color: STATUS_TEXT[label] || 'var(--sf-text-secondary)',
  }
}

export function StatusBadge({ status }: { status?: string | null }) {
  const label = status || 'Not Started'
  const cls = STATUS_CLASS[label] || 'sf-status-pill-neutral'
  return (
    <span className={`sf-status-pill ${cls}`}>
      {label}
    </span>
  )
}

export function ReviewBadge({ status }: { status?: string | null }) {
  const s = (status || 'none').toLowerCase()
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: 'Approved', cls: 'sf-status-pill-done' },
    rejected: { label: 'Rejected', cls: 'sf-status-pill-revision' },
    pending: { label: 'Pending review', cls: 'sf-status-pill-review' },
    none: { label: 'No review', cls: 'sf-status-pill-neutral' },
  }
  const row = map[s] || map.none
  return <span className={`sf-status-pill ${row.cls}`}>{row.label}</span>
}
