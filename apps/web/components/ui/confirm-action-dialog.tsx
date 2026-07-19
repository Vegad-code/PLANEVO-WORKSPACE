"use client";

import { useId, useState, useTransition } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { Dialog } from "@/components/ui/dialog";

export type ActionResult = { ok: true } | { ok: false; error: string };

export function ConfirmActionDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<ActionResult | void>;
  onSuccess?: () => void;
}) {
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetFields() {
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
        const result = await onConfirm();
        if (result && !result.ok) {
          setError(result.error);
          return;
        }
        resetFields();
        onClose();
        onSuccess?.();
      } catch (cause) {
        if (isRedirectError(cause)) throw cause;
        setError(cause instanceof Error ? cause.message : "Something went wrong.");
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
            disabled={isPending}
            onClick={handleConfirm}
            className={`h-9 rounded-lg px-4 text-small font-medium outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50 ${
              destructive
                ? "bg-brick text-paper hover:opacity-90"
                : "bg-ink text-paper hover:opacity-90"
            }`}
          >
            {isPending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
