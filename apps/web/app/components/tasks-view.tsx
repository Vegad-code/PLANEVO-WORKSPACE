"use client";

import { useState } from "react";
import type { TaskItem, TasksData } from "@/lib/queries/tasks";
import { EmptyState } from "./empty-state";
import { TaskComposer } from "./task-composer";

const BOARD_COLUMNS = ["To do", "In progress", "In review", "Done"] as const;

function TaskCard({ task }: { task: TaskItem }) {
  const formattedDate = task.dueDate
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
        new Date(task.dueDate),
      )
    : null;

  return (
    <article className="rounded-xl border border-border bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-body font-medium">{task.title}</h3>
        {task.priority && (
          <span className="shrink-0 rounded-full bg-slate-tint px-2 py-1 text-label text-ink">
            {task.priority}
          </span>
        )}
      </div>
      {task.description && <p className="mt-2 line-clamp-2 text-small text-text-secondary">{task.description}</p>}
      {(formattedDate || task.estimateMinutes !== null || task.tags.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-label text-text-muted">
          {formattedDate && <span>{formattedDate}</span>}
          {task.estimateMinutes !== null && <span>{task.estimateMinutes} min</span>}
          {task.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border px-2 py-1">{tag}</span>
          ))}
        </div>
      )}
    </article>
  );
}

export function TasksView({ data }: { data: TasksData }) {
  const [view, setView] = useState<"board" | "list">("board");
  const hasTasks = data.tasks.length > 0;

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label uppercase text-text-muted">Workspace database</p>
          <h1 className="mt-2 text-h1">Tasks</h1>
          <p className="mt-2 text-body text-text-secondary">Plan the work, then move it forward.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border bg-surface-raised p-1" aria-label="Task view">
            {(["board", "list"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                aria-pressed={view === option}
                className={`h-7 rounded-md px-3 text-small capitalize outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  view === option ? "bg-paper text-ink" : "text-text-muted"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <TaskComposer workspaceId={data.workspaceId} />
        </div>
      </div>

      <div className="mt-8 min-h-0 flex-1">
        {!hasTasks ? (
          <EmptyState
            icon="tasks"
            title="Your task board is ready when you are"
            description="Create your first real task. Planevo will add only the database structure and views it needs—no starter tasks or sample rows."
            action={<TaskComposer workspaceId={data.workspaceId} buttonLabel="Create first task" />}
          />
        ) : view === "board" ? (
          <div className="grid min-w-max grid-cols-4 gap-4 pb-4 lg:min-w-0">
            {BOARD_COLUMNS.map((column) => {
              const tasks = data.tasks.filter((task) => task.status === column);
              return (
                <section key={column} className="w-72 rounded-card border border-border bg-surface-raised p-3 lg:w-auto">
                  <div className="flex items-center justify-between px-1 py-1">
                    <h2 className="text-small font-medium">{column}</h2>
                    <span className="text-label text-text-muted">{tasks.length}</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {tasks.map((task) => <TaskCard key={task.id} task={task} />)}
                    {tasks.length === 0 && (
                      <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-small text-text-muted">No tasks</p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-border bg-surface-raised">
            {data.tasks.map((task) => (
              <div key={task.id} className="flex flex-col gap-2 border-b border-border px-4 py-4 last:border-b-0 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-body font-medium">{task.title}</p>
                  {task.description && <p className="mt-1 truncate text-small text-text-muted">{task.description}</p>}
                </div>
                <span className="text-small text-text-secondary sm:ml-auto sm:w-32">{task.status}</span>
                <span className="text-small text-text-muted sm:w-32">{task.priority ?? "No priority"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
