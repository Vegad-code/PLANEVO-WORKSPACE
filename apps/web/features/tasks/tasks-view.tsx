"use client";

import { useState } from "react";
import type { TasksData } from "@planevo/core/queries/tasks";
import { EmptyState } from "@/components/ui/empty-state";
import { TaskComposer } from "@/features/tasks/task-composer";
import { RecordBoard, RecordList } from "@/features/database/record-board";

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
          <TaskComposer workspaceId={data.workspaceId} appearance="quiet" />
        </div>
      </div>

      <div className="mt-8 min-h-0 flex-1">
        {!hasTasks ? (
          <EmptyState
            icon="tasks"
            title="Your task board is ready when you are"
            description="Create your first real task. Planevo will add only the database structure and views it needs—no starter tasks or sample rows."
            action={
              <TaskComposer
                workspaceId={data.workspaceId}
                buttonLabel="Create first task"
                appearance="quiet"
              />
            }
          />
        ) : view === "board" ? (
          <RecordBoard records={data.tasks} statusOptions={data.statusOptions} />
        ) : (
          <RecordList records={data.tasks} />
        )}
      </div>
    </div>
  );
}
