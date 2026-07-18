export type Role = 'owner' | 'manager' | 'team' | 'hr' | 'accountant' | 'developer'

export interface Profile {
  id: string; name: string; email: string; role: Role
  department: string | null; designation: string | null; avatar: string | null
  is_active: boolean; leaves_total: number; leaves_taken: number
  manager_id: string | null
  created_at: string; updated_at: string
}

export type TaskStatus = 'Not Started' | 'In Progress' | 'Under Review' | 'Revision Needed' | 'Completed' | 'On Hold' | 'Struggling' | 'Needs Attention'
export type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low'
export type TaskType = 'Design' | 'Content' | 'Development' | 'Strategy' | 'Operations' | 'Other'

export interface ChecklistItem { id: string; text: string; done: boolean }
export interface SubTask { id: string; title: string; assigned_to: string[]; status: string; due_date: string; completed_at?: string }
export interface RecurringConfig { enabled: boolean; frequency: string; day_of_month?: number; next_due: string }

export interface Task {
  id: string; title: string; description: string | null; brand_id: string | null
  assigned_to: string[]; assigned_managers: string[]; created_by: string | null
  type: TaskType | null; task_mode: 'standard' | 'project'; priority: TaskPriority | null
  status: TaskStatus; start_date: string | null; due_date: string | null
  requires_review: boolean; is_billable: boolean; billable_amount: number | null
  billed_at: string | null; checklist: ChecklistItem[]; sub_tasks: SubTask[]
  recurring_config: RecurringConfig | null; created_at: string; updated_at: string
  brand?: { id: string; name: string; logo: string | null }
}

export interface Brand {
  id: string; name: string; logo: string | null; logo_url?: string | null
  description: string | null
  client_type: string | null; priority: string | null
  workflow_stage?: string | null
  short_term_goals: string[]; long_term_goals: string[]
  journey: string[]
  responsibilities: string | null; assigned_members: string[]
  created_at: string; updated_at: string
}

export interface AttendanceLog {
  id: string; user_id: string; date: string
  login_time: string | null; logout_time: string | null; hours_worked: number
}

export interface LeaveRequest {
  id: string; user_id: string; leave_type: string; start_date: string
  end_date: string; days: number; reason: string | null
  status: 'Pending' | 'Approved' | 'Rejected'
  created_at: string; user?: Profile
}

export interface Announcement {
  id: string; title: string; body: string | null
  priority: 'Normal' | 'Important' | 'Urgent'
  created_by: string | null; read_by: string[]; created_at: string
  creator?: { name: string; avatar: string | null }
}

export interface Notification {
  id: string; user_id: string; message: string | null
  type: string; is_read: boolean; created_at: string
}

export interface SessionUser {
  id: string; name: string; email: string; role: Role; avatar: string | null
}

export const ROLE_COLORS: Record<string, string> = {
  owner: '#E8630A', manager: '#3B82F6', team: '#10B981',
  hr: '#8B5CF6', accountant: '#EC4899', developer: '#10B981',
}

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', manager: 'Manager', team: 'Team Member',
  hr: 'HR Manager', accountant: 'Accounts', developer: 'Team Member',
}

export const STATUS_BG: Record<string, string> = {
  'Not Started': '#F1F5F9', 'In Progress': '#DBEAFE', 'Under Review': '#F3E8FF',
  'Revision Needed': '#FFEDD5', 'Completed': '#DCFCE7', 'On Hold': '#F3F4F6',
  'Struggling': '#FEE2E2', 'Needs Attention': '#FEF9C3',
}

export const STATUS_TEXT: Record<string, string> = {
  'Not Started': '#475569', 'In Progress': '#1D4ED8', 'Under Review': '#7E22CE',
  'Revision Needed': '#C2410C', 'Completed': '#15803D', 'On Hold': '#4B5563',
  'Struggling': '#B91C1C', 'Needs Attention': '#92400E',
}

export type NavIcon =
  | 'dashboard'
  | 'calendar'
  | 'tasks'
  | 'code'
  | 'brands'
  | 'team'
  | 'performance'
  | 'attendance'
  | 'leave'
  | 'announcements'
  | 'billing'
  | 'inbox'

export const NAV_ITEMS = [
  { id: 'overview',      label: 'Dashboard',     icon: 'dashboard' as NavIcon, roles: ['owner','manager','team','hr','accountant'] },
  { id: 'calendar',      label: 'Calendar',      icon: 'calendar' as NavIcon, roles: ['owner','manager','team','hr','accountant'] },
  { id: 'tasks',         label: 'Tasks',         icon: 'tasks' as NavIcon, roles: ['owner','manager','team'] },
  { id: 'updates',       label: 'Updates',       icon: 'inbox' as NavIcon, roles: ['owner','manager','team','hr','accountant'] },
  { id: 'devboard',      label: 'Workflow',      icon: 'code' as NavIcon, roles: ['owner','manager','team'] },
  { id: 'brands',        label: 'Brands',        icon: 'brands' as NavIcon, roles: ['owner','manager','hr','accountant','team'] },
  { id: 'team',          label: 'Team',          icon: 'team' as NavIcon, roles: ['owner','manager','hr'] },
  { id: 'performance',   label: 'Performance',   icon: 'performance' as NavIcon, roles: ['owner','manager','hr','team'] },
  { id: 'attendance',    label: 'Attendance',    icon: 'attendance' as NavIcon, roles: ['owner','manager','team','hr','accountant'] },
  { id: 'leave',         label: 'Leave',         icon: 'leave' as NavIcon, roles: ['owner','manager','team','hr','accountant'] },
  { id: 'announcements', label: 'Announcements', icon: 'announcements' as NavIcon, roles: ['owner','manager','team','hr','accountant'] },
  { id: 'billing',       label: 'Billing',       icon: 'billing' as NavIcon, roles: ['owner','manager','accountant'] },
] as const
