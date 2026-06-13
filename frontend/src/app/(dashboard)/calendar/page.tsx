import { getSession } from '@/lib/auth'
import CalendarClient from '@/components/pages/CalendarClient'

export default async function CalendarPage() {
  const session = await getSession()
  return <CalendarClient session={session!} />
}
