/** Delivery phases for workflow dashboard — tasks only (brands do not have stages). */

export const WORKFLOW_PHASES = [
  { id: 'all', label: 'All Brands' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'design', label: 'Design Phase' },
  { id: 'content', label: 'Content Phase' },
  { id: 'editing', label: 'Editing' },
  { id: 'approval', label: 'Approval' },
  { id: 'delivered', label: 'Delivered' },
] as const

export type WorkflowPhaseId = (typeof WORKFLOW_PHASES)[number]['id']

export const PHASE_ORDER = ['assigned', 'design', 'content', 'editing', 'approval', 'delivered'] as const

export const PHASE_COLORS: Record<string, string> = {
  assigned: '#4a69bd',
  design: '#8854d0',
  content: '#20b2aa',
  editing: '#ff6b6b',
  approval: '#ffa502',
  delivered: '#26de81',
}

export function phaseLabel(id: string) {
  return WORKFLOW_PHASES.find((s) => s.id === id)?.label || id
}

/** Map a task to a dashboard phase from status + type (no brand workflow_stage). */
export function taskWorkflowPhase(task: {
  status?: string
  type?: string
}): string {
  const status = task?.status || 'Not Started'
  const type = (task?.type || '').toLowerCase()
  if (status === 'Completed') return 'delivered'
  if (status === 'Under Review') return 'approval'
  if (status === 'Revision Needed') return 'editing'
  if (status === 'Not Started' || status === 'On Hold') return 'assigned'
  if (status === 'In Progress' || status === 'Struggling' || status === 'Needs Attention') {
    if (type === 'design') return 'design'
    if (type === 'content') return 'content'
    return 'editing'
  }
  return 'assigned'
}

export function taskProgressSegments(task: { status?: string; sub_tasks?: { status?: string }[] }) {
  const subs = task.sub_tasks || []
  if (subs.length === 0) {
    const status = task.status || 'Not Started'
    if (status === 'Completed') return { filled: 8, total: 8 }
    if (status === 'Under Review') return { filled: 6, total: 8 }
    if (status === 'In Progress' || status === 'Revision Needed') return { filled: 4, total: 8 }
    return { filled: 1, total: 8 }
  }
  const total = Math.min(12, Math.max(8, subs.length))
  const done = subs.filter((s) => s.status === 'Completed').length
  const filled = Math.round((done / subs.length) * total)
  return { filled: Math.max(1, filled), total }
}
