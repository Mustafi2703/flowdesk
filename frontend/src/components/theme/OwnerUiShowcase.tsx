'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Icon, type IconName } from '@/components/app/Icons'
import { departmentColor } from '@/lib/departmentColors'
import type { UiStylePackage } from '@/lib/uiStylePackages'
import { packageChromeTokens, packageColorVars } from '@/lib/uiStylePackages'

const SHOWCASE_NAV: { label: string; icon: IconName; key: string }[] = [
  { label: 'Dashboard', icon: 'dashboard', key: 'Dashboard' },
  { label: 'Workflow', icon: 'code', key: 'Workflow' },
  { label: 'Tasks', icon: 'tasks', key: 'Tasks' },
  { label: 'Updates', icon: 'inbox', key: 'Updates' },
  { label: 'Brands', icon: 'brands', key: 'Brands' },
  { label: 'Team', icon: 'team', key: 'Team' },
  { label: 'Performance', icon: 'performance', key: 'Performance' },
]

const REFERENCE_CAPACITY: [string, number, boolean][] = [
  ['Poornima', 78, false], ['Aarti', 89, true], ['Kalgi', 67, false], ['Hemali', 56, false],
  ['Mohit', 50, false], ['Suhani', 38, false], ['Apurv', 75, false], ['Anthony', 87, true],
  ['Om', 70, false], ['Somya', 63, false], ['Aastha', 90, true], ['Karan', 75, false],
  ['Pari', 75, false], ['Anushka', 80, false],
]

const REFERENCE_CAMPAIGNS = [
  { brand: 'Dinamoo', title: 'March reel set', pri: 'HIGH', phase: 'Design Phase', deliv: 15, prog: 5 },
  { brand: 'HR', title: 'Policy carousel', pri: 'MED', phase: 'Content Phase', deliv: 8, prog: 4 },
  { brand: 'Powerpalazzo', title: 'Sale edits', pri: 'HIGH', phase: 'Editing', deliv: 12, prog: 9 },
  { brand: 'Minotti', title: 'Lookbook', pri: 'MED', phase: 'Approval', deliv: 6, prog: 7 },
  { brand: 'Acme', title: 'Landing hero', pri: 'MED', phase: 'Delivered', deliv: 3, prog: 10 },
]

function ScreenLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="tp-screen-label" id={id}>
      {children}
    </div>
  )
}

function ShowcaseShell({
  activeNav,
  title,
  eyebrow,
  children,
  style,
  className = '',
}: {
  activeNav: string
  title: string
  eyebrow?: string
  children: ReactNode
  style: CSSProperties
  className?: string
}) {
  return (
    <div className={`tp-showcase-shell ${className}`} style={style}>
      <aside className="tp-showcase-nav">
        <div className="tp-showcase-nav-logo">S</div>
        {SHOWCASE_NAV.map((n) => (
          <div key={n.key} className={`tp-showcase-nav-item${n.key === activeNav ? ' is-active' : ''}`}>
            <span className="tp-showcase-nav-ico"><Icon name={n.icon} size={14} /></span>
            <span className="tp-showcase-nav-text">{n.label}</span>
          </div>
        ))}
      </aside>
      <div className="tp-showcase-main">
        <header className="tp-showcase-topbar">
          <span className="tp-showcase-role">Owner</span>
          <span className="tp-showcase-clock">Clocked in · 6.2h</span>
          <span className="tp-showcase-notif" title="Notifications" />
        </header>
        <div className="tp-showcase-content">
          <header className="tp-showcase-pagehead">
            {eyebrow && <div className="tp-showcase-eyebrow">{eyebrow}</div>}
            <h3 className="tp-showcase-title">{title}</h3>
          </header>
          {children}
        </div>
      </div>
    </div>
  )
}

