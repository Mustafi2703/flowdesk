import { THEME_PRESETS, type ThemePreset } from '@/lib/themePresets'

/** Shape / density / nav — independent of accent colour. */
export type UiChrome = {
  id: string
  label: string
  /** CSS values applied on preview root */
  tokens: {
    '--tp-radius-panel': string
    '--tp-radius-btn': string
    '--tp-radius-input': string
    '--tp-radius-pill': string
    '--tp-nav-width': string
    '--tp-shadow-panel': string
    '--tp-font-display': string
    '--tp-header-style': 'flat' | 'gradient' | 'campaign'
    '--tp-nav-labels': '0' | '1'
    '--tp-density': string
  }
}

export const UI_CHROME: Record<string, UiChrome> = {
  campaign: {
    id: 'campaign',
    label: 'Campaign command (client reference)',
    tokens: {
      '--tp-radius-panel': '6px',
      '--tp-radius-btn': '6px',
      '--tp-radius-input': '999px',
      '--tp-radius-pill': '6px',
      '--tp-nav-width': '168px',
      '--tp-shadow-panel': '0 12px 40px rgba(0,0,0,0.35)',
      '--tp-font-display': "'Space Grotesk', sans-serif",
      '--tp-header-style': 'campaign',
      '--tp-nav-labels': '1',
      '--tp-density': '1.05',
    },
  },
  erpFlat: {
    id: 'erpFlat',
    label: 'ERP flat · squared',
    tokens: {
      '--tp-radius-panel': '2px',
      '--tp-radius-btn': '2px',
      '--tp-radius-input': '2px',
      '--tp-radius-pill': '2px',
      '--tp-nav-width': '56px',
      '--tp-shadow-panel': 'none',
      '--tp-font-display': "'IBM Plex Sans', sans-serif",
      '--tp-header-style': 'flat',
      '--tp-nav-labels': '0',
      '--tp-density': '1',
    },
  },
  softRound: {
    id: 'softRound',
    label: 'Soft rounded · friendly',
    tokens: {
      '--tp-radius-panel': '16px',
      '--tp-radius-btn': '12px',
      '--tp-radius-input': '12px',
      '--tp-radius-pill': '999px',
      '--tp-nav-width': '180px',
      '--tp-shadow-panel': '0 8px 24px rgba(0,0,0,0.08)',
      '--tp-font-display': "'Manrope', sans-serif",
      '--tp-header-style': 'gradient',
      '--tp-nav-labels': '1',
      '--tp-density': '1.08',
    },
  },
  hybrid: {
    id: 'hybrid',
    label: 'Hybrid · square cards, round nav',
    tokens: {
      '--tp-radius-panel': '4px',
      '--tp-radius-btn': '8px',
      '--tp-radius-input': '8px',
      '--tp-radius-pill': '999px',
      '--tp-nav-width': '160px',
      '--tp-shadow-panel': '0 4px 16px rgba(0,0,0,0.12)',
      '--tp-font-display': "'Space Grotesk', sans-serif",
      '--tp-header-style': 'flat',
      '--tp-nav-labels': '1',
      '--tp-density': '1',
    },
  },
}

export type UiStylePackage = {
  id: string
  name: string
  subtitle: string
  ownerFocus?: boolean
  recommended?: string
  chromeId: keyof typeof UI_CHROME
  presetId: string
  /** Which mode to emphasize in docs */
  defaultMode: 'light' | 'dark'
}

export const UI_STYLE_PACKAGES: UiStylePackage[] = [
  {
    id: 'owner-campaign-dark',
    name: 'Owner · Campaign Command',
    subtitle: 'Dark workflow board, capacity grid, gradient titles — matches shared references',
    ownerFocus: true,
    recommended: 'Best for owner sign-off',
    chromeId: 'campaign',
    presetId: 'ember-noir',
    defaultMode: 'dark',
  },
  {
    id: 'owner-sunset-erp',
    name: 'Owner · Sunset ERP Flat',
    subtitle: 'Warm orange accent, squared panels, dense tables — classic ERP',
    ownerFocus: true,
    chromeId: 'erpFlat',
    presetId: 'sunset-ops',
    defaultMode: 'light',
  },
  {
    id: 'owner-violet-soft',
    name: 'Owner · Violet Studio Soft',
    subtitle: 'Purple accent, rounded cards, labelled sidebar — creative agency feel',
    ownerFocus: true,
    chromeId: 'softRound',
    presetId: 'violet-studio',
    defaultMode: 'light',
  },
  {
    id: 'manager-forest-square',
    name: 'Manager · Forest Squared',
    subtitle: 'Green accent, square modals, compact nav icons',
    chromeId: 'erpFlat',
    presetId: 'forest-desk',
    defaultMode: 'dark',
  },
  {
    id: 'team-hybrid-light',
    name: 'Team · Hybrid Light',
    subtitle: 'Readable light UI, pill filters, square task cards',
    chromeId: 'hybrid',
    presetId: 'sunset-ops',
    defaultMode: 'light',
  },
  {
    id: 'global-ember-flat',
    name: 'Global · Ember Noir Flat',
    subtitle: 'Maximum contrast dark, orange accent, zero rounding',
    chromeId: 'erpFlat',
    presetId: 'ember-noir',
    defaultMode: 'dark',
  },
  {
    id: 'owner-jade-campaign',
    name: 'Owner · Jade Campaign',
    subtitle: 'Green accent with client workflow layout — capacity + task cards',
    ownerFocus: true,
    chromeId: 'campaign',
    presetId: 'jade-grove',
    defaultMode: 'dark',
  },
  {
    id: 'owner-mint-soft',
    name: 'Owner · Mint Fresh Soft',
    subtitle: 'Teal/mint greens, rounded panels, bright light mode',
    ownerFocus: true,
    chromeId: 'softRound',
    presetId: 'mint-fresh',
    defaultMode: 'light',
  },
  {
    id: 'owner-forest-erp',
    name: 'Owner · Forest ERP',
    subtitle: 'Classic forest green, squared ERP chrome',
    ownerFocus: true,
    chromeId: 'erpFlat',
    presetId: 'forest-desk',
    defaultMode: 'light',
  },
  {
    id: 'owner-ocean-hybrid',
    name: 'Owner · Ocean Cobalt',
    subtitle: 'Blue professional theme, hybrid nav + pills',
    ownerFocus: true,
    chromeId: 'hybrid',
    presetId: 'ocean-cobalt',
    defaultMode: 'light',
  },
  {
    id: 'owner-coral-round',
    name: 'Owner · Coral Studio',
    subtitle: 'Rose/coral accent, soft rounded cards',
    ownerFocus: true,
    chromeId: 'softRound',
    presetId: 'coral-studio',
    defaultMode: 'light',
  },
  {
    id: 'owner-slate-gold',
    name: 'Owner · Slate & Gold',
    subtitle: 'Executive slate neutrals with gold highlights',
    ownerFocus: true,
    chromeId: 'campaign',
    presetId: 'slate-gold',
    defaultMode: 'dark',
  },
]

export function getPresetById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id)
}

export function packageColorVars(pkg: UiStylePackage, mode: 'light' | 'dark'): Record<string, string> {
  const preset = getPresetById(pkg.presetId)
  if (!preset) return {}
  return mode === 'light' ? preset.light : preset.dark
}

export function packageChromeTokens(pkg: UiStylePackage): Record<string, string> {
  return { ...UI_CHROME[pkg.chromeId].tokens }
}
