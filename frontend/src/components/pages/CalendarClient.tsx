// @ts-nocheck
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { SessionUser } from '@/types'
import { PageHeader, PageShell, PageToolbar, Section } from '@/components/app/Section'
import { StatusBadge } from '@/components/app/StatusBadge'
import { Icon } from '@/components/app/Icons'

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

function DayDetailPanel({
  selectedDay,
  dayDetail,
  isCompanyView,
  isOwner,
  isManager,
  onClear,
}: {
  selectedDay: string | null
  dayDetail: any
  isCompanyView: boolean
  isOwner: boolean
  isManager: boolean
  onClear: () => void
}) {
  if (!selectedDay) {
    return (
      <aside className="sf-cal-side sf-cal-side-empty">
        <div className="sf-cal-side-empty-icon" aria-hidden>
          <Icon name="calendar" size={28} />
        </div>
        <div className="sf-cal-side-empty-title">Select a date</div>
        <p className="sf-cal-side-empty-text">
          Click any day in the month grid to review tasks, leave, and attendance for that date.
        </p>
      </aside>
    )
  }

  const selectedDate = new Date(selectedDay + 'T12:00:00')
  const dayLabel = selectedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const taskCount = dayDetail?.tasks?.length || 0
  const leaveCount = dayDetail?.leave?.length || 0
  const isEmptyDay = !taskCount && !leaveCount && !dayDetail?.attendance

  return (
    <aside className="sf-cal-side">
      <div className="sf-cal-side-head">
        <div className="sf-cal-day-hero-date">
          <span className="sf-cal-day-hero-num">{selectedDate.getDate()}</span>
          <div>
            <div className="sf-cal-day-hero-weekday">
              {selectedDate.toLocaleDateString(undefined, { weekday: 'long' })}
            </div>
            <div className="sf-cal-day-hero-full">{dayLabel}</div>
          </div>
        </div>
        <button type="button" className="sf-btn sf-btn-ghost sf-cal-side-close" onClick={onClear} aria-label="Clear selection">
          ✕
        </button>
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

      <div className="sf-cal-side-body">
        {dayDetail?.tasks?.length > 0 && (
          <section className="sf-cal-section">
            <h3 className="sf-cal-section-title">Tasks due</h3>
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
                      <Link href={`/tasks/${t.id}`} className="sf-btn sf-btn-primary" style={{ textDecoration: 'none', fontSize: 12 }}>
                        Open task
                      </Link>
                      <Link href={`/tasks/${t.id}?tab=files`} className="sf-btn sf-btn-ghost" style={{ textDecoration: 'none', fontSize: 12 }}>
                        Files
                      </Link>
                      {canStart && (
                        <Link href={`/tasks/${t.id}`} className="sf-btn sf-btn-ghost" style={{ textDecoration: 'none', fontSize: 12 }}>
                          Start work
                        </Link>
                      )}
                      {needsReview && (isOwner || isManager) && (
                        <Link href={`/tasks/${t.id}?tab=review`} className="sf-btn sf-btn-ghost" style={{ textDecoration: 'none', fontSize: 12 }}>
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

        {dayDetail?.leave?.length > 0 && (
          <section className="sf-cal-section">
            <h3 className="sf-cal-section-title">Leave</h3>
            <div className="sf-cal-leave-list">
              {dayDetail.leave.map((l: any) => (
                <div key={l.id} className="sf-cal-leave-card">
                  <div>
                    <div className="sf-cal-leave-type">
                      {l.user_name ? `${l.user_name} — ${l.leave_type}` : l.leave_type}
                    </div>
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

        {dayDetail?.attendance && (
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
            <div className="sf-cal-empty-icon" aria-hidden>
              <Icon name="calendar" size={24} />
            </div>
            <div className="sf-cal-empty-title">Clear day</div>
            <div className="sf-cal-empty-text">No tasks, leave, or attendance logged for this date.</div>
            <Link href="/tasks" className="sf-btn sf-btn-ghost" style={{ textDecoration: 'none', marginTop: 8 }}>
              Browse all tasks
            </Link>
          </div>
        )}
      </div>

      <div className="sf-cal-side-foot">
        <Link href="/tasks" className="sf-btn sf-btn-ghost" style={{ textDecoration: 'none' }}>
          All tasks
        </Link>
      </div>
    </aside>
  )
}

export default function CalendarClient({ session }: { session: SessionUser }) {
  const isOwner = session.role === 'owner'
  const isManager = session.role === 'manager'
  const isHr = session.role === 'hr'
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedUser, setSelectedUser] = useState(isOwner ? COMPANY : session.id)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(() => localDateKey(new Date()))

  const month = monthKey(cursor)
  const isCompanyView = selectedUser === COMPANY
  const todayKey = localDateKey(new Date())

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

  const monthStats = useMemo(() => {
    if (!data?.days) return { tasks: 0, leaveDays: 0, busyDays: 0 }
    let tasks = 0
    let leaveDays = 0
    let busyDays = 0
    for (const [key, day] of Object.entries<any>(data.days)) {
      if (!key.startsWith(month)) continue
      const t = day?.tasks?.length || 0
      const l = day?.leave?.length || 0
      tasks += t
      if (l) leaveDays += 1
      if (t || l) busyDays += 1
    }
    return { tasks, leaveDays, busyDays }
  }, [data, month])

  const viewable = data?.viewable_users || [{ id: session.id, name: session.name }]
  const showPicker = (isOwner || isManager || isHr) && viewable.length > 1
  const dayDetail = selectedDay ? (data?.days?.[selectedDay] || {}) : null
  const subtitle = isCompanyView
    ? 'Company-wide tasks, leave, and attendance'
    : isOwner || isManager || isHr
      ? `Assigned tasks — ${data?.user?.name || session.name}`
      : 'Your assigned tasks, leave, and attendance'

  function goToday() {
    const now = new Date()
    setCursor(now)
    setSelectedDay(localDateKey(now))
  }

  return (
    <PageShell fill className="sf-cal-page">
      <PageToolbar>
        <PageHeader
          title={isCompanyView ? 'Company Calendar' : 'My Calendar'}
          subtitle={subtitle}
        />
        <div className="sf-cal-toolbar">
          {showPicker && (
            <select
              className="sf-cal-select"
              value={selectedUser}
              onChange={e => { setSelectedUser(e.target.value); setSelectedDay(null) }}
            >
              {isOwner && <option value={COMPANY}>Company view</option>}
              {viewable.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
          <div className="sf-cal-nav">
            <button type="button" className="sf-cal-nav-btn" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month">
              <Icon name="chevron-left" size={16} />
            </button>
            <span className="sf-cal-month-label">
              {cursor.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" className="sf-cal-nav-btn" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month">
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
          <button type="button" className="sf-btn sf-btn-ghost sf-cal-today-btn" onClick={goToday}>
            Today
          </button>
        </div>
      </PageToolbar>

      <div className="sf-cal-summary">
        <div className="sf-cal-summary-stat">
          <span className="sf-cal-summary-value">{monthStats.tasks}</span>
          <span className="sf-cal-summary-label">Tasks this month</span>
        </div>
        <div className="sf-cal-summary-stat">
          <span className="sf-cal-summary-value">{monthStats.busyDays}</span>
          <span className="sf-cal-summary-label">Days with work</span>
        </div>
        <div className="sf-cal-summary-stat">
          <span className="sf-cal-summary-value">{monthStats.leaveDays}</span>
          <span className="sf-cal-summary-label">Leave days</span>
        </div>
        <div className="sf-cal-legend">
          <span className="sf-cal-legend-item"><i className="sf-cal-dot sf-cal-dot-task" /> Task</span>
          <span className="sf-cal-legend-item"><i className="sf-cal-dot sf-cal-dot-leave" /> Leave</span>
          <span className="sf-cal-legend-item"><i className="sf-cal-dot sf-cal-dot-att" /> Attendance</span>
        </div>
      </div>

      {loading ? (
        <div className="sf-cal-loading">Loading calendar…</div>
      ) : (
        <div className="sf-cal-workspace">
          <Section
            title="Month view"
            subtitle={`${data?.user?.name || session.name} · ${cursor.toLocaleString('default', { month: 'long' })}`}
            flush
            flex={1}
            className="sf-cal-grid-section"
          >
            <div className="sf-cal-weekdays">
              {WEEKDAYS.map(w => (
                <div key={w} className="sf-cal-weekday">{w}</div>
              ))}
            </div>
            <div className="sf-cal-grid-scroll">
              <div className="sf-cal-grid">
                {grid.map(cell => {
                  const info = data?.days?.[cell.key]
                  const tasks = info?.tasks || []
                  const tasksN = tasks.length
                  const leaveN = info?.leave?.length || 0
                  const att = info?.attendance
                  const isToday = cell.key === todayKey
                  const isSelected = selectedDay === cell.key
                  const visibleTasks = tasks.slice(0, 2)
                  const overflow = tasksN - visibleTasks.length

                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => cell.inMonth && setSelectedDay(cell.key)}
                      className={[
                        'sf-cal-cell',
                        isSelected ? 'sf-cal-cell-selected' : '',
                        isToday ? 'sf-cal-cell-today' : '',
                        cell.inMonth ? '' : 'sf-cal-cell-out',
                      ].filter(Boolean).join(' ')}
                      disabled={!cell.inMonth}
                    >
                      <div className="sf-cal-cell-top">
                        <span className="sf-cal-day-num">{cell.date.getDate()}</span>
                        {(tasksN > 0 || leaveN > 0) && (
                          <span className="sf-cal-cell-count">{tasksN + leaveN}</span>
                        )}
                      </div>
                      <div className="sf-cal-cell-events">
                        {visibleTasks.map((t: any) => (
                          <span
                            key={t.id}
                            className="sf-cal-event sf-cal-event-task"
                            style={{ '--event-color': PRIORITY_COLORS[t.priority || 'Low'] || PRIORITY_COLORS.Low } as React.CSSProperties}
                            title={t.title}
                          >
                            {t.title}
                          </span>
                        ))}
                        {overflow > 0 && (
                          <span className="sf-cal-event sf-cal-event-more">+{overflow} more</span>
                        )}
                        {leaveN > 0 && (
                          <span className="sf-cal-event sf-cal-event-leave">
                            {leaveN} on leave
                          </span>
                        )}
                        {isCompanyView && att?.present_count > 0 && (
                          <span className="sf-cal-event sf-cal-event-att">
                            {att.present_count} present
                          </span>
                        )}
                        {!isCompanyView && att?.clocked_in && (
                          <span className="sf-cal-event sf-cal-event-att">Clocked in</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </Section>

          <DayDetailPanel
            selectedDay={selectedDay}
            dayDetail={dayDetail}
            isCompanyView={isCompanyView}
            isOwner={isOwner}
            isManager={isManager}
            onClear={() => setSelectedDay(null)}
          />
        </div>
      )}
    </PageShell>
  )
}
