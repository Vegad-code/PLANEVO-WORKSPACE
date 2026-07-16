"use client";

import type { ReactNode } from "react";
import { deleteRecord } from "@/app/(workspace)/databases/[databaseId]/actions";
import { HoverDeleteAction } from "@/components/ui/hover-delete-action";
import { DeleteEntityControl } from "@/components/ui/delete-entity-control";

export function DeleteRecordControl({
  databaseId,
  recordId,
  recordTitle,
}: {
  databaseId: string;
  recordId: string;
  recordTitle: string;
}) {
  const label = recordTitle.trim() || "Untitled";

  return (
    <DeleteEntityControl
      label={`Delete ${label}`}
      title={`Delete “${label}”?`}
      description="This permanently removes the record and all of its property values. This can't be undone."
      confirmLabel="Delete record"
      onConfirm={() => deleteRecord({ databaseId, recordId })}
    />
  );
}

/** Hover-reveal delete for record rows and cards. */
export function RecordDeleteHover({
  databaseId,
  recordId,
  recordTitle,
  children,
  className = "",
}: {
  databaseId: string;
  recordId: string;
  recordTitle: string;
  children: ReactNode;
  className?: string;
}) {
  const label = recordTitle.trim() || "Untitled";

  return (
    <HoverDeleteAction
      className={className}
      label={`Delete ${label}`}
      title={`Delete “${label}”?`}
      description="This permanently removes the record and all of its property values. This can't be undone."
      confirmLabel="Delete record"
      onConfirm={() => deleteRecord({ databaseId, recordId })}
    >
      {children}
    </HoverDeleteAction>
  );
}
