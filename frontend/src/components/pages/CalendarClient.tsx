// @ts-nocheck
'use client'

import { useEffect, useMemo, useState } from 'react'
import { SessionUser } from '@/types'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function CalendarClient({ session }: { session: SessionUser }) {
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedUser, setSelectedUser] = useState(session.id)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const month = monthKey(cursor)

  useEffect(() => {
    setLoading(true)
    const qs = selectedUser !== session.id ? `&user_id=${selectedUser}` : ''
    fetch(`/api/calendar?month=${month}${qs}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [month, selectedUser, session.id])

  const grid = useMemo(() => {
    const y = cursor.getFullYear()
    const m = cursor.getMonth()
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    const startPad = (first.getDay() + 6) % 7
    const cells: Array<{ key: string; inMonth: boolean; date: Date }> = []
    for (let i = 0; i < startPad; i++) {
      const d = new Date(y, m, 1 - (startPad - i))
      cells.push({ key: d.toISOString().slice(0, 10), inMonth: false, date: d })
    }
    for (let day = 1; day <= last.getDate(); day++) {
      const d = new Date(y, m, day)
      cells.push({ key: d.toISOString().slice(0, 10), inMonth: true, date: d })
    }
    while (cells.length % 7 !== 0) {
      const d = new Date(y, m + 1, cells.length - startPad - last.getDate() + 1)
      cells.push({ key: d.toISOString().slice(0, 10), inMonth: false, date: d })
    }
    return cells
  }, [cursor])

  const viewable = data?.viewable_users || [{ id: session.id, name: session.name }]
  const dayDetail = selectedDay && data?.days?.[selectedDay]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ color: 'var(--sf-text)', fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, margin: 0 }}>
            Calendar
          </h2>
          <p style={{ color: 'var(--sf-muted)', fontSize: 13, margin: '4px 0 0' }}>
            Tasks, leave, and attendance — {data?.user?.name || session.name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {viewable.length > 1 && (
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              style={selectStyle}
            >
              {viewable.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} style={navBtn}>←</button>
          <span style={{ color: 'var(--sf-text)', fontWeight: 700, minWidth: 140, textAlign: 'center' }}>
            {cursor.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} style={navBtn}>→</button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--sf-muted)', padding: 40, textAlign: 'center' }}>Loading calendar…</div>
      ) : (
        <>
          <div style={{ background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--sf-border)' }}>
              {WEEKDAYS.map(w => (
                <div key={w} style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--sf-muted)', fontSize: 11, fontWeight: 700 }}>{w}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {grid.map(cell => {
                const info = data?.days?.[cell.key]
                const taskCount = info?.tasks?.length || 0
                const leaveCount = info?.leave?.length || 0
                const att = info?.attendance
                const isToday = cell.key === new Date().toISOString().slice(0, 10)
                const isSelected = selectedDay === cell.key
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => cell.inMonth && setSelectedDay(cell.key)}
                    style={{
                      minHeight: 88,
                      padding: 8,
                      border: 'none',
                      borderRight: '1px solid var(--sf-border)',
                      borderBottom: '1px solid var(--sf-border)',
                      background: isSelected ? 'var(--sf-accent-soft)' : cell.inMonth ? 'transparent' : 'var(--sf-surface-2)',
                      cursor: cell.inMonth ? 'pointer' : 'default',
                      textAlign: 'left',
                      opacity: cell.inMonth ? 1 : 0.45,
                    }}
                  >
                    <div style={{
                      color: isToday ? 'var(--sf-accent)' : 'var(--sf-text)',
                      fontWeight: isToday ? 800 : 600,
                      fontSize: 13,
                      marginBottom: 6,
                    }}>
                      {cell.date.getDate()}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {taskCount > 0 && <span style={dot('#3B82F6')}>{taskCount} task{taskCount > 1 ? 's' : ''}</span>}
                      {leaveCount > 0 && <span style={dot('#8B5CF6')}>Leave</span>}
                      {att?.clocked_in && <span style={dot('#10B981')}>In</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {dayDetail && (
            <div style={{ marginTop: 18, background: 'var(--sf-surface)', border: '1px solid var(--sf-border)', borderRadius: 14, padding: 18 }}>
              <div style={{ color: 'var(--sf-text)', fontWeight: 800, marginBottom: 12 }}>
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              {dayDetail.tasks?.length > 0 && (
                <Section title="Tasks">
                  {dayDetail.tasks.map((t: any) => (
                    <div key={t.id} style={rowStyle}>
                      <span>{t.title}</span>
                      <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{t.status}</span>
                    </div>
                  ))}
                </Section>
              )}
              {dayDetail.leave?.length > 0 && (
                <Section title="Leave">
                  {dayDetail.leave.map((l: any) => (
                    <div key={l.id} style={rowStyle}>
                      <span>{l.leave_type}</span>
                      <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>{l.status}</span>
                    </div>
                  ))}
                </Section>
              )}
              {dayDetail.attendance && (
                <Section title="Attendance">
                  <div style={rowStyle}>
                    <span>{dayDetail.attendance.clocked_in ? 'Clocked in' : 'Logged hours'}</span>
                    <span style={{ color: 'var(--sf-muted)', fontSize: 11 }}>
                      {dayDetail.attendance.hours_worked != null ? `${dayDetail.attendance.hours_worked}h` : '—'}
                    </span>
                  </div>
                </Section>
              )}
              {!dayDetail.tasks?.length && !dayDetail.leave?.length && !dayDetail.attendance && (
                <div style={{ color: 'var(--sf-muted)', fontSize: 13 }}>Nothing scheduled for this day.</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: 'var(--sf-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  )
}

const dot = (color: string) => ({
  background: color + '22',
  color,
  fontSize: 9,
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: 999,
})

const selectStyle: any = {
  background: 'var(--sf-surface-2)',
  border: '1px solid var(--sf-border)',
  color: 'var(--sf-text)',
  borderRadius: 9,
  padding: '8px 10px',
}

const navBtn: any = {
  background: 'var(--sf-surface-2)',
  border: '1px solid var(--sf-border)',
  color: 'var(--sf-text)',
  borderRadius: 9,
  width: 36,
  height: 36,
  cursor: 'pointer',
}

const rowStyle: any = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 10px',
  background: 'var(--sf-surface-2)',
  borderRadius: 8,
  marginBottom: 6,
  color: 'var(--sf-text)',
  fontSize: 13,
}
