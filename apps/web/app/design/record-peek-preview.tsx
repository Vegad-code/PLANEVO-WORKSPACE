"use client";

import type { DisplayRecord } from "@planevo/core/queries/record-display";
import { Icon } from "@/components/ui/planevo-icon";

/** Static /design preview of center + side record peeks (no router). */
export function RecordPeekPreview({
  record,
  mode,
}: {
  record: DisplayRecord;
  mode: "center" | "side";
}) {
  const panel = (
    <div
      data-peek-mode={mode}
      className={
        mode === "center"
          ? "flex max-h-96 w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-surface-raised"
          : "flex h-full w-72 flex-col overflow-hidden border-l border-border bg-surface-raised"
      }
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-label uppercase text-text-muted">{mode} peek</span>
        <div className="flex-1" />
        <Icon name="close" className="size-4 text-text-muted" />
      </header>
      <div className="overflow-y-auto px-4 py-4">
        <h3 className="text-h3 text-ink">{record.title}</h3>
        {record.description && (
          <p className="mt-2 text-small text-text-secondary">{record.description}</p>
        )}
        <p className="mt-4 text-label text-text-muted">
          {record.status ?? "No status"} · {record.priority ?? "No priority"}
        </p>
      </div>
    </div>
  );

  if (mode === "side") {
    return (
      <div className="relative h-96 overflow-hidden rounded-xl border border-border bg-paper">
        <p className="absolute left-4 top-4 text-small text-text-muted">Database stays visible</p>
        <div className="absolute inset-y-0 right-0">{panel}</div>
      </div>
    );
  }

  return (
    <div className="relative flex h-96 items-center justify-center overflow-hidden rounded-xl border border-border bg-ink/20 p-6">
      {panel}
    </div>
  );
}
