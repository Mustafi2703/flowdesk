'use client'

import { THEME_PRESETS, type ThemePreset } from '@/lib/themePresets'
import './theme-options.css'

function PreviewFrame({
  preset,
  mode,
  vars,
}: {
  preset: ThemePreset
  mode: 'Light' | 'Dark'
  vars: Record<string, string>
}) {
  const style = vars as React.CSSProperties
  return (
    <div>
      <div className="tp-frame-label">
        {mode} mode · {preset.name}
      </div>
      <div className="tp-frame" style={style} id={`${preset.id}-${mode.toLowerCase()}`}>
        <div className="tp-shell">
          <aside className="tp-nav" aria-hidden>
            <div className="tp-nav-logo">S</div>
            <div className="tp-nav-dot is-active" />
            <div className="tp-nav-dot" />
            <div className="tp-nav-dot" />
            <div className="tp-nav-dot" />
          </aside>
          <div className="tp-main">
            <div className="tp-topbar">
              <span className="tp-pill-clock">Clocked in</span>
              <div className="tp-icon" />
              <div className="tp-icon" />
            </div>
            <div className="tp-body">
              <div className="tp-panel">
                <div className="tp-panel-head">Dashboard · Owner / Manager</div>
                <div className="tp-stats">
                  <div className="tp-stat">
                    <strong>24</strong>
                    <label>Open tasks</label>
                  </div>
                  <div className="tp-stat">
                    <strong>6</strong>
                    <label>Due today</label>
                  </div>
                  <div className="tp-stat">
                    <strong>3</strong>
                    <label>Recurring</label>
                  </div>
                </div>
                <div className="tp-bars">
                  {[
                    ['In Progress', 12, 48],
                    ['Under Review', 5, 20],
                    ['Not Started', 7, 28],
                  ].map(([label, val, pct]) => (
                    <div key={String(label)} className="tp-bar-row">
                      <div className="tp-bar-meta">
                        <span>{label}</span>
                        <span>{val}</span>
                      </div>
                      <div className="tp-bar-track">
                        <div className="tp-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <span className="tp-role-tag" style={{ padding: '0 10px 8px', display: 'block' }}>
                  Pipeline chart · same accent across stats & bars
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="tp-panel" style={{ flex: 1 }}>
                  <div className="tp-panel-head">Updates · Slack-style threads</div>
                  <div className="tp-updates">
                    <div className="tp-channel is-active">
                      <div className="tp-ch-brand">Acme Co</div>
                      <div className="tp-ch-title">March social carousel</div>
                      <div className="tp-ch-preview">Priya: Updated copy in frame 3…</div>
                    </div>
                    <div className="tp-channel">
                      <div className="tp-ch-brand">Northwind</div>
                      <div className="tp-ch-title">Landing page hero</div>
                      <div className="tp-ch-preview">Rahul: Files uploaded for review</div>
                    </div>
                  </div>
                </div>
                <div className="tp-panel">
                  <div className="tp-panel-head">Tasks · Team view</div>
                  <div className="tp-tasks">
                    <div className="tp-task">
                      <div>
                        <div className="tp-task-title">Brand guidelines PDF</div>
                        <div className="tp-task-meta">Design · Due Fri</div>
                      </div>
                      <span className="tp-status">In Progress</span>
                    </div>
                    <div className="tp-task">
                      <div>
                        <div className="tp-task-title">Weekly report deck</div>
                        <div className="tp-task-meta">Strategy · Recurring</div>
                      </div>
                      <span className="tp-status">Not Started</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ThemeOptionsPage() {
  return (
    <div className="tp-page">
      <header className="tp-hero">
        <h1>Scrumfolks TMS — colour theme options</h1>
        <p>
          Four directions for nav, dashboard, Updates, and tasks. Screenshot this page (or each block) and share with
          your client. Tell us which option + light/dark preference to ship app-wide.
        </p>
        <p className="tp-hero-tip">
          Tip: use full-page capture (Cmd+Shift+3 / Win+Shift+S) or scroll to each option ID. Link:{' '}
          <code style={{ color: '#d4d4d4' }}>/theme-options</code> — no login required.
        </p>
      </header>

      <div className="tp-grid">
        {THEME_PRESETS.map((preset) => (
          <section key={preset.id} className="tp-option" id={preset.id}>
            <div className="tp-option-head">
              <h2>{preset.name}</h2>
              <span>{preset.subtitle}</span>
              {preset.recommended && <span className="tp-badge">{preset.recommended}</span>}
            </div>
            <div className="tp-pair">
              <PreviewFrame preset={preset} mode="Light" vars={preset.light} />
              <PreviewFrame preset={preset} mode="Dark" vars={preset.dark} />
            </div>
          </section>
        ))}
      </div>

      <footer className="tp-footer">
        QRYX Tech · Scrumfolks TMS theme preview · {new Date().getFullYear()}
      </footer>
    </div>
  )
}
