import type { Task } from "@prisma/client";
import type { TaskStatus, TimelineEvent } from "./types";
import { isManagerId } from "./constants";
import { todayISO } from "./serialize-task";

export type PatchBody = {
  actorId: string;
  action: "start" | "submit" | "issue" | "approve" | "changes" | "close" | "resubmit";
  note?: string;
};

/** Applies a workflow action; throws string messages for client errors. */
export function applyPatch(task: Task, body: PatchBody): { status: TaskStatus; timeline: TimelineEvent[] } {
  const { actorId, action, note = "" } = body;
  const n = note.trim();
  const timeline = [...((task.timeline as TimelineEvent[]) ?? [])];
  const at = todayISO();
  const assignee = task.assignedTo === actorId;
  const manager = isManagerId(actorId);

  const push = (actionLabel: string, noteText?: string) => {
    timeline.push({
      by: actorId,
      action: actionLabel,
      at,
      ...(noteText ? { note: noteText } : {}),
    });
  };

  const current = task.status as TaskStatus;

  if (action === "start") {
    if (!assignee || manager) throw new Error("Only the assignee can start this task.");
    if (current !== "assigned") throw new Error("Task is not in assigned state.");
    push("Started work");
    return { status: "in_progress", timeline };
  }

  if (action === "submit") {
    if (!assignee || manager) throw new Error("Only the assignee can submit.");
    if (current !== "in_progress" && current !== "changes") throw new Error("Cannot submit from this state.");
    if (!n) throw new Error("Add a note before submitting.");
    push("Submitted for review", n);
    return { status: "submitted", timeline };
  }

  if (action === "issue") {
    if (!assignee || manager) throw new Error("Only the assignee can raise an issue.");
    if (current !== "in_progress" && current !== "changes") throw new Error("Cannot raise issue from this state.");
    if (!n) throw new Error("Describe the issue first.");
    push("Raised issue", n);
    return { status: "issue", timeline };
  }

  if (action === "resubmit") {
    if (!assignee || manager) throw new Error("Only the assignee can re-submit.");
    if (current !== "issue") throw new Error("Cannot re-submit from this state.");
    if (!n) throw new Error("Add a note about changes made.");
    push("Submitted for review", n);
    return { status: "submitted", timeline };
  }

  if (action === "approve") {
    if (!manager) throw new Error("Only a manager can approve.");
    if (current === "submitted" || current === "issue") {
      push("Reviewed & approved", n || "Approved.");
      return { status: "reviewed", timeline };
    }
    if (current === "reviewed") {
      throw new Error("Already reviewed; close the task instead.");
    }
    throw new Error("Cannot approve from this state.");
  }

  if (action === "changes") {
    if (!manager) throw new Error("Only a manager can request changes.");
    if (current !== "submitted" && current !== "issue") throw new Error("Nothing to change from this state.");
    if (!n) throw new Error("Describe what needs to change.");
    push("Requested changes", n);
    return { status: "changes", timeline };
  }

  if (action === "close") {
    if (!manager) throw new Error("Only a manager can close.");
    if (current !== "reviewed") throw new Error("Approve before closing.");
    push("Closed task", n || "Task closed.");
    return { status: "closed", timeline };
  }

  throw new Error("Unknown action.");
}

/** Used when creating a task from the assign form. */
export function timelineForNewAssignment(actorId: string): TimelineEvent[] {
  return [{ by: actorId, action: "Assigned task", at: todayISO() }];
}
