import { getSession } from '@/lib/auth'
import DevBoardClient from '@/components/pages/DevBoardClient'

export default async function DevBoardPage() {
  const session = await getSession()
  return <DevBoardClient session={session!} />
}
