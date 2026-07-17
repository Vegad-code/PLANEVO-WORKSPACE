"use client";

import { useState } from "react";
import type { TaskWithMeta } from "@planevo/core/queries/product-tasks";
import {
  TaskBoard,
  type TaskBoardStatus,
} from "@/features/tasks-product/task-board";
import { TaskCard } from "@/features/tasks-product/task-card";
import { TaskList } from "@/features/tasks-product/task-list";
import { TaskTable } from "@/features/tasks-product/task-table";
import {
  TasksToolbar,
  type TasksView,
} from "@/features/tasks-product/tasks-toolbar";
import type { TasksScope } from "@/lib/tasks/scope-prefs";

const DEFAULT_TASK: TaskWithMeta = {
  id: "design-task-default",
  user_id: "design-owner",
  title: "Outline the project update",
  status: "not_started",
  priority: "medium",
  due_at: "2099-07-21T18:00:00.000Z",
  description_json: {},
  position: 1,
  completed_at: null,
  created_at: "2026-07-17T08:00:00.000Z",
  updated_at: "2026-07-17T08:00:00.000Z",
  subtaskTotal: 3,
  subtaskDone: 1,
  fileCount: 1,
  subtasks: [],
};

const HIGH_PRIORITY_TASK: TaskWithMeta = {
  ...DEFAULT_TASK,
  id: "design-task-high",
  title: "Send the revised launch notes",
  priority: "high",
  due_at: "2099-07-18T18:00:00.000Z",
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
  position: 1,
  subtaskTotal: 4,
  subtaskDone: 2,
  fileCount: 2,
};

const SUBTASKS_DONE_TASK: TaskWithMeta = {
  ...DEFAULT_TASK,
  id: "design-task-subtasks-done",
  title: "Prepare the meeting agenda",
  status: "in_progress",
  priority: "low",
  due_at: "2099-07-23T18:00:00.000Z",
  position: 2,
  subtaskTotal: 3,
  subtaskDone: 3,
  fileCount: 0,
};

const DONE_TASK: TaskWithMeta = {
  ...DEFAULT_TASK,
  id: "design-task-done",
  title: "Publish the project update",
  status: "done",
  priority: "medium",
  due_at: "2099-07-17T18:00:00.000Z",
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
  position: 1,
  subtaskTotal: 0,
  subtaskDone: 0,
  fileCount: 0,
};

const CARD_STATES = [
  { label: "Default", task: DEFAULT_TASK },
  { label: "High priority", task: HIGH_PRIORITY_TASK },
  { label: "Overdue", task: OVERDUE_TASK },
  { label: "All subtasks done", task: SUBTASKS_DONE_TASK },
] as const;

const INITIAL_BOARD_TASKS = CARD_STATES.map(({ task }) => task);
const LIST_AND_TABLE_TASKS = [
  ...INITIAL_BOARD_TASKS,
  DONE_TASK,
  CANCELLED_TASK,
];

export function TasksProductPreview() {
  const [tasks, setTasks] = useState<TaskWithMeta[]>(INITIAL_BOARD_TASKS);
  const [view, setView] = useState<TasksView>("board");
  const [scope, setScope] = useState<TasksScope>("all");

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
          Pointer and keyboard dragging are active. The Done column starts empty.
        </p>
        <div className="mt-4">
          <TaskBoard tasks={tasks} onStatusChange={handleStatusChange} />
        </div>
      </div>

      <div>
        <h3 className="text-h3">Tasks toolbar</h3>
        <p className="mt-1 text-small text-text-secondary">
          View and scope controls are fully controlled. Create task is the only marigold action.
        </p>
        <div className="mt-4">
          <TasksToolbar
            view={view}
            scope={scope}
            onViewChange={setView}
            onScopeChange={setScope}
            onCreateTask={() => undefined}
          />
        </div>
      </div>

      <div>
        <h3 className="text-h3">Status-grouped list</h3>
        <p className="mt-1 text-small text-text-secondary">
          Dense rows preserve task metadata and every product status.
        </p>
        <div className="mt-4">
          <TaskList tasks={LIST_AND_TABLE_TASKS} />
        </div>
      </div>

      <div>
        <h3 className="text-h3">Sortable table</h3>
        <p className="mt-1 text-small text-text-secondary">
          Every column sorts on the client. Activate a header again to reverse its direction.
        </p>
        <div className="mt-4">
          <TaskTable tasks={LIST_AND_TABLE_TASKS} />
        </div>
      </div>
    </div>
  );
}
