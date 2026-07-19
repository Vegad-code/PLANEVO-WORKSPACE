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
import {
  CornerBracketFrame,
  LumisDotGridBand,
} from "./create-task-modal-chrome";

/**
 * Create-task modal matching the Lumis reference (founder override
 * 2026-07-19): narrow content-sized shell, tight vertical rhythm, ink
 * Create Task CTA, title / description / priority / due / estimate /
 * tags / attachments. Presentational — parent owns submission so
 * `/design` can mount a no-op.
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
  const labelClassName = "mb-1 block text-label uppercase text-text-muted";
  const selectClassName = "h-11";

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
      className="m-4 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface-raised p-0 text-ink shadow-lg backdrop:bg-ink/30 sm:m-auto"
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3.5 shrink-0 rounded-sm bg-ink"
            />
            <h2
              id="create-task-title"
              className="truncate text-h3 font-medium text-ink"
            >
              Create New Task
            </h2>
          </div>
          <CornerBracketFrame
            bracketSize="size-1.5"
            className="flex size-9 shrink-0 items-center justify-center"
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              aria-label="Close create task"
              className="flex size-full items-center justify-center text-text-muted outline-none transition-colors hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              <X aria-hidden="true" className="size-3 stroke-[1.75]" />
            </button>
          </CornerBracketFrame>
        </header>

        <CornerBracketFrame
          bracketSize="size-3.5"
          bracketClassName="border-border-strong"
          className="mb-4 px-6"
        >
          <div className="scrollbar-silent flex max-h-[calc(100dvh-11rem)] flex-col gap-5 overflow-y-auto py-4">
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
              className="w-full resize-none rounded-lg border border-border bg-paper px-3 py-2 text-body text-ink outline-none placeholder:text-text-muted focus:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
          </label>

          <SelectField
            label="Priority"
            labelClassName={labelClassName}
            selectClassName={selectClassName}
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
              labelClassName={labelClassName}
              selectClassName={selectClassName}
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
            <div className="flex flex-wrap gap-1.5">
              {TASK_TAGS.map((tag) => {
                const isSelected = tags.includes(tag);

                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleTag(tag)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-label outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
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

          <div className="relative">
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
              className={`relative flex min-h-32 w-full flex-col overflow-hidden rounded-xl border border-dashed text-center outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
                isDragOver
                  ? "border-ink bg-paper"
                  : "border-border-strong bg-paper hover:border-ink"
              }`}
            >
              <span className="relative z-10 flex flex-col items-center justify-center gap-1 px-3 py-8">
                <CloudUpload
                  aria-hidden="true"
                  className="size-6 text-text-muted"
                />
                <span className="text-small font-medium text-ink">
                  Drop Your File Here
                </span>
                <span className="max-w-xs text-label leading-snug text-text-muted">
                  or click to browse — up to {MAX_TASK_ATTACHMENTS} files, 25 MB
                  each
                </span>
              </span>
              <LumisDotGridBand className="absolute inset-x-0 bottom-0 h-16 rounded-b-xl" />
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
              <div className="mt-3 overflow-hidden rounded-xl border border-border bg-paper">
                <ul className="flex flex-col divide-y divide-border">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 px-3 py-2 text-small"
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
                <LumisDotGridBand className="h-10" />
              </div>
            ) : null}
          </div>
          </div>
        </CornerBracketFrame>

        <footer className="shrink-0 border-t border-border bg-surface-raised">
          <div className="flex items-end justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-11 min-w-[6.75rem] rounded-none rounded-br-none rounded-tl-none rounded-tr-xl rounded-bl-2xl border-0 border-t border-r border-border-strong bg-paper px-5 text-body font-semibold text-ink shadow-none hover:bg-surface-raised"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="ink"
              disabled={isPending || !title.trim()}
              className="h-11 min-w-[8.25rem] rounded-none rounded-bl-none rounded-br-2xl rounded-tl-xl border-0 px-5 text-body font-semibold text-paper shadow-none hover:opacity-100 disabled:bg-text-secondary disabled:text-paper disabled:opacity-100"
            >
              {isPending ? "Creating…" : "Create Task"}
            </Button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
