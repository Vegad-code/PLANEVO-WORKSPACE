"use client";

import { Icon } from "@/components/ui/planevo-icon";
import type { TasksScope } from "@/lib/tasks/scope-prefs";

export const TASK_VIEWS = ["board", "list", "table"] as const;

export type TasksView = (typeof TASK_VIEWS)[number];

type TasksToolbarProps = {
  view: TasksView;
  scope: TasksScope;
  onViewChange: (view: TasksView) => void;
  onScopeChange: (scope: TasksScope) => void;
  onCreateTask: () => void;
};

const VIEW_LABELS: Record<TasksView, string> = {
  board: "Board",
  list: "List",
  table: "Table",
};

const SCOPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "workspace", label: "This workspace" },
] as const satisfies ReadonlyArray<{ value: TasksScope; label: string }>;

export function TasksToolbar({
  view,
  scope,
  onViewChange,
  onScopeChange,
  onCreateTask,
}: TasksToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Tasks controls"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div
          role="group"
          aria-label="Task view"
          className="flex w-full rounded-full border border-border bg-paper p-1 sm:w-auto"
        >
          {TASK_VIEWS.map((option) => {
            const isSelected = view === option;

            return (
              <button
                key={option}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onViewChange(option)}
                className={`min-w-0 flex-1 rounded-full px-3 py-2 text-small font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none sm:flex-none ${
                  isSelected
                    ? "bg-ink text-paper"
                    : "text-text-secondary hover:bg-surface-raised hover:text-ink"
                }`}
              >
                {VIEW_LABELS[option]}
              </button>
            );
          })}
        </div>

        <div
          role="group"
          aria-label="Task scope"
          className="flex w-full rounded-full border border-border bg-paper p-1 sm:w-auto"
        >
          {SCOPE_OPTIONS.map((option) => {
            const isSelected = scope === option.value;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onScopeChange(option.value)}
                className={`min-w-0 flex-1 rounded-full px-3 py-2 text-small font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none sm:flex-none ${
                  isSelected
                    ? "bg-surface-raised text-ink"
                    : "text-text-secondary hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onCreateTask}
        className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-marigold px-4 py-2 text-small font-medium text-ink outline-none transition-colors hover:bg-marigold-tint focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none sm:w-auto"
      >
        <Icon name="plus" className="size-4" />
        Create task
      </button>
    </div>
  );
}
