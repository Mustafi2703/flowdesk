'use client'

import Link from 'next/link'
import { OwnerUiShowcase } from '@/components/theme/OwnerUiShowcase'
import { UI_STYLE_PACKAGES } from '@/lib/uiStylePackages'

const OWNER_CAMPAIGN = UI_STYLE_PACKAGES.find((p) => p.id === 'owner-campaign-dark')!
const OWNER_SUNSET = UI_STYLE_PACKAGES.find((p) => p.id === 'owner-sunset-erp')!
const OWNER_VIOLET = UI_STYLE_PACKAGES.find((p) => p.id === 'owner-violet-soft')!
const OWNER_JADE = UI_STYLE_PACKAGES.find((p) => p.id === 'owner-jade-campaign')!
const OWNER_MINT = UI_STYLE_PACKAGES.find((p) => p.id === 'owner-mint-soft')!

export default function UiMockupsPage() {
  return (
    <div className="um-page">
      <header className="um-hero">
        <h1>Scrumfolks TMS — Owner UI mockups (full pages)</h1>
        <p>
          Every major view for sign-off: workflow (client reference style), dashboard, tasks, Updates, brands, review
          links, modals, mobile. Three owner packages below — different <em>shape</em> and colour, not just accent swap.
        </p>
        <p className="um-tip">
          Six packages + light/dark toggles: <Link href="/theme-options">/theme-options</Link> · No login
        </p>
      </header>

      <section className="um-block" id="owner-campaign">
        <h2 className="um-block-title">Recommended · Campaign Command (dark)</h2>
        <p className="um-block-desc">Gradient workflow title, capacity grid, task cards, brand-first Updates — matches shared refs.</p>
        <OwnerUiShowcase pkg={OWNER_CAMPAIGN} mode="dark" />
      </section>

      <section className="um-block" id="owner-sunset">
        <h2 className="um-block-title">Owner · Sunset ERP (light, squared)</h2>
        <p className="um-block-desc">Flat ERP panels, icon sidebar, dense tables.</p>
        <OwnerUiShowcase pkg={OWNER_SUNSET} mode="light" />
      </section>

      <section className="um-block" id="owner-violet">
        <h2 className="um-block-title">Owner · Violet Soft (rounded)</h2>
        <p className="um-block-desc">Labelled nav, rounded cards, softer shadows.</p>
        <OwnerUiShowcase pkg={OWNER_VIOLET} mode="light" />
      </section>

      <section className="um-block" id="owner-jade">
        <h2 className="um-block-title">Owner · Jade Campaign (green, dark)</h2>
        <p className="um-block-desc">Green accent with workflow dashboard layout.</p>
        <OwnerUiShowcase pkg={OWNER_JADE} mode="dark" />
      </section>

      <section className="um-block" id="owner-mint">
        <h2 className="um-block-title">Owner · Mint Fresh (green, light)</h2>
        <p className="um-block-desc">Teal/mint light mode, rounded panels.</p>
        <OwnerUiShowcase pkg={OWNER_MINT} mode="light" />
      </section>

      <section className="um-block">
        <h2 className="um-block-title">All packages + colour swatches</h2>
        <p className="um-block-desc">
          Manager, team, and global variants — compare strips on{' '}
          <Link href="/theme-options">theme-options</Link>.
        </p>
        <Link href="/theme-options" className="um-redirect-cta">
          Open full style picker →
        </Link>
      </section>

      <footer className="um-foot">Scrumfolks TMS · Owner mockups for client sign-off</footer>
    </div>
  )
}
