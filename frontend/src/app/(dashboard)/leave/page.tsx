import { getSession } from '@/lib/auth'
import LeaveClient from '@/components/pages/LeaveClient'

export default async function LeavePage() {
  const session = await getSession()
  return <LeaveClient session={session!} />
}
