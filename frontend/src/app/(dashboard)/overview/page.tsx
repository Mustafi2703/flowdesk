import { getSession } from '@/lib/auth'
import OverviewClient from '@/components/pages/OverviewClient'

export default async function OverviewPage() {
  const session = await getSession()
  return <OverviewClient session={session!} />
}
