"use client"

import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react"
import { LayoutGrid } from "lucide-react"
import { useRouter } from "next/navigation"
import type { TaskWithMeta } from "@planevo/core/queries/product-tasks"
import type { TaskStatus } from "@planevo/core/types/tasks"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/toast"
import type { TaskAttachmentCleanupTarget } from "@/lib/tasks/task-attachment-cleanup"
import {
  createProductTaskAction,
  linkProductTaskToWorkspaceAction,
  moveProductTaskAction,
  updateProductTaskAction,
} from "@/app/(workspace)/tasks/actions"
import { CreateTaskDialog } from "./create-task-dialog"
import {
  discardTaskAttachmentUploads,
  uploadTaskAttachments,
} from "./task-attachment-uploads"
import { TaskBoard, type TaskBoardStatus } from "./task-board"
import { TaskList } from "./task-list"
import { TaskPeek } from "./task-peek"
import { TaskTable } from "./task-table"
import { TasksToolbar, type TasksView } from "./tasks-toolbar"
import type { TaskPatch } from "./task-row"
import { activeTasks } from "@/lib/tasks/task-view-state"
import {
  getTasksScope,
  setTasksScope,
  type TasksScope,
} from "@/lib/tasks/scope-prefs"
import {
  buildTaskUpdatePayload,
  toggleDoneStatus,
} from "@/lib/tasks/task-row-formatters"
import {
  DEFAULT_TASKS_VIEW_PREFS,
  getTasksViewPrefs,
  setTasksViewPrefs,
  type TasksViewPrefs,
} from "@/lib/tasks/task-view-prefs"
import { getTasksPageLayoutClass, isTasksFullBleedView } from "./tasks-page-layout"

type TasksProductViewProps = {
  initialTasks: TaskWithMeta[]
  initialScope: TasksScope
  workspaceId: string | null
  workspaceName?: string | null
}

type OptimisticMove = {
  taskId: string
  status: TaskBoardStatus
  position: number
}

type OptimisticPatch = {
  taskId: string
  patch: TaskPatch
}

type OptimisticAction =
  | { type: "move"; move: OptimisticMove }
  | { type: "patch"; patch: OptimisticPatch }

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    Boolean(
      target.closest(
        "input, textarea, select, [contenteditable]:not([contenteditable='false'])",
      ),
    )
  )
}

function moveOptimistically(
  tasks: TaskWithMeta[],
  move: OptimisticMove,
): TaskWithMeta[] {
  return tasks.map((task) =>
    task.id === move.taskId
      ? { ...task, status: move.status, position: move.position }
      : task,
  )
}

function patchOptimistically(
  tasks: TaskWithMeta[],
  action: OptimisticPatch,
): TaskWithMeta[] {
  return tasks.map((task) => {
    if (task.id !== action.taskId) return task
    return {
      ...task,
      status: action.patch.status ?? task.status,
      priority:
        action.patch.priority !== undefined
          ? action.patch.priority
          : task.priority,
      due_at:
        action.patch.dueAt !== undefined ? action.patch.dueAt : task.due_at,
    }
  })
}

function applyOptimisticAction(
  tasks: TaskWithMeta[],
  action: OptimisticAction,
): TaskWithMeta[] {
  if (action.type === "move") return moveOptimistically(tasks, action.move)
  return patchOptimistically(tasks, action.patch)
}

function neighborIdsForMove(
  tasks: TaskWithMeta[],
  move: OptimisticMove,
): { beforeTaskId: string | null; afterTaskId: string | null } {
  const destination = tasks
    .filter((task) => task.id !== move.taskId && task.status === move.status)
    .sort(
      (left, right) =>
        left.position - right.position || left.id.localeCompare(right.id),
    )
  const insertionIndex = destination.findIndex(
    (task) => task.position > move.position,
  )
  const index = insertionIndex === -1 ? destination.length : insertionIndex
  return {
    beforeTaskId: destination[index - 1]?.id ?? null,
    afterTaskId: destination[index]?.id ?? null,
  }
}

export function TasksEmptyState({
  onCreateTask,
}: {
  onCreateTask: () => void
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface-raised px-6 py-12 text-center">
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-card border border-dashed border-border bg-paper text-text-muted"
      >
        <LayoutGrid aria-hidden="true" className="size-10" />
      </span>
      <h2 className="mt-5 text-h2">A clear place for every task</h2>
      <p className="mt-2 max-w-md text-body text-text-secondary">
        Add your first task, then shape the board, list, or table around the way
        you work. Press{" "}
        <kbd className="rounded-lg border border-border bg-paper px-1.5 py-0.5 font-mono text-mono">
          N
        </kbd>{" "}
        anytime to create one.
      </p>
      <p className="mt-2 text-small text-text-muted">
        Import from CSV is coming soon — for now, capture tasks here or from quick
        capture.
      </p>
      <button
        type="button"
        onClick={onCreateTask}
        className="mt-5 rounded-lg bg-ink px-4 py-2 text-small font-medium text-paper outline-none hover:opacity-85 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Add your first task
      </button>
    </div>
  )
}

