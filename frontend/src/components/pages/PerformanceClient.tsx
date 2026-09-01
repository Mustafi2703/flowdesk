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
    <div className="sf-perf-member-panel-inner">
      <div className="sf-perf-detail-head">
        <div className="sf-perf-table-member">
          <div className="sf-perf-table-avatar sf-perf-table-avatar--lg" style={{ background: ROLE_COLORS[user.role] || 'var(--sf-accent)' }}>
            {user.avatar || user.name?.slice(0, 2)}
          </div>
          <div>
            <div className="sf-perf-detail-name">{user.name}</div>
            <div className="sf-perf-table-role">{[user.designation, user.department].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <span className="sf-perf-detail-badge" style={{ background: sm.perf.color + '20', color: sm.perf.color }}>
          {sm.perf.label}
        </span>
      </div>

      <div className="sf-perf-stat-grid sf-perf-stat-grid--4">
        {[['Assigned', sm.total, '#3B82F6'], ['Completed', sm.done, '#10B981'], ['In Progress', sm.ip, 'var(--sf-accent)'], ['Overdue', sm.overdue, '#EF4444']].map(([l, v, c]) => (
          <StatCard key={String(l)} label={String(l)} value={v as any} accent={String(c)} />
        ))}
      </div>
      <div className="sf-perf-stat-grid sf-perf-stat-grid--4">
        {[['Flagged', sm.strug, '#F59E0B'], ['Days Present', sm.days, '#8B5CF6'], ['Avg Hours', `${sm.avg}h`, '#06B6D4'], ['Leaves', sm.taken, '#EC4899']].map(([l, v, c]) => (
          <StatCard key={String(l)} label={String(l)} value={v as any} accent={String(c)} />
        ))}
      </div>
      <div className="sf-perf-detail-split">
        <div className="sf-perf-detail-card">
          <div className="sf-perf-detail-card-title">Metrics</div>
          {[['Completion Rate', sm.rate, '#10B981'], ['On-Time Delivery', sm.ontime, '#3B82F6'], ['Attendance', Math.min(100, Math.round(sm.days / 22 * 100)), 'var(--sf-accent)']].map(([l, v, c]) => (
            <div key={String(l)} className="sf-perf-metric-row">
              <div className="sf-perf-metric-label">
                <span>{l}</span>
                <span style={{ color: String(c), fontWeight: 700 }}>{v}%</span>
              </div>
              <div className="sf-perf-metric-bar">
                <div style={{ width: `${v}%`, background: String(c) }} />
              </div>
            </div>
          ))}
        </div>
        <div className="sf-perf-detail-card">
          <div className="sf-perf-detail-card-title">Completed by month</div>
          <Bars data={(sm.monthly || []).map((m: any) => ({ label: m.label, value: m.value }))} color="#10B981" height={100} />
        </div>
      </div>
      <div className="sf-perf-detail-card">
        <div className="sf-perf-detail-card-title">Task breakdown</div>
        {[['Completed', sm.done, '#10B981'], ['In Progress', sm.ip, '#3B82F6'], ['Overdue', sm.overdue, '#EF4444'], ['Struggling', sm.strug, '#F59E0B']].map(([l, v, c]) => (
          <div key={String(l)} className="sf-perf-breakdown-row">
            <div className="sf-perf-breakdown-label">{l}</div>
            <div className="sf-perf-metric-bar sf-perf-metric-bar--inline">
              <div style={{ width: sm.total > 0 ? `${(v as number) / sm.total * 100}%` : '0%', background: String(c) }} />
            </div>
            <div className="sf-perf-breakdown-val" style={{ color: String(c) }}>{v}</div>
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
  const [detailId, setDetailId] = useState<string | null>(null)
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

  const detailRow = detailId ? tm.find(({ user }) => String(user.id) === String(detailId)) : null
  const selfRow = isSelfOnly ? tm[0] : null

  if (loading) return <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>

  if (isSelfOnly && selfRow) {
    return (
      <PageShell className="sf-perf-page">
        <PageHeader title="Performance" subtitle="Your allocated, delayed, and on-time metrics" />
        <div className="sf-perf-member-panel">
          <MemberPerformanceDetail user={selfRow.user} sm={selfRow} />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell className="sf-perf-page">
      <PageHeader title="Performance" subtitle="Team overview — click a member for full metrics" />

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
          <Bars data={(overview?.monthly_activity || []).map((m: any) => ({ label: m.label, value: m.value }))} color="#10B981" height={88} />
        </div>
      </div>

      <section className="sf-perf-team-section" aria-label="Team members">
        <div className="sf-perf-team-head">
          <h2 className="sf-perf-roster-title">Team ({filteredTm.length}{memberSearch.trim() ? ` of ${tm.length}` : ''})</h2>
          <div className="sf-perf-search-wrap">
            <input
              type="search"
              className="sf-perf-search"
              placeholder="Search by name, role, or email…"
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              aria-label="Search team members"
            />
          </div>
        </div>
        <div className="sf-perf-team-grid">
          {filteredTm.length === 0 ? (
            <div className="sf-perf-table-empty sf-perf-table-empty--wide">No team members match your search.</div>
          ) : filteredTm.map(({ user, total, done, overdue, ontime, perf }) => (
            <button
              key={user.id}
              type="button"
              className="sf-perf-team-card"
              onClick={() => setDetailId(String(user.id))}
            >
              <div className="sf-perf-table-avatar" style={{ background: ROLE_COLORS[user.role] || 'var(--sf-accent)' }}>
                {user.avatar || user.name?.slice(0, 2)}
              </div>
              <div className="sf-perf-roster-copy">
                <div className="sf-perf-table-name">{user.name}</div>
                <div className="sf-perf-table-role">{user.designation || 'Team Member'}</div>
                <div className="sf-perf-roster-stats">{total} assigned · {done} done · {overdue} overdue · {ontime}% on-time</div>
              </div>
              <span className="sf-perf-roster-badge" style={{ background: perf.color + '20', color: perf.color }}>
                {perf.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      <Modal
        open={Boolean(detailRow)}
        onClose={() => setDetailId(null)}
        title={detailRow?.user?.name || 'Member performance'}
        subtitle={detailRow ? [detailRow.user.designation, detailRow.user.department].filter(Boolean).join(' · ') : undefined}
        size="full"
        footer={
          <button type="button" className="sf-btn sf-btn-primary" onClick={() => setDetailId(null)}>
            Close
          </button>
        }
      >
        {detailRow && <MemberPerformanceDetail user={detailRow.user} sm={detailRow} />}
      </Modal>
    </PageShell>
  )
}
