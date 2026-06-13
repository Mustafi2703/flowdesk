/** Shared inline styles using CSS variables — theme-aware across Night/Morning. */

export const ui = {
  bg: 'var(--sf-bg)',
  surface: 'var(--sf-surface)',
  surface2: 'var(--sf-surface-2)',
  border: 'var(--sf-border)',
  borderStrong: 'var(--sf-border-strong)',
  text: 'var(--sf-text)',
  textSecondary: 'var(--sf-text-secondary)',
  muted: 'var(--sf-muted)',
  muted2: 'var(--sf-muted-2)',
  accent: 'var(--sf-accent)',
  accentSoft: 'var(--sf-accent-soft)',
  inputBg: 'var(--sf-input-bg)',
  shadow: 'var(--sf-shadow)',
  success: 'var(--sf-success)',
  danger: 'var(--sf-danger)',
} as const

export const card = (extra?: Record<string, string | number>): Record<string, string | number> => ({
  background: ui.surface,
  border: `1px solid ${ui.border}`,
  borderRadius: 12,
  boxShadow: ui.shadow,
  ...extra,
})

export const pageHeader = {
  marginBottom: 24,
} as const
