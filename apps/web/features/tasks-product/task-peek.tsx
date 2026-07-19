"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TaskWithMeta } from "@planevo/core/queries/product-tasks";
import {
  TASK_PRIORITIES,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "@planevo/core/types/tasks";
import { Icon } from "@/components/ui/planevo-icon";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import {
  createProductSubtaskAction,
  deleteProductSubtaskAction,
  deleteProductTaskAction,
  toggleProductSubtaskAction,
  updateProductTaskAction,
} from "@/app/(workspace)/tasks/actions";

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

export function TaskPeek({ task, onClose }: TaskPeekProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority | "">(task.priority ?? "");
  const [dueDate, setDueDate] = useState(dateInputValue(task.due_at));
  const [description, setDescription] = useState(descriptionText(task));
  const [subtaskTitle, setSubtaskTitle] = useState("");

  function refreshAfter(message: string) {
    toast(message);
    router.refresh();
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
          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-label uppercase text-text-muted">Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClassName}
                maxLength={500}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-label uppercase text-text-muted">Status</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as TaskStatus)}
                  className={inputClassName}
                >
                  {TASK_STATUSES.map((option) => (
                    <option key={option} value={option}>
                      {TASK_STATUS_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-label uppercase text-text-muted">Priority</span>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as TaskPriority | "")}
                  className={inputClassName}
                >
                  <option value="">No priority</option>
                  {TASK_PRIORITIES.map((option) => (
                    <option key={option} value={option}>
                      {PRIORITY_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-label uppercase text-text-muted">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className={inputClassName}
              />
            </label>

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

            <section aria-labelledby="task-subtasks-title" className="border-t border-border pt-5">
              <div className="flex items-center justify-between gap-3">
                <h3 id="task-subtasks-title" className="text-h3">Subtasks</h3>
                <span className="font-mono text-mono text-text-muted">
                  {task.subtaskDone} / {task.subtaskTotal}
                </span>
              </div>

              <ul className="mt-3 space-y-2">
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
          <button
            type="button"
            disabled={isPending}
            onClick={removeTask}
            className="rounded-lg px-3 py-2 text-small font-medium text-brick outline-none hover:bg-brick-tint focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-brick disabled:opacity-50"
          >
            Delete task
          </button>
          <button
            type="button"
            disabled={isPending || !title.trim()}
            onClick={saveTask}
            className="rounded-lg bg-ink px-4 py-2 text-small font-medium text-paper outline-none hover:opacity-85 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </div>
    </Dialog>
  );
}
