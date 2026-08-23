// @ts-nocheck
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { SessionUser } from '@/types'
import { PageHeader, PageShell, Section } from '@/components/app/Section'
import { Modal } from '@/components/app/Modal'
import { StatusBadge } from '@/components/app/StatusBadge'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const COMPANY = 'company'

const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#f87171',
  High: '#fb923c',
  Medium: '#eab308',
  Low: '#94a3b8',
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CalendarClient({ session }: { session: SessionUser }) {
  const isOwner = session.role === 'owner'
  const isManager = session.role === 'manager'
  const isHr = session.role === 'hr'
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedUser, setSelectedUser] = useState(isOwner ? COMPANY : session.id)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const month = monthKey(cursor)
  const isCompanyView = selectedUser === COMPANY

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ month })
    if (isCompanyView) {
      params.set('scope', 'company')
    } else if (selectedUser !== session.id) {
      params.set('user_id', selectedUser)
    }
    fetch(`/api/calendar?${params}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [month, selectedUser, session.id, isCompanyView])

  const grid = useMemo(() => {
    const y = cursor.getFullYear()
    const m = cursor.getMonth()
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    const startPad = (first.getDay() + 6) % 7
    const cells: Array<{ key: string; inMonth: boolean; date: Date }> = []
    for (let i = 0; i < startPad; i++) {
      const d = new Date(y, m, 1 - (startPad - i))
      cells.push({ key: localDateKey(d), inMonth: false, date: d })
    }
    for (let day = 1; day <= last.getDate(); day++) {
      const d = new Date(y, m, day)
      cells.push({ key: localDateKey(d), inMonth: true, date: d })
    }
    while (cells.length % 7 !== 0) {
      const d = new Date(y, m + 1, cells.length - startPad - last.getDate() + 1)
      cells.push({ key: localDateKey(d), inMonth: false, date: d })
    }
    return cells
  }, [cursor])

  const viewable = data?.viewable_users || [{ id: session.id, name: session.name }]
  const showPicker = (isOwner || isManager || isHr) && viewable.length > 1
  const dayDetail = selectedDay ? (data?.days?.[selectedDay] || {}) : null
  const selectedDate = selectedDay ? new Date(selectedDay + 'T12:00:00') : null
  const dayLabel = selectedDate
    ? selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''
  const subtitle = isCompanyView
    ? 'Company-wide tasks, leave, and attendance'
    : isOwner || isManager || isHr
      ? `Assigned tasks — ${data?.user?.name || session.name}`
      : 'Your assigned tasks, leave, and attendance'

  const taskCount = dayDetail?.tasks?.length || 0
  const leaveCount = dayDetail?.leave?.length || 0
  const isEmptyDay = !taskCount && !leaveCount && !dayDetail?.attendance

  return (
    <PageShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, flexShrink: 0 }}>
        <PageHeader
          title={isCompanyView ? 'Company Calendar' : 'My Calendar'}
          subtitle={subtitle}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {showPicker && (
            <select value={selectedUser} onChange={e => { setSelectedUser(e.target.value); setSelectedDay(null) }} style={selectStyle}>
              {viewable.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
          <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} style={navBtn}>Prev</button>
          <span style={{ color: 'var(--sf-text)', fontWeight: 600, minWidth: 130, textAlign: 'center', fontSize: 14 }}>
            {cursor.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} style={navBtn}>Next</button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading calendar…</div>
      ) : (
        <Section title="Month view" subtitle={`${data?.user?.name || session.name} · click a date for details`} flush flex={1}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--sf-border)', flexShrink: 0 }}>
            {WEEKDAYS.map(w => (
              <div key={w} style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--sf-muted)', fontSize: 11, fontWeight: 600, background: 'var(--sf-surface-2)' }}>{w}</div>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {grid.map(cell => {
                const info = data?.days?.[cell.key]
                const tasksN = info?.tasks?.length || 0
                const leaveN = info?.leave?.length || 0
                const att = info?.attendance
                const isToday = cell.key === localDateKey(new Date())
                const isSelected = selectedDay === cell.key
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => cell.inMonth && setSelectedDay(cell.key)}
                    className={`sf-cal-cell${isSelected ? ' sf-cal-cell-selected' : ''}${isToday ? ' sf-cal-cell-today' : ''}`}
                    style={{
                      opacity: cell.inMonth ? 1 : 0.4,
                      background: !isSelected && !cell.inMonth ? 'var(--sf-surface-2)' : undefined,
                      cursor: cell.inMonth ? 'pointer' : 'default',
                    }}
                  >
                    <div className="sf-cal-day-num">{cell.date.getDate()}</div>
                    {tasksN > 0 && <div style={pill('#2563eb')}>{tasksN} task{tasksN > 1 ? 's' : ''}</div>}
                    {leaveN > 0 && <div style={pill('#7c3aed')}>{leaveN} on leave</div>}
                    {isCompanyView && att?.present_count > 0 && (
                      <div style={pill('#059669')}>{att.present_count} present</div>
                    )}
                    {!isCompanyView && att?.clocked_in && <div style={pill('#059669')}>Clocked in</div>}
                  </button>
                )
              })}
            </div>
          </div>
        </Section>
      )}

      <Modal
        open={Boolean(selectedDay)}
        onClose={() => setSelectedDay(null)}
        title=""
        width={640}
        zIndex={1100}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/tasks" className="sf-btn sf-btn-ghost" style={{ textDecoration: 'none' }} onClick={() => setSelectedDay(null)}>
              All tasks
            </Link>
            <button type="button" className="sf-btn sf-btn-primary" onClick={() => setSelectedDay(null)}>
              Close
            </button>
          </div>
        }
      >
        {selectedDate && (
          <div className="sf-cal-day-hero">
            <div className="sf-cal-day-hero-date">
              <span className="sf-cal-day-hero-num">{selectedDate.getDate()}</span>
              <div>
                <div className="sf-cal-day-hero-weekday">{selectedDate.toLocaleDateString(undefined, { weekday: 'long' })}</div>
                <div className="sf-cal-day-hero-full">{dayLabel}</div>
              </div>
            </div>
            <div className="sf-cal-day-stats">
              <span className="sf-cal-stat sf-cal-stat-tasks">{taskCount} task{taskCount === 1 ? '' : 's'}</span>
              <span className="sf-cal-stat sf-cal-stat-leave">{leaveCount} leave</span>
              {dayDetail?.attendance && !isCompanyView && (
                <span className="sf-cal-stat sf-cal-stat-att">
                  {dayDetail.attendance.clocked_in ? 'Clocked in' : `${dayDetail.attendance.hours_worked ?? 0}h logged`}
                </span>
              )}
              {isCompanyView && dayDetail?.attendance && (
                <span className="sf-cal-stat sf-cal-stat-att">
                  {dayDetail.attendance.present_count} present
                </span>
              )}
            </div>
          </div>
        )}

        {dayDetail && (
          <div className="sf-cal-day-body">
            {dayDetail.tasks?.length > 0 && (
              <section className="sf-cal-section">
                <h3 className="sf-cal-section-title">Tasks due this day</h3>
                <div className="sf-cal-task-list">
                  {dayDetail.tasks.map((t: any) => {
                    const priColor = PRIORITY_COLORS[t.priority || 'Low'] || PRIORITY_COLORS.Low
                    const canStart = t.status === 'Not Started'
                    const needsReview = t.requires_review && t.status === 'Under Review'
                    return (
                      <article key={t.id} className="sf-cal-task-card" style={{ borderLeftColor: priColor }}>
                        <div className="sf-cal-task-head">
                          <div className="sf-cal-task-main">
                            <div className="sf-cal-task-title">{t.title}</div>
                            <div className="sf-cal-task-meta">
                              {t.brand_name && <span>{t.brand_name}</span>}
                              {t.type && <span>{t.type}</span>}
                              {t.priority && <span style={{ color: priColor, fontWeight: 700 }}>{t.priority}</span>}
                            </div>
                            {t.assignees?.length > 0 && (
                              <div className="sf-cal-task-assignees">{t.assignees.join(' · ')}</div>
                            )}
                          </div>
                          <StatusBadge status={t.status} />
                        </div>
                        <div className="sf-cal-task-actions">
                          <Link
                            href={`/tasks/${t.id}`}
                            className="sf-btn sf-btn-primary"
                            style={{ textDecoration: 'none', fontSize: 12 }}
                            onClick={() => setSelectedDay(null)}
                          >
                            Open task
                          </Link>
                          <Link
                            href={`/tasks/${t.id}?tab=files`}
                            className="sf-btn sf-btn-ghost"
                            style={{ textDecoration: 'none', fontSize: 12 }}
                            onClick={() => setSelectedDay(null)}
                          >
                            Files & upload
                          </Link>
                          {canStart && (
                            <Link
                              href={`/tasks/${t.id}`}
                              className="sf-btn sf-btn-ghost"
                              style={{ textDecoration: 'none', fontSize: 12 }}
                              onClick={() => setSelectedDay(null)}
                            >
                              Start work
                            </Link>
                          )}
                          {needsReview && (isOwner || isManager) && (
                            <Link
                              href={`/tasks/${t.id}?tab=review`}
                              className="sf-btn sf-btn-ghost"
                              style={{ textDecoration: 'none', fontSize: 12 }}
                              onClick={() => setSelectedDay(null)}
                            >
                              Review
                            </Link>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )}

            {dayDetail.leave?.length > 0 && (
              <section className="sf-cal-section">
                <h3 className="sf-cal-section-title">Leave</h3>
                <div className="sf-cal-leave-list">
                  {dayDetail.leave.map((l: any) => (
                    <div key={l.id} className="sf-cal-leave-card">
                      <div>
                        <div className="sf-cal-leave-type">{l.user_name ? `${l.user_name} — ${l.leave_type}` : l.leave_type}</div>
                        {l.days != null && <div className="sf-cal-leave-sub">{l.days} day(s) total</div>}
                      </div>
                      <span className={`sf-cal-leave-status sf-cal-leave-status-${String(l.status || 'pending').toLowerCase()}`}>
                        {l.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {dayDetail.attendance && (
              <section className="sf-cal-section">
                <h3 className="sf-cal-section-title">Attendance</h3>
                <div className="sf-cal-att-card">
                  {isCompanyView ? (
                    <>
                      <div className="sf-cal-att-row">
                        <span>Team logged in</span>
                        <strong>{dayDetail.attendance.present_count}</strong>
                      </div>
                      <div className="sf-cal-att-row">
                        <span>Currently active</span>
                        <strong>{dayDetail.attendance.clocked_in_count}</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="sf-cal-att-row">
                        <span>Status</span>
                        <strong>{dayDetail.attendance.clocked_in ? 'Clocked in' : 'Not clocked in'}</strong>
                      </div>
                      <div className="sf-cal-att-row">
                        <span>Hours logged</span>
                        <strong>{dayDetail.attendance.hours_worked != null ? `${dayDetail.attendance.hours_worked}h` : '—'}</strong>
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}

            {isEmptyDay && (
              <div className="sf-cal-empty">
                <div className="sf-cal-empty-icon">📅</div>
                <div className="sf-cal-empty-title">Clear day</div>
                <div className="sf-cal-empty-text">No tasks, leave, or attendance logged for this date.</div>
                <Link href="/tasks" className="sf-btn sf-btn-ghost" style={{ textDecoration: 'none', marginTop: 8 }} onClick={() => setSelectedDay(null)}>
                  Browse all tasks
                </Link>
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageShell>
  )
}

const pill = (color: string) => ({
  color,
  fontSize: 10,
  fontWeight: 600,
  marginBottom: 3,
})

const selectStyle: any = {
  background: 'var(--sf-input-bg)',
  border: '1px solid var(--sf-border)',
  color: 'var(--sf-text)',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
}

const navBtn: any = {
  background: 'var(--sf-surface)',
  border: '1px solid var(--sf-border)',
  color: 'var(--sf-text)',
  borderRadius: 8,
  padding: '8px 12px',
  cursor: 'pointer',
  fontSize: 12,
}
