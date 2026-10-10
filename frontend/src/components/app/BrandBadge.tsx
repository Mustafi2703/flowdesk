'use client'

import type { CSSProperties, MouseEventHandler } from 'react'

export type BrandLike = {
  id?: string
  name?: string
  logo?: string | null
  logo_url?: string | null
  updated_at?: string | null
  priority?: string | null
  client_type?: string | null
  workflow_stage?: string | null
}

const PRIORITY_ACCENT: Record<string, string> = {
  P1: '#DC2626',
  P2: '#EA580C',
  P3: '#2563EB',
  P4: '#64748B',
}

export function brandLogoSrc(brand?: BrandLike | null) {
  if (!brand?.logo_url) return null
  const stamp = brand.updated_at ? new Date(brand.updated_at).getTime() : ''
  return stamp ? `${brand.logo_url}?v=${stamp}` : brand.logo_url
}

export function brandAccent(priority?: string | null) {
  return PRIORITY_ACCENT[priority || ''] || 'var(--sf-accent)'
}

export function BrandLogoMark({ brand, size = 40 }: { brand: BrandLike; size?: number }) {
  const raw = String(brand.logo || brand.name || '?').trim()
  // Small tiles stay short; brand header marks can show longer fallback initials.
  const maxChars = size >= 100 ? 16 : size >= 72 ? 8 : size >= 48 ? 4 : 2
  const initials = (raw.length <= maxChars ? raw : raw.slice(0, maxChars)).toUpperCase()
  const src = brandLogoSrc(brand)
  const radius = size > 96 ? 20 : size > 72 ? 16 : size > 48 ? 12 : size > 36 ? 10 : 8
  const wide = !src && initials.length > 3
  const boxW = wide
    ? Math.min(Math.round(size * (0.42 + initials.length * 0.22)), Math.round(size * 2.6))
    : size
  const fontSize = Math.max(
    11,
    Math.round(size * (initials.length >= 8 ? 0.18 : initials.length >= 5 ? 0.22 : initials.length >= 3 ? 0.3 : 0.4))
  )

  if (src) {
    return (
      <img
        src={src}
        alt={brand.name || 'Brand'}
        width={size}
        height={size}
        className="sf-brand-logo-img"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    )
  }

  return (
    <div
      className="sf-brand-logo-fallback"
      style={{
        width: boxW,
        minWidth: boxW,
        height: size,
        borderRadius: radius,
        fontSize,
        letterSpacing: initials.length > 4 ? '-0.03em' : initials.length > 2 ? '-0.02em' : '0.02em',
        padding: wide ? '0 14px' : '0 6%',
        background: `linear-gradient(145deg, ${brandAccent(brand.priority)}, color-mix(in srgb, ${brandAccent(brand.priority)} 55%, #fff))`,
      }}
      aria-hidden
      title={raw}
    >
      {initials}
    </div>
  )
}

export function BrandTag({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: 'neutral' | 'priority' | 'stage' | 'type'
}) {
  return <span className={`sf-brand-tag sf-brand-tag-${tone}`}>{label}</span>
}

export function BrandBadge({
  brand,
  variant = 'inline',
  active = false,
  taskCount,
  stageLabel,
  onClick,
}: {
  brand?: BrandLike | null
  variant?: 'inline' | 'roster'
  active?: boolean
  taskCount?: number
  stageLabel?: string
  onClick?: MouseEventHandler<HTMLButtonElement>
}) {
  if (!brand?.name) {
    return <span className="sf-brand-badge sf-brand-badge-empty">No brand</span>
  }

  const accent = brandAccent(brand.priority)
  const style = { '--brand-accent': accent } as CSSProperties

  if (variant === 'roster') {
    const open = taskCount ?? 0
    return (
      <button
        type="button"
        className={`sf-brand-roster-item${active ? ' is-active' : ''}`}
        style={style}
        onClick={onClick}
      >
        <span className="sf-brand-roster-accent" aria-hidden />
        <BrandLogoMark brand={brand} size={40} />
        <span className="sf-brand-roster-copy">
          <span className="sf-brand-roster-name" title={brand.name}>{brand.name}</span>
          <span className="sf-brand-roster-meta">
            {open} task{open === 1 ? '' : 's'}
            {stageLabel ? ` · ${stageLabel}` : ''}
            {brand.client_type ? ` · ${brand.client_type}` : ''}
          </span>
        </span>
        {brand.priority && (
          <span className="sf-brand-roster-priority" title={`Priority ${brand.priority}`}>
            {brand.priority}
          </span>
        )}
      </button>
    )
  }

  return (
    <span className="sf-brand-badge" style={style} title={brand.name}>
      <BrandLogoMark brand={brand} size={18} />
      <span className="sf-brand-badge-name">{brand.name}</span>
    </span>
  )
}
