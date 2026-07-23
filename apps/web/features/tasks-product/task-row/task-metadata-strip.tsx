"use client"

import type { TaskWithMeta } from "@planevo/core/queries/product-tasks"
import type { TaskPriority, TaskStatus } from "@planevo/core/types/tasks"
import {
  getVisibleMetadata,
  type TaskMetadataContext,
} from "@/lib/tasks/task-row-formatters"
import { TaskDuePopover } from "../task-inline-edit/task-due-popover"
import { TaskPriorityPopover } from "../task-inline-edit/task-priority-popover"
import { TaskStatusPopover } from "../task-inline-edit/task-status-popover"
import { TaskDueLabel } from "./task-due-label"
import { TaskFileBadge } from "./task-file-badge"
import { TaskPriorityPill } from "./task-priority-pill"
import { TaskStatusPill } from "./task-status-pill"
import { TaskSubtaskProgress } from "./task-subtask-progress"

export type TaskPatch = {
  status?: TaskStatus
  priority?: TaskPriority | null
  dueAt?: string | null
}

type TaskMetadataStripProps = {
  task: TaskWithMeta
  context: TaskMetadataContext
  editable?: boolean
  onPatch?: (patch: TaskPatch) => void
}

export function TaskMetadataStrip({
  task,
  context,
  editable = false,
  onPatch,
}: TaskMetadataStripProps) {
  const visible = getVisibleMetadata(task, context)

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5">
      {visible.showStatus ? (
        editable && onPatch ? (
          <TaskStatusPopover
            status={task.status}
            onSelect={(status) => onPatch({ status })}
          />
        ) : (
          <TaskStatusPill status={task.status} />
        )
      ) : null}

      {visible.showPriority && task.priority ? (
        editable && onPatch ? (
          <TaskPriorityPopover
            priority={task.priority}
            onSelect={(priority) => onPatch({ priority })}
          />
        ) : (
          <TaskPriorityPill priority={task.priority} />
        )
      ) : null}

      {visible.showDue ? (
        editable && onPatch ? (
          <TaskDuePopover
            dueAt={task.due_at}
            status={task.status}
            onSelect={(dueAt) => onPatch({ dueAt })}
          />
        ) : (
          <TaskDueLabel dueAt={task.due_at} status={task.status} />
        )
      ) : null}

      {visible.showSubtasks ? (
        <TaskSubtaskProgress
          done={task.subtaskDone}
          total={task.subtaskTotal}
        />
      ) : null}

      {visible.showFiles ? <TaskFileBadge count={task.fileCount} /> : null}
    </div>
  )
}
