'use client'

import { useEffect, type CSSProperties, type ReactNode } from 'react'

/** Fixed overlay dialog — keeps page scroll stable while forms/summaries are open. */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 560,
  zIndex = 100,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: number | string
  zIndex?: number
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const panelStyle: CSSProperties = {
    width: typeof width === 'number' ? `min(${width}px, 100%)` : width,
    maxHeight: 'min(88vh, 820px)',
    background: 'var(--sf-surface)',
    border: '1px solid var(--sf-border)',
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={panelStyle}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sf-border)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--sf-text)', fontWeight: 700, fontSize: 17, fontFamily: "'Space Grotesk',sans-serif" }}>{title}</div>
            {subtitle && <div style={{ color: 'var(--sf-muted)', fontSize: 12, marginTop: 4 }}>{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} className="sf-btn sf-btn-ghost" style={{ fontSize: 18, lineHeight: 1, padding: '4px 10px' }} aria-label="Close">
            ×
          </button>
        </div>
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sf-border)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
