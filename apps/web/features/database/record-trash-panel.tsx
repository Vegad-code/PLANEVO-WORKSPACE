"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listTrashedRecords,
  restoreRecord,
} from "@/app/(workspace)/databases/[databaseId]/actions";

export function RecordTrashPanel({ databaseId }: { databaseId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ id: string; deletedAt: string }[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const rows = await listTrashedRecords(databaseId);
      setItems(rows);
    });
  }, [databaseId, open]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="h-8 rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Trash{items.length > 0 ? ` (${items.length})` : ""}
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-border bg-surface-raised p-4">
          {pending && <p className="text-small text-text-muted">Loading trash…</p>}
          {!pending && items.length === 0 && (
            <p className="text-small text-text-muted">No trashed records in the last 30 days.</p>
          )}
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-small">
                <span className="text-text-secondary">{item.id.slice(0, 8)}…</span>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await restoreRecord(item.id);
                      const rows = await listTrashedRecords(databaseId);
                      setItems(rows);
                    })
                  }
                  className="rounded-md px-2 py-1 text-small text-ink hover:bg-paper"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
