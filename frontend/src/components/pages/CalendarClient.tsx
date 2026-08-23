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
  const dayLabel = selectedDay
    ? new Date(selectedDay + 'T12:00:00').toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : ''
  const subtitle = isCompanyView
    ? 'Company-wide tasks, leave, and attendance'
    : isOwner || isManager || isHr
      ? `Assigned tasks — ${data?.user?.name || session.name}`
      : 'Your assigned tasks, leave, and attendance'

  const taskCount = dayDetail?.tasks?.length || 0
  const leaveCount = dayDetail?.leave?.length || 0

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
                    style={{
                      minHeight: 96,
                      padding: 8,
                      border: 'none',
                      borderRight: '1px solid var(--sf-border)',
                      borderBottom: '1px solid var(--sf-border)',
                      background: isSelected ? 'var(--sf-accent-soft)' : cell.inMonth ? 'transparent' : 'var(--sf-surface-2)',
                      cursor: cell.inMonth ? 'pointer' : 'default',
                      textAlign: 'left',
                      opacity: cell.inMonth ? 1 : 0.4,
                      transition: 'background 0.12s ease',
                    }}
                  >
                    <div style={{ color: isToday ? 'var(--sf-accent)' : 'var(--sf-text)', fontWeight: isToday ? 700 : 500, fontSize: 13, marginBottom: 6 }}>
                      {cell.date.getDate()}
                    </div>
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
        title={dayLabel || 'Day detail'}
        subtitle={
          selectedDay
            ? `${taskCount} task${taskCount === 1 ? '' : 's'} · ${leaveCount} leave`
            : undefined
        }
        width={560}
        footer={
          <button type="button" className="sf-btn sf-btn-primary" onClick={() => setSelectedDay(null)}>
            Close
          </button>
        }
      >
        {dayDetail && (
          <>
            {dayDetail.tasks?.length > 0 && (
              <Block title="Tasks due">
                {dayDetail.tasks.map((t: any) => (
                  <Link
                    key={t.id}
                    href={`/tasks/${t.id}`}
                    onClick={() => setSelectedDay(null)}
                    style={{ ...rowStyle, textDecoration: 'none' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{t.title}</div>
                      {t.assignees?.length > 0 && (
                        <div style={{ color: 'var(--sf-muted)', fontSize: 11, marginTop: 2 }}>{t.assignees.join(', ')}</div>
                      )}
                    </div>
                    <StatusBadge status={t.status} />
                  </Link>
                ))}
              </Block>
            )}
            {dayDetail.leave?.length > 0 && (
              <Block title="Leave">
                {dayDetail.leave.map((l: any) => (
                  <div key={l.id} style={rowStyle}>
                    <span>{l.user_name ? `${l.user_name} — ${l.leave_type}` : l.leave_type}</span>
                    <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{l.status}</span>
                  </div>
                ))}
              </Block>
            )}
            {dayDetail.attendance && !isCompanyView && (
              <Block title="Attendance">
                <div style={rowStyle}>
                  <span>{dayDetail.attendance.clocked_in ? 'Currently clocked in' : 'Hours logged'}</span>
                  <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>
                    {dayDetail.attendance.hours_worked != null ? `${dayDetail.attendance.hours_worked}h` : '—'}
                  </span>
                </div>
              </Block>
            )}
            {isCompanyView && dayDetail.attendance && (
              <Block title="Attendance">
                <div style={rowStyle}>
                  <span>Team present</span>
                  <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>
                    {dayDetail.attendance.present_count} logged · {dayDetail.attendance.clocked_in_count} active
                  </span>
                </div>
              </Block>
            )}
            {!dayDetail.tasks?.length && !dayDetail.leave?.length && !dayDetail.attendance && (
              <div style={{ color: 'var(--sf-muted)', fontSize: 14, textAlign: 'center', padding: '24px 8px' }}>
                Nothing scheduled for this day.
              </div>
            )}
          </>
        )}
      </Modal>
    </PageShell>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
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

const rowStyle: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  background: 'var(--sf-surface-2)',
  borderRadius: 10,
  marginBottom: 6,
  color: 'var(--sf-text)',
  fontSize: 13,
}
