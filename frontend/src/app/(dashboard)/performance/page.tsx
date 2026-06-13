import { getSession } from '@/lib/auth'
import PerformanceClient from '@/components/pages/PerformanceClient'

export default async function PerformancePage() {
  const session = await getSession()
  return <PerformanceClient session={session!} />
}
