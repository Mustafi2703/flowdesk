import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import Sidebar from '@/components/app/Sidebar'
import { TopBar } from '@/components/app/TopBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  return (
    <div className="sf-app-shell">
      <Sidebar session={session} />
      <main className="sf-app-main">
        <TopBar />
        <div className="sf-main-scroll">{children}</div>
      </main>
    </div>
  )
}
