/** Stable accent colours per department / discipline (chips & avatars).
 * App chrome stays orange/black; these colours only mark people/teams.
 */
const NAMED: Record<string, string> = {
  owner: '#E8630A',
  manager: '#2563EB',
  team: '#059669',
  accounts: '#CA8A04',
  accountant: '#CA8A04',
  hr: '#DB2777',
  design: '#7C3AED',
  content: '#0891B2',
  editing: '#EA580C',
  video: '#4F46E5',
  strategy: '#0D9488',
  operations: '#64748B',
  development: '#1D4ED8',
  developer: '#1D4ED8',
}

const FALLBACK = [
  '#E8630A',
  '#2563EB',
  '#7C3AED',
  '#059669',
  '#DB2777',
  '#0891B2',
  '#CA8A04',
  '#4F46E5',
  '#0D9488',
  '#EA580C',
]

export function departmentColor(department?: string | null): string {
  const key = (department || '').trim().toLowerCase()
  if (!key) return 'var(--sf-accent)'
  if (NAMED[key]) return NAMED[key]
  // Prefix match e.g. "Design Team" → design
  for (const [name, color] of Object.entries(NAMED)) {
    if (key.includes(name)) return color
  }
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return FALLBACK[hash % FALLBACK.length]
}
