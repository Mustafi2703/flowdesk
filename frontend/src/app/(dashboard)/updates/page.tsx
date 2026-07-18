import { requireSession } from '@/lib/page-guard'
import UpdatesClient from '@/components/pages/UpdatesClient'

export default async function UpdatesPage() {
  const session = await requireSession()
  return <UpdatesClient session={session} />
}
