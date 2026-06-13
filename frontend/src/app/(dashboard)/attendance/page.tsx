import { getSession } from '@/lib/auth'
import AttendanceClient from '@/components/pages/AttendanceClient'

export default async function AttendancePage() {
  const session = await getSession()
  return <AttendanceClient session={session!} />
}
