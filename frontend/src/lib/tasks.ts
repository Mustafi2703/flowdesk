import type { TaskStatus } from '@/types'
import { todayIST } from '@/lib/clock'

export const TASK_STATUSES: TaskStatus[] = [
  'Not Started',
  'In Progress',
  'Under Review',
  'Revision Needed',
  'Completed',
  'On Hold',
  'Struggling',
  'Needs Attention',
]

const TEAM_ESCALATION: TaskStatus[] = ['On Hold', 'Struggling', 'Needs Attention']

export function sameUserId(a: string | null | undefined, b: string | null | undefined) {
  return String(a || '') === String(b || '')
}

export function isTaskAssignee(task: any, userId: string) {
  if ((task?.assigned_to || []).some((id: string) => sameUserId(id, userId))) return true
  return (task?.sub_tasks || []).some((st: any) =>
    (st.assigned_to || []).some((id: string) => sameUserId(id, userId))
  )
}

export function canManageTasks(role: string) {
  return ['owner', 'manager'].includes(role)
}

export function canSetTaskPrice(role: string) {
  return ['owner', 'accountant'].includes(role)
}

export function canMarkTaskBilled(role: string) {
  return ['owner', 'accountant'].includes(role)
}

/** Status options for assignees once a task is in the delivery workflow. */
export function allowedTaskStatuses(task: any, role: string): TaskStatus[] {
  if (canManageTasks(role)) return TASK_STATUSES
  const current = (task?.status || 'Not Started') as TaskStatus
  if (current === 'Completed') return ['Completed']

  if (task?.requires_review) {
    if (current === 'Under Review') return ['Under Review']
    if (current === 'Not Started') return ['Not Started', 'In Progress']
    if (current === 'In Progress' || current === 'Revision Needed') {
      const opts = [current, ...TEAM_ESCALATION]
      return [...new Set(opts)] as TaskStatus[]
    }
    return [current]
  }

  if (current === 'Not Started') return ['Not Started', 'In Progress']
  const active: TaskStatus[] = ['In Progress', 'On Hold', 'Struggling', 'Needs Attention']
  if (current === 'Revision Needed') active.push('Revision Needed')
  active.push('Completed')
  return active
}

/** Whether the UI should expose a status control (dropdown / patch) for this user. */
export function canManualStatusChange(task: any, role: string, userId?: string): boolean {
  if (canManageTasks(role)) return true
  if (userId && !isTaskAssignee(task, userId)) return false
  if (!task?.requires_review) return true
  const current = task?.status || 'Not Started'
  if (current === 'Not Started') return true
  if (current === 'In Progress' || current === 'Revision Needed') return true
  return false
}

/** Short guidance for review-gated tasks — status moves via upload + manager review. */
export function taskStatusFlowHint(task: any, role: string): string {
  if (!task?.requires_review) return ''
  const current = task?.status || 'Not Started'
  if (canManageTasks(role)) {
    if (current === 'Under Review') return 'Approve or reject this delivery. Reject sends the task back for revisions.'
    if (current === 'Revision Needed') return 'Waiting on assignee to upload a revised file — upload auto-sends it back to review.'
    return 'Assignees upload deliverables to move tasks into review. You approve or request revisions.'
  }
  if (current === 'Not Started') return 'Start work, then upload files — status moves to Under Review automatically.'
  if (current === 'In Progress') return 'Upload your deliverable to send this task for manager review.'
  if (current === 'Under Review') return 'With manager for review — you cannot change status until they approve or request revisions.'
  if (current === 'Revision Needed') return 'Apply revision notes, then upload again — status returns to Under Review automatically.'
  if (current === 'Completed') return 'This task is complete.'
  return 'Upload files to advance review tasks — status changes are automatic.'
}

export function isClockedInToday(attendance: any[], userId: string, today?: string) {
  const day = today || todayIST()
  return attendance.some(
    (a) => sameUserId(a.user_id, userId) && a.date === day && a.login_time && !a.logout_time
  )
}
