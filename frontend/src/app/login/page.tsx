'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DEMOS = [
  { role: 'Owner',      email: 'owner@scrumfolks.com',      color: '#E8630A' },
  { role: 'Manager',    email: 'manager@scrumfolks.com',    color: '#3B82F6' },
  { role: 'Team',       email: 'team@scrumfolks.com',       color: '#10B981' },
  { role: 'HR',         email: 'hr@scrumfolks.com',         color: '#8B5CF6' },
  { role: 'Accountant', email: 'accountant@scrumfolks.com', color: '#EC4899' },
  { role: 'Developer',  email: 'dev@scrumfolks.com',        color: '#06B6D4' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function doLogin(em: string, pw: string) {
    setLoading(true); setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: em, password: pw }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Login failed'); setLoading(false); return }
    router.push('/overview')
  }

  const s = {
    card: { background: '#111120', border: '1px solid #1E1E35', borderRadius: 20, padding: 44, width: '100%', maxWidth: 420, position: 'relative' as const, overflow: 'hidden' },
    label: { color: '#8888AA', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 6, display: 'block' },
    input: { width: '100%', padding: '11px 14px', background: '#1A1A2E', border: '1px solid #2A2A45', borderRadius: 9, color: 'white', fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif", marginBottom: 14 },
    btn: { width: '100%', padding: 13, background: '#E8630A', border: 'none', borderRadius: 10, color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", marginTop: 4 },
    demo: { padding: '9px 10px', background: '#16162A', border: '1px solid #2A2A45', borderRadius: 9, color: 'white', cursor: 'pointer', textAlign: 'left' as const, fontFamily: "'DM Sans',sans-serif", width: '100%' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A12', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={s.card}>
          <div style={{ position: 'absolute', top: -80, right: -80, width: 200, height: 200, background: 'radial-gradient(circle,rgba(232,99,10,0.12),transparent 70%)', borderRadius: '50%' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
            <div style={{ width: 38, height: 38, background: '#E8630A', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: 17 }}>S</div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 17, fontFamily: "'Space Grotesk',sans-serif" }}>Scrumfolks</div>
              <div style={{ color: '#4A4A6A', fontSize: 11 }}>Task Management System</div>
            </div>
          </div>
          <h1 style={{ color: 'white', fontSize: 26, fontWeight: 700, marginBottom: 6, fontFamily: "'Space Grotesk',sans-serif" }}>Welcome back</h1>
          <p style={{ color: '#6B6B8A', fontSize: 13, marginBottom: 28 }}>Sign in to your workspace</p>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#F87171', fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <form onSubmit={e => { e.preventDefault(); doLogin(email, password) }}>
            <label style={s.label}>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@scrumfolks.com" required style={s.input} />
            <label style={s.label}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={{ ...s.input, marginBottom: 0 }} />
            <button type="submit" disabled={loading} style={s.btn}>{loading ? 'Signing in…' : 'Sign In →'}</button>
          </form>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#1E1E35' }} />
            <span style={{ color: '#4A4A6A', fontSize: 11 }}>Quick demo access</span>
            <div style={{ flex: 1, height: 1, background: '#1E1E35' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {DEMOS.map(d => (
              <button key={d.role} onClick={() => doLogin(d.email, 'scrumfolks2026')} style={s.demo}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>
                  <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: d.color, marginRight: 5 }} />
                  {d.role}
                </div>
                <div style={{ color: '#4A4A6A', fontSize: 10, marginTop: 2 }}>{d.email}</div>
              </button>
            ))}
          </div>
        </div>
        <p style={{ textAlign: 'center', color: '#3A3A5A', fontSize: 11, marginTop: 20 }}>tasks.scrumfolks.com · Scrumfolks Internal</p>
      </div>
    </div>
  )
}