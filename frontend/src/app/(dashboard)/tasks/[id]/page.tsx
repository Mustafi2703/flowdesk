import { canAccessTasks } from '@/lib/auth'
import { requireRole } from '@/lib/page-guard'
import TaskDetailClient from '@/components/pages/TaskDetailClient'

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireRole(canAccessTasks)
  const { id } = await params
  return <TaskDetailClient session={session} taskId={id} />
}
