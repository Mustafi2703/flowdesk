import { getSession } from '@/lib/auth'
import TeamClient from '@/components/pages/TeamClient'

export default async function TeamPage() {
  const session = await getSession()
  return <TeamClient session={session!} />
}
