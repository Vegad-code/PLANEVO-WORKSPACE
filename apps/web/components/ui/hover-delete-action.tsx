"use client";

import type { ReactNode } from "react";
import { DeleteEntityControl } from "@/components/ui/delete-entity-control";
import type { DeleteResult } from "@/lib/mutations/delete-entities";

type HoverDeleteActionProps = {
  children: ReactNode;
  className?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmationPhrase?: string;
  /** Used for aria-label / tooltip — not shown on compact hover buttons. */
  label?: string;
  /** Compact icon button fits rows and sidebar items without covering labels. */
  compact?: boolean;
  onConfirm: (typedConfirmation?: string) => Promise<DeleteResult | void>;
};

export function HoverDeleteAction({
  children,
  className = "",
  title,
  description,
  confirmLabel,
  confirmationPhrase,
  label = "Delete",
  compact = true,
  onConfirm,
}: HoverDeleteActionProps) {
  return (
    <div className={`group flex min-w-0 items-center gap-1 ${className}`}>
      <div className="min-w-0 flex-1">{children}</div>
      <div className="shrink-0 opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100">
        <DeleteEntityControl
          compact={compact}
          label={label}
          title={title}
          description={description}
          confirmLabel={confirmLabel}
          confirmationPhrase={confirmationPhrase}
          onConfirm={onConfirm}
        />
      </div>
    </div>
  );
}
