import { Suspense } from 'react'
import { getSession } from '@/lib/auth'
import BrandsClient from '@/components/pages/BrandsClient'

export default async function BrandsPage() {
  const session = await getSession()
  return (
    <Suspense fallback={<div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading brands…</div>}>
      <BrandsClient session={session!} />
    </Suspense>
  )
}
