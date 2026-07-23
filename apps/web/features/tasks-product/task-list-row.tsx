"use client"

import type { TaskWithMeta } from "@planevo/core/queries/product-tasks"
import { resolveTaskIcon } from "@planevo/core/tasks/task-icon-classifier"
import type { TaskListGrouping } from "@/lib/tasks/task-view-state"
import { TaskIconRender } from "./task-icon-render"
import {
  TaskMetadataStrip,
  TaskRowCheckbox,
  type TaskPatch,
} from "./task-row"

type TaskListRowProps = {
  task: TaskWithMeta
  grouping: TaskListGrouping
  onTaskSelect?: (taskId: string) => void
  onTaskPatch?: (taskId: string, patch: TaskPatch) => void
  onToggleComplete?: (taskId: string) => void
}

export function TaskListRow({
  task,
  grouping,
  onTaskSelect,
  onTaskPatch,
  onToggleComplete,
}: TaskListRowProps) {
  const title = task.title.trim() || "Untitled task"
  const isDone = task.status === "done"
  const icon = resolveTaskIcon(task, task.fileCount)

  return (
    <li className="border-b border-border last:border-b-0">
      <div
        className={`flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-sidebar/40 motion-reduce:transition-none ${
          isDone ? "opacity-80" : ""
        }`}
      >
        {onToggleComplete ? (
          <TaskRowCheckbox
            title={title}
            checked={isDone}
            onToggle={() => onToggleComplete(task.id)}
          />
        ) : null}

        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center text-text-muted"
        >
          <TaskIconRender
            definition={icon.definition}
            style={icon.ref.style}
            size="picker"
            active={!isDone}
          />
        </span>

        {onTaskSelect ? (
          <button
            type="button"
            onClick={() => onTaskSelect(task.id)}
            aria-label={`Open task: ${title}`}
            className={`min-w-0 flex-1 truncate text-left text-product-title outline-none hover:underline focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
              isDone ? "text-text-muted line-through" : "text-ink"
            }`}
          >
            {title}
          </button>
        ) : (
          <span
            className={`min-w-0 flex-1 truncate text-product-title ${
              isDone ? "text-text-muted line-through" : "text-ink"
            }`}
          >
            {title}
          </span>
        )}

        <TaskMetadataStrip
          task={task}
          context={{ view: "list", grouping }}
          editable={Boolean(onTaskPatch)}
          onPatch={
            onTaskPatch ? (patch) => onTaskPatch(task.id, patch) : undefined
          }
        />
      </div>
    </li>
  )
}
