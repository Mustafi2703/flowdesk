'use client'

import { taskStatusFlowHint } from '@/lib/tasks'

const FLOW_STEPS = ['Not Started', 'In Progress', 'Upload', 'Under Review', 'Done / Revisions']

export function TaskWorkflowBanner({
  task,
  role,
  compact = false,
}: {
  task: any
  role: string
  compact?: boolean
}) {
  if (!task?.requires_review) return null
  const hint = taskStatusFlowHint(task, role)
  const current = task?.status || 'Not Started'
  const activeIdx =
    current === 'Not Started' ? 0
    : current === 'In Progress' ? 1
    : current === 'Under Review' ? 3
    : current === 'Revision Needed' ? 4
    : current === 'Completed' ? 4
    : 1

  return (
    <div className={`sf-task-flow${compact ? ' sf-task-flow--compact' : ''}`}>
      {!compact && (
        <div className="sf-task-flow-steps" aria-hidden>
          {FLOW_STEPS.map((label, i) => (
            <span
              key={label}
              className={`sf-task-flow-step${i === activeIdx ? ' is-active' : ''}${i < activeIdx ? ' is-done' : ''}`}
            >
              {label}
            </span>
          ))}
        </div>
      )}
      {hint ? <p className="sf-task-flow-hint">{hint}</p> : null}
    </div>
  )
}
