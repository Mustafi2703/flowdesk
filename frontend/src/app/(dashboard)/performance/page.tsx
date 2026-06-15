import { canAccessPerformance } from '@/lib/auth'
import { requireRole } from '@/lib/page-guard'
import PerformanceClient from '@/components/pages/PerformanceClient'

export default async function PerformancePage() {
  const session = await requireRole(canAccessPerformance)
  return <PerformanceClient session={session} />
}
