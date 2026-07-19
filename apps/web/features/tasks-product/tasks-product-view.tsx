"use client";

import {
  useCallback,
  useEffect,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { RectangleGroupIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import type { TaskWithMeta } from "@planevo/core/queries/product-tasks";
import { toast } from "@/components/ui/toast";
import type { TaskAttachmentCleanupTarget } from "@/lib/tasks/task-attachment-cleanup";
import {
  createProductTaskAction,
  linkProductTaskToWorkspaceAction,
  moveProductTaskAction,
} from "@/app/(workspace)/tasks/actions";
import { CreateTaskDialog } from "./create-task-dialog";
import {
  discardTaskAttachmentUploads,
  uploadTaskAttachments,
} from "./task-attachment-uploads";
import { TaskBoard, type TaskBoardStatus } from "./task-board";
import { TaskList } from "./task-list";
import { TaskPeek } from "./task-peek";
import { TaskTable } from "./task-table";
import { TasksToolbar, type TasksView } from "./tasks-toolbar";
import {
  getTasksScope,
  setTasksScope,
  type TasksScope,
} from "@/lib/tasks/scope-prefs";
import { activeTasks } from "@/lib/tasks/task-view-state";

type TasksProductViewProps = {
  initialTasks: TaskWithMeta[];
  initialScope: TasksScope;
  workspaceId: string | null;
  workspaceName?: string | null;
};

type OptimisticMove = {
  taskId: string;
  status: TaskBoardStatus;
  position: number;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    Boolean(
      target.closest(
        "input, textarea, select, [contenteditable]:not([contenteditable='false'])",
      ),
    )
  );
}

function moveOptimistically(
  tasks: TaskWithMeta[],
  move: OptimisticMove,
): TaskWithMeta[] {
  return tasks.map((task) =>
    task.id === move.taskId
      ? { ...task, status: move.status, position: move.position }
      : task,
  );
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
    );
  const insertionIndex = destination.findIndex(
    (task) => task.position > move.position,
  );
  const index = insertionIndex === -1 ? destination.length : insertionIndex;
  return {
    beforeTaskId: destination[index - 1]?.id ?? null,
    afterTaskId: destination[index]?.id ?? null,
  };
}

export function TasksEmptyState({
  onCreateTask,
}: {
  onCreateTask: () => void;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface-raised px-6 py-12 text-center">
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-card border border-dashed border-border bg-paper text-text-muted"
      >
        <RectangleGroupIcon className="size-10" />
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
  );
}

