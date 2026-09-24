/** Stable accent color per department name (for avatars and roster chips). */
const PALETTE = [
  '#E8630A',
  '#2563EB',
  '#7C3AED',
  '#059669',
  '#DB2777',
  '#0891B2',
  '#CA8A04',
  '#4F46E5',
]

export function departmentColor(department?: string | null): string {
  const key = (department || '').trim().toLowerCase()
  if (!key) return 'var(--sf-accent)'
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}
