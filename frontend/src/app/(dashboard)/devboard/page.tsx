import { canAccessDevBoard } from '@/lib/auth'
import { requireRole } from '@/lib/page-guard'
import DevBoardClient from '@/components/pages/DevBoardClient'

export default async function DevBoardPage() {
  const session = await requireRole(canAccessDevBoard)
  return <DevBoardClient session={session} />
}
