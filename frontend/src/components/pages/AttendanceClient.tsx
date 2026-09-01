// @ts-nocheck
'use client'
import { useEffect, useMemo, useState } from 'react'
import { SessionUser, ROLE_COLORS } from '@/types'
import { PageHeader, PageShell, Section, StatCard, StatGrid } from '@/components/app/Section'
import { clockOutWithConfirm, todayIST } from '@/lib/clock'
import { Modal } from '@/components/app/Modal'

export default function AttendanceClient({ session }: { session: SessionUser }) {
  const canView = ['owner', 'hr', 'manager'].includes(session.role)
  const isAdminReport = canView
  const [logs, setLogs] = useState<any[]>([])
  const [report, setReport] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState(session.id)
  const [memberSearch, setMemberSearch] = useState('')
  const [detailModal, setDetailModal] = useState(false)
  const [mode, setMode] = useState(isAdminReport ? 'report' : 'personal')
  const [clocked, setClocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState(false)
  const [nowTick, setNowTick] = useState(Date.now())
  const today = todayIST()

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
      const [r, u, l] = await Promise.all([
        fetch('/api/attendance?report=true&days=14').then(res => res.json()),
        fetch('/api/users').then(res => res.json()),
        fetch('/api/attendance').then(res => res.json()),
      ])
      setReport(Array.isArray(r) ? r : [])
      setUsers(Array.isArray(u) ? u : [])
      const arr = Array.isArray(l) ? l : []
      setLogs(arr)
      setClocked(arr.some((x: any) => x.date === today && !x.logout_time))
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
    if (String(uid) === String(session.id)) {
      setClocked(arr.some((x: any) => x.date === today && !x.logout_time))
    }
    setLoading(false)
  }

  useEffect(() => { setLoading(true); load() }, [selectedUser, mode])

  async function clockIn() { setAction(true); await fetch('/api/attendance/clockin', { method: 'POST' }); setAction(false); load() }
  async function clockOut() {
    setAction(true)
    await clockOutWithConfirm()
    setAction(false)
    load()
  }

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

  const filteredReport = useMemo(() => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return reportByUser
    return reportByUser.filter((row: any) => {
      const u = row.user
      const hay = [u.name, u.designation, u.department, u.email].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [reportByUser, memberSearch])

  const [memberLogs, setMemberLogs] = useState<any[]>([])
  const [memberLogsLoading, setMemberLogsLoading] = useState(false)

  useEffect(() => {
    if (mode !== 'report' || !selectedUser) return
    setMemberLogsLoading(true)
    fetch(`/api/attendance?user_id=${selectedUser}`)
      .then(r => r.json())
      .then(data => setMemberLogs(Array.isArray(data) ? data : []))
      .finally(() => setMemberLogsLoading(false))
  }, [selectedUser, mode])

  useEffect(() => {
    if (mode === 'report' && filteredReport.length > 0) {
      const visible = selectedUser && filteredReport.some((r: any) => String(r.user.id) === String(selectedUser))
      if (!visible) setSelectedUser(String(filteredReport[0].user.id))
    }
  }, [filteredReport, mode, selectedUser])

  const selectedReportRow = reportByUser.find((r: any) => String(r.user.id) === String(selectedUser))

  function selectMember(id: string) {
    setSelectedUser(id)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 960px)').matches) {
      setDetailModal(true)
    }
  }

  function AttendanceLogTable({ rows, emptyLabel }: { rows: any[]; emptyLabel: string }) {
    return (
      <div className="sf-attendance-log-wrap">
        <div className="sf-attendance-log-head">
          {['Date', 'Clock In', 'Clock Out', 'Hours'].map(h => <div key={h}>{h}</div>)}
        </div>
        {rows.length === 0 ? (
          <div className="sf-perf-table-empty">{emptyLabel}</div>
        ) : rows.slice(0, 30).map((log: any) => (
          <div key={log.id} className={`sf-attendance-log-row${log.date === today ? ' is-today' : ''}`}>
            <div>{log.date}{log.date === today ? ' · Today' : ''}</div>
            <div>{log.login_time || '—'}</div>
            <div style={{ color: log.logout_time ? 'var(--sf-muted)' : '#F59E0B' }}>{log.logout_time || '— Active'}</div>
            <div style={{ color: log.hours_worked > 0 ? '#10B981' : 'var(--sf-muted)', fontWeight: 600 }}>
              {log.hours_worked > 0 ? `${log.hours_worked}h` : '—'}
            </div>
          </div>
        ))}
      </div>
    )
  }

  function MemberAttendanceDetail({ row, logRows, loadingLogs }: { row: any; logRows: any[]; loadingLogs: boolean }) {
    const u = row.user
    const status = !row.todayIn ? 'Absent today' : row.todayOut ? 'Completed today' : 'Active now'
    const statusColor = !row.todayIn ? 'var(--sf-muted)' : row.todayOut ? '#10B981' : '#F59E0B'
    return (
      <div className="sf-perf-detail-body">
        <div className="sf-perf-detail-head">
          <div className="sf-perf-table-member">
            <div className="sf-perf-table-avatar" style={{ background: ROLE_COLORS[u.role] || 'var(--sf-accent)', width: 40, height: 40, borderRadius: 10 }}>
              {u.avatar || u.name?.slice(0, 2)}
            </div>
            <div>
              <div className="sf-perf-detail-name">{u.name}</div>
              <div className="sf-perf-table-role">{[u.designation, u.department].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
          <span style={{ color: statusColor, fontSize: 12, fontWeight: 700 }}>{status}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
          <StatCard label="Days (14d)" value={row.days} accent="#3B82F6" />
          <StatCard label="Hours (14d)" value={`${Math.round(row.hours)}h`} accent="#10B981" />
          <StatCard label="Today" value={status} accent={statusColor} />
        </div>
        <div className="sf-perf-detail-card-title" style={{ marginBottom: 8 }}>Recent log</div>
        {loadingLogs ? (
          <div className="sf-perf-table-empty">Loading log…</div>
        ) : (
          <AttendanceLogTable rows={logRows} emptyLabel="No attendance records for this member." />
        )}
      </div>
    )
  }

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>

  return (
    <PageShell fill={mode === 'report' && isAdminReport} className={mode === 'report' && isAdminReport ? 'sf-attendance-page' : undefined}>
      <PageHeader
        title="Attendance"
        subtitle={mode === 'report' ? 'Team attendance — last 14 days' : `${days} days logged · ${Math.round(totalH)}h total`}
      />

      {isAdminReport && (
        <div className="sf-perf-toolbar">
          <div className="sf-perf-period-toggle">
            <button type="button" className={mode === 'report' ? 'is-active' : ''} onClick={() => setMode('report')}>All team</button>
            <button type="button" className={mode === 'personal' ? 'is-active' : ''} onClick={() => setMode('personal')}>Individual log</button>
          </div>
        </div>
      )}

      {(mode !== 'report' || !isAdminReport) && (
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

          <div className="sf-perf-workspace">
            <aside className="sf-perf-roster" aria-label="Team attendance">
              <div className="sf-perf-roster-head">
                <h2 className="sf-perf-roster-title">Team ({filteredReport.length})</h2>
                <input
                  type="search"
                  className="sf-perf-table-search"
                  placeholder="Search team members…"
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  aria-label="Search team members"
                />
              </div>
              <div className="sf-perf-roster-list">
                {filteredReport.length === 0 ? (
                  <div className="sf-perf-table-empty">No team members match your search.</div>
                ) : filteredReport.map((row: any) => {
                  const active = String(selectedUser) === String(row.user.id)
                  const status = !row.todayIn ? 'Absent' : row.todayOut ? 'Done' : 'Active'
                  return (
                    <button
                      key={row.user.id}
                      type="button"
                      className={`sf-perf-roster-row${active ? ' is-active' : ''}`}
                      onClick={() => selectMember(String(row.user.id))}
                    >
                      <div className="sf-perf-table-avatar" style={{ background: ROLE_COLORS[row.user.role] || 'var(--sf-accent)' }}>
                        {row.user.avatar || row.user.name?.slice(0, 2)}
                      </div>
                      <div className="sf-perf-roster-copy">
                        <div className="sf-perf-table-name">{row.user.name}</div>
                        <div className="sf-perf-table-role">{row.user.department || row.user.designation || '—'}</div>
                        <div className="sf-perf-roster-stats">{status} · {row.days}d · {Math.round(row.hours)}h</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </aside>

            <div className="sf-perf-detail sf-perf-detail--desktop">
              {selectedReportRow ? (
                <MemberAttendanceDetail row={selectedReportRow} logRows={memberLogs} loadingLogs={memberLogsLoading} />
              ) : (
                <div className="sf-perf-table-empty">Select a team member to view their attendance log.</div>
              )}
            </div>
          </div>

          {detailModal && selectedReportRow && (
            <Modal open onClose={() => setDetailModal(false)} title={selectedReportRow.user.name} subtitle="Attendance log" size="full" zIndex={90}>
              <MemberAttendanceDetail row={selectedReportRow} logRows={memberLogs} loadingLogs={memberLogsLoading} />
            </Modal>
          )}
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
          <StatGrid>
            <StatCard label="Days logged" value={days} accent="#3B82F6" />
            <StatCard label="Total hours" value={`${Math.round(totalH)}h`} accent="var(--sf-accent)" />
            <StatCard label="Avg / day" value={`${avg}h`} accent="#10B981" />
          </StatGrid>
          <Section title="Log history" subtitle="Last 30 entries" flush flex={1} bodyStyle={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <AttendanceLogTable rows={logs} emptyLabel="No attendance records." />
            </div>
          </Section>
        </>
      )}
    </PageShell>
  )
}
