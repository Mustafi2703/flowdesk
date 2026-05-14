export type TaskStatus =
  | "assigned"
  | "in_progress"
  | "submitted"
  | "issue"
  | "reviewed"
  | "closed"
  | "changes";

export type TimelineEvent = {
  by: string;
  action: string;
  at: string;
  note?: string;
};

export type TaskDTO = {
  id: string;
  title: string;
  desc: string;
  brand: string;
  assignedTo: string;
  assignedBy: string;
  priority: string;
  due: string;
  status: TaskStatus;
  createdAt: string;
  timeline: TimelineEvent[];
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  dept: string;
  avatar: string;
  canAssign: boolean;
};
