import { canAccessTeam } from '@/lib/auth'
import { requireRole } from '@/lib/page-guard'
import TeamClient from '@/components/pages/TeamClient'

export default async function TeamPage() {
  const session = await requireRole(canAccessTeam)
  return <TeamClient session={session} />
}