export function TasksProductView({
  initialTasks,
  initialScope,
  workspaceId,
  workspaceName = null,
}: TasksProductViewProps) {
  const router = useRouter()
  const [prefs, setPrefs] = useState<TasksViewPrefs>(DEFAULT_TASKS_VIEW_PREFS)
  const [prefsReady, setPrefsReady] = useState(false)
  const previousStatusRef = useRef<Record<string, TaskStatus>>({})
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createStatus, setCreateStatus] =
    useState<TaskBoardStatus>("not_started")
  const [isPending, startTransition] = useTransition()
  const [tasks, applyOptimistic] = useOptimistic(
    initialTasks,
    applyOptimisticAction,
  )
  const selectedTask = selectedTaskId
    ? tasks.find((task) => task.id === selectedTaskId) ?? null
    : null
  const boardTasks = activeTasks(tasks)
  const visibleTasks = boardTasks
  const view = prefs.view

  const closePeek = useCallback(() => setSelectedTaskId(null), [])

  function persistPrefs(next: TasksViewPrefs) {
    setPrefs(next)
    setTasksViewPrefs(next)
  }

  function patchPrefs(patch: Partial<TasksViewPrefs>) {
    persistPrefs({
      ...prefs,
      ...patch,
      sort: patch.sort ? { ...prefs.sort, ...patch.sort } : prefs.sort,
    })
  }

  useEffect(() => {
    const stored = getTasksViewPrefs()
    setPrefs(stored)
    setPrefsReady(true)
  }, [])

  function openCreate(status: TaskBoardStatus = "not_started") {
    setCreateStatus(status)
    setCreateOpen(true)
  }

  function closeCreate() {
    setCreateOpen(false)
    setCreateStatus("not_started")
  }

  useEffect(() => {
    const storedScope = getTasksScope()
    if (storedScope === initialScope) return
    if (storedScope === "workspace" && !workspaceId) {
      setTasksScope("all")
      return
    }
    router.replace(storedScope === "workspace" ? "/tasks?scope=workspace" : "/tasks")
  }, [initialScope, router, workspaceId])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() !== "n" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.repeat ||
        event.defaultPrevented ||
        event.isComposing ||
        isEditableTarget(event.target)
      ) {
        return
      }
      event.preventDefault()
      setCreateStatus("not_started")
      setCreateOpen(true)
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [])

  function changeScope(scope: TasksScope) {
    if (scope === "workspace" && !workspaceId) {
      toast("Open a workspace before using this filter", { tone: "error" })
      return
    }
    setTasksScope(scope)
    router.push(scope === "workspace" ? "/tasks?scope=workspace" : "/tasks")
  }

  function moveTask(
    taskId: string,
    status: TaskBoardStatus,
    position: number,
  ) {
    const move = { taskId, status, position } satisfies OptimisticMove
    const neighbors = neighborIdsForMove(tasks, move)

    startTransition(async () => {
      applyOptimistic({ type: "move", move })
      const result = await moveProductTaskAction({
        taskId,
        status,
        ...neighbors,
      })
      if (!result.ok) {
        toast(result.error, { tone: "error" })
      }
      router.refresh()
    })
  }

  function patchTask(taskId: string, patch: TaskPatch) {
    const task = tasks.find((entry) => entry.id === taskId)
    if (!task) return

    if (patch.status && patch.status !== "done" && task.status !== "done") {
      previousStatusRef.current[taskId] = task.status
    }

    startTransition(async () => {
      applyOptimistic({ type: "patch", patch: { taskId, patch } })
      const result = await updateProductTaskAction(
        buildTaskUpdatePayload(task, patch),
      )
      if (!result.ok) {
        toast(result.error, { tone: "error" })
      }
      router.refresh()
    })
  }

  function toggleComplete(taskId: string) {
    const task = tasks.find((entry) => entry.id === taskId)
    if (!task) return

    const previous =
      previousStatusRef.current[taskId] ??
      (task.status !== "done" ? task.status : "not_started")
    if (task.status !== "done") {
      previousStatusRef.current[taskId] = task.status
    }
    const nextStatus = toggleDoneStatus(task.status, previous)
    patchTask(taskId, { status: nextStatus })
  }

  function createTask(formData: FormData) {
    startTransition(async () => {
      const fileEntries = formData.getAll("files")
      if (fileEntries.some((entry) => !(entry instanceof File))) {
        toast("Check the attachments and try again.", { tone: "error" })
        return
      }

      const files = fileEntries as File[]
      formData.delete("files")
      let cleanupTargets: TaskAttachmentCleanupTarget[] = []
      let cleanupAttempted = false

      try {
        const attachments = await uploadTaskAttachments(files)
        cleanupTargets = attachments.map((attachment) => ({
          sourceId: attachment.sourceId,
          storagePath: attachment.storagePath,
        }))
        for (const attachment of attachments) {
          formData.append("attachments", JSON.stringify(attachment))
        }

        const result = await createProductTaskAction(formData)
        if (!result.ok) {
          cleanupAttempted = true
          await discardTaskAttachmentUploads(cleanupTargets)
          cleanupTargets = []
          toast(result.error, { tone: "error" })
          return
        }

        closeCreate()
        if (result.data.attachmentError) {
          toast(result.data.attachmentError, { tone: "error" })
        } else if (workspaceId) {
          const label = workspaceName?.trim() || "this workspace"
          toast(`Add to ${label}?`, {
            action: {
              label: "Add",
              onClick: () => {
                void linkProductTaskToWorkspaceAction({
                  taskId: result.data.task.id,
                  workspaceId,
                }).then((linkResult) => {
                  if (!linkResult.ok) {
                    toast(linkResult.error, { tone: "error" })
                    return
                  }
                  toast(`Added to ${label}`)
                  router.refresh()
                })
              },
            },
          })
        } else {
          toast("Task created")
        }
        router.refresh()
      } catch (cause) {
        if (cleanupTargets.length > 0 && !cleanupAttempted) {
          try {
            cleanupAttempted = true
            await discardTaskAttachmentUploads(cleanupTargets)
          } catch (cleanupCause) {
            toast(
              cleanupCause instanceof Error
                ? cleanupCause.message
                : "Attachment cleanup remains pending.",
              { tone: "error" },
            )
            return
          }
        }
        toast(
          cause instanceof Error ? cause.message : "Could not create the task.",
          { tone: "error" },
        )
      }
    })
  }

  const content = visibleTasks.length === 0 ? (
    <TasksEmptyState onCreateTask={() => openCreate()} />
  ) : view === "board" ? (
    <TaskBoard
      tasks={boardTasks}
      onStatusChange={moveTask}
      onTaskSelect={setSelectedTaskId}
      onCreateTask={openCreate}
      fillHeight
    />
  ) : view === "list" ? (
    <TaskList
      tasks={visibleTasks}
      grouping={prefs.grouping}
      onGroupingChange={(grouping) => patchPrefs({ grouping })}
      collapsedGroups={prefs.collapsedGroups}
      onCollapsedGroupsChange={(collapsedGroups) =>
        patchPrefs({ collapsedGroups })
      }
      hideDone={prefs.hideDone}
      onHideDoneChange={(hideDone) => patchPrefs({ hideDone })}
      onTaskSelect={setSelectedTaskId}
      onTaskPatch={patchTask}
      onToggleComplete={toggleComplete}
      fillHeight
    />
  ) : (
    <TaskTable
      tasks={visibleTasks}
      sort={prefs.sort}
      onSortChange={(sort) => patchPrefs({ sort })}
      hideDone={prefs.hideDone}
      onHideDoneChange={(hideDone) => patchPrefs({ hideDone })}
      onTaskSelect={setSelectedTaskId}
      onTaskPatch={patchTask}
      onToggleComplete={toggleComplete}
      fillHeight
    />
  )

  const isFullBleed = isTasksFullBleedView(view, visibleTasks.length > 0)

  return (
    <section
      aria-labelledby="tasks-product-title"
      className={`tasks-product-ui ${getTasksPageLayoutClass(view, visibleTasks.length > 0)}`}
      data-prefs-ready={prefsReady ? "true" : "false"}
    >
      <header
        className={`flex flex-wrap items-end justify-between gap-4 ${
          isFullBleed ? "mb-4 shrink-0" : "mb-8"
        }`}
      >
        <div>
          <p className="text-product-meta text-text-muted">
            {initialScope === "workspace" ? "This workspace" : "All tasks"}
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <h1 id="tasks-product-title" className="text-h1 font-medium tracking-tight">
              Tasks
            </h1>
            <Badge
              variant="secondary"
              aria-label={
                visibleTasks.length === 1
                  ? "1 task"
                  : `${visibleTasks.length} tasks`
              }
              className="tabular-nums"
            >
              {visibleTasks.length}
            </Badge>
          </div>
        </div>
      </header>

      <div
        className={`sticky top-0 z-20 mb-4 border-b border-border/80 bg-paper/95 py-2 backdrop-blur-sm ${
          isFullBleed
            ? "-mx-5 shrink-0 px-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
            : "-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        }`}
      >
        <TasksToolbar
          view={view}
          scope={initialScope}
          onViewChange={(nextView: TasksView) => patchPrefs({ view: nextView })}
          onScopeChange={changeScope}
          onCreateTask={() => openCreate()}
          isCreateDialogOpen={createOpen}
        />
      </div>

      <div
        aria-busy={isPending}
        className={isFullBleed ? "flex min-h-0 flex-1 flex-col" : undefined}
      >
        {content}
      </div>

      {createOpen ? (
        <CreateTaskDialog
          onClose={closeCreate}
          onSubmit={createTask}
          isPending={isPending}
          initialStatus={createStatus}
        />
      ) : null}

      {selectedTask ? (
        <TaskPeek key={selectedTask.id} task={selectedTask} onClose={closePeek} />
      ) : null}
    </section>
  )
}
