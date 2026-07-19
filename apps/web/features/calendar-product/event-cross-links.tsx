"use client";

import { useEffect, useState } from "react";
import { CalendarDays, LayoutGrid, Link2, Paperclip, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  attachFileToEventAction,
  linkEventToWorkspaceAction,
  linkTaskToEventAction,
  loadEventCrossLinkOptionsAction,
  type EventCrossLinkOptions,
} from "@/app/(workspace)/calendar/actions";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { formatTaskFileSize } from "@/lib/tasks/task-cross-link-contracts";

export type EventCrossLinkPanel = "files" | "task" | "workspace";

const PANEL_COPY: Record<EventCrossLinkPanel, { title: string; description: string }> = {
  files: {
    title: "Attach a file",
    description: "Choose from your file library.",
  },
  task: {
    title: "Link a task",
    description: "Connect this event to one of your open tasks.",
  },
  workspace: {
    title: "Add to workspace",
    description: "Link this event into one of your workspaces.",
  },
};

type EventCrossLinkDialogsProps = {
  eventId: string;
  panel: EventCrossLinkPanel;
  onClose: () => void;
};

function OptionRow({
  icon,
  title,
  meta,
  actionLabel,
  disabled,
  onChoose,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string | null;
  actionLabel: string;
  disabled: boolean;
  onChoose: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onChoose}
        className="flex w-full items-center gap-3 rounded-card border border-border bg-paper p-3 text-left outline-none hover:border-border-strong hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-muted">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-small font-medium text-ink">
            {title}
          </span>
          {meta ? (
            <span className="mt-0.5 block truncate text-label text-text-muted">
              {meta}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-small font-medium text-text-secondary">
          {actionLabel}
        </span>
      </button>
    </li>
  );
}

function EmptyOptions({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-dashed border-border bg-paper px-4 py-8 text-center">
      <p className="text-body font-medium text-ink">Nothing to link</p>
      <p className="mt-1 text-small text-text-muted">{message}</p>
    </div>
  );
}

export function EventCrossLinkDialogs({
  eventId,
  panel,
  onClose,
}: EventCrossLinkDialogsProps) {
  const router = useRouter();
  const [options, setOptions] = useState<EventCrossLinkOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadEventCrossLinkOptionsAction({ eventId })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setLoadError(result.error);
          return;
        }
        setOptions(result.data);
      })
      .catch((cause) => {
        if (cancelled) return;
        setLoadError(
          cause instanceof Error
            ? cause.message
            : "Could not load cross-feature options.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function choose(
    id: string,
    act: () => Promise<{ ok: true } | { ok: false; error: string }>,
    successMessage: string,
  ) {
    setPendingId(id);
    try {
      const result = await act();
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      toast(successMessage);
      onClose();
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  const copy = PANEL_COPY[panel];

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy="event-cross-link-title"
      className="m-auto w-full max-w-md rounded-card border border-border bg-surface-raised p-0 text-ink backdrop:bg-ink/30"
    >
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 id="event-cross-link-title" className="text-h3">
            {copy.title}
          </h2>
          <p className="mt-1 text-small text-text-secondary">{copy.description}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${copy.title.toLowerCase()}`}
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
        ) : options === null ? (
          <p role="status" className="py-8 text-center text-small text-text-muted">
            Loading…
          </p>
        ) : panel === "files" ? (
          options.files.length === 0 ? (
            <EmptyOptions message="Every visible file is already attached, or your file library is empty." />
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {options.files.map((file) => (
                <OptionRow
                  key={file.id}
                  icon={<Paperclip aria-hidden="true" className="size-4" />}
                  title={file.name}
                  meta={formatTaskFileSize(file.sizeBytes)}
                  actionLabel={pendingId === file.id ? "Attaching…" : "Attach"}
                  disabled={pendingId !== null}
                  onChoose={() =>
                    void choose(
                      file.id,
                      () =>
                        attachFileToEventAction({
                          eventId,
                          fileSourceId: file.id,
                        }),
                      `Attached ${file.name}`,
                    )
                  }
                />
              ))}
            </ul>
          )
        ) : panel === "task" ? (
          options.tasks.length === 0 ? (
            <EmptyOptions message="Create a task first — done tasks stay out of this list." />
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {options.tasks.map((task) => (
                <OptionRow
                  key={task.id}
                  icon={<Link2 aria-hidden="true" className="size-4" />}
                  title={task.title}
                  meta={null}
                  actionLabel={pendingId === task.id ? "Linking…" : "Link"}
                  disabled={pendingId !== null}
                  onChoose={() =>
                    void choose(
                      task.id,
                      () => linkTaskToEventAction({ eventId, taskId: task.id }),
                      `Linked ${task.title}`,
                    )
                  }
                />
              ))}
            </ul>
          )
        ) : options.workspaces.length === 0 ? (
          <EmptyOptions message="Create a workspace before linking this event." />
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {options.workspaces.map((workspace) => (
              <OptionRow
                key={workspace.id}
                icon={
                  workspace.isLinked ? (
                    <CalendarDays aria-hidden="true" className="size-4" />
                  ) : (
                    <LayoutGrid aria-hidden="true" className="size-4" />
                  )
                }
                title={workspace.name}
                meta={workspace.isCurrent ? "Current workspace" : "Workspace"}
                actionLabel={
                  workspace.isLinked
                    ? "Added"
                    : pendingId === workspace.id
                      ? "Adding…"
                      : "Add"
                }
                disabled={workspace.isLinked || pendingId !== null}
                onChoose={() =>
                  void choose(
                    workspace.id,
                    () =>
                      linkEventToWorkspaceAction({
                        eventId,
                        workspaceId: workspace.id,
                      }).then((result) =>
                        result.ok ? { ok: true as const } : result,
                      ),
                    `Added to ${workspace.name}`,
                  )
                }
              />
            ))}
          </ul>
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
