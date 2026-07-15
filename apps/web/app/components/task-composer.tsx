"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { submitTask, type TaskFormState } from "@/app/(workspace)/tasks/actions";
import { Icon } from "./planevo-icon";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center justify-center rounded-lg bg-ink px-4 text-small font-medium text-paper outline-none transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50 motion-reduce:transition-none"
    >
      {pending ? "Creating…" : "Create task"}
    </button>
  );
}

export function TaskComposer({
  workspaceId,
  buttonLabel = "New task",
  appearance = "primary",
}: {
  workspaceId: string | null;
  buttonLabel?: string;
  appearance?: "primary" | "quiet";
}) {
  const [open, setOpen] = useState(false);
  const initialState: TaskFormState = { status: "idle", message: null };
  const [state, formAction] = useActionState(submitTask, initialState);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (state.status !== "success") return;
    // Closing the dialog fires its onClose handler, which owns the setState.
    dialogRef.current?.close();
    router.refresh();
  }, [router, state.status]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-lg px-3 text-small font-medium outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${appearance === "primary" ? "h-9 bg-marigold px-4 text-ink hover:opacity-90" : "h-8 border border-border-strong bg-paper text-ink hover:border-ink"}`}
      >
        <Icon name="tasks" />
        {buttonLabel}
      </button>

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
        aria-labelledby="task-composer-title"
        className="m-auto h-dvh max-h-dvh w-screen max-w-none overflow-hidden rounded-none border border-border bg-paper p-0 text-ink backdrop:bg-ink/30 sm:h-auto sm:w-full sm:max-w-2xl sm:rounded-card"
      >
        <form action={formAction} className="flex max-h-[inherit] flex-col">
          <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
            <div className="flex items-center gap-2">
              <Icon name="tasks" className="size-5 text-text-secondary" />
              <h2 id="task-composer-title" className="text-h3">Create task</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close task composer"
              className="flex size-8 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <label className="block">
              <span className="text-label uppercase text-text-muted">Task title</span>
              <input
                autoFocus
                required
                name="title"
                placeholder="e.g. Finish the weekly progress update"
                className="mt-2 h-10 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-body outline-none placeholder:text-text-muted focus:border-ink"
              />
            </label>

            <label className="block">
              <span className="text-label uppercase text-text-muted">Description</span>
              <textarea
                name="description"
                rows={4}
                placeholder="What needs to happen?"
                className="mt-2 w-full resize-none rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-body outline-none placeholder:text-text-muted focus:border-ink"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-label uppercase text-text-muted">Status</span>
                <select name="status" defaultValue="To do" className="mt-2 h-10 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-body outline-none focus:border-ink">
                  <option>To do</option>
                  <option>In progress</option>
                  <option>In review</option>
                  <option>Done</option>
                </select>
              </label>
              <label>
                <span className="text-label uppercase text-text-muted">Priority</span>
                <select name="priority" defaultValue="" className="mt-2 h-10 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-body outline-none focus:border-ink">
                  <option value="">No priority</option>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>
              <label>
                <span className="text-label uppercase text-text-muted">Due date</span>
                <input type="datetime-local" name="dueDate" className="mt-2 h-10 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-body outline-none focus:border-ink" />
              </label>
              <label>
                <span className="text-label uppercase text-text-muted">Estimate</span>
                <div className="relative mt-2">
                  <input type="number" min="0" step="5" name="estimateMinutes" placeholder="None" className="h-10 w-full rounded-lg border border-border-strong bg-surface-raised px-3 pr-16 text-body outline-none placeholder:text-text-muted focus:border-ink" />
                  <span className="absolute inset-y-0 right-3 flex items-center text-small text-text-muted">minutes</span>
                </div>
              </label>
            </div>

            <label className="block">
              <span className="text-label uppercase text-text-muted">Tags</span>
              <input name="tags" placeholder="school, launch, research" className="mt-2 h-10 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-body outline-none placeholder:text-text-muted focus:border-ink" />
              <span className="mt-1 block text-small text-text-muted">Separate tags with commas.</span>
            </label>

            <div>
              <span className="text-label uppercase text-text-muted">Attachments</span>
              <div className="mt-2 flex min-h-20 items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-raised px-4 text-center text-small text-text-muted">
                Attachments can be added from Files after this task is created.
              </div>
            </div>

            {state.status === "error" && (
              <p role="alert" className="rounded-lg bg-brick-tint px-3 py-2 text-small text-ink">
                {state.message}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-5 py-4">
            <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-border-strong px-4 text-small font-medium outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink">
              Cancel
            </button>
            <SubmitButton />
          </div>
        </form>
      </dialog>
    </>
  );
}