export function OwnerUiShowcase({ pkg, mode, compact = false }: { pkg: UiStylePackage; mode: 'light' | 'dark'; compact?: boolean }) {
  const rootStyle: CSSProperties = {
    ...packageColorVars(pkg, mode),
    ...packageChromeTokens(pkg),
  }

  const cap = REFERENCE_CAPACITY

  if (compact) {
    return (
      <div className={`tp-showcase tp-showcase--compact tp-chrome-${pkg.chromeId}`} style={rootStyle}>
        <div className="tp-showcase-workflow-block">
          <div className="tp-showcase-wf-hero">
            <h4 className="tp-showcase-wf-title">Workflow</h4>
            <p>{pkg.name} · {mode}</p>
          </div>
          <div className="tp-showcase-kpis tp-showcase-kpis--wf">
            {[['487', 'Tasks'], ['12', 'Review'], ['23', 'Done']].map(([v, l]) => (
              <div key={l} className="tp-showcase-kpi tp-showcase-kpi--dense">
                <span className="tp-showcase-kpi-cap">{l}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <div className="tp-showcase-cap-grid tp-showcase-cap-grid--compact">
            {cap.slice(0, 4).map(([name, pct, hot]) => (
              <div key={name} className="tp-showcase-cap">
                <div><span>{name}</span><span>{pct}%</span></div>
                <div className="tp-showcase-cap-bar">
                  <div className={`tp-showcase-cap-fill${hot ? ' is-hot' : ''}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="tp-showcase-split tp-showcase-split--compact">
          <div className="tp-showcase-panel tp-showcase-panel--flush">
            <div className="tp-showcase-brand-head"><span>ACME</span><span>2 active</span></div>
            <div className="tp-showcase-channel is-active"><strong>March social</strong></div>
          </div>
          <div className="tp-showcase-panel tp-showcase-panel--flush">
            <div className="tp-showcase-kit-row">
              <span className="tp-showcase-btn-primary">Primary</span>
              <span className="tp-showcase-btn-ghost">Ghost</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`tp-showcase tp-chrome-${pkg.chromeId}`} style={rootStyle}>
      <nav className="tp-showcase-toc" aria-label="Screens in this package">
        {[
          ['login', 'Login'],
          ['dashboard', 'Dashboard'],
          ['workflow', 'Workflow'],
          ['tasks', 'Tasks'],
          ['task-detail', 'Task detail'],
          ['updates', 'Updates'],
          ['brands', 'Brands'],
          ['performance', 'Performance'],
          ['kit', 'UI kit'],
          ['modal', 'Modals'],
          ['mobile', 'Mobile'],
        ].map(([id, label]) => (
          <a key={id} href={`#${pkg.id}-${id}`} className="tp-showcase-toc-link">
            {label}
          </a>
        ))}
      </nav>

      <ScreenLabel id={`${pkg.id}-login`}>Login</ScreenLabel>
      <div className="tp-showcase-login">
        <div className="tp-showcase-login-brand">
          <div className="tp-showcase-login-logo">S</div>
          <div>
            <strong>Scrumfolks TMS</strong>
            <span>Enterprise task & delivery</span>
          </div>
        </div>
        <div className="tp-showcase-login-form">
          <div className="tp-showcase-panel">
            <div className="tp-showcase-panel-inner">
              <div className="tp-showcase-eyebrow">Sign in</div>
              <h4>Welcome back</h4>
              <label>Email</label>
              <div className="tp-showcase-input">owner@company.com</div>
              <label>Password</label>
              <div className="tp-showcase-input">••••••••</div>
              <div className="tp-showcase-btn-primary">Sign in</div>
            </div>
          </div>
        </div>
      </div>

      <ScreenLabel id={`${pkg.id}-dashboard`}>Dashboard (Owner)</ScreenLabel>
      <ShowcaseShell activeNav="Dashboard" title="Dashboard" eyebrow="Workspace" style={rootStyle}>
        <div className="tp-showcase-kpis">
          {[
            ['24', 'Open tasks'],
            ['6', 'Due today'],
            ['3', 'Recurring'],
            ['12', 'Active chats'],
            ['5', 'In review'],
          ].map(([v, l]) => (
            <div key={l} className="tp-showcase-kpi">
              <strong>{v}</strong>
              <span>{l}</span>
            </div>
          ))}
        </div>
        <div className="tp-showcase-grid-2">
          <div className="tp-showcase-panel">
            <div className="tp-showcase-panel-head">Pipeline</div>
            <div className="tp-showcase-bars">
              {[
                ['In Progress', 48],
                ['Under Review', 20],
                ['Not Started', 32],
              ].map(([l, w]) => (
                <div key={String(l)} className="tp-showcase-bar-row">
                  <span>{l}</span>
                  <div className="tp-showcase-bar"><div style={{ width: `${w}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="tp-showcase-panel">
            <div className="tp-showcase-panel-head">Quick routes</div>
            <div className="tp-showcase-quick">
              <span className="tp-showcase-btn-ghost">All tasks</span>
              <span className="tp-showcase-btn-ghost">Workflow board</span>
              <span className="tp-showcase-btn-primary">Open Updates</span>
            </div>
          </div>
        </div>
      </ShowcaseShell>

      <ScreenLabel id={`${pkg.id}-workflow`}>Workflow dashboard (Owner)</ScreenLabel>
      <div className="tp-showcase-workflow-block">
        <div className="tp-showcase-wf-hero">
          <h4 className="tp-showcase-wf-title">Workflow Dashboard</h4>
          <p>Real-time active work · Team capacity · Task phases (not brand stages)</p>
        </div>
        <div className="tp-showcase-wf-pills">
          {['All Brands', 'Assigned', 'Design Phase', 'Content Phase', 'Editing', 'Approval', 'Delivered'].map((p, i) => (
            <span key={p} className={`tp-showcase-pill${i === 0 ? ' is-active' : ''}`}>{p}</span>
          ))}
          <span className="tp-showcase-wf-search">Search brands…</span>
        </div>
        <div className="tp-showcase-kpis tp-showcase-kpis--wf">
          {[
            ['35', 'TOTAL BRANDS'],
            ['487', 'ACTIVE TASKS'],
            ['12', 'AWAITING APPROVAL'],
            ['23', 'COMPLETED TODAY'],
          ].map(([v, l]) => (
            <div key={l} className="tp-showcase-kpi tp-showcase-kpi--dense">
              <span className="tp-showcase-kpi-cap">{l}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        <div className="tp-showcase-wf-subhead">Team Capacity</div>
        <div className="tp-showcase-cap-grid tp-showcase-cap-grid--ref">
          {cap.map(([name, pct, hot]) => (
            <div key={name} className="tp-showcase-cap">
              <div><span>{name}</span><span>{pct}%</span></div>
              <div className="tp-showcase-cap-bar">
                <div className={`tp-showcase-cap-fill${hot ? ' is-hot' : ''}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="tp-showcase-wf-subhead tp-showcase-wf-subhead--accent">Active campaigns</div>
        <div className="tp-showcase-wf-cards tp-showcase-wf-cards--ref">
          {REFERENCE_CAMPAIGNS.map((c) => (
            <div key={c.title} className={`tp-showcase-wf-card tp-showcase-wf-card--${c.pri === 'HIGH' ? 'hi' : 'med'}`}>
              <div className="tp-showcase-wf-card-head">
                <div>
                  <div className="tp-showcase-wf-card-brand">{c.brand}</div>
                  <div className="tp-showcase-wf-card-title">{c.title}</div>
                </div>
                <span className="tp-showcase-wf-card-pri">{c.pri}</span>
              </div>
              <span className="tp-showcase-wf-deliv">{c.deliv} deliverables</span>
              <div className="tp-showcase-seg">{Array.from({ length: 10 }).map((_, i) => <span key={i} className={i < c.prog ? 'on' : ''} />)}</div>
              <div className="tp-showcase-wf-phase">Current: <em>{c.phase}</em></div>
              <div className="tp-showcase-wf-card-foot">
                <span className="tp-showcase-btn-ghost">Open chat</span>
                <span className="tp-showcase-btn-primary">Open task</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ScreenLabel id={`${pkg.id}-tasks`}>Tasks — board & list</ScreenLabel>
      <ShowcaseShell activeNav="Tasks" title="Tasks" eyebrow="Delivery" style={rootStyle}>
        <div className="tp-showcase-seg-row">
          <span className="tp-showcase-seg is-active">Board</span>
          <span className="tp-showcase-seg">List</span>
          <span className="tp-showcase-seg">Recurring</span>
        </div>
        <div className="tp-showcase-board">
          {['Not Started', 'In Progress', 'Under Review', 'Completed'].map((col) => (
            <div key={col} className="tp-showcase-board-col">
              <div className="tp-showcase-board-col-head">{col}</div>
              <div className="tp-showcase-board-card">
                <span className="tp-showcase-tag">Recurring</span>
                <strong>March social</strong>
                <span>Acme · Fri</span>
              </div>
              {col === 'In Progress' && (
                <div className="tp-showcase-board-card">
                  <strong>Landing hero</strong>
                  <span>Northwind · Today</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </ShowcaseShell>

      <ScreenLabel id={`${pkg.id}-task-detail`}>Task detail — files, Drive, review</ScreenLabel>
      <ShowcaseShell activeNav="Tasks" title="March social carousel" eyebrow="Acme Co" style={rootStyle}>
        <div className="tp-showcase-tabs">
          {['Overview', 'Sub-tasks', 'Files & links', 'Review', 'History'].map((t, i) => (
            <span key={t} className={`tp-showcase-tab${i === 2 ? ' is-active' : ''}`}>{t}</span>
          ))}
        </div>
        <div className="tp-showcase-grid-2">
          <div className="tp-showcase-panel">
            <div className="tp-showcase-panel-head">Google Drive · review links</div>
            <div className="tp-showcase-panel-inner">
              <div className="tp-showcase-input">Review folder · drive.google.com/…</div>
              <div className="tp-showcase-btn-ghost">+ Add link</div>
            </div>
          </div>
          <div className="tp-showcase-panel">
            <div className="tp-showcase-panel-head">Uploads</div>
            <div className="tp-showcase-panel-inner">
              <div className="tp-showcase-file">carousel_v3.zip</div>
              <div className="tp-showcase-file">copy.docx</div>
            </div>
          </div>
        </div>
        <p className="tp-showcase-note">Close chat on Updates when done — no delete; history stays.</p>
      </ShowcaseShell>

      <ScreenLabel id={`${pkg.id}-updates`}>Updates — brand-first threads</ScreenLabel>
      <ShowcaseShell activeNav="Updates" title="Updates" eyebrow="Collaboration" style={rootStyle}>
        <div className="tp-showcase-brand-filters">
          <span className="tp-showcase-pill is-active">All brands · 12</span>
          <span className="tp-showcase-pill">Acme · 3 live</span>
          <span className="tp-showcase-pill">Northwind · 1 live</span>
          <span className="tp-showcase-pill">Dinamoo · 2 live</span>
        </div>
        <div className="tp-showcase-split">
          <div className="tp-showcase-panel tp-showcase-panel--flush">
            <div className="tp-showcase-panel-head">Active · Closed · All</div>
            <div className="tp-showcase-brand-group">
              <div className="tp-showcase-brand-head"><span>ACME CO</span><span>2 active</span></div>
              <div className="tp-showcase-channel is-active">
                <strong>March social carousel</strong>
                <span>Priya: Frame 3 updated</span>
              </div>
              <div className="tp-showcase-channel">
                <strong>Guidelines PDF</strong>
                <span>Closed · history visible</span>
              </div>
            </div>
            <div className="tp-showcase-brand-group">
              <div className="tp-showcase-brand-head"><span>NORTHWIND</span><span>1 active</span></div>
              <div className="tp-showcase-channel">
                <strong>Landing hero</strong>
                <span>Drive link for review</span>
              </div>
            </div>
          </div>
          <div className="tp-showcase-panel tp-showcase-panel--flush">
            <div className="tp-showcase-panel-head">Thread · Close chat only</div>
            <div className="tp-showcase-chat">
              <div><b>Priya</b> Updated copy</div>
              <div><b>You</b> Ship to review</div>
            </div>
            <div className="tp-showcase-composer">Message…</div>
          </div>
        </div>
      </ShowcaseShell>

      <ScreenLabel id={`${pkg.id}-brands`}>Brand page</ScreenLabel>
      <ShowcaseShell activeNav="Brands" title="Acme Co" eyebrow="Client" style={rootStyle}>
        <div className="tp-showcase-seg-row">
          <span className="tp-showcase-seg is-active">Tasks (8)</span>
          <span className="tp-showcase-seg">Projects</span>
          <span className="tp-showcase-seg">Team</span>
          <span className="tp-showcase-seg">Meetings</span>
          <span className="tp-showcase-seg">Summary</span>
          <span className="tp-showcase-seg">Identity</span>
        </div>
        <div className="tp-showcase-table">
          <div className="tp-showcase-table-head"><span>Task</span><span>Assignees</span><span>Status</span></div>
          <div className="tp-showcase-table-row"><span>March social</span><span>Priya, Rahul</span><span className="tp-showcase-badge">In Progress</span></div>
          <div className="tp-showcase-table-row"><span>Brand book</span><span>Design pod</span><span className="tp-showcase-badge">Not Started</span></div>
        </div>
      </ShowcaseShell>

      <ScreenLabel id={`${pkg.id}-performance`}>Performance (Owner view)</ScreenLabel>
      <ShowcaseShell activeNav="Performance" title="Team performance" eyebrow="Owner" style={rootStyle}>
        <div className="tp-showcase-table">
          <div className="tp-showcase-table-head"><span>Member</span><span>Open</span><span>Capacity</span><span>Dept</span></div>
          {[
            ['Poornima', '6', '78%', 'Design'],
            ['Aarti', '7', '89%', 'Content'],
            ['Bhautik', '5', '73%', 'Editing'],
          ].map(([n, o, c, d]) => (
            <div key={n} className="tp-showcase-table-row">
              <span>{n}</span>
              <span>{o}</span>
              <span>{c}</span>
              <span><span className="tp-showcase-dept-chip" style={{ background: departmentColor(String(d)) }}>{d}</span></span>
            </div>
          ))}
        </div>
      </ShowcaseShell>

      <ScreenLabel id={`${pkg.id}-kit`}>UI kit — buttons, inputs, badges</ScreenLabel>
      <div className="tp-showcase-kit" style={rootStyle}>
        <div className="tp-showcase-kit-row">
          <span className="tp-showcase-btn-primary">Primary</span>
          <span className="tp-showcase-btn-ghost">Secondary</span>
          <span className="tp-showcase-badge">In Progress</span>
          <span className="tp-showcase-badge tp-showcase-badge--warn">Under Review</span>
          <span className="tp-showcase-pill is-active">Filter</span>
        </div>
        <div className="tp-showcase-kit-row">
          <div className="tp-showcase-input">Search tasks, brands…</div>
          <div className="tp-showcase-select">Status ▾</div>
        </div>
      </div>

      <ScreenLabel id={`${pkg.id}-modal`}>Modals & forms</ScreenLabel>
      <div className="tp-showcase-modal-wrap" style={rootStyle}>
        <div className="tp-showcase-modal">
          <div className="tp-showcase-modal-head"><strong>Add task</strong><span>×</span></div>
          <div className="tp-showcase-modal-body">
            <label>Title</label>
            <div className="tp-showcase-input">New deliverable</div>
            <label>Brand</label>
            <div className="tp-showcase-select">Acme Co ▾</div>
          </div>
          <div className="tp-showcase-modal-foot">
            <span className="tp-showcase-btn-ghost">Cancel</span>
            <span className="tp-showcase-btn-primary">Save</span>
          </div>
        </div>
      </div>

      <ScreenLabel id={`${pkg.id}-mobile`}>Mobile — sign-in & Updates</ScreenLabel>
      <div className="tp-showcase-mobile-row">
        <div className="tp-showcase-phone tp-showcase-phone--login" style={rootStyle}>
          <div className="tp-showcase-phone-inner">
            <div className="tp-showcase-login-mobile-head">
              <div className="tp-showcase-login-logo">S</div>
              <strong>Scrumfolks TMS</strong>
            </div>
            <div className="tp-showcase-panel">
              <div className="tp-showcase-panel-inner">
                <div className="tp-showcase-eyebrow">Sign in</div>
                <label>Email</label>
                <div className="tp-showcase-input">owner@company.com</div>
                <label>Password</label>
                <div className="tp-showcase-input">••••••••</div>
                <div className="tp-showcase-btn-primary">Sign in</div>
              </div>
            </div>
          </div>
        </div>
        <div className="tp-showcase-phone tp-showcase-phone--updates" style={rootStyle}>
          <div className="tp-showcase-phone-inner">
            <div className="tp-showcase-phone-top">Updates</div>
            <div className="tp-showcase-brand-filters tp-showcase-brand-filters--compact">
              <span className="tp-showcase-pill is-active">All</span>
              <span className="tp-showcase-pill">Acme</span>
              <span className="tp-showcase-pill">HR</span>
            </div>
            <div className="tp-showcase-panel tp-showcase-panel--flush">
              <div className="tp-showcase-brand-head"><span>ACME</span><span>2 live</span></div>
              <div className="tp-showcase-channel is-active"><strong>March social</strong></div>
            </div>
            <div className="tp-showcase-composer">Message…</div>
            <div className="tp-showcase-phone-nav">
              {['Home', 'Tasks', 'Chat', 'Menu'].map((x) => (
                <span key={x} className={x === 'Chat' ? 'is-active' : ''}>{x}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
