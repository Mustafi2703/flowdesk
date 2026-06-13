import { getSession } from '@/lib/auth'
import BillingClient from '@/components/pages/BillingClient'

export default async function BillingPage() {
  const session = await getSession()
  return <BillingClient session={session!} />
}
