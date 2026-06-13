import { getSession } from '@/lib/auth'
import TasksClient from '@/components/pages/TasksClient'

export default async function TasksPage() {
  const session = await getSession()
  return <TasksClient session={session!} />
}
