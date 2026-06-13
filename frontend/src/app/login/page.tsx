'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/app/ThemeProvider'

const DEMOS = [
  { role: 'owner', label: 'Owner', email: 'owner@scrumfolks.com', color: '#E8630A' },
  { role: 'manager', label: 'Manager', email: 'manager@scrumfolks.com', color: '#3B82F6' },
  { role: 'team', label: 'Team', email: 'team@scrumfolks.com', color: '#10B981' },
  { role: 'hr', label: 'HR', email: 'hr@scrumfolks.com', color: '#8B5CF6' },
  { role: 'accountant', label: 'Accountant', email: 'accountant@scrumfolks.com', color: '#EC4899' },
  { role: 'developer', label: 'Developer', email: 'dev@scrumfolks.com', color: '#06B6D4' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAuth(res: Response) {
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || data.detail || 'Login failed')
      setLoading(false)
      return
    }
    router.push('/overview')
  }

  async function doLogin(em: string, pw: string) {
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: em, password: pw }),
    })
    await handleAuth(res)
  }

  async function doDemoLogin(role: string) {
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/demo-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    await handleAuth(res)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--sf-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <ThemeToggle />
        </div>

        <div
          className="sf-card"
          style={{ padding: '2.5rem 2.75rem', position: 'relative', overflow: 'hidden' }}
        >
          <div
            style={{
              position: 'absolute',
              top: -80,
              right: -80,
              width: 200,
              height: 200,
              background: 'radial-gradient(circle, var(--sf-accent-soft), transparent 70%)',
              borderRadius: '50%',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <div
              style={{
                width: 42,
                height: 42,
                background: 'var(--sf-accent)',
                borderRadius: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: '#fff',
                fontSize: 18,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              S
            </div>
            <div>
              <div
                style={{
                  color: 'var(--sf-text)',
                  fontWeight: 700,
                  fontSize: 18,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Scrumfolks CRM
              </div>
              <div style={{ color: 'var(--sf-muted)', fontSize: 12 }}>Task Management System</div>
            </div>
          </div>

          <h1 className="sf-page-title" style={{ fontSize: '1.625rem', marginBottom: 6 }}>
            Welcome back
          </h1>
          <p className="sf-page-sub" style={{ marginBottom: 28 }}>
            Sign in to your workspace
          </p>

          {error && (
            <div
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8,
                padding: '10px 14px',
                color: 'var(--sf-danger)',
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          <form
            onSubmit={e => {
              e.preventDefault()
              doLogin(email, password)
            }}
          >
            <label className="sf-label">Email Address</label>
            <input
              type="email"
              className="sf-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@scrumfolks.com"
              required
              style={{ marginBottom: 14 }}
            />
            <label className="sf-label">Password</label>
            <input
              type="password"
              className="sf-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ marginBottom: 16 }}
            />
            <button type="submit" disabled={loading} className="sf-btn sf-btn-primary" style={{ width: '100%', padding: '0.8125rem' }}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '1.375rem 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--sf-border)' }} />
            <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>Quick demo access</span>
            <div style={{ flex: 1, height: 1, background: 'var(--sf-border)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {DEMOS.map(d => (
              <button
                key={d.role}
                type="button"
                disabled={loading}
                onClick={() => doDemoLogin(d.role)}
                style={{
                  padding: '0.625rem 0.75rem',
                  background: 'var(--sf-surface-2)',
                  border: '1px solid var(--sf-border)',
                  borderRadius: 9,
                  color: 'var(--sf-text)',
                  cursor: loading ? 'wait' : 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  width: '100%',
                  transition: 'border-color 0.15s',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 12 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: d.color,
                      marginRight: 5,
                    }}
                  />
                  {d.label}
                </div>
                <div style={{ color: 'var(--sf-muted)', fontSize: 10, marginTop: 2 }}>{d.email}</div>
              </button>
            ))}
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--sf-muted-2)', fontSize: 11, marginTop: 20 }}>
          Scrumfolks Internal · Secure workspace
        </p>
      </div>
    </div>
  )
}
