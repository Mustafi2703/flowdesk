import type { Task } from "@prisma/client";
import type { TaskDTO, TaskStatus, TimelineEvent } from "./types";

export function toTaskDTO(row: Task): TaskDTO {
  const timeline = (row.timeline as TimelineEvent[]) ?? [];
  return {
    id: row.id,
    title: row.title,
    desc: row.desc,
    brand: row.brand,
    assignedTo: row.assignedTo,
    assignedBy: row.assignedBy,
    priority: row.priority,
    due: row.due.toISOString().slice(0, 10),
    status: row.status as TaskStatus,
    createdAt: row.createdAt.toISOString().slice(0, 10),
    timeline,
  };
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
