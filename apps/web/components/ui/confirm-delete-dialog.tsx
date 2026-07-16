"use client";

import { useId, useState, useTransition } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { Dialog } from "@/components/ui/dialog";
import type { DeleteResult } from "@/lib/mutations/delete-entities";

export function ConfirmDeleteDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Delete",
  confirmationPhrase,
  onConfirm,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  /** When set, the user must type this exact string to enable confirm. */
  confirmationPhrase?: string;
  onConfirm: (typedConfirmation?: string) => Promise<DeleteResult | void>;
  onSuccess?: () => void;
}) {
  const titleId = useId();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canConfirm = !confirmationPhrase || typed === confirmationPhrase;

  function resetFields() {
    setTyped("");
    setError(null);
  }

  function handleClose() {
    if (isPending) return;
    resetFields();
    onClose();
  }

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await onConfirm(confirmationPhrase ? typed : undefined);
        if (result && !result.ok) {
          setError(result.error);
          return;
        }
        resetFields();
        onClose();
        onSuccess?.();
      } catch (cause) {
        if (isRedirectError(cause)) throw cause;
        setError(cause instanceof Error ? cause.message : "Couldn't delete.");
      }
    });
  }

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      labelledBy={titleId}
      className="m-auto w-full max-w-md rounded-card border border-border bg-paper p-0 text-ink backdrop:bg-ink/30"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-h3">
          {title}
        </h2>
        <p className="mt-2 text-body text-text-secondary">{description}</p>
        {confirmationPhrase && (
          <label className="mt-4 block">
            <span className="text-small font-medium">
              Type <span className="font-mono">{confirmationPhrase}</span> to confirm
            </span>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="mt-2 h-10 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-body outline-none focus:border-ink"
            />
          </label>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-brick-tint px-3 py-2 text-small text-ink">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleClose}
            className="h-9 rounded-lg border border-border-strong px-4 text-small font-medium outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending || !canConfirm}
            onClick={handleConfirm}
            className="h-9 rounded-lg bg-brick px-4 text-small font-medium text-paper outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
          >
            {isPending ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
