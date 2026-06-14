'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const FEATURES = [
  'Task boards, assignments, and delivery tracking',
  'Team onboarding, roles, and reporting hierarchy',
  'Calendar, attendance, leave, and performance',
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    let data: any = {}
    try {
      data = await res.json()
    } catch {
      setError('Unexpected server response')
      setLoading(false)
      return
    }
    if (!res.ok) {
      const detail = typeof data.detail === 'string' ? data.detail : Array.isArray(data.detail) ? data.detail[0]?.msg : null
      setError(data.error || detail || 'Invalid email or password')
      setLoading(false)
      return
    }
    router.push('/overview')
  }

  return (
    <div className="login-shell">
      <aside className="login-brand">
        <div className="login-brand-inner">
          <div className="login-logo-row">
            <div className="login-logo-mark">S</div>
            <div>
              <div className="login-product-name">Scrumfolks TMS</div>
              <div className="login-product-tag">Task Management System</div>
            </div>
          </div>

          <h1 className="login-headline">
            Run your agency operations from one workspace.
          </h1>
          <p className="login-lead">
            Plan work, assign tasks, track delivery, and manage your team — built for creative and digital agencies.
          </p>

          <ul className="login-features">
            {FEATURES.map(f => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>

        <div className="login-brand-footer">
          <span className="login-powered">Powered by</span>
          <span className="login-company">QRYX Tech Private Limited</span>
        </div>
      </aside>

      <main className="login-panel">
        <div className="login-card">
          <div className="login-card-header">
            <h2>Sign in</h2>
            <p>Sign in with the owner account created at deploy, then onboard your team from the Team module.</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form className="login-form" onSubmit={doLogin}>
            <label className="login-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="login-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
              required
            />

            <label className="login-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="login-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />

            <button type="submit" disabled={loading} className="login-submit">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="login-legal">Internal use only · Secure session</p>
      </main>
    </div>
  )
}
