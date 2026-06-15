import { canViewBilling } from '@/lib/auth'
import { requireRole } from '@/lib/page-guard'
import BillingClient from '@/components/pages/BillingClient'

export default async function BillingPage() {
  const session = await requireRole(canViewBilling)
  return <BillingClient session={session} />
}
