import { Suspense } from 'react'
import { requireSession } from '@/lib/page-guard'
import UpdatesClient from '@/components/pages/UpdatesClient'

export default async function UpdatesPage() {
  const session = await requireSession()
  return (
    <Suspense fallback={<div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading chat…</div>}>
      <UpdatesClient session={session} />
    </Suspense>
  )
}
