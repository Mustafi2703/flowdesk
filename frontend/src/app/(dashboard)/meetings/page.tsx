import { requireRole } from '@/lib/page-guard'
import { canAccessMeetings } from '@/lib/auth'
import MeetingsClient from '@/components/pages/MeetingsClient'

export default async function MeetingsPage() {
  const session = await requireRole(canAccessMeetings)
  return <MeetingsClient session={session} />
}
