import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import Sidebar from '@/components/app/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: 'var(--sf-bg)',
        overflow: 'hidden',
      }}
    >
      <Sidebar session={session} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem' }}>{children}</div>
      </main>
    </div>
  )
}
