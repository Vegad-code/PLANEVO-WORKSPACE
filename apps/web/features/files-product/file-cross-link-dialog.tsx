"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Link2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { attachFileToEventAction } from "@/app/(workspace)/calendar/actions";
import {
  loadFileLinkTargetsAction,
  type FileLinkTargets,
} from "@/app/(workspace)/files/actions";
import { attachFileToProductTaskAction } from "@/app/(workspace)/tasks/actions";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import type { ProductFileItem } from "./files-table";

export type FileCrossLinkTarget = "task" | "event";

type FileCrossLinkDialogProps = {
  file: ProductFileItem;
  target: FileCrossLinkTarget;
  onClose: () => void;
};

function formatEventStart(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function FileCrossLinkDialog({
  file,
  target,
  onClose,
}: FileCrossLinkDialogProps) {
  const router = useRouter();
  const [targets, setTargets] = useState<FileLinkTargets | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadFileLinkTargetsAction({ fileSourceId: file.id })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setLoadError(result.error);
          return;
        }
        setTargets(result.data);
      })
      .catch((cause) => {
        if (cancelled) return;
        setLoadError(
          cause instanceof Error ? cause.message : "Could not load link targets.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [file.id]);

  async function linkToTask(taskId: string, taskTitle: string) {
    setPendingId(taskId);
    try {
      const result = await attachFileToProductTaskAction({
        taskId,
        fileSourceId: file.id,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      toast(`Attached to ${taskTitle}`);
      onClose();
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function linkToEvent(eventId: string, eventTitle: string) {
    setPendingId(eventId);
    try {
      const result = await attachFileToEventAction({
        eventId,
        fileSourceId: file.id,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      toast(`Linked to ${eventTitle}`);
      onClose();
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  const title = target === "task" ? "Attach to task" : "Link to event";
  const description =
    target === "task"
      ? `Attach “${file.name}” to one of your open tasks.`
      : `Link “${file.name}” to one of your events.`;

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy="file-cross-link-title"
      className="m-auto w-full max-w-md rounded-card border border-border bg-surface-raised p-0 text-ink backdrop:bg-ink/30"
    >
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 id="file-cross-link-title" className="text-h3">
            {title}
          </h2>
          <p className="mt-1 truncate text-small text-text-secondary">
            {description}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title.toLowerCase()}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>

      <div className="px-5 py-5">
        {loadError ? (
          <p
            role="alert"
            className="rounded-lg border border-brick bg-brick-tint px-3 py-2 text-small text-ink"
          >
            {loadError}
          </p>
        ) : targets === null ? (
          <p role="status" className="py-8 text-center text-small text-text-muted">
            Loading…
          </p>
        ) : (
          (() => {
            const rows =
              target === "task"
                ? targets.tasks.map((task) => ({
                    id: task.id,
                    title: task.title,
                    meta: null as string | null,
                    onChoose: () => void linkToTask(task.id, task.title),
                  }))
                : targets.events.map((event) => ({
                    id: event.id,
                    title: event.title,
                    meta: formatEventStart(event.startsAt),
                    onChoose: () => void linkToEvent(event.id, event.title),
                  }));
            if (rows.length === 0) {
              return (
                <div className="rounded-card border border-dashed border-border bg-paper px-4 py-8 text-center">
                  <p className="text-body font-medium text-ink">Nothing to link</p>
                  <p className="mt-1 text-small text-text-muted">
                    {target === "task"
                      ? "Create a task first — done tasks stay out of this list."
                      : "Create an event on your calendar first."}
                  </p>
                </div>
              );
            }
            return (
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      disabled={pendingId !== null}
                      onClick={row.onChoose}
                      className="flex w-full items-center gap-3 rounded-card border border-border bg-paper p-3 text-left outline-none hover:border-border-strong hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-muted">
                        {target === "task" ? (
                          <Link2 aria-hidden="true" className="size-4" />
                        ) : (
                          <CalendarDays aria-hidden="true" className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-small font-medium text-ink">
                          {row.title}
                        </span>
                        {row.meta ? (
                          <span className="mt-0.5 block text-label text-text-muted">
                            {row.meta}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-small font-medium text-text-secondary">
                        {pendingId === row.id
                          ? "Linking…"
                          : target === "task"
                            ? "Attach"
                            : "Link"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            );
          })()
        )}
      </div>

      <footer className="flex justify-end border-t border-border px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border-strong bg-paper px-4 py-2 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Cancel
        </button>
      </footer>
    </Dialog>
  );
}
