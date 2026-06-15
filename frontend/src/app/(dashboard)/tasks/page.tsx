import { canAccessDevBoard, canAccessPerformance, canAccessTasks, canAccessTeam, canViewBilling } from '@/lib/auth'
import { requireRole } from '@/lib/page-guard'
import TasksClient from '@/components/pages/TasksClient'

export default async function TasksPage() {
  const session = await requireRole(canAccessTasks)
  return <TasksClient session={session} />
}
