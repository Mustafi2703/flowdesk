import Link from 'next/link'
import type { ReactNode } from 'react'

function MockLogin({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className={`um-login${mobile ? ' um-login--mobile' : ''}`}>
      <div className="um-login-brand">
        <div className="um-login-logo">S</div>
        <div>
          <div className="um-login-product">Scrumfolks TMS</div>
          <div className="um-login-tag">Enterprise task & delivery</div>
        </div>
        {!mobile && (
          <p className="um-login-blurb">
            Streamlined workflows for owners, managers, and team — one source of truth for tasks, brands, and updates.
          </p>
        )}
      </div>
      <div className="um-login-form-pane">
        <div className="um-login-card">
          <div className="um-eyebrow">Sign in</div>
          <h2 className="um-h2">Welcome back</h2>
          <label className="um-label">Email</label>
          <div className="um-input">name@company.com</div>
          <label className="um-label">Password</label>
          <div className="um-input">••••••••</div>
          <div className="um-btn-primary">Sign in</div>
        </div>
      </div>
    </div>
  )
}

function MockShell({
  title,
  eyebrow,
  activeNav,
  children,
  narrow,
}: {
  title: string
  eyebrow: string
  activeNav: string
  children: ReactNode
  narrow?: boolean
}) {
  const nav = ['Dashboard', 'Tasks', 'Updates', 'Workflow', 'Brands']
  return (
    <div className={`um-shell${narrow ? ' um-shell--mobile' : ''}`}>
      <aside className="um-nav">
        <div className="um-nav-logo">S</div>
        {nav.map((n) => (
          <div key={n} className={`um-nav-item${n === activeNav ? ' is-active' : ''}`}>
            {n}
          </div>
        ))}
      </aside>
      <div className="um-main">
        <header className="um-topbar">
          <span className="um-clock">Clocked in · 6.2h today</span>
          <span className="um-top-icons" />
        </header>
        <div className="um-content">
          <header className="um-page-head">
            <div className="um-eyebrow">{eyebrow}</div>
            <h1 className="um-h1">{title}</h1>
          </header>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function UiMockupsPage() {
  return (
    <div className="um-page">
      <header className="um-hero">
        <h1>Scrumfolks TMS — ERP-style UI mockups</h1>
        <p>
          Flat panels, square modals, clear page titles, role-based dashboard — inspired by enterprise ERP UX (
          <a href="https://excited.agency/blog/erp-design" target="_blank" rel="noreferrer">
            ERP design guide
          </a>
          ). Screenshot sections below for client sign-off. Also see{' '}
          <Link href="/theme-options">colour theme options</Link>.
        </p>
        <p className="um-tip">Open locally: <code>/ui-mockups</code> · No login required</p>
      </header>

      <section className="um-block" id="login-desktop">
        <h2 className="um-block-title">Login — desktop</h2>
        <MockLogin />
      </section>

      <section className="um-block" id="login-mobile">
        <h2 className="um-block-title">Login — mobile</h2>
        <div className="um-phone-wrap">
          <MockLogin mobile />
        </div>
      </section>

      <section className="um-block" id="dashboard">
        <h2 className="um-block-title">Dashboard (Owner)</h2>
        <MockShell title="Dashboard" eyebrow="Workspace" activeNav="Dashboard">
          <div className="um-kpi-row">
            {[
              ['24', 'Open tasks'],
              ['6', 'Due today'],
              ['3', 'Recurring'],
              ['5', 'In review'],
            ].map(([v, l]) => (
              <div key={l} className="um-kpi">
                <strong>{v}</strong>
                <span>{l}</span>
              </div>
            ))}
          </div>
          <div className="um-grid-3">
            <div className="um-panel">
              <div className="um-panel-head">Your tasks</div>
              <div className="um-row">March social · Acme · In Progress</div>
              <div className="um-row">Landing hero · Northwind · Due today</div>
            </div>
            <div className="um-panel">
              <div className="um-panel-head">Focus</div>
              <div className="um-row um-row--strong">March social carousel</div>
              <div className="um-btn-ghost um-btn-sm">Open task</div>
            </div>
            <div className="um-panel">
              <div className="um-panel-head">Activity</div>
              <div className="um-row">Priya · Updates on Acme task</div>
              <div className="um-row">Review submitted · v2</div>
            </div>
          </div>
        </MockShell>
      </section>

      <section className="um-block" id="tasks">
        <h2 className="um-block-title">Tasks</h2>
        <MockShell title="Tasks" eyebrow="Delivery" activeNav="Tasks">
          <div className="um-toolbar">
            <span className="um-seg is-active">Board</span>
            <span className="um-seg">List</span>
            <span className="um-seg">Filters</span>
          </div>
          <div className="um-table">
            <div className="um-table-head">
              <span>Task</span>
              <span>Brand</span>
              <span>Status</span>
              <span>Due</span>
            </div>
            <div className="um-table-row">
              <span>March social carousel <em className="um-tag">Recurring</em></span>
              <span>Acme Co</span>
              <span className="um-status">In Progress</span>
              <span>Fri</span>
            </div>
            <div className="um-table-row">
              <span>Landing page hero</span>
              <span>Northwind</span>
              <span className="um-status">Under Review</span>
              <span>Today</span>
            </div>
          </div>
        </MockShell>
      </section>

      <section className="um-block" id="updates">
        <h2 className="um-block-title">Updates</h2>
        <MockShell title="Updates" eyebrow="Collaboration" activeNav="Updates">
          <div className="um-split">
            <div className="um-panel um-panel--flush">
              <div className="um-panel-head">Active threads</div>
              <div className="um-thread is-active">
                <div className="um-thread-brand">ACME CO</div>
                <div className="um-thread-title">March social carousel</div>
                <div className="um-thread-prev">Priya: Updated frame 3 copy</div>
              </div>
              <div className="um-thread">
                <div className="um-thread-brand">NORTHWIND</div>
                <div className="um-thread-title">Landing hero</div>
                <div className="um-thread-prev">Rahul: Files uploaded</div>
              </div>
            </div>
            <div className="um-panel um-panel--flush">
              <div className="um-panel-head">Thread · Acme · March social</div>
              <div className="um-chat-line"><b>Priya</b> Updated copy in frame 3</div>
              <div className="um-chat-line"><b>You</b> Looks good, ship to review</div>
              <div className="um-composer">Message…</div>
            </div>
          </div>
        </MockShell>
      </section>

      <section className="um-block" id="brands">
        <h2 className="um-block-title">Brand detail</h2>
        <MockShell title="Acme Co" eyebrow="Client" activeNav="Brands">
          <div className="um-toolbar">
            <span className="um-seg is-active">Overview</span>
            <span className="um-seg">Tasks (8)</span>
            <span className="um-seg">Identity</span>
          </div>
          <div className="um-table">
            <div className="um-table-head">
              <span>Task</span>
              <span>Assignees</span>
              <span>Status</span>
            </div>
            <div className="um-table-row">
              <span>March social</span>
              <span>Priya, Rahul</span>
              <span className="um-status">In Progress</span>
            </div>
            <div className="um-table-row">
              <span>Brand guidelines</span>
              <span>Dev team</span>
              <span className="um-status">Not Started</span>
            </div>
          </div>
        </MockShell>
      </section>

      <section className="um-block" id="mobile-app">
        <h2 className="um-block-title">Mobile — dashboard</h2>
        <div className="um-phone-wrap">
          <MockShell title="Dashboard" eyebrow="Workspace" activeNav="Dashboard" narrow>
            <div className="um-kpi-row um-kpi-row--stack">
              <div className="um-kpi">
                <strong>12</strong>
                <span>Open</span>
              </div>
              <div className="um-kpi">
                <strong>2</strong>
                <span>Due today</span>
              </div>
            </div>
            <div className="um-panel">
              <div className="um-panel-head">Tasks</div>
              <div className="um-row">March social · In Progress</div>
              <div className="um-row">Landing hero · Today</div>
            </div>
          </MockShell>
        </div>
      </section>

      <section className="um-block" id="modal">
        <h2 className="um-block-title">Modal pattern (squared)</h2>
        <div className="um-modal-demo">
          <div className="um-modal">
            <div className="um-modal-accent" />
            <div className="um-modal-head">
              <span className="um-h2" style={{ margin: 0 }}>Add task</span>
              <span className="um-modal-x">×</span>
            </div>
            <div className="um-modal-body">
              <label className="um-label">Title</label>
              <div className="um-input">New deliverable</div>
              <label className="um-label">Brand</label>
              <div className="um-input">Acme Co</div>
            </div>
            <div className="um-modal-foot">
              <span className="um-btn-ghost um-btn-sm">Cancel</span>
              <span className="um-btn-primary um-btn-sm">Save</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="um-foot">Scrumfolks TMS · ERP UI reference mockups</footer>
    </div>
  )
}
