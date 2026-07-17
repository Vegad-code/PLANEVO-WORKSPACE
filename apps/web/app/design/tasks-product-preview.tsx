"use client";

import { useState } from "react";
import type { TaskWithMeta } from "@planevo/core/queries/product-tasks";
import {
  TaskBoard,
  type TaskBoardStatus,
} from "@/features/tasks-product/task-board";
import { TaskCard } from "@/features/tasks-product/task-card";

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

const CARD_STATES = [
  { label: "Default", task: DEFAULT_TASK },
  { label: "High priority", task: HIGH_PRIORITY_TASK },
  { label: "Overdue", task: OVERDUE_TASK },
  { label: "All subtasks done", task: SUBTASKS_DONE_TASK },
] as const;

const INITIAL_BOARD_TASKS = CARD_STATES.map(({ task }) => task);

export function TasksProductPreview() {
  const [tasks, setTasks] = useState<TaskWithMeta[]>(INITIAL_BOARD_TASKS);

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
    </div>
  );
}
