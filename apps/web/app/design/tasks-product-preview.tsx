"use client";

import { useState } from "react";
import type { TaskWithMeta } from "@planevo/core/queries/product-tasks";
import { CreateTaskDialog } from "@/features/tasks-product/create-task-dialog";
import { TaskCrossLinkActionsPreview } from "@/features/tasks-product/cross-link-actions";
import { TasksEmptyState } from "@/features/tasks-product/tasks-product-view";
import {
  TaskBoard,
  type TaskBoardStatus,
} from "@/features/tasks-product/task-board";
import { classifyTaskIcon } from "@planevo/core/tasks/task-icon-classifier";
import { resolveIconDefinition } from "@planevo/core/tasks/icon-catalog";
import { TASK_ICON_REGISTRY } from "@planevo/core/tasks/task-icon-registry";
import { TaskCard } from "@/features/tasks-product/task-card";
import { TaskIconRender } from "@/features/tasks-product/task-icon-render";
import { TaskList } from "@/features/tasks-product/task-list";
import { TaskPeek } from "@/features/tasks-product/task-peek";
import { TaskTable } from "@/features/tasks-product/task-table";
import {
  TasksToolbar,
  type TasksView,
} from "@/features/tasks-product/tasks-toolbar";
import type { TasksScope } from "@/lib/tasks/scope-prefs";

const CLASSIFIER_EXAMPLES = [
  { title: "Do homework", expected: "fa:solid:book" },
  { title: "Buy groceries", expected: "fa:solid:cart-shopping" },
  { title: "Weekly team sync", expected: "meeting" },
  { title: "Write API spec", expected: "docs" },
  { title: "Untitled task", tags: ["Design"], expected: "design" },
] as const;

const DEFAULT_TASK: TaskWithMeta = {
  id: "design-task-default",
  user_id: "design-owner",
  title: "Outline the project update",
  status: "not_started",
  priority: "medium",
  due_at: "2099-07-21T18:00:00.000Z",
  description_json: { tags: ["Product", "Design"] },
  position: 1,
  completed_at: null,
  created_at: "2026-07-17T08:00:00.000Z",
  updated_at: "2026-07-17T08:00:00.000Z",
  subtaskTotal: 3,
  subtaskDone: 1,
  fileCount: 1,
  linkedEventCount: 0,
  subtasks: [],
};

const HIGH_PRIORITY_TASK: TaskWithMeta = {
  ...DEFAULT_TASK,
  id: "design-task-high",
  title: "Send the revised launch notes",
  priority: "high",
  due_at: "2099-07-18T18:00:00.000Z",
  description_json: { tags: ["Launch", "Notes"] },
  position: 2,
  subtaskTotal: 2,
  subtaskDone: 0,
  fileCount: 3,
};

const OVERDUE_TASK: TaskWithMeta = {
  ...DEFAULT_TASK,
  id: "design-task-overdue",
  title: "Confirm the venue booking",
  status: "in_progress",
  priority: "high",
  due_at: "2020-07-15T18:00:00.000Z",
  description_json: { tags: ["Operations"] },
  position: 1,
  subtaskTotal: 4,
  subtaskDone: 2,
  fileCount: 2,
};

const IN_REVIEW_TASK: TaskWithMeta = {
  ...DEFAULT_TASK,
  id: "design-task-review",
  title: "Review the launch checklist",
  status: "in_review",
  priority: "medium",
  due_at: "2099-07-22T18:00:00.000Z",
  description_json: { tags: ["Product", "Components"] },
  position: 1,
  subtaskTotal: 4,
  subtaskDone: 3,
  fileCount: 4,
};

const SECOND_DONE_TASK: TaskWithMeta = {
  ...DEFAULT_TASK,
  id: "design-task-second-done",
  title: "Review the design system docs",
  status: "done",
  priority: "medium",
  due_at: "2099-07-24T18:00:00.000Z",
  description_json: { tags: ["Documentation"] },
  position: 2,
  subtaskTotal: 6,
  subtaskDone: 3,
  fileCount: 8,
};

