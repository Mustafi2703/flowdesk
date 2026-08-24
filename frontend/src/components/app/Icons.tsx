'use client'

import type { CSSProperties, ReactNode } from 'react'

export type IconName =
  | 'dashboard'
  | 'calendar'
  | 'tasks'
  | 'code'
  | 'brands'
  | 'team'
  | 'performance'
  | 'attendance'
  | 'leave'
  | 'announcements'
  | 'billing'
  | 'key'
  | 'chevron-left'
  | 'chevron-right'
  | 'log-out'
  | 'sun'
  | 'moon'
  | 'megaphone'
  | 'folder'
  | 'map'
  | 'sparkles'
  | 'inbox'
  | 'bell'
  | 'review'
  | 'panel-left'

type IconProps = {
  name: IconName
  size?: number
  className?: string
  style?: CSSProperties
}

const paths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  tasks: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  code: (
    <>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </>
  ),
  brands: (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
    </>
  ),
  team: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  performance: (
    <>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
  attendance: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  leave: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </>
  ),
  announcements: (
    <>
      <path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M18 8v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8" />
      <path d="M6 12h8" />
    </>
  ),
  billing: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.5 12.5 8-8" />
      <path d="M18 5l2 2" />
    </>
  ),
  'chevron-left': <path d="m15 18-6-6 6-6" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  'log-out': (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />,
  megaphone: (
    <>
      <path d="m3 11 18-5v12L3 14v-3Z" />
      <path d="M11 6v12" />
    </>
  ),
  folder: (
    <>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
      <path d="M9 3v15M15 6v15" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5Z" />
      <path d="M19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  review: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  'panel-left': (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </>
  ),
}

export function Icon({ name, size = 18, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {paths[name]}
    </svg>
  )
}

export type NavTone = { bg: string; fg: string; border: string }

export const NAV_ICON_TONES: Record<string, NavTone> = {
  overview: { bg: 'rgba(234, 88, 12, 0.16)', fg: '#ea580c', border: 'rgba(234, 88, 12, 0.32)' },
  calendar: { bg: 'rgba(37, 99, 235, 0.14)', fg: '#2563eb', border: 'rgba(37, 99, 235, 0.28)' },
  tasks: { bg: 'rgba(124, 58, 237, 0.14)', fg: '#7c3aed', border: 'rgba(124, 58, 237, 0.28)' },
  updates: { bg: 'rgba(6, 182, 212, 0.14)', fg: '#0891b2', border: 'rgba(6, 182, 212, 0.28)' },
  devboard: { bg: 'rgba(16, 185, 129, 0.14)', fg: '#059669', border: 'rgba(16, 185, 129, 0.28)' },
  brands: { bg: 'rgba(236, 72, 153, 0.14)', fg: '#db2777', border: 'rgba(236, 72, 153, 0.28)' },
  meetings: { bg: 'rgba(11, 106, 120, 0.14)', fg: '#0B6A78', border: 'rgba(11, 106, 120, 0.28)' },
  review: { bg: 'rgba(245, 158, 11, 0.14)', fg: '#d97706', border: 'rgba(245, 158, 11, 0.28)' },
  team: { bg: 'rgba(99, 102, 241, 0.14)', fg: '#6366f1', border: 'rgba(99, 102, 241, 0.28)' },
  performance: { bg: 'rgba(20, 184, 166, 0.14)', fg: '#0d9488', border: 'rgba(20, 184, 166, 0.28)' },
  attendance: { bg: 'rgba(34, 197, 94, 0.14)', fg: '#16a34a', border: 'rgba(34, 197, 94, 0.28)' },
  leave: { bg: 'rgba(168, 85, 247, 0.14)', fg: '#9333ea', border: 'rgba(168, 85, 247, 0.28)' },
  announcements: { bg: 'rgba(239, 68, 68, 0.12)', fg: '#dc2626', border: 'rgba(239, 68, 68, 0.26)' },
  billing: { bg: 'rgba(234, 179, 8, 0.14)', fg: '#ca8a04', border: 'rgba(234, 179, 8, 0.28)' },
}

export function navTone(navId: string): NavTone {
  return NAV_ICON_TONES[navId] || NAV_ICON_TONES.overview
}

export function NavIconBadge({
  name,
  navId,
  size = 16,
  active = false,
  className = '',
}: {
  name: IconName
  navId: string
  size?: number
  active?: boolean
  className?: string
}) {
  const tone = navTone(navId)
  return (
    <span
      className={`sf-nav-icon-badge${active ? ' is-active' : ''} ${className}`.trim()}
      style={{
        '--nav-fg': tone.fg,
        '--nav-bg': tone.bg,
        '--nav-border': tone.border,
      } as CSSProperties}
    >
      <Icon name={name} size={size} style={{ color: tone.fg }} />
    </span>
  )
}

export function DashTileIcon({ name, navId }: { name: IconName; navId: string }) {
  return <NavIconBadge name={name} navId={navId} size={18} className="sf-dash-tile-icon" />
}

export function EmptyState({ icon, title }: { icon: IconName; title: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 48, color: 'var(--sf-muted-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--sf-muted)' }}>
        <Icon name={icon} size={40} />
      </div>
      <div>{title}</div>
    </div>
  )
}
