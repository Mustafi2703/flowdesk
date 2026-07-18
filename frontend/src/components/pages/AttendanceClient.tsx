// @ts-nocheck
'use client'
import { useEffect, useMemo, useState } from 'react'
import { SessionUser } from '@/types'
import { PageHeader, PageShell, Section, StatCard, StatGrid } from '@/components/app/Section'

export default function AttendanceClient({ session }: { session: SessionUser }) {
  const canView = ['owner', 'hr', 'manager'].includes(session.role)
  const isAdminReport = canView
  const [logs, setLogs] = useState<any[]>([])
  const [report, setReport] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState(session.id)
  const [mode, setMode] = useState(isAdminReport ? 'report' : 'personal')
  const [clocked, setClocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState(false)
  const [nowTick, setNowTick] = useState(Date.now())
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  function liveHours(log: any) {
    if (!log?.login_time) return 0
    if (log.logout_time && log.hours_worked != null) return Number(log.hours_worked) || 0
    const [hh, mm] = String(log.login_time).split(':').map(Number)
    if (Number.isNaN(hh)) return 0
    const start = new Date()
    start.setHours(hh, mm || 0, 0, 0)
    return Math.max(0, (nowTick - start.getTime()) / 3600000)
  }

  async function load() {
    if (isAdminReport && mode === 'report') {
      const [r, u] = await Promise.all([
        fetch('/api/attendance?report=true&days=14').then(res => res.json()),
        fetch('/api/users').then(res => res.json()),
      ])
      setReport(Array.isArray(r) ? r : [])
      setUsers(Array.isArray(u) ? u : [])
      setLoading(false)
      return
    }
    const uid = canView && mode === 'personal' ? selectedUser : session.id
    const [l, u] = await Promise.all([
      fetch(`/api/attendance?user_id=${uid}`).then(r => r.json()),
      canView ? fetch('/api/users').then(r => r.json()) : Promise.resolve([]),
    ])
    const arr = Array.isArray(l) ? l : []
    setLogs(arr)
    if (canView) setUsers(Array.isArray(u) ? u : [])
    setClocked(arr.some((x: any) => x.date === today && !x.logout_time && String(x.user_id) === String(session.id)))
    // For personal view of self, clocked from own logs
    if (String(uid) === String(session.id)) {
      setClocked(arr.some((x: any) => x.date === today && !x.logout_time))
    }
    setLoading(false)
  }

  useEffect(() => { setLoading(true); load() }, [selectedUser, mode])

  async function clockIn() { setAction(true); await fetch('/api/attendance/clockin', { method: 'POST' }); setAction(false); load() }
  async function clockOut() { setAction(true); await fetch('/api/attendance/clockout', { method: 'POST' }); setAction(false); load() }

  const totalH = logs.reduce((s, l) => s + (l.hours_worked || 0), 0)
  const days = logs.filter(l => l.hours_worked > 0).length
  const avg = days > 0 ? (totalH / days).toFixed(1) : '0'
  const todayLog = logs.find(l => l.date === today)

  const reportByUser = useMemo(() => {
    const map: Record<string, any> = {}
    for (const u of users.filter((x: any) => x.is_active !== false)) {
      map[u.id] = { user: u, days: 0, hours: 0, todayIn: false, todayOut: false }
    }
    for (const row of report) {
      const uid = row.user_id
      if (!map[uid]) {
        map[uid] = { user: row.user || { id: uid, name: 'Unknown' }, days: 0, hours: 0, todayIn: false, todayOut: false }
      }
      if (row.hours_worked > 0) map[uid].days += 1
      map[uid].hours += row.hours_worked || 0
      if (row.date === today && row.login_time) {
        map[uid].todayIn = true
        map[uid].todayOut = Boolean(row.logout_time)
      }
    }
    return Object.values(map).sort((a: any, b: any) => (a.user.name || '').localeCompare(b.user.name || ''))
  }, [report, users, today])

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>

  return (
    <PageShell>
      <PageHeader
        title="Attendance"
        subtitle={mode === 'report' ? 'Team attendance report' : `${days} days logged · ${Math.round(totalH)}h total`}
      />

      {isAdminReport && (
        <Section title="View" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setMode('report')} className={mode === 'report' ? 'sf-btn sf-btn-primary' : 'sf-btn sf-btn-ghost'}>
              All team report
            </button>
            <button type="button" onClick={() => setMode('personal')} className={mode === 'personal' ? 'sf-btn sf-btn-primary' : 'sf-btn sf-btn-ghost'}>
              Individual log
            </button>
          </div>
        </Section>
      )}

      {!isAdminReport && (
        <Section title="Today" subtitle={today} style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ color: clocked ? '#10B981' : 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{clocked ? 'Live · clocked in' : 'Not clocked in'}</div>
                <div style={{ color: 'var(--sf-text)', fontSize: 18, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>{clocked ? 'Active session' : 'Start your workday'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>In time</div>
                <div style={{ color: 'var(--sf-text)', fontSize: 18, fontWeight: 700 }}>{todayLog?.login_time || '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hours today</div>
                <div style={{ color: '#10B981', fontSize: 18, fontWeight: 700 }}>{todayLog?.login_time ? `${liveHours(todayLog).toFixed(1)}h` : '0h'}</div>
              </div>
            </div>
            <button onClick={clocked ? clockOut : clockIn} disabled={action} className="sf-btn sf-btn-primary">{action ? '…' : clocked ? 'Clock out' : 'Clock in'}</button>
          </div>
        </Section>
      )}

      {mode === 'report' && isAdminReport ? (
        <>
          <StatGrid>
            <StatCard label="Team members" value={reportByUser.length} accent="#3B82F6" />
            <StatCard label="In today" value={reportByUser.filter((r: any) => r.todayIn && !r.todayOut).length} accent="#10B981" />
            <StatCard label="Completed today" value={reportByUser.filter((r: any) => r.todayOut).length} accent="var(--sf-accent)" />
            <StatCard label="Hours (14d)" value={`${Math.round(reportByUser.reduce((s: number, r: any) => s + r.hours, 0))}h`} accent="#8B5CF6" />
          </StatGrid>
          <Section title="Team attendance report" subtitle="Last 14 days · all members" flush flex={1}>
            <div style={{ minWidth: 640 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: '1px solid var(--sf-border)', background: 'var(--sf-surface-2)' }}>
                {['Member', 'Today', 'Days (14d)', 'Hours', 'Department'].map(h => (
                  <div key={h} style={{ color: 'var(--sf-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>
              {reportByUser.map((row: any) => (
                <div
                  key={row.user.id}
                  style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: '1px solid #1A1A2E', cursor: 'pointer' }}
                  onClick={() => { setSelectedUser(row.user.id); setMode('personal') }}
                >
                  <div style={{ color: 'var(--sf-text)', fontSize: 13, fontWeight: 600 }}>{row.user.name}</div>
                  <div style={{ color: row.todayIn ? (row.todayOut ? '#10B981' : '#F59E0B') : 'var(--sf-muted)', fontSize: 12, fontWeight: 600 }}>
                    {!row.todayIn ? 'Absent' : row.todayOut ? 'Done' : 'Active'}
                  </div>
                  <div style={{ color: 'var(--sf-text-secondary)', fontSize: 13 }}>{row.days}</div>
                  <div style={{ color: '#10B981', fontSize: 13, fontWeight: 600 }}>{Math.round(row.hours)}h</div>
                  <div style={{ color: 'var(--sf-muted)', fontSize: 12 }}>{row.user.department || '—'}</div>
                </div>
              ))}
              {reportByUser.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--sf-muted-2)', fontSize: 13 }}>No attendance records yet.</div>}
            </div>
          </Section>
        </>
      ) : (
        <>
          {canView && mode === 'personal' && (
            <Section title="Member" style={{ flexShrink: 0 }}>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} style={{ padding: '9px 14px', background: 'var(--sf-surface-2)', border: '1px solid var(--sf-border)', borderRadius: 9, color: 'var(--sf-text)', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", width: '100%', maxWidth: 360 }}>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} — {u.designation || u.role}</option>)}
              </select>
            </Section>
          )}
          {String(selectedUser) === String(session.id) && !isAdminReport && null}
          {String(selectedUser) === String(session.id) && (
            <Section title="Today" subtitle={today} style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ color: clocked ? '#10B981' : 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{clocked ? 'Live · clocked in' : 'Not clocked in'}</div>
                    <div style={{ color: 'var(--sf-text)', fontSize: 18, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>{clocked ? 'Active session' : 'Start your workday'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>In time</div>
                    <div style={{ color: 'var(--sf-text)', fontSize: 18, fontWeight: 700 }}>{todayLog?.login_time || '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hours today</div>
                    <div style={{ color: '#10B981', fontSize: 18, fontWeight: 700 }}>{todayLog?.login_time ? `${liveHours(todayLog).toFixed(1)}h` : '0h'}</div>
                  </div>
                </div>
                <button onClick={clocked ? clockOut : clockIn} disabled={action} className="sf-btn sf-btn-primary">{action ? '…' : clocked ? 'Clock out' : 'Clock in'}</button>
              </div>
            </Section>
          )}
          <StatGrid>
            <StatCard label="Days logged" value={days} accent="#3B82F6" />
            <StatCard label="Total hours" value={`${Math.round(totalH)}h`} accent="var(--sf-accent)" />
            <StatCard label="Avg / day" value={`${avg}h`} accent="#10B981" />
          </StatGrid>
          <Section title="Log history" subtitle="Last 30 entries" flush flex={1}>
            <div style={{ minWidth: 560 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: '1px solid var(--sf-border)', background: 'var(--sf-surface-2)' }}>
                {['Date', 'Clock In', 'Clock Out', 'Hours'].map(h => <div key={h} style={{ color: 'var(--sf-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>)}
              </div>
              {logs.slice(0, 30).map((log: any) => (
                <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: '1px solid #1A1A2E', background: log.date === today ? 'rgba(232,99,10,0.03)' : 'transparent' }}>
                  <div style={{ color: log.date === today ? 'var(--sf-accent)' : 'white', fontSize: 13, fontWeight: log.date === today ? 700 : 400 }}>{log.date}{log.date === today ? ' · Today' : ''}</div>
                  <div style={{ color: '#A0A0C0', fontSize: 13 }}>{log.login_time || '—'}</div>
                  <div style={{ color: log.logout_time ? '#A0A0C0' : '#F59E0B', fontSize: 13 }}>{log.logout_time || '— Active'}</div>
                  <div style={{ color: log.hours_worked > 0 ? '#10B981' : 'var(--sf-muted)', fontWeight: 600, fontSize: 13 }}>{log.hours_worked > 0 ? `${log.hours_worked}h` : '—'}</div>
                </div>
              ))}
              {logs.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--sf-muted-2)', fontSize: 13 }}>No attendance records.</div>}
            </div>
          </Section>
        </>
      )}
    </PageShell>
  )
}
