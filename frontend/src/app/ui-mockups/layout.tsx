import type { Metadata } from 'next'
import '../theme-options/theme-options.css'
import './ui-mockups.css'

export const metadata: Metadata = {
  title: 'ERP UI mockups · Scrumfolks TMS',
  description: 'Client-ready screen mockups — login, dashboard, tasks, updates, brands, mobile',
}

export default function UiMockupsLayout({ children }: { children: React.ReactNode }) {
  return <div className="um-root">{children}</div>
}
