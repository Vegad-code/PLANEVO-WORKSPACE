"use client";

import { useEffect, useRef, useState } from "react";
import {
  Columns3,
  LayoutGrid,
  List,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  isCreateDialogOpen?: boolean;
};

const VIEW_LABELS: Record<TasksView, string> = {
  board: "Board",
  list: "List",
  table: "Table",
};

const VIEW_ICONS = {
  board: Columns3,
  list: List,
  table: LayoutGrid,
} as const;

const SCOPE_OPTIONS = [
  { value: "all", label: "All tasks" },
  { value: "workspace", label: "This workspace" },
] as const satisfies ReadonlyArray<{ value: TasksScope; label: string }>;

export function TasksToolbar({
  view,
  scope,
  onViewChange,
  onScopeChange,
  onCreateTask,
  isCreateDialogOpen = false,
}: TasksToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    filterPanelRef.current
      ?.querySelector<HTMLInputElement>("input:checked")
      ?.focus();
  }, [filterOpen]);

  function closeFilter(restoreFocus = false) {
    setFilterOpen(false);
    if (restoreFocus) filterButtonRef.current?.focus();
  }

  return (
    <div
      role="toolbar"
      aria-label="Tasks controls"
      className="flex flex-wrap items-center gap-3"
    >
      <div
        role="group"
        aria-label="Task view"
        className="flex rounded-lg border border-border bg-surface-raised p-0.5"
      >
        {TASK_VIEWS.map((option) => {
          const isSelected = view === option;
          const ViewIcon = VIEW_ICONS[option];

          return (
            <button
              key={option}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onViewChange(option)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-small font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
                isSelected
                  ? "border border-border bg-paper text-ink"
                  : "border border-transparent text-text-secondary hover:text-ink"
              }`}
            >
              <ViewIcon aria-hidden="true" className="size-4" />
              {VIEW_LABELS[option]}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <button
          ref={filterButtonRef}
          type="button"
          aria-expanded={filterOpen}
          aria-controls="task-scope-filter"
          onClick={() => setFilterOpen((open) => !open)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-2 text-small font-medium text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Filter
          <Icon name="chevron-down" className="size-3.5" />
        </button>
        {filterOpen ? (
          <>
            <button
              type="button"
              aria-label="Close filter menu"
              tabIndex={-1}
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => closeFilter(true)}
            />
            <div
              ref={filterPanelRef}
              id="task-scope-filter"
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                closeFilter(true);
              }}
              className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-border bg-paper p-1"
            >
              <fieldset>
                <legend className="sr-only">Task scope</legend>
                {SCOPE_OPTIONS.map((option) => {
                  const isSelected = scope === option.value;

                  return (
                    <label key={option.value} className="block cursor-pointer">
                      <input
                        type="radio"
                        name="task-scope"
                        value={option.value}
                        checked={isSelected}
                        onChange={() => {
                          closeFilter(true);
                          onScopeChange(option.value);
                        }}
                        className="peer sr-only"
                      />
                      <span className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-small text-ink outline-none hover:bg-surface-raised peer-focus-visible:outline peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                        {option.label}
                        {isSelected ? (
                          <Icon
                            name="check"
                            className="size-4 text-text-secondary"
                          />
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            </div>
          </>
        ) : null}
      </div>

      <Button
        type="button"
        aria-haspopup="dialog"
        onClick={onCreateTask}
        variant={isCreateDialogOpen ? "ink" : "default"}
        className="shrink-0"
      >
        <Plus aria-hidden="true" className="size-4" />
        Create task
      </Button>
    </div>
  );
}
