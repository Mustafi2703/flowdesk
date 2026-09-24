'use client'

import type { CSSProperties } from 'react'
import type { ThemePreset } from '@/lib/themePresets'

/** Client-ready login: desktop split + mobile stacked (same icons/colours as app nav themes). */
export function LoginThemeShowcase({
  preset,
  mode,
  vars,
}: {
  preset: ThemePreset
  mode: 'light' | 'dark'
  vars: Record<string, string>
}) {
  const accent = vars['--sf-accent'] || '#e8630a'
  const sidebar = vars['--sf-sidebar'] || '#000000'
  const panelBg = mode === 'light' ? '#eef0f3' : '#0f1117'
  const cardBg = mode === 'light' ? '#ffffff' : vars['--sf-surface'] || '#1a1a1a'
  const text = vars['--sf-text'] || '#1a1d21'

  const shellStyle = {
    ...vars,
    '--login-accent': accent,
    '--login-sidebar': sidebar,
    '--login-panel': panelBg,
    '--login-card': cardBg,
    '--login-text': text,
  } as CSSProperties

  return (
    <div className="tp-login-showcase" style={shellStyle} id={`login-${preset.id}-${mode}`}>
      <div className="tp-login-showcase-label">
        {preset.name} · {mode} · desktop + mobile
      </div>
      <div className="tp-login-pair">
        <div className="tp-login-desktop">
          <aside className="tp-login-brand-pane">
            <div className="tp-login-logo" style={{ background: accent }}>S</div>
            <strong>Scrumfolks TMS</strong>
            <p>Run agency operations from one workspace.</p>
          </aside>
          <main className="tp-login-form-pane">
            <div className="tp-login-card">
              <h4>Sign in</h4>
              <label>Email</label>
              <div className="tp-login-field">owner@company.com</div>
              <label>Password</label>
              <div className="tp-login-field">••••••••</div>
              <div className="tp-login-submit" style={{ background: accent }}>Sign in</div>
            </div>
          </main>
        </div>
        <div className="tp-login-mobile">
          <div className="tp-login-mobile-caption">Phone · sign-in first</div>
          <div className="tp-login-mobile-inner">
            <div className="tp-login-mobile-status"><span>9:41</span><span>5G</span></div>
            <div className="tp-login-mobile-head">
              <div className="tp-login-logo" style={{ background: accent }}>S</div>
              <div>
                <strong>Scrumfolks TMS</strong>
                <small>Task Management System</small>
              </div>
            </div>
            <div className="tp-login-card tp-login-card--mobile">
              <h4>Sign in</h4>
              <p>Sign in with your Scrumfolks TMS account.</p>
              <label>Email</label>
              <div className="tp-login-field">name@company.com</div>
              <label>Password</label>
              <div className="tp-login-field">Enter your password</div>
              <div className="tp-login-submit" style={{ background: accent }}>Sign in</div>
            </div>
            <div className="tp-login-mobile-legal">Internal use only · Theme colours</div>
          </div>
        </div>
      </div>
    </div>
  )
}
