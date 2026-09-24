'use client'

import type { CSSProperties } from 'react'
import { THEME_PRESETS, type ThemePreset } from '@/lib/themePresets'

function MiniFrame({ preset, mode, vars }: { preset: ThemePreset; mode: 'light' | 'dark'; vars: Record<string, string> }) {
  return (
    <div className="tp-color-card" id={`palette-${preset.id}-${mode}`}>
      <div className="tp-color-card-head">
        <span className="tp-color-swatch" style={{ background: vars['--sf-accent'] }} />
        <div>
          <strong>{preset.name}</strong>
          <span>{mode === 'light' ? 'Light' : 'Dark'}</span>
        </div>
      </div>
      <div className="tp-color-frame" style={vars as CSSProperties}>
        <div className="tp-color-sidebar" />
        <div className="tp-color-main">
          <div className="tp-color-bar" />
          <div className="tp-color-kpi" />
          <div className="tp-color-kpi" />
        </div>
      </div>
    </div>
  )
}

export function ColorPaletteGrid({ mode }: { mode: 'light' | 'dark' }) {
  return (
    <div className="tp-color-grid">
      {THEME_PRESETS.map((preset) => (
        <MiniFrame
          key={`${preset.id}-${mode}`}
          preset={preset}
          mode={mode}
          vars={mode === 'light' ? preset.light : preset.dark}
        />
      ))}
    </div>
  )
}
