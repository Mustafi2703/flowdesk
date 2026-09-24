import type { Metadata } from 'next'
import './theme-options.css'

export const metadata: Metadata = {
  title: 'Theme options · Scrumfolks TMS',
  description: 'Client colour theme previews for Scrumfolks TMS',
}

/** Standalone layout — no dashboard shell; styles loaded from server for reliable local dev. */
export default function ThemeOptionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="tp-root">
      {children}
    </div>
  )
}
