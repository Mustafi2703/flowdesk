/** Broadcast when clock-in state changes so task pages refresh without reload. */
export const ATTENDANCE_CHANGED = 'sf-attendance-changed'

export function notifyAttendanceChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ATTENDANCE_CHANGED))
  }
}
