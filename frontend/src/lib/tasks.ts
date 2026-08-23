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
  if (current === 'Not Started') return ['Not Started', 'In Progress']
  if (current === 'Under Review') return ['Under Review']
  const active: TaskStatus[] = ['In Progress', 'On Hold', 'Struggling', 'Needs Attention']
  if (current === 'Revision Needed') active.push('Revision Needed')
  if (!task?.requires_review) active.push('Completed')
  return active
}

export function isClockedInToday(attendance: any[], userId: string, today?: string) {
  const day = today || todayIST()
  return attendance.some(
    (a) => sameUserId(a.user_id, userId) && a.date === day && a.login_time && !a.logout_time
  )
}
