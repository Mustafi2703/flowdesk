import { redirect } from 'next/navigation'
import { getSession, canViewBilling } from '@/lib/auth'
import BillingClient from '@/components/pages/BillingClient'

export default async function BillingPage() {
  const session = await getSession()
  if (!session || !canViewBilling(session.role)) redirect('/overview')
  return <BillingClient session={session} />
}
