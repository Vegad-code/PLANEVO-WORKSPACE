"use client";

import { useState, useTransition } from "react";
import { Square } from "lucide-react";
import { useRouter } from "next/navigation";
import type { TaskWithMeta } from "@planevo/core/queries/product-tasks";
import { resolveTaskIcon } from "@planevo/core/tasks/task-icon-classifier";
import { resolveIconDefinition } from "@planevo/core/tasks/icon-catalog";
import type { TaskIconRef } from "@planevo/core/tasks/task-icon-types";
import {
  TASK_PRIORITIES,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "@planevo/core/types/tasks";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select";
import { Icon } from "@/components/ui/planevo-icon";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  createProductSubtaskAction,
  deleteProductSubtaskAction,
  deleteProductTaskAction,
  toggleProductSubtaskAction,
  updateProductTaskAction,
  updateTaskIconAction,
} from "@/app/(workspace)/tasks/actions";
import {
  ESTIMATE_OPTIONS,
  TASK_TAGS,
} from "./create-task-dialog";
import { TaskCrossLinkActions } from "./cross-link-actions";
import { TaskIconPicker } from "./task-icon-picker";
import { TaskIconRender } from "./task-icon-render";

type TaskPeekProps = {
  task: TaskWithMeta;
  onClose: () => void;
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function descriptionText(task: TaskWithMeta): string {
  const text = task.description_json.text;
  return typeof text === "string" ? text : "";
}

function dateInputValue(dueAt: string | null): string {
  if (!dueAt) return "";
  const date = new Date(dueAt);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function dueAtFromDateInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function taskTags(task: TaskWithMeta): string[] {
  const tags = task.description_json.tags;
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag): tag is string => typeof tag === "string");
}

function taskEstimateMinutes(task: TaskWithMeta): string {
  const value = task.description_json.estimateMinutes;
  return typeof value === "number" && value > 0 ? String(value) : "";
}

