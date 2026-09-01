// @ts-nocheck
'use client'
import { useEffect, useMemo, useState } from 'react'
import { SessionUser, ROLE_COLORS } from '@/types'
import { PageHeader, PageShell, StatCard, StatGrid } from '@/components/app/Section'
import { Modal } from '@/components/app/Modal'

function Bars({ data, color, height = 60 }: any) {
  const max = Math.max(...data.map((d: any) => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }}>
      {data.map((d: any, i: number) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700 }}>{d.value}</div>
          <div style={{ width: '100%', background: color, borderRadius: '3px 3px 0 0', height: `${Math.max(4, (d.value / max) * (height - 24))}px` }} />
          <div style={{ color: 'var(--sf-muted-2)', fontSize: 9 }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

function MemberPerformanceDetail({ user, sm }: { user: any; sm: ReturnType<typeof buildMetrics> }) {
  return (
    <div className="sf-perf-detail-body">
      <div className="sf-perf-detail-head">
        <div className="sf-perf-table-member">
          <div className="sf-perf-table-avatar" style={{ background: ROLE_COLORS[user.role] || 'var(--sf-accent)', width: 40, height: 40, borderRadius: 10 }}>
            {user.avatar || user.name?.slice(0, 2)}
          </div>
          <div>
            <div className="sf-perf-detail-name">{user.name}</div>
            <div className="sf-perf-table-role">{[user.designation, user.department].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <span style={{ background: sm.perf.color + '20', color: sm.perf.color, fontSize: 11, padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>
          {sm.perf.label}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
        {[['Assigned', sm.total, '#3B82F6'], ['Completed', sm.done, '#10B981'], ['In Progress', sm.ip, 'var(--sf-accent)'], ['Overdue', sm.overdue, '#EF4444']].map(([l, v, c]) => (
          <StatCard key={String(l)} label={String(l)} value={v as any} accent={String(c)} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
        {[['Flagged', sm.strug, '#F59E0B'], ['Days Present', sm.days, '#8B5CF6'], ['Avg Hours', `${sm.avg}h`, '#06B6D4'], ['Leaves', sm.taken, '#EC4899']].map(([l, v, c]) => (
          <StatCard key={String(l)} label={String(l)} value={v as any} accent={String(c)} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div className="sf-perf-detail-card">
          <div className="sf-perf-detail-card-title">Metrics</div>
          {[['Completion Rate', sm.rate, '#10B981'], ['On-Time Delivery', sm.ontime, '#3B82F6'], ['Attendance', Math.min(100, Math.round(sm.days / 22 * 100)), 'var(--sf-accent)']].map(([l, v, c]) => (
            <div key={String(l)} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--sf-muted)', fontSize: 12 }}>{l}</span>
                <span style={{ color: String(c), fontWeight: 700, fontSize: 12 }}>{v}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--sf-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${v}%`, height: '100%', background: String(c), borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="sf-perf-detail-card">
          <div className="sf-perf-detail-card-title">Completed by month</div>
          <Bars data={(sm.monthly || []).map((m: any) => ({ label: m.label, value: m.value }))} color="#10B981" />
        </div>
      </div>
      <div className="sf-perf-detail-card">
        <div className="sf-perf-detail-card-title">Task breakdown</div>
        {[['Completed', sm.done, '#10B981'], ['In Progress', sm.ip, '#3B82F6'], ['Overdue', sm.overdue, '#EF4444'], ['Struggling', sm.strug, '#F59E0B']].map(([l, v, c]) => (
          <div key={String(l)} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 90, color: 'var(--sf-muted)', fontSize: 12 }}>{l}</div>
            <div style={{ flex: 1, height: 6, background: 'var(--sf-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: sm.total > 0 ? `${(v as number) / sm.total * 100}%` : '0%', height: '100%', background: String(c), borderRadius: 3 }} />
            </div>
            <div style={{ color: String(c), fontWeight: 700, fontSize: 13, width: 22, textAlign: 'right' }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function buildMetrics(card: any) {
  if (!card) {
    return { total: 0, done: 0, ip: 0, overdue: 0, strug: 0, ontime: 0, rate: 0, days: 0, avg: '0', taken: 0, monthly: [], perf: { label: 'Needs Support', color: '#EF4444' } }
  }
  const rate = Math.round(card.completion_rate || 0)
  const perf = rate >= 80 ? { label: 'Excellent', color: '#10B981' } : rate >= 60 ? { label: 'Good', color: '#3B82F6' } : rate >= 40 ? { label: 'Average', color: '#FBBF24' } : { label: 'Needs Support', color: '#EF4444' }
  return {
    total: card.assigned || 0,
    done: card.completed || 0,
    ip: card.in_progress || 0,
    overdue: card.overdue || 0,
    strug: card.struggling || 0,
    ontime: Math.round(card.on_time_rate || 0),
    rate,
    days: card.days_present || 0,
    avg: (card.avg_hours ?? 0).toString(),
    taken: card.leaves_taken || 0,
    monthly: Array.isArray(card.monthly) ? card.monthly : [],
    perf,
  }
}

export default function PerformanceClient({ session }: { session: SessionUser }) {
  const [overview, setOverview] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [period, setPeriod] = useState('monthly')
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailModal, setDetailModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/performance?period=${period}`).then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([perf, u]) => {
      setOverview(perf && !perf.error ? perf : { members: [] })
      setUsers(Array.isArray(u) ? u : [])
      setLoading(false)
    })
  }, [period])

  function metrics(uid: string) {
    const card = (overview?.members || []).find((m: any) => String(m.user_id) === String(uid))
    return buildMetrics(card)
  }

  const teamU = users.filter(u => u.role === 'team')
  const isSelfOnly = session.role === 'team'
  const tm = (isSelfOnly ? teamU.filter(u => u.id === session.id) : teamU).map(u => ({ user: u, ...metrics(u.id) }))

  const filteredTm = useMemo(() => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return tm
    return tm.filter(({ user }) => {
      const hay = [user.name, user.designation, user.department, user.email].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [tm, memberSearch])

  useEffect(() => {
    if (!isSelfOnly && filteredTm.length === 0) {
      setSelectedId(null)
      return
    }
    if (isSelfOnly) {
      setSelectedId(session.id)
      return
    }
    const visible = selectedId && filteredTm.some(({ user }) => String(user.id) === String(selectedId))
    if (!visible) setSelectedId(String(filteredTm[0]?.user?.id || ''))
  }, [filteredTm, selectedId, isSelfOnly, session.id])

  const selectedRow = tm.find(({ user }) => String(user.id) === String(selectedId))
  const showOverview = !isSelfOnly

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>

  if (isSelfOnly && selectedRow) {
    return (
      <PageShell>
        <PageHeader title="Performance" subtitle="Your allocated, delayed, and on-time metrics" />
        <MemberPerformanceDetail user={selectedRow.user} sm={selectedRow} />
      </PageShell>
    )
  }

  return (
    <PageShell fill className="sf-perf-page">
      <PageHeader title="Performance" subtitle="Team metrics — pick a member for full drill-down" />

      <div className="sf-perf-toolbar">
        <div className="sf-perf-period-toggle">
          {['monthly', 'quarterly', 'yearly'].map(p => (
            <button key={p} type="button" className={period === p ? 'is-active' : ''} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
      </div>

      <div className="sf-perf-summary">
        <StatGrid>
          <StatCard label="Team size" value={teamU.length} accent="var(--sf-accent)" />
          <StatCard label="Total tasks" value={overview?.total_tasks ?? tm.reduce((s, m) => s + m.total, 0)} accent="#3B82F6" />
          <StatCard label="Avg completion" value={`${Math.round(tm.reduce((s, m) => s + m.rate, 0) / Math.max(tm.length, 1))}%`} accent="#10B981" />
          <StatCard label="Total overdue" value={tm.reduce((s, m) => s + m.overdue, 0)} accent="#EF4444" />
        </StatGrid>
        <div className="sf-perf-chart-card">
          <div className="sf-perf-detail-card-title">Team tasks — completed in the last 6 months</div>
          <Bars data={(overview?.monthly_activity || []).map((m: any) => ({ label: m.label, value: m.value }))} color="#10B981" height={72} />
        </div>
      </div>

      <div className="sf-perf-workspace">
        <aside className="sf-perf-roster" aria-label="Team members">
          <div className="sf-perf-roster-head">
            <h2 className="sf-perf-roster-title">Team ({filteredTm.length})</h2>
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
            {filteredTm.length === 0 ? (
              <div className="sf-perf-table-empty">No team members match your search.</div>
            ) : filteredTm.map(({ user, total, done, overdue, ontime, perf }) => {
              const active = String(selectedId) === String(user.id)
              return (
                <button
                  key={user.id}
                  type="button"
                  className={`sf-perf-roster-row${active ? ' is-active' : ''}`}
                  onClick={() => {
                    setSelectedId(String(user.id))
                    if (window.matchMedia('(max-width: 960px)').matches) setDetailModal(true)
                  }}
                >
                  <div className="sf-perf-table-avatar" style={{ background: ROLE_COLORS[user.role] || 'var(--sf-accent)' }}>
                    {user.avatar || user.name?.slice(0, 2)}
                  </div>
                  <div className="sf-perf-roster-copy">
                    <div className="sf-perf-table-name">{user.name}</div>
                    <div className="sf-perf-table-role">{user.designation || 'Team'}</div>
                    <div className="sf-perf-roster-stats">{total} assigned · {done} done · {overdue} overdue · {ontime}% on-time</div>
                  </div>
                  <span style={{ background: perf.color + '20', color: perf.color, fontSize: 9, padding: '3px 7px', borderRadius: 999, fontWeight: 800, flexShrink: 0 }}>
                    {perf.label}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="sf-perf-detail sf-perf-detail--desktop">
          {selectedRow ? (
            <MemberPerformanceDetail user={selectedRow.user} sm={selectedRow} />
          ) : (
            <div className="sf-perf-table-empty">Select a team member to view performance.</div>
          )}
        </div>
      </div>

      {detailModal && selectedRow && (
        <Modal
          open
          onClose={() => setDetailModal(false)}
          title={selectedRow.user.name}
          subtitle={[selectedRow.user.designation, selectedRow.perf.label].filter(Boolean).join(' · ')}
          size="full"
          zIndex={90}
        >
          <MemberPerformanceDetail user={selectedRow.user} sm={selectedRow} />
        </Modal>
      )}
    </PageShell>
  )
}
