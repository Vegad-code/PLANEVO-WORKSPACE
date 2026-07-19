"use client";

import { useRef, useState } from "react";
import { TagIcon } from "@heroicons/react/24/outline";
import {
  TASK_PRIORITIES,
  type TaskPriority,
} from "@planevo/core/types/tasks";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/planevo-icon";
import {
  MAX_TASK_ATTACHMENT_BYTES,
  MAX_TASK_ATTACHMENTS,
} from "@/lib/tasks/task-attachments";
import type { TaskBoardStatus } from "./task-board-ordering";

/**
 * Create-task modal matching the Lumis reference (founder override
 * 2026-07-18): title, description, priority, due date, estimate, tag chips,
 * and an attachment drop zone. Purely presentational — the parent owns
 * submission, so `/design` can mount it against a no-op. Field state lives
 * here and is discarded on unmount; parents mount it only while open, so
 * closing always resets the form.
 */

export const TASK_TAGS = [
  "Product",
  "Design",
  "Components",
  "User",
  "Other",
] as const;

const ESTIMATE_OPTIONS = [
  { minutes: "", label: "None" },
  { minutes: "15", label: "15 min" },
  { minutes: "30", label: "30 min" },
  { minutes: "45", label: "45 min" },
  { minutes: "60", label: "1 hour" },
  { minutes: "120", label: "2 hours" },
  { minutes: "240", label: "4 hours" },
  { minutes: "480", label: "1 day" },
] as const;

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

type CreateTaskDialogProps = {
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  isPending: boolean;
  initialStatus?: TaskBoardStatus;
};

function dueAtFromDate(value: string): string | null {
  if (!value) return null;
  // Noon local keeps the calendar day stable across timezones.
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function CreateTaskDialog({
  onClose,
  onSubmit,
  isPending,
  initialStatus = "not_started",
}: CreateTaskDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [dueDate, setDueDate] = useState("");
  const [estimate, setEstimate] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const inputClassName =
    "w-full rounded-lg border border-border-strong bg-paper px-3 py-2 text-body text-ink outline-none placeholder:text-text-muted focus:border-ink";
  const labelClassName = "mb-2 block text-label uppercase text-text-muted";

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((existing) => existing !== tag)
        : [...current, tag],
    );
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;

    const accepted = [...files];
    let error: string | null = null;
    for (const file of incoming) {
      if (accepted.length >= MAX_TASK_ATTACHMENTS) {
        error = `Attach up to ${MAX_TASK_ATTACHMENTS} files per task.`;
        break;
      }
      if (file.size > MAX_TASK_ATTACHMENT_BYTES) {
        error = "Files must be 25 MB or smaller.";
        continue;
      }
      accepted.push(file);
    }
    setFiles(accepted);
    setFileError(error);
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
    setFileError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const formData = new FormData();
    formData.set("title", trimmedTitle);
    formData.set("status", initialStatus);
    formData.set("description", description.trim());
    formData.set("priority", priority);
    formData.set("dueAt", dueAtFromDate(dueDate) ?? "");
    formData.set("estimateMinutes", estimate);
    for (const tag of tags) formData.append("tags", tag);
    for (const file of files) formData.append("files", file);
    onSubmit(formData);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy="create-task-title"
      className="m-4 max-h-dvh w-auto max-w-lg overflow-hidden rounded-card border border-border bg-surface-raised p-0 text-ink backdrop:bg-ink/30 sm:m-auto sm:w-full"
    >
      <form onSubmit={handleSubmit} className="flex max-h-dvh flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-label uppercase text-text-muted">New task</p>
            <h2 id="create-task-title" className="mt-1 text-h2">
              Create new task
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create task"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="close" className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <label className="block">
            <span className={labelClassName}>Task title</span>
            <input
              autoFocus
              required
              maxLength={500}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Weekly progress update"
              className={inputClassName}
            />
          </label>

          <label className="block">
            <span className={labelClassName}>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={20_000}
              placeholder="What does this task cover end-to-end?"
              className={`${inputClassName} resize-y`}
            />
          </label>

          <label className="block">
            <span className={labelClassName}>Priority</span>
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as TaskPriority | "")
              }
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

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClassName}>Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="block">
              <span className={labelClassName}>Estimate</span>
              <select
                value={estimate}
                onChange={(event) => setEstimate(event.target.value)}
                className={inputClassName}
              >
                {ESTIMATE_OPTIONS.map((option) => (
                  <option key={option.label} value={option.minutes}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className={labelClassName}>Tags</legend>
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
                    <TagIcon aria-hidden="true" className="size-3 shrink-0" />
                    {tag}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <p className={labelClassName}>
              Attachments <span className="normal-case">(optional)</span>
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragOver(false);
                addFiles(event.dataTransfer.files);
              }}
              className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
                isDragOver
                  ? "border-ink bg-paper"
                  : "border-border-strong bg-paper hover:border-ink"
              }`}
            >
              <Icon name="upload" className="size-5 text-text-muted" />
              <span className="text-small font-medium text-ink">
                Drop files here
              </span>
              <span className="text-label text-text-muted">
                or click to browse — up to {MAX_TASK_ATTACHMENTS} files, 25 MB each
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              aria-label="Attach files"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            {fileError ? (
              <p role="alert" className="mt-2 text-small text-brick">
                {fileError}
              </p>
            ) : null}
            {files.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-border bg-paper px-3 py-2 text-small"
                  >
                    <Icon name="document" className="size-4 shrink-0 text-text-muted" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="shrink-0 text-label text-text-muted">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      aria-label={`Remove ${file.name}`}
                      className="flex size-6 shrink-0 items-center justify-center rounded-md text-text-muted outline-none hover:bg-surface-raised hover:text-brick focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      <Icon name="close" className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-strong bg-paper px-4 py-2 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !title.trim()}
            className="rounded-lg bg-marigold px-4 py-2 text-small font-medium text-ink outline-none hover:bg-marigold-tint focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
          >
            {isPending ? "Creating…" : "Create task"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
