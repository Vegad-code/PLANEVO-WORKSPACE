"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Icon, type IconName } from "@/components/ui/planevo-icon";
import type { DeleteResult } from "@/lib/mutations/delete-entities";

export function DeleteEntityControl({
  title,
  description,
  confirmLabel = "Delete",
  confirmationPhrase,
  onConfirm,
  label = "Delete",
  compact = false,
  icon,
  className = "",
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  confirmationPhrase?: string;
  onConfirm: (typedConfirmation?: string) => Promise<DeleteResult | void>;
  label?: string;
  compact?: boolean;
  icon?: IconName;
  className?: string;
}) {
  const resolvedIcon = icon ?? "warning";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDialogKey((key) => key + 1);
          setOpen(true);
        }}
        aria-label={label}
        title={label}
        className={
          compact
            ? `flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-brick-tint hover:text-brick focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${className}`
            : `inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border border-border-strong bg-paper px-3 text-small font-medium text-text-secondary outline-none hover:border-brick hover:bg-brick-tint hover:text-brick focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${className}`
        }
      >
        <Icon name={resolvedIcon} className="size-4" />
        {!compact && label}
      </button>
      <ConfirmDeleteDialog
        key={dialogKey}
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        confirmationPhrase={confirmationPhrase}
        onConfirm={(typedConfirmation) => onConfirm(typedConfirmation)}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
