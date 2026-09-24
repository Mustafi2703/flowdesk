'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ColorPaletteGrid } from '@/components/theme/ColorPaletteGrid'
import { OwnerUiShowcase } from '@/components/theme/OwnerUiShowcase'
import { LoginThemeShowcase } from '@/components/theme/LoginThemeShowcase'
import { THEME_PRESETS } from '@/lib/themePresets'
import { getPresetById, UI_CHROME, UI_STYLE_PACKAGES, type UiStylePackage } from '@/lib/uiStylePackages'

function PackageCard({
  pkg,
  selected,
  onSelect,
}: {
  pkg: UiStylePackage
  selected: boolean
  onSelect: () => void
}) {
  const chrome = UI_CHROME[pkg.chromeId]
  const preset = getPresetById(pkg.presetId)
  const accent = preset?.dark['--sf-accent'] || '#ff6b1a'
  return (
    <button type="button" className={`tp-pick-card${selected ? ' is-selected' : ''}`} onClick={onSelect}>
      <div className="tp-pick-card-top">
        <span className="tp-pick-swatch" style={{ background: accent }} aria-hidden />
        <strong>{pkg.name}</strong>
        {pkg.recommended && <span className="tp-badge">{pkg.recommended}</span>}
        {pkg.ownerFocus && <span className="tp-badge tp-badge--owner">Owner</span>}
      </div>
      <p>{pkg.subtitle}</p>
      <div className="tp-pick-meta">
        <span>{chrome.label}</span>
        <span>Default: {pkg.defaultMode}</span>
      </div>
    </button>
  )
}

function ModeToggle({
  mode,
  onChange,
  large,
}: {
  mode: 'light' | 'dark'
  onChange: (m: 'light' | 'dark') => void
  large?: boolean
}) {
  return (
    <div className={`tp-mode-toggle${large ? ' tp-mode-toggle--large' : ''}`} role="tablist" aria-label="Light or dark mode">
      {(['light', 'dark'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          className={`tp-mode-btn${mode === m ? ' is-active' : ''}${m === 'light' ? ' tp-mode-btn--light' : ' tp-mode-btn--dark'}`}
          onClick={() => onChange(m)}
        >
          {m === 'light' ? '☀ Light mode' : '☾ Dark mode'}
        </button>
      ))}
    </div>
  )
}

export default function ThemeOptionsPage() {
  const ownerPackages = useMemo(() => UI_STYLE_PACKAGES.filter((p) => p.ownerFocus), [])
  const [activeId, setActiveId] = useState(ownerPackages[0]?.id ?? UI_STYLE_PACKAGES[0].id)
  const [mode, setMode] = useState<'light' | 'dark'>('dark')
  const [paletteMode, setPaletteMode] = useState<'light' | 'dark'>('light')

  const active = UI_STYLE_PACKAGES.find((p) => p.id === activeId) ?? UI_STYLE_PACKAGES[0]

  return (
    <div className="tp-page">
      <div className="tp-sticky-bar">
        <span className="tp-sticky-label">Preview mode</span>
        <ModeToggle mode={mode} onChange={setMode} large />
        <span className="tp-sticky-hint">Applies to owner showcase below</span>
      </div>

      <header className="tp-hero">
        <h1>Scrumfolks TMS — UI & colour options</h1>
        <p>
          <strong>{THEME_PRESETS.length} colour palettes</strong> (orange, purple, greens, blue, coral, gold…) plus{' '}
          <strong>{UI_STYLE_PACKAGES.length} full UI packages</strong> (shape + layout). Owner sign-off: pick palette +
          package + light or dark.
        </p>
        <p className="tp-hero-tip">
          Also see <Link href="/ui-mockups">/ui-mockups</Link> · No login required
        </p>
      </header>

      <section className="tp-picker-section" id="login-mockups">
        <h2 className="tp-section-title">Login — desktop & mobile (per palette)</h2>
        <p className="tp-section-lead">Same layout as production sign-in; accent follows each theme. Screenshot for client.</p>
        <div className="tp-login-grid">
          {(['sunset-ops', 'jade-grove', 'mint-fresh', 'ember-noir', 'ocean-cobalt'] as const).map((id) => {
            const preset = THEME_PRESETS.find((p) => p.id === id)!
            return (
              <LoginThemeShowcase
                key={id}
                preset={preset}
                mode={id === 'ember-noir' ? 'dark' : 'light'}
                vars={id === 'ember-noir' ? preset.dark : preset.light}
              />
            )
          })}
        </div>
      </section>

      <section className="tp-picker-section" id="colour-palettes">
        <div className="tp-section-head-row">
          <h2 className="tp-section-title">Colour palettes only</h2>
          <ModeToggle mode={paletteMode} onChange={setPaletteMode} />
        </div>
        <p className="tp-section-lead">Includes dedicated green themes: Jade Grove, Mint Fresh, Forest Desk.</p>
        <ColorPaletteGrid mode={paletteMode} />
      </section>

      <section className="tp-picker-section">
        <h2 className="tp-section-title">Full UI packages (colour + ERP shape)</h2>
        <div className="tp-pick-grid">
          {UI_STYLE_PACKAGES.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              selected={pkg.id === activeId}
              onSelect={() => {
                setActiveId(pkg.id)
                setMode(pkg.defaultMode)
              }}
            />
          ))}
        </div>
      </section>

      <section className="tp-active-section" id={active.id}>
        <div className="tp-active-head">
          <div>
            <h2>{active.name}</h2>
            <p>{active.subtitle}</p>
            <p className="tp-active-chrome">{UI_CHROME[active.chromeId].label}</p>
          </div>
          <ModeToggle mode={mode} onChange={setMode} large />
        </div>
        <OwnerUiShowcase pkg={active} mode={mode} />
      </section>

      <section className="tp-picker-section">
        <h2 className="tp-section-title">Quick compare (all packages)</h2>
        {UI_STYLE_PACKAGES.map((pkg) => (
          <div key={`cmp-${pkg.id}`} className="tp-compare-row">
            <div className="tp-compare-label">
              <strong>{pkg.name}</strong>
              <span>{UI_CHROME[pkg.chromeId].label}</span>
            </div>
            <OwnerUiShowcase pkg={pkg} mode={pkg.defaultMode} compact />
          </div>
        ))}
      </section>

      <footer className="tp-footer">
        QRYX Tech · Scrumfolks TMS · Pick palette + package + light/dark · {new Date().getFullYear()}
      </footer>
    </div>
  )
}