export function TasksProductView({
  initialTasks,
  initialScope,
  workspaceId,
  workspaceName = null,
}: TasksProductViewProps) {
  const router = useRouter();
  const [view, setView] = useState<TasksView>("board");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] =
    useState<TaskBoardStatus>("not_started");
  const [isPending, startTransition] = useTransition();
  const [tasks, applyOptimisticMove] = useOptimistic(
    initialTasks,
    moveOptimistically,
  );
  const selectedTask = selectedTaskId
    ? tasks.find((task) => task.id === selectedTaskId) ?? null
    : null;
  const boardTasks = activeTasks(tasks);
  const visibleTasks = boardTasks;

  const closePeek = useCallback(() => setSelectedTaskId(null), []);

  function openCreate(status: TaskBoardStatus = "not_started") {
    setCreateStatus(status);
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setCreateStatus("not_started");
  }

  useEffect(() => {
    const storedScope = getTasksScope();
    if (storedScope === initialScope) return;
    if (storedScope === "workspace" && !workspaceId) {
      setTasksScope("all");
      return;
    }
    router.replace(storedScope === "workspace" ? "/tasks?scope=workspace" : "/tasks");
  }, [initialScope, router, workspaceId]);

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
        return;
      }
      event.preventDefault();
      setCreateStatus("not_started");
      setCreateOpen(true);
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function changeScope(scope: TasksScope) {
    if (scope === "workspace" && !workspaceId) {
      toast("Open a workspace before using this filter", { tone: "error" });
      return;
    }
    setTasksScope(scope);
    router.push(scope === "workspace" ? "/tasks?scope=workspace" : "/tasks");
  }

  function moveTask(
    taskId: string,
    status: TaskBoardStatus,
    position: number,
  ) {
    const move = { taskId, status, position } satisfies OptimisticMove;
    const neighbors = neighborIdsForMove(tasks, move);

    startTransition(async () => {
      applyOptimisticMove(move);
      const result = await moveProductTaskAction({
        taskId,
        status,
        ...neighbors,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
      }
      router.refresh();
    });
  }

  function createTask(formData: FormData) {
    startTransition(async () => {
      const fileEntries = formData.getAll("files");
      if (fileEntries.some((entry) => !(entry instanceof File))) {
        toast("Check the attachments and try again.", { tone: "error" });
        return;
      }

      const files = fileEntries as File[];
      formData.delete("files");
      let cleanupTargets: TaskAttachmentCleanupTarget[] = [];
      let cleanupAttempted = false;

      try {
        const attachments = await uploadTaskAttachments(files);
        cleanupTargets = attachments.map((attachment) => ({
          sourceId: attachment.sourceId,
          storagePath: attachment.storagePath,
        }));
        for (const attachment of attachments) {
          formData.append("attachments", JSON.stringify(attachment));
        }

        const result = await createProductTaskAction(formData);
        if (!result.ok) {
          cleanupAttempted = true;
          await discardTaskAttachmentUploads(cleanupTargets);
          cleanupTargets = [];
          toast(result.error, { tone: "error" });
          return;
        }

        closeCreate();
        if (result.data.attachmentError) {
          toast(result.data.attachmentError, { tone: "error" });
        } else if (workspaceId) {
          const label = workspaceName?.trim() || "this workspace";
          toast(`Add to ${label}?`, {
            action: {
              label: "Add",
              onClick: () => {
                void linkProductTaskToWorkspaceAction({
                  taskId: result.data.task.id,
                  workspaceId,
                }).then((linkResult) => {
                  if (!linkResult.ok) {
                    toast(linkResult.error, { tone: "error" });
                    return;
                  }
                  toast(`Added to ${label}`);
                  router.refresh();
                });
              },
            },
          });
        } else {
          toast("Task created");
        }
        router.refresh();
      } catch (cause) {
        if (cleanupTargets.length > 0 && !cleanupAttempted) {
          try {
            cleanupAttempted = true;
            await discardTaskAttachmentUploads(cleanupTargets);
          } catch (cleanupCause) {
            toast(
              cleanupCause instanceof Error
                ? cleanupCause.message
                : "Attachment cleanup remains pending.",
              { tone: "error" },
            );
            return;
          }
        }
        toast(
          cause instanceof Error ? cause.message : "Could not create the task.",
          { tone: "error" },
        );
      }
    });
  }

  const content = visibleTasks.length === 0 ? (
    <TasksEmptyState onCreateTask={() => openCreate()} />
  ) : view === "board" ? (
    <TaskBoard
      tasks={boardTasks}
      onStatusChange={moveTask}
      onTaskSelect={setSelectedTaskId}
      onCreateTask={openCreate}
    />
  ) : view === "list" ? (
    <TaskList tasks={visibleTasks} onTaskSelect={setSelectedTaskId} />
  ) : (
    <TaskTable tasks={visibleTasks} onTaskSelect={setSelectedTaskId} />
  );

  return (
    <section
      aria-labelledby="tasks-product-title"
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
    >
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-label uppercase text-text-muted">
            {initialScope === "workspace" ? "This workspace" : "All tasks"}
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <h1 id="tasks-product-title" className="text-h1">
              Tasks
            </h1>
            <span
              aria-label={
                visibleTasks.length === 1
                  ? "1 task"
                  : `${visibleTasks.length} tasks`
              }
              className="rounded-full border border-border bg-surface-raised px-2 py-0.5 font-mono text-label text-text-muted"
            >
              {visibleTasks.length}
            </span>
          </div>
        </div>
        <TasksToolbar
          view={view}
          scope={initialScope}
          onViewChange={setView}
          onScopeChange={changeScope}
          onCreateTask={() => openCreate()}
          isCreateDialogOpen={createOpen}
        />
      </header>

      <div aria-busy={isPending}>{content}</div>

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
  );
}
