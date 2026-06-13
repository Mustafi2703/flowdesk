import { getSession } from '@/lib/auth'
import BrandsClient from '@/components/pages/BrandsClient'

export default async function BrandsPage() {
  const session = await getSession()
  return <BrandsClient session={session!} />
}
