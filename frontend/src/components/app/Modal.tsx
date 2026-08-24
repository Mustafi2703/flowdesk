'use client'

import { useEffect, type ReactNode } from 'react'

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
  size = 'default',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: number | string
  zIndex?: number
  size?: 'default' | 'wide' | 'full'
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

  const panelClass = [
    'sf-modal-panel',
    size === 'wide' ? 'sf-modal-panel-wide' : '',
    size === 'full' ? 'sf-modal-panel-full' : '',
  ].filter(Boolean).join(' ')

  const panelStyle = size === 'default' && width !== 560
    ? { width: typeof width === 'number' ? `min(${width}px, 100%)` : width }
    : undefined

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="sf-modal-overlay"
      style={{ zIndex }}
      onClick={onClose}
    >
      <div className={panelClass} style={panelStyle} onClick={e => e.stopPropagation()}>
        <div className="sf-modal-header">
          <div className="sf-modal-header-copy">
            <div className="sf-modal-title">{title}</div>
            {subtitle && <div className="sf-modal-subtitle">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sf-btn sf-btn-ghost sf-modal-close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="sf-modal-body">{children}</div>
        {footer && <div className="sf-modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
