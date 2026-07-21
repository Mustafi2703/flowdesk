import { canAccessReview } from '@/lib/auth'
import { requireRole } from '@/lib/page-guard'
import ReviewClient from '@/components/pages/ReviewClient'

export default async function ReviewPage() {
  const session = await requireRole(canAccessReview)
  return <ReviewClient session={session} />
}
