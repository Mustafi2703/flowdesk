import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import Sidebar from '@/components/app/Sidebar'
import { TopBar } from '@/components/app/TopBar'

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
        <TopBar />
        <div className="sf-main-scroll">{children}</div>
      </main>
    </div>
  )
}
