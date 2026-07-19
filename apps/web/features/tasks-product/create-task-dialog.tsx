"use client";

import { useRef, useState } from "react";
import { Calendar, CloudUpload, FileText, X } from "lucide-react";
import {
  TASK_PRIORITIES,
  type TaskPriority,
} from "@planevo/core/types/tasks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select";
import {
  MAX_TASK_ATTACHMENT_BYTES,
  MAX_TASK_ATTACHMENTS,
} from "@/lib/tasks/task-attachments";
import type { TaskBoardStatus } from "./task-board-ordering";

/**
 * Create-task modal matching the Lumis reference (founder override
 * 2026-07-19): narrow shell, taller controls, ink Create Task CTA,
 * title / description / priority / due / estimate / tags / attachments.
 * Presentational — parent owns submission so `/design` can mount a no-op.
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

export { ESTIMATE_OPTIONS };

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
  const operationKeyRef = useRef<string | null>(null);
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
    "h-11 w-full rounded-lg border border-border bg-paper px-3 text-body text-ink outline-none placeholder:text-text-muted focus:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink";
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
    operationKeyRef.current ??= crypto.randomUUID();
    formData.set("operationKey", operationKeyRef.current);
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
      onClose={() => {
        if (!isPending) onClose();
      }}
      labelledBy="create-task-title"
      className="m-4 max-h-dvh w-auto max-w-md overflow-hidden rounded-2xl border border-border bg-surface-raised p-0 text-ink shadow-lg backdrop:bg-ink/30 sm:m-auto sm:w-full"
    >
      <form onSubmit={handleSubmit} className="flex max-h-dvh flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="size-3.5 shrink-0 rounded-sm bg-ink"
            />
            <h2 id="create-task-title" className="truncate text-h3">
              Create New Task
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close create task"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
          <label className="block">
            <span className={labelClassName}>Task title</span>
            <input
              autoFocus
              required
              maxLength={500}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Weekly progress..."
              className={inputClassName}
            />
          </label>

          <label className="block">
            <span className={labelClassName}>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              maxLength={20_000}
              placeholder="What does this workflow do end-to-end?"
              className="min-h-28 w-full resize-y rounded-lg border border-border bg-paper px-3 py-2.5 text-body text-ink outline-none placeholder:text-text-muted focus:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
          </label>

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

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClassName}>Due date</span>
              <span className="relative block">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className={`${inputClassName} pr-10`}
                />
                <Calendar
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-muted"
                />
              </span>
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
                    className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-small outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
                      isSelected
                        ? "border-ink bg-paper text-ink"
                        : "border-border bg-paper text-text-secondary hover:border-border-strong hover:text-ink"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`size-2.5 shrink-0 rounded-sm ${
                        isSelected ? "bg-ink" : "bg-text-muted"
                      }`}
                    />
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
              className={`flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
                isDragOver
                  ? "border-ink bg-paper"
                  : "border-border-strong bg-paper hover:border-ink"
              }`}
            >
              <CloudUpload aria-hidden="true" className="size-6 text-text-muted" />
              <span className="text-small font-medium text-ink">
                Drop Your File Here
              </span>
              <span className="max-w-xs text-label text-text-muted">
                or click to browse — up to {MAX_TASK_ATTACHMENTS} files, 25 MB
                each
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
              <ul className="mt-3 flex flex-col gap-1.5">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-border bg-paper px-3 py-2 text-small"
                  >
                    <FileText
                      aria-hidden="true"
                      className="size-4 shrink-0 text-text-muted"
                    />
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
                      <X aria-hidden="true" className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-6 py-5">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="ink"
            disabled={isPending || !title.trim()}
          >
            {isPending ? "Creating…" : "Create Task"}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