export function TaskPeek({ task, onClose }: TaskPeekProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority | "">(task.priority ?? "");
  const [dueDate, setDueDate] = useState(dateInputValue(task.due_at));
  const [description, setDescription] = useState(descriptionText(task));
  const [tags, setTags] = useState<string[]>(taskTags(task));
  const [estimate, setEstimate] = useState(taskEstimateMinutes(task));
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const taskIcon = resolveTaskIcon(task, task.fileCount);
  const [optimisticIconRef, setOptimisticIconRef] = useState<TaskIconRef | null>(
    null,
  );
  const localIconRef = optimisticIconRef ?? taskIcon.ref;
  const iconDefinition =
    resolveIconDefinition(localIconRef.id, localIconRef.emoji) ??
    taskIcon.definition;

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((existing) => existing !== tag)
        : [...current, tag],
    );
  }

  function refreshAfter(message: string) {
    toast(message);
    router.refresh();
  }

  function handleIconSelect(nextIcon: TaskIconRef) {
    setOptimisticIconRef(nextIcon);
    setIconPickerOpen(false);
    startTransition(async () => {
      const result = await updateTaskIconAction({
        taskId: task.id,
        iconId: nextIcon.id,
        style: nextIcon.style,
        emoji: nextIcon.emoji,
      });
      if (!result.ok) {
        setOptimisticIconRef(null);
        toast(result.error, { tone: "error" });
        return;
      }
      setOptimisticIconRef(null);
      refreshAfter("Task icon updated");
    });
  }

  function saveTask() {
    startTransition(async () => {
      const result = await updateProductTaskAction({
        taskId: task.id,
        title,
        status,
        priority: priority || null,
        dueAt: dueAtFromDateInput(dueDate),
        description,
        tags,
        estimateMinutes: estimate ? Number.parseInt(estimate, 10) : null,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      refreshAfter("Task updated");
    });
  }

  function removeTask() {
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteProductTaskAction({ taskId: task.id });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      onClose();
      refreshAfter("Task deleted");
    });
  }

  function addSubtask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = subtaskTitle.trim();
    if (!nextTitle) return;

    startTransition(async () => {
      const result = await createProductSubtaskAction({
        taskId: task.id,
        title: nextTitle,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      setSubtaskTitle("");
      refreshAfter("Subtask added");
    });
  }

  function setSubtaskDone(subtaskId: string, isDone: boolean) {
    startTransition(async () => {
      const result = await toggleProductSubtaskAction({ subtaskId, isDone });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      router.refresh();
    });
  }

  function removeSubtask(subtaskId: string) {
    startTransition(async () => {
      const result = await deleteProductSubtaskAction({ subtaskId });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      refreshAfter("Subtask removed");
    });
  }

  const inputClassName =
    "w-full rounded-lg border border-border-strong bg-paper px-3 py-2 text-body text-ink outline-none placeholder:text-text-muted focus:border-ink";

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy="task-peek-title"
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-md border-l border-border bg-surface-raised p-0 text-ink backdrop:bg-ink/30"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-label uppercase text-text-muted">Task details</p>
            <h2 id="task-peek-title" className="truncate text-h3">
              {task.title || "Untitled task"}
            </h2>
          </div>
          <button
            autoFocus
            type="button"
            onClick={onClose}
            aria-label="Close task details"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="close" className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-5">
            <label className="block">
              <span className="mb-2 block text-label uppercase text-text-muted">Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClassName}
                maxLength={500}
              />
            </label>

            <div className="relative">
              <span className="mb-2 block text-label uppercase text-text-muted">
                Task icon
              </span>
              <button
                type="button"
                aria-label="Change task icon"
                aria-expanded={iconPickerOpen}
                onClick={() => setIconPickerOpen((open) => !open)}
                className="flex size-12 items-center justify-center rounded-lg border border-border bg-sidebar text-text-secondary outline-none transition-colors hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <TaskIconRender
                  definition={iconDefinition}
                  active={taskIcon.active}
                  style={localIconRef.style}
                  size="peek"
                />
              </button>
              {iconPickerOpen ? (
                <TaskIconPicker
                  currentIconRef={localIconRef}
                  onSelect={handleIconSelect}
                  onClose={() => setIconPickerOpen(false)}
                />
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Status"
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
              >
                {TASK_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {TASK_STATUS_LABELS[option]}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Priority"
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as TaskPriority | "")
                }
              >
                <option value="">No priority</option>
                {TASK_PRIORITIES.map((option) => (
                  <option key={option} value={option}>
                    {PRIORITY_LABELS[option]}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-label uppercase text-text-muted">Due date</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className={inputClassName}
                />
              </label>
              <SelectField
                label="Estimate"
                value={estimate}
                onChange={(event) => setEstimate(event.target.value)}
              >
                {ESTIMATE_OPTIONS.map((option) => (
                  <option key={option.label} value={option.minutes}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </div>

            <fieldset>
              <legend className="mb-2 block text-label uppercase text-text-muted">Tags</legend>
              <div className="flex flex-wrap gap-2">
                {TASK_TAGS.map((tag) => {
                  const isSelected = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleTag(tag)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-small outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
                        isSelected
                          ? "border-ink bg-paper text-ink"
                          : "border-border bg-paper text-text-secondary hover:border-border-strong hover:text-ink"
                      }`}
                    >
                      <Square aria-hidden="true" className="size-3 shrink-0" />
                      {tag}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="block">
              <span className="mb-2 block text-label uppercase text-text-muted">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                maxLength={20_000}
                placeholder="Add context, notes, or a definition of done…"
                className={`${inputClassName} resize-y`}
              />
            </label>

            <TaskCrossLinkActions
              taskId={task.id}
              dueAt={task.due_at}
              initialFileCount={task.fileCount}
            />

            <section aria-labelledby="task-subtasks-title" className="border-t border-border pt-5">
              <div className="flex items-center justify-between gap-3">
                <h3 id="task-subtasks-title" className="text-h3">Subtasks</h3>
                <span className="font-mono text-mono text-text-muted">
                  {task.subtaskDone} / {task.subtaskTotal}
                </span>
              </div>

              <ul className="mt-3 flex flex-col gap-2">
                {task.subtasks.map((subtask) => (
                  <li
                    key={subtask.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-paper px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={subtask.is_done}
                      disabled={isPending}
                      onChange={(event) => setSubtaskDone(subtask.id, event.target.checked)}
                      aria-label={`Mark ${subtask.title} ${subtask.is_done ? "not done" : "done"}`}
                      className="size-4 accent-meadow"
                    />
                    <span className={`min-w-0 flex-1 text-small ${subtask.is_done ? "text-text-muted line-through" : "text-ink"}`}>
                      {subtask.title}
                    </span>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => removeSubtask(subtask.id)}
                      className="rounded-lg px-2 py-1 text-label text-text-muted outline-none hover:bg-surface-raised hover:text-brick focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {task.subtasks.length === 0 ? (
                <p className="mt-3 text-small text-text-muted">No subtasks yet.</p>
              ) : null}

              <form onSubmit={addSubtask} className="mt-3 flex gap-2">
                <input
                  value={subtaskTitle}
                  onChange={(event) => setSubtaskTitle(event.target.value)}
                  placeholder="Add a subtask"
                  aria-label="New subtask title"
                  maxLength={500}
                  className={inputClassName}
                />
                <button
                  type="submit"
                  disabled={isPending || !subtaskTitle.trim()}
                  className="shrink-0 rounded-lg border border-border-strong bg-paper px-3 py-2 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
                >
                  Add
                </button>
              </form>
            </section>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={removeTask}
            className="text-brick hover:bg-brick-tint"
          >
            Delete task
          </Button>
          <Button
            type="button"
            variant="ink"
            disabled={isPending || !title.trim()}
            onClick={saveTask}
          >
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </footer>
      </div>
    </Dialog>
  );
}
