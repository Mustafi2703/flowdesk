import type { TaskStatus } from '@/types'

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
  return ['owner', 'manager', 'accountant'].includes(role)
}

export function canMarkTaskBilled(role: string) {
  return ['owner', 'accountant'].includes(role)
}

export function isClockedInToday(attendance: any[], userId: string, today?: string) {
  const day = today || new Date().toISOString().split('T')[0]
  return attendance.some(
    (a) => sameUserId(a.user_id, userId) && a.date === day && a.login_time && !a.logout_time
  )
}