const SUBTASKS_DONE_TASK: TaskWithMeta = {
  ...DEFAULT_TASK,
  id: "design-task-subtasks-done",
  title: "Prepare the meeting agenda",
  status: "in_progress",
  priority: "low",
  due_at: "2099-07-23T18:00:00.000Z",
  description_json: { tags: ["Meeting"] },
  position: 2,
  subtaskTotal: 3,
  subtaskDone: 3,
  fileCount: 0,
  linkedEventCount: 0,
};

const DONE_TASK: TaskWithMeta = {
  ...DEFAULT_TASK,
  id: "design-task-done",
  title: "Publish the project update",
  status: "done",
  priority: "medium",
  due_at: "2099-07-17T18:00:00.000Z",
  description_json: { tags: ["Product", "Weekly"] },
  position: 1,
  subtaskTotal: 2,
  subtaskDone: 2,
  fileCount: 2,
};

const CANCELLED_TASK: TaskWithMeta = {
  ...DEFAULT_TASK,
  id: "design-task-cancelled",
  title: "Book the old meeting room",
  status: "cancelled",
  priority: null,
  due_at: null,
  description_json: {},
  position: 1,
  subtaskTotal: 0,
  subtaskDone: 0,
  fileCount: 0,
};

const SPARSE_TASK: TaskWithMeta = {
  ...DEFAULT_TASK,
  id: "design-task-sparse",
  title: "Capture a quiet idea",
  status: "not_started",
  priority: null,
  due_at: null,
  description_json: {},
  position: 3,
  subtaskTotal: 0,
  subtaskDone: 0,
  fileCount: 0,
};

const PEEK_TASK: TaskWithMeta = {
  ...DEFAULT_TASK,
  description_json: {
    text: "Bring the weekly decisions, risks, and next actions into one concise update.",
    tags: ["Product", "Design"],
    estimateMinutes: 60,
  },
  subtaskTotal: 3,
  subtaskDone: 1,
  subtasks: [
    {
      id: "design-subtask-one",
      task_id: DEFAULT_TASK.id,
      title: "Collect team updates",
      is_done: true,
      position: 1,
      created_at: "2026-07-17T08:00:00.000Z",
    },
    {
      id: "design-subtask-two",
      task_id: DEFAULT_TASK.id,
      title: "Call out the launch risk",
      is_done: false,
      position: 2,
      created_at: "2026-07-17T08:00:00.000Z",
    },
    {
      id: "design-subtask-three",
      task_id: DEFAULT_TASK.id,
      title: "Share the final note",
      is_done: false,
      position: 3,
      created_at: "2026-07-17T08:00:00.000Z",
    },
  ],
};

const CARD_STATES = [
  { label: "Default", task: DEFAULT_TASK },
  { label: "High priority", task: HIGH_PRIORITY_TASK },
  { label: "Overdue", task: OVERDUE_TASK },
  { label: "All subtasks done", task: SUBTASKS_DONE_TASK },
] as const;

const INITIAL_BOARD_TASKS = [
  DEFAULT_TASK,
  HIGH_PRIORITY_TASK,
  OVERDUE_TASK,
  SUBTASKS_DONE_TASK,
  IN_REVIEW_TASK,
  SECOND_DONE_TASK,
  DONE_TASK,
];
const LIST_AND_TABLE_TASKS = [
  ...INITIAL_BOARD_TASKS,
  SPARSE_TASK,
  CANCELLED_TASK,
];

