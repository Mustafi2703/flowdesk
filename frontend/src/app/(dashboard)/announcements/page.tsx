import { getSession } from '@/lib/auth'
import AnnouncementsClient from '@/components/pages/AnnouncementsClient'

export default async function AnnouncementsPage() {
  const session = await getSession()
  return <AnnouncementsClient session={session!} />
}
