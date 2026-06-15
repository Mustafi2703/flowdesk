'use client'

import type { CSSProperties, ReactNode } from 'react'

type SectionProps = {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  flush?: boolean
  className?: string
  style?: CSSProperties
  bodyStyle?: CSSProperties
  /** Max height for scrollable body, e.g. "320px" or "100%" */
  maxBodyHeight?: string | number
  flex?: number | string
}

export function PageShell({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`sf-page ${className}`.trim()} style={style}>{children}</div>
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="sf-page-header">
      <h1 className="sf-page-title">{title}</h1>
      {subtitle && <p className="sf-page-sub">{subtitle}</p>}
    </div>
  )
}

export function Section({
  title,
  subtitle,
  action,
  children,
  flush = false,
  className = '',
  style,
  bodyStyle,
  maxBodyHeight,
  flex,
}: SectionProps) {
  return (
    <section className={`sf-section ${className}`.trim()} style={{ flex, ...style }}>
      <div className="sf-section-header">
        <div>
          <h2 className="sf-section-title">{title}</h2>
          {subtitle && <p className="sf-section-sub">{subtitle}</p>}
        </div>
        {action && <div className="sf-section-action">{action}</div>}
      </div>
      <div
        className={flush ? 'sf-section-body sf-section-body-flush' : 'sf-section-body'}
        style={{ maxHeight: maxBodyHeight, ...bodyStyle }}
      >
        {children}
      </div>
    </section>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="sf-stat-grid">{children}</div>
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent: string
}) {
  return (
    <div className="sf-stat-card" style={{ borderLeftColor: accent }}>
      <div className="sf-stat-label">{label}</div>
      <div className="sf-stat-value">{value}</div>
      {sub && <div className="sf-stat-sub">{sub}</div>}
    </div>
  )
}