export function TasksProductPreview() {
  const [tasks, setTasks] = useState<TaskWithMeta[]>(INITIAL_BOARD_TASKS);
  const [view, setView] = useState<TasksView>("board");
  const [scope, setScope] = useState<TasksScope>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] =
    useState<TaskBoardStatus>("not_started");
  const [peekOpen, setPeekOpen] = useState(false);
  const [listGrouping, setListGrouping] = useState<"status" | "priority">(
    "status",
  );
  const [hideDone, setHideDone] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([
    "status:cancelled",
  ]);
  const [previewTasks, setPreviewTasks] =
    useState<TaskWithMeta[]>(LIST_AND_TABLE_TASKS);

  function handleStatusChange(
    taskId: string,
    status: TaskBoardStatus,
    position: number,
  ) {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, status, position } : task,
      ),
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-h3">Task icon registry</h3>
        <p className="mt-1 text-small text-text-secondary">
          Auto-assigned on create; light weight by default, duotone when files attach.
        </p>
        <ul className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-7">
          {TASK_ICON_REGISTRY.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-paper p-3 text-center"
            >
              <TaskIconRender definition={entry} className="size-6 text-text-secondary" />
              <span className="text-label text-text-muted">{entry.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-h3">Classifier examples</h3>
        <p className="mt-1 text-small text-text-secondary">
          Deterministic title and tag rules — no AI.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {CLASSIFIER_EXAMPLES.map((example) => {
            const icon = classifyTaskIcon({
              title: example.title,
              tags: "tags" in example ? [...example.tags] : undefined,
            });

            return (
              <li
                key={example.title}
                className="flex items-center gap-3 rounded-xl border border-border bg-paper p-4"
              >
                <TaskIconRender
                  definition={resolveIconDefinition(icon.id)!}
                  className="size-6 shrink-0 text-text-secondary"
                />
                <div className="min-w-0">
                  <p className="truncate text-small font-medium">{example.title}</p>
                  <p className="text-label text-text-muted">→ {icon.id}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="text-h3">Task icon states</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-paper p-6">
            <p className="mb-3 text-label uppercase text-text-muted">Auto (empty)</p>
            <div className="rounded-xl border border-border bg-paper p-2">
              <div className="flex min-h-[4.75rem] items-center justify-center rounded-lg bg-sidebar ring-1 ring-inset ring-border/80 text-text-muted/65">
                <TaskIconRender
                  definition={TASK_ICON_REGISTRY.find((entry) => entry.id === "default")!}
                  className="size-9"
                />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-paper p-6">
            <p className="mb-3 text-label uppercase text-text-muted">With files</p>
            <div className="rounded-xl border border-border bg-paper p-2">
              <div className="flex min-h-[4.75rem] items-center justify-center rounded-lg bg-sidebar ring-1 ring-inset ring-border/80 text-text-secondary">
                <TaskIconRender
                  definition={TASK_ICON_REGISTRY.find((entry) => entry.id === "files")!}
                  active
                  className="size-9"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-h3">Task card states</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {CARD_STATES.map(({ label, task }) => (
            <div key={label}>
              <p className="mb-2 text-label uppercase text-text-muted">{label}</p>
              <TaskCard task={task} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-h3">Interactive board</h3>
        <p className="mt-1 text-small text-text-secondary">
          To do, In progress, In review, and Done. Pointer and keyboard
          dragging are active.
        </p>
        <div className="mt-4">
          <TaskBoard
            tasks={tasks}
            onStatusChange={handleStatusChange}
            onCreateTask={(status) => {
              setCreateStatus(status);
              setCreateOpen(true);
            }}
          />
        </div>
      </div>

      <div>
        <h3 className="text-h3">Tasks toolbar</h3>
        <p className="mt-1 text-small text-text-secondary">
          View switch, scope filter menu, and the single marigold create action.
        </p>
        <div className="mt-4">
          <TasksToolbar
            view={view}
            scope={scope}
            onViewChange={setView}
            onScopeChange={setScope}
            onCreateTask={() => {
              setCreateStatus("not_started");
              setCreateOpen(true);
            }}
            isCreateDialogOpen={createOpen}
          />
        </div>
      </div>

      <div>
        <h3 className="text-h3">Cross-feature action states</h3>
        <p className="mt-1 text-small text-text-secondary">
          Neutral manual actions, each picker, and calm pending, success, and retry states.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TaskCrossLinkActionsPreview state="default" />
          <TaskCrossLinkActionsPreview state="schedule" />
          <TaskCrossLinkActionsPreview state="files" />
          <TaskCrossLinkActionsPreview state="files-empty" />
          <TaskCrossLinkActionsPreview state="workspace" />
          <TaskCrossLinkActionsPreview state="workspace-empty" />
          <TaskCrossLinkActionsPreview state="loading" />
          <TaskCrossLinkActionsPreview state="pending" />
          <TaskCrossLinkActionsPreview state="success" />
          <TaskCrossLinkActionsPreview state="error" />
        </div>
      </div>

      <div>
        <h3 className="text-h3">Create task modal</h3>
        <p className="mt-1 text-small text-text-secondary">
          The production modal covers title, description, priority, due date,
          estimate, tags, and attachments. Submitting here closes the preview
          without saving.
        </p>
        <button
          type="button"
          onClick={() => {
            setCreateStatus("not_started");
            setCreateOpen(true);
          }}
          className="mt-4 rounded-lg border border-border-strong bg-paper px-4 py-2 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Open create modal
        </button>
        {createOpen ? (
          <CreateTaskDialog
            onClose={() => {
              setCreateOpen(false);
              setCreateStatus("not_started");
            }}
            onSubmit={() => {
              setCreateOpen(false);
              setCreateStatus("not_started");
            }}
            isPending={false}
            initialStatus={createStatus}
          />
        ) : null}
      </div>

      <div>
        <h3 className="text-h3">Empty task state</h3>
        <p className="mt-1 text-small text-text-secondary">
          Line-art scaffolding keeps the first action clear without database
          recreation language.
        </p>
        <div className="mt-4">
          <TasksEmptyState
            onCreateTask={() => {
              setCreateStatus("not_started");
              setCreateOpen(true);
            }}
          />
        </div>
      </div>

      <div>
        <h3 className="text-h3">Premium list (smart metadata)</h3>
        <p className="mt-1 text-small text-text-secondary">
          Empty due/priority/subtasks/files stay hidden. Checkbox complete, group
          collapse, hide done, and segmented group-by are interactive in this
          preview.
        </p>
        <div className="mt-4">
          <TaskList
            tasks={previewTasks}
            grouping={listGrouping}
            onGroupingChange={setListGrouping}
            collapsedGroups={collapsedGroups}
            onCollapsedGroupsChange={setCollapsedGroups}
            hideDone={hideDone}
            onHideDoneChange={setHideDone}
            onToggleComplete={(taskId) => {
              setPreviewTasks((current) =>
                current.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        status: task.status === "done" ? "not_started" : "done",
                      }
                    : task,
                ),
              );
            }}
            onTaskPatch={(taskId, patch) => {
              setPreviewTasks((current) =>
                current.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        status: patch.status ?? task.status,
                        priority:
                          patch.priority !== undefined
                            ? patch.priority
                            : task.priority,
                        due_at:
                          patch.dueAt !== undefined ? patch.dueAt : task.due_at,
                      }
                    : task,
                ),
              );
            }}
          />
        </div>
      </div>

      <div>
        <h3 className="text-h3">Task peek</h3>
        <p className="mt-1 text-small text-text-secondary">
          The production slide-over keeps task fields and subtasks close to the
          board without leaving the page.
        </p>
        <button
          type="button"
          onClick={() => setPeekOpen(true)}
          className="mt-4 rounded-lg border border-border-strong bg-paper px-4 py-2 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Open task peek
        </button>
        {peekOpen ? (
          <TaskPeek task={PEEK_TASK} onClose={() => setPeekOpen(false)} />
        ) : null}
      </div>

      <div>
        <h3 className="text-h3">Premium table</h3>
        <p className="mt-1 text-small text-text-secondary">
          Sticky title with checkbox and icon, blank empty cells, inline
          status/priority/due editors, and VALUES footer.
        </p>
        <div className="mt-4">
          <TaskTable
            tasks={previewTasks}
            hideDone={hideDone}
            onHideDoneChange={setHideDone}
            onToggleComplete={(taskId) => {
              setPreviewTasks((current) =>
                current.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        status: task.status === "done" ? "not_started" : "done",
                      }
                    : task,
                ),
              );
            }}
            onTaskPatch={(taskId, patch) => {
              setPreviewTasks((current) =>
                current.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        status: patch.status ?? task.status,
                        priority:
                          patch.priority !== undefined
                            ? patch.priority
                            : task.priority,
                        due_at:
                          patch.dueAt !== undefined ? patch.dueAt : task.due_at,
                      }
                    : task,
                ),
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
