"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BRANDS,
  DEPT_COLOR,
  PRIORITIES,
  PRIORITY_COLOR,
  ROLE_LABELS,
  STATUS_META,
  TEAM,
  teamMember,
} from "@/lib/constants";
import type { TaskDTO, TeamMember } from "@/lib/types";

function Btn({
  label,
  color,
  onClick,
  ghost,
}: {
  label: string;
  color: string;
  onClick: () => void;
  ghost?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[10px] px-4 py-2 text-xs font-bold transition-all"
      style={{
        padding: "9px 16px",
        background: ghost ? "transparent" : `${color}22`,
        border: `1px solid ${color}55`,
        color,
        cursor: "pointer",
        fontFamily: "'Figtree',sans-serif",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = ghost ? `${color}18` : `${color}33`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = ghost ? "transparent" : `${color}22`;
      }}
    >
      {label}
    </button>
  );
}

export function FlowDeskApp() {
  const [loadState, setLoadState] = useState<"loading" | "ok" | "err">("loading");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [user, setUser] = useState<TeamMember | null>(null);
  const [view, setView] = useState("tasks");
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [reviewTab, setReviewTab] = useState("pending");
  const [nTask, setNTask] = useState({
    title: "",
    desc: "",
    assignedTo: "",
    brand: "Dinamoo",
    priority: "Medium",
    due: "",
  });
  const [saving, setSaving] = useState(false);

  const refreshTasks = useCallback(async () => {
    const r = await fetch("/api/tasks");
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Failed to load tasks.");
    }
    setTasks(data as TaskDTO[]);
  }, []);

  useEffect(() => {
    refreshTasks()
      .then(() => {
        setLoadState("ok");
        setLoadErr(null);
      })
      .catch((e: Error) => {
        setLoadState("err");
        setLoadErr(e.message);
      });
  }, [refreshTasks]);

  const isManager = user?.canAssign ?? false;
  const myTasks = user ? tasks.filter((t) => (isManager ? true : t.assignedTo === user.id)) : [];
  const filteredTasks = myTasks
    .filter((t) => filterStatus === "all" || t.status === filterStatus)
    .filter((t) => filterBrand === "all" || t.brand === filterBrand);

  const pendingReview = tasks.filter((t) => t.status === "submitted" || t.status === "issue");
  const selectedTask = selectedId ? tasks.find((t) => t.id === selectedId) ?? null : null;

  const assignerMembers = TEAM.filter((t) => !t.canAssign);

  const handleTaskAction = async (taskId: string, action: string) => {
    if (!user) return;
    const n = noteInput.trim();
    setSaving(true);
    try {
      const r = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: user.id, action, note: n }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(typeof data.error === "string" ? data.error : "Action failed.");
        return;
      }
      setNoteInput("");
      await refreshTasks();
    } finally {
      setSaving(false);
    }
  };

  const createTask = async () => {
    if (!user) return;
    if (!nTask.title || !nTask.assignedTo || !nTask.due) {
      alert("Fill title, assignee, and due date.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...nTask,
          assignedBy: user.id,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(typeof data.error === "string" ? data.error : "Could not create task.");
        return;
      }
      setNTask({ title: "", desc: "", assignedTo: "", brand: "Dinamoo", priority: "Medium", due: "" });
      await refreshTasks();
    } finally {
      setSaving(false);
    }
  };

  if (loadState === "loading") {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "#04070e", fontFamily: "'Figtree',sans-serif" }}
      >
        <div className="text-sm" style={{ color: "#475569" }}>
          Loading tasks…
        </div>
      </div>
    );
  }

  if (loadState === "err") {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: "#04070e", fontFamily: "'Figtree',sans-serif", color: "#e2e8f0" }}
      >
        <div style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: 28, fontWeight: 900 }}>FlowDesk</div>
        <p className="max-w-md text-sm" style={{ color: "#94a3b8" }}>
          {loadErr}
        </p>
        <p className="max-w-lg text-xs" style={{ color: "#475569" }}>
          Create a Postgres database on Railway, copy its connection string, set{" "}
          <code className="rounded bg-white/10 px-1">DATABASE_URL</code> in <code className="rounded bg-white/10 px-1">.env</code>, then run{" "}
          <code className="rounded bg-white/10 px-1">npx prisma migrate deploy</code> and{" "}
          <code className="rounded bg-white/10 px-1">npm run db:seed</code>.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "#04070e", fontFamily: "'Figtree',sans-serif" }}
      >
        <div
          className="max-h-[92vh] w-[540px] overflow-y-auto rounded-[28px] p-9"
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="mb-8 text-center">
            <div
              style={{
                fontFamily: "'Cabinet Grotesk',sans-serif",
                fontSize: 40,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "-1.5px",
              }}
            >
              FlowDesk
            </div>
            <div className="mt-1 text-[13px]" style={{ color: "#475569" }}>
              Scrumfolks · Select your profile to continue
            </div>
          </div>
          {Object.keys(DEPT_COLOR).map((dept) => {
            const members = TEAM.filter((t) => t.dept === dept);
            if (!members.length) return null;
            return (
              <div key={dept} className="mb-[18px]">
                <div
                  className="mb-2 pl-0.5 text-[10px] font-bold uppercase tracking-[4px]"
                  style={{ color: DEPT_COLOR[dept] }}
                >
                  {dept}
                </div>
                <div className="flex flex-wrap gap-[7px]">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setUser(m);
                        setView("tasks");
                      }}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all"
                      style={{
                        background: "rgba(255,255,255,0.035)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "#e2e8f0",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${DEPT_COLOR[dept]}18`;
                        e.currentTarget.style.borderColor = `${DEPT_COLOR[dept]}55`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.035)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                      }}
                    >
                      <div
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                        style={{ background: DEPT_COLOR[dept] }}
                      >
                        {m.avatar}
                      </div>
                      <div>
                        <div className="text-xs font-semibold leading-tight">{m.name}</div>
                        <div className="text-[10px]" style={{ color: "#475569" }}>
                          {ROLE_LABELS[m.role]}
                        </div>
                      </div>
                      {m.canAssign && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                          style={{ background: "rgba(249,115,22,0.2)", color: "#f97316" }}
                        >
                          MGR
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const col = DEPT_COLOR[user.dept];

  const NAV = [
    { id: "tasks", label: "My Tasks", icon: "✦", badge: isManager ? null : myTasks.filter((t) => t.status === "changes").length || null },
    { id: "review", label: "Review Queue", icon: "◎", badge: isManager ? pendingReview.length || null : null, managerOnly: true },
    { id: "assign", label: "Assign Tasks", icon: "+", managerOnly: true },
    { id: "all", label: "All Tasks", icon: "⊞", managerOnly: true },
  ].filter((n) => !n.managerOnly || isManager);

  const TaskCard = ({ task }: { task: TaskDTO }) => {
    const sm = STATUS_META[task.status];
    const assignee = teamMember(task.assignedTo);
    const isOverdue = new Date(task.due) < new Date() && task.status !== "closed";
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setSelectedId(task.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedId(task.id);
          }
        }}
        className="relative cursor-pointer overflow-hidden rounded-2xl px-5 py-4 transition-all"
        style={{
          background: "#080d18",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `${sm.color}44`;
          e.currentTarget.style.background = "#0a1120";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
          e.currentTarget.style.background = "#080d18";
        }}
      >
        <div
          className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l"
          style={{ background: sm.color }}
        />
        <div className="mb-2 flex items-start justify-between gap-2.5">
          <div className="flex-1 text-sm font-bold leading-snug" style={{ color: "#e2e8f0" }}>
            {task.title}
          </div>
          <span
            className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ background: sm.bg, color: sm.color }}
          >
            {sm.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px]" style={{ color: "#334155" }}>
            {task.brand}
          </span>
          <span
            className="rounded-[10px] px-1.5 py-px text-[11px] font-semibold"
            style={{
              background: `${PRIORITY_COLOR[task.priority]}15`,
              color: PRIORITY_COLOR[task.priority],
            }}
          >
            {task.priority}
          </span>
          {isManager && assignee && (
            <div className="flex items-center gap-1.5">
              <div
                className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8px] font-extrabold"
                style={{ background: DEPT_COLOR[assignee.dept] }}
              >
                {assignee.avatar}
              </div>
              <span className="text-[11px]" style={{ color: "#475569" }}>
                {assignee.name}
              </span>
            </div>
          )}
          <span
            className="ml-auto text-[11px]"
            style={{ color: isOverdue ? "#f87171" : "#334155" }}
          >
            {isOverdue ? "⚠ " : ""}Due {task.due}
          </span>
        </div>
        {task.timeline.length > 1 && (
          <div className="mt-2 text-[11px] italic" style={{ color: "#334155" }}>
            Last: {task.timeline[task.timeline.length - 1].action}
          </div>
        )}
      </div>
    );
  };

  const TaskDetail = ({ task, onClose }: { task: TaskDTO; onClose: () => void }) => {
    const t = tasks.find((t2) => t2.id === task.id) ?? task;
    const assignee = teamMember(t.assignedTo);
    const assigner = teamMember(t.assignedBy);
    const sm = STATUS_META[t.status];
    const isMyTask = t.assignedTo === user.id;
    const canReview = isManager && (t.status === "submitted" || t.status === "issue" || t.status === "reviewed");

    return (
      <div
        className="fixed bottom-0 right-0 top-0 z-[100] flex w-[480px] flex-col overflow-y-auto border-l"
        style={{ background: "#080d18", borderColor: "rgba(255,255,255,0.07)" }}
      >
        <div className="border-b px-6 pb-5 pt-6" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="mb-2.5 flex flex-wrap gap-2">
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                  style={{ background: sm.bg, color: sm.color }}
                >
                  {sm.label}
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                  style={{
                    background: `${PRIORITY_COLOR[t.priority]}18`,
                    color: PRIORITY_COLOR[t.priority],
                  }}
                >
                  {t.priority}
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}
                >
                  {t.brand}
                </span>
              </div>
              <div
                className="text-xl font-extrabold leading-snug text-white"
                style={{ fontFamily: "'Cabinet Grotesk',sans-serif" }}
              >
                {t.title}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-[30px] w-[30px] flex-shrink-0 cursor-pointer rounded-full border-0 text-base"
              style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}
            >
              ×
            </button>
          </div>
          {t.desc && (
            <div className="mt-2.5 text-[13px] leading-relaxed" style={{ color: "#64748b" }}>
              {t.desc}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-xs" style={{ color: "#475569" }}>
            <div>
              Assigned to{" "}
              <span className="font-semibold" style={{ color: "#e2e8f0" }}>
                {assignee?.name}
              </span>
            </div>
            <div>
              by{" "}
              <span className="font-semibold" style={{ color: "#e2e8f0" }}>
                {assigner?.name}
              </span>
            </div>
            <div>
              Due{" "}
              <span
                className="font-semibold"
                style={{ color: new Date(t.due) < new Date() ? "#f87171" : "#e2e8f0" }}
              >
                {t.due}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 px-6 py-5">
          <div
            className="mb-3.5 text-xs font-bold uppercase tracking-widest"
            style={{ color: "#334155" }}
          >
            Activity
          </div>
          <div className="flex flex-col">
            {t.timeline.map((ev, i) => {
              const evUser = teamMember(ev.by);
              return (
                <div key={`${ev.at}-${i}`} className="relative flex gap-3 pb-4">
                  <div className="flex flex-shrink-0 flex-col items-center">
                    <div
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white"
                      style={{ background: DEPT_COLOR[evUser?.dept ?? ""] || "#334155" }}
                    >
                      {evUser?.avatar}
                    </div>
                    {i < t.timeline.length - 1 && (
                      <div
                        className="mt-1.5 flex-1"
                        style={{ width: 1, background: "rgba(255,255,255,0.06)" }}
                      />
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="text-[13px]" style={{ color: "#e2e8f0" }}>
                      <span className="font-semibold">{evUser?.name}</span> · {ev.action}
                    </div>
                    {ev.note && (
                      <div
                        className="mt-1 rounded-lg border-l-2 px-3 py-2 text-xs leading-snug"
                        style={{
                          color: "#64748b",
                          background: "rgba(255,255,255,0.04)",
                          borderLeftColor: "rgba(255,255,255,0.1)",
                        }}
                      >
                        {ev.note}
                      </div>
                    )}
                    <div className="mt-1 text-[11px]" style={{ color: "#334155" }}>
                      {ev.at}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {(isMyTask || canReview) && t.status !== "closed" && (
          <div
            className="border-t px-6 py-5"
            style={{ background: "#04070e", borderColor: "rgba(255,255,255,0.06)" }}
          >
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder={
                isMyTask && !isManager
                  ? "Add a note (required for submit / issue)..."
                  : "Add review note (optional)..."
              }
              className="mb-3 w-full resize-none rounded-xl border px-3.5 py-2.5 text-[13px]"
              style={{
                height: 72,
                background: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.08)",
                color: "#e2e8f0",
                fontFamily: "'Figtree',sans-serif",
              }}
              disabled={saving}
            />
            <div className="flex flex-wrap gap-2">
              {isMyTask && !isManager && (
                <>
                  {t.status === "assigned" && (
                    <Btn label="▶ Start" color="#fbbf24" onClick={() => handleTaskAction(t.id, "start")} />
                  )}
                  {(t.status === "in_progress" || t.status === "changes") && (
                    <>
                      <Btn
                        label="✓ Submit for Review"
                        color="#a78bfa"
                        onClick={() => handleTaskAction(t.id, "submit")}
                      />
                      <Btn
                        label="⚠ Raise Issue"
                        color="#f87171"
                        ghost
                        onClick={() => handleTaskAction(t.id, "issue")}
                      />
                    </>
                  )}
                  {t.status === "issue" && (
                    <Btn label="↺ Re-submit" color="#60a5fa" onClick={() => handleTaskAction(t.id, "resubmit")} />
                  )}
                </>
              )}
              {isManager && (
                <>
                  {(t.status === "submitted" || t.status === "issue") && (
                    <>
                      <Btn label="✓ Approve" color="#34d399" onClick={() => handleTaskAction(t.id, "approve")} />
                      <Btn
                        label="↺ Request Changes"
                        color="#fb923c"
                        ghost
                        onClick={() => handleTaskAction(t.id, "changes")}
                      />
                    </>
                  )}
                  {t.status === "reviewed" && (
                    <Btn label="✓✓ Close Task" color="#4ade80" onClick={() => handleTaskAction(t.id, "close")} />
                  )}
                  {t.status === "issue" && (
                    <Btn
                      label="✓ Acknowledge Issue"
                      color="#f87171"
                      ghost
                      onClick={() => handleTaskAction(t.id, "approve")}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}
        {t.status === "closed" && (
          <div
            className="border-t px-6 py-4 text-center text-[13px]"
            style={{ borderColor: "rgba(255,255,255,0.06)", color: "#334155" }}
          >
            ✓✓ This task has been closed
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="flex min-h-screen"
      style={{ background: "#04070e", fontFamily: "'Figtree',sans-serif", color: "#e2e8f0" }}
    >
      <div
        className="flex w-[200px] flex-shrink-0 flex-col border-r px-3 py-[22px]"
        style={{ background: "#070b14", borderColor: "rgba(255,255,255,0.05)" }}
      >
        <div className="mb-6 pl-2">
          <div
            className="text-xl font-black text-white"
            style={{ fontFamily: "'Cabinet Grotesk',sans-serif", letterSpacing: "-0.5px" }}
          >
            FlowDesk
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[3px]" style={{ color: col }}>
            Scrumfolks OS
          </div>
        </div>
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => {
              setView(n.id);
              setSelectedId(null);
            }}
            className="mb-0.5 flex w-full cursor-pointer items-center justify-between rounded-[11px] border-0 px-2.5 py-2 text-left text-[13px] transition-all"
            style={{
              background: view === n.id ? `${col}18` : "transparent",
              color: view === n.id ? col : "#475569",
              fontWeight: view === n.id ? 700 : 400,
            }}
          >
            <span className="flex items-center gap-2">
              <span>{n.icon}</span>
              {n.label}
            </span>
            {n.badge ? (
              <span
                className="rounded-full px-1.5 py-px text-[10px] font-extrabold text-white"
                style={{ background: view === n.id ? col : "#ef4444" }}
              >
                {n.badge}
              </span>
            ) : null}
          </button>
        ))}

        <div className="mt-auto">
          <div
            className="mb-2 rounded-xl border px-3 py-2.5"
            style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-extrabold"
                style={{ background: col }}
              >
                {user.avatar}
              </div>
              <div>
                <div className="text-xs font-bold">{user.name.split(" ")[0]}</div>
                <div className="text-[10px]" style={{ color: col }}>
                  {user.canAssign ? "Manager" : "Team"}
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setUser(null);
              setSelectedId(null);
            }}
            className="w-full cursor-pointer rounded-lg border py-2 text-xs"
            style={{
              background: "rgba(255,255,255,0.04)",
              borderColor: "rgba(255,255,255,0.06)",
              color: "#475569",
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-7 py-7">
        {view === "tasks" && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div
                  className="text-[26px] font-black tracking-tight text-white"
                  style={{ fontFamily: "'Cabinet Grotesk',sans-serif" }}
                >
                  {isManager ? "All Tasks Overview" : "My Tasks"}
                </div>
                <div className="mt-1 text-xs" style={{ color: "#475569" }}>
                  {myTasks.length} tasks · click any to open
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-[10px] border px-3 py-2 text-xs"
                  style={{
                    background: "#0a1120",
                    borderColor: "rgba(255,255,255,0.08)",
                    color: "#e2e8f0",
                  }}
                >
                  <option value="all">All Status</option>
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filterBrand}
                  onChange={(e) => setFilterBrand(e.target.value)}
                  className="rounded-[10px] border px-3 py-2 text-xs"
                  style={{
                    background: "#0a1120",
                    borderColor: "rgba(255,255,255,0.08)",
                    color: "#e2e8f0",
                  }}
                >
                  <option value="all">All Brands</option>
                  {BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {["assigned", "in_progress", "changes", "submitted", "issue", "reviewed", "closed"].map((s) => {
              const sTasks = filteredTasks.filter((t) => t.status === s);
              if (!sTasks.length) return null;
              const sm = STATUS_META[s];
              return (
                <div key={s} className="mb-7">
                  <div className="mb-2.5 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: sm.color }} />
                    <div className="text-xs font-bold tracking-wide" style={{ color: sm.color }}>
                      {sm.label.toUpperCase()}
                    </div>
                    <div className="text-xs" style={{ color: "#334155" }}>
                      ({sTasks.length})
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {sTasks.map((t) => (
                      <TaskCard key={t.id} task={t} />
                    ))}
                  </div>
                </div>
              );
            })}
            {filteredTasks.length === 0 && (
              <div className="px-5 py-14 text-center text-sm" style={{ color: "#334155" }}>
                <div className="mb-2.5 text-3xl">✓</div>
                No tasks found for selected filters.
              </div>
            )}
          </div>
        )}

        {view === "review" && isManager && (
          <div>
            <div className="mb-5">
              <div
                className="text-[26px] font-black tracking-tight text-white"
                style={{ fontFamily: "'Cabinet Grotesk',sans-serif" }}
              >
                Review Queue
              </div>
              <div className="mt-1 text-xs" style={{ color: "#475569" }}>
                {pendingReview.length} tasks waiting for your review
              </div>
            </div>
            <div className="mb-5 flex gap-2">
              {(
                [
                  ["pending", "Needs Review", tasks.filter((t) => t.status === "submitted").length],
                  ["issues", "Issues Raised", tasks.filter((t) => t.status === "issue").length],
                  ["reviewed", "Reviewed", tasks.filter((t) => t.status === "reviewed").length],
                ] as const
              ).map(([tab, label, cnt]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setReviewTab(tab)}
                  className="cursor-pointer rounded-[10px] border px-4 py-2 text-[13px]"
                  style={{
                    borderColor: reviewTab === tab ? `${col}66` : "rgba(255,255,255,0.07)",
                    background: reviewTab === tab ? `${col}18` : "transparent",
                    color: reviewTab === tab ? col : "#475569",
                    fontWeight: reviewTab === tab ? 700 : 400,
                  }}
                >
                  {label}{" "}
                  {cnt > 0 && (
                    <span
                      className="ml-1 rounded-full px-1.5 py-px text-[11px] text-white"
                      style={{ background: reviewTab === tab ? col : "#334155" }}
                    >
                      {cnt}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {(() => {
              const statusMap: Record<string, string[]> = {
                pending: ["submitted"],
                issues: ["issue"],
                reviewed: ["reviewed"],
              };
              const reviewTasks = tasks.filter((t) => statusMap[reviewTab]?.includes(t.status));
              return reviewTasks.length ? (
                <div className="flex flex-col gap-2">
                  {reviewTasks.map((t) => (
                    <TaskCard key={t.id} task={t} />
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-sm" style={{ color: "#334155" }}>
                  Nothing here ✓
                </div>
              );
            })()}
          </div>
        )}

        {view === "assign" && isManager && (
          <div>
            <div className="mb-5">
              <div className="text-[26px] font-black text-white" style={{ fontFamily: "'Cabinet Grotesk',sans-serif" }}>
                Assign New Task
              </div>
              <div className="mt-1 text-xs" style={{ color: "#475569" }}>
                Only managers and co-founders can assign tasks
              </div>
            </div>
            <div
              className="max-w-[560px] rounded-[22px] border px-7 py-7"
              style={{ background: "#080d18", borderColor: `${col}22` }}
            >
              <div className="flex flex-col gap-3.5">
                <div>
                  <div
                    className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: "#475569" }}
                  >
                    Task Title *
                  </div>
                  <input
                    value={nTask.title}
                    onChange={(e) => setNTask({ ...nTask, title: e.target.value })}
                    placeholder="e.g. Design 10 Static Posts — Dinamoo June"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
                    style={{
                      background: "#04070e",
                      borderColor: "rgba(255,255,255,0.08)",
                      color: "#e2e8f0",
                    }}
                  />
                </div>
                <div>
                  <div
                    className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: "#475569" }}
                  >
                    Description
                  </div>
                  <textarea
                    value={nTask.desc}
                    onChange={(e) => setNTask({ ...nTask, desc: e.target.value })}
                    placeholder="Task details, requirements, references..."
                    className="h-20 w-full resize-none rounded-xl border px-3.5 py-2.5 text-[13px]"
                    style={{
                      background: "#04070e",
                      borderColor: "rgba(255,255,255,0.08)",
                      color: "#e2e8f0",
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div
                      className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: "#475569" }}
                    >
                      Assign To *
                    </div>
                    <select
                      value={nTask.assignedTo}
                      onChange={(e) => setNTask({ ...nTask, assignedTo: e.target.value })}
                      className="w-full rounded-xl border px-3.5 py-2.5 text-[13px]"
                      style={{
                        background: "#04070e",
                        borderColor: "rgba(255,255,255,0.08)",
                        color: nTask.assignedTo ? "#e2e8f0" : "#475569",
                      }}
                    >
                      <option value="">Select team member</option>
                      {assignerMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {m.dept}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div
                      className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: "#475569" }}
                    >
                      Brand
                    </div>
                    <select
                      value={nTask.brand}
                      onChange={(e) => setNTask({ ...nTask, brand: e.target.value })}
                      className="w-full rounded-xl border px-3.5 py-2.5 text-[13px]"
                      style={{
                        background: "#04070e",
                        borderColor: "rgba(255,255,255,0.08)",
                        color: "#e2e8f0",
                      }}
                    >
                      {BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div
                      className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: "#475569" }}
                    >
                      Priority
                    </div>
                    <select
                      value={nTask.priority}
                      onChange={(e) => setNTask({ ...nTask, priority: e.target.value })}
                      className="w-full rounded-xl border px-3.5 py-2.5 text-[13px] font-bold"
                      style={{
                        background: "#04070e",
                        borderColor: "rgba(255,255,255,0.08)",
                        color: PRIORITY_COLOR[nTask.priority],
                      }}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div
                      className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: "#475569" }}
                    >
                      Due Date *
                    </div>
                    <input
                      type="date"
                      value={nTask.due}
                      onChange={(e) => setNTask({ ...nTask, due: e.target.value })}
                      className="w-full rounded-xl border px-3.5 py-2.5 text-[13px]"
                      style={{
                        background: "#04070e",
                        borderColor: "rgba(255,255,255,0.08)",
                        color: "#e2e8f0",
                      }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={createTask}
                  disabled={saving}
                  className="mt-1 cursor-pointer rounded-xl border-0 py-3.5 text-[15px] font-extrabold text-white disabled:opacity-50"
                  style={{ background: col, fontFamily: "'Cabinet Grotesk',sans-serif" }}
                >
                  Assign Task →
                </button>
              </div>
            </div>
            <div className="mt-7 max-w-[560px]">
              <div
                className="mb-3 text-[13px] font-bold uppercase tracking-wide"
                style={{ color: "#475569" }}
              >
                Recently Assigned
              </div>
              <div className="flex flex-col gap-2">
                {tasks
                  .filter((t) => t.assignedBy === user.id)
                  .slice(0, 5)
                  .map((t) => (
                    <TaskCard key={t.id} task={t} />
                  ))}
              </div>
            </div>
          </div>
        )}

        {view === "all" && isManager && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-[26px] font-black text-white" style={{ fontFamily: "'Cabinet Grotesk',sans-serif" }}>
                  All Tasks
                </div>
                <div className="mt-1 text-xs" style={{ color: "#475569" }}>
                  {tasks.length} tasks across entire team
                </div>
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-[10px] border px-3 py-2 text-xs"
                style={{
                  background: "#0a1120",
                  borderColor: "rgba(255,255,255,0.08)",
                  color: "#e2e8f0",
                }}
              >
                <option value="all">All Status</option>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            {TEAM.filter((m) => !m.canAssign).map((m) => {
              const mTasks = tasks.filter(
                (t) => t.assignedTo === m.id && (filterStatus === "all" || t.status === filterStatus),
              );
              if (!mTasks.length) return null;
              return (
                <div key={m.id} className="mb-6">
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-extrabold"
                      style={{ background: DEPT_COLOR[m.dept] }}
                    >
                      {m.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-bold" style={{ color: "#e2e8f0" }}>
                        {m.name}
                      </div>
                      <div className="text-[11px]" style={{ color: "#475569" }}>
                        {ROLE_LABELS[m.role]} · {mTasks.length} tasks
                      </div>
                    </div>
                    <div className="ml-auto flex gap-1.5">
                      {Object.entries(STATUS_META).map(([s, sm]) => {
                        const c = mTasks.filter((t) => t.status === s).length;
                        return c ? (
                          <span
                            key={s}
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                            style={{ background: sm.bg, color: sm.color }}
                          >
                            {c}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 pl-[42px]">
                    {mTasks.map((t) => (
                      <TaskCard key={t.id} task={t} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => {
            setSelectedId(null);
            setNoteInput("");
          }}
        />
      )}
    </div>
  );
}
