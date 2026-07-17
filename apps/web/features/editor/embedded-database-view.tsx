"use client";

import { useEffect, useState } from "react";
import type { DisplayRecord } from "@planevo/core/queries/record-display";

export const FLATTEN_DATABASE_VIEW_EVENT = "planevo:flatten-database-view";

export type FlattenDatabaseViewDetail = {
  databaseId: string;
  recordIds: string;
};

type EmbeddedDatabaseViewProps = {
  databaseId: string;
  viewId?: string;
  recordIds: string;
};

/**
 * Inline database view block (F-10). Compact linked list for promoted records —
 * kept self-contained so editor stays decoupled from full database list props.
 */
export function EmbeddedDatabaseView({
  databaseId,
  viewId = "",
  recordIds,
}: EmbeddedDatabaseViewProps) {
  const [records, setRecords] = useState<DisplayRecord[]>([]);
  const [databaseName, setDatabaseName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams({ databaseId, recordIds });
        if (viewId) params.set("viewId", viewId);
        const response = await fetch(`/api/embedded-database?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to load embedded view.");
        const payload = (await response.json()) as {
          databaseName: string;
          records: DisplayRecord[];
        };
        if (cancelled) return;
        setDatabaseName(payload.databaseName);
        setRecords(payload.records);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Failed to load embedded view.");
      }
    }

    if (databaseId && recordIds) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [databaseId, viewId, recordIds]);

  if (!databaseId) {
    return (
      <div className="my-2 rounded-xl border border-dashed border-border bg-surface-raised p-4">
        <p className="text-small text-text-muted">Choose a database to embed.</p>
      </div>
    );
  }

  return (
    <div
      className="my-2 rounded-xl border border-border bg-surface-raised p-4"
      data-database-view={databaseId}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-label uppercase text-text-muted">
          {databaseName ?? "Linked database"}
        </p>
        <div className="flex items-center gap-3">
          {recordIds && (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent<FlattenDatabaseViewDetail>(FLATTEN_DATABASE_VIEW_EVENT, {
                    detail: { databaseId, recordIds },
                  }),
                );
              }}
              className="text-small text-text-secondary hover:text-ink"
            >
              Turn back into text
            </button>
          )}
          <a
            href={`/databases/${databaseId}`}
            className="text-small text-text-secondary hover:text-ink"
          >
            Open database
          </a>
        </div>
      </div>
      {error ? (
        <p className="mt-3 text-small text-brick" role="alert">
          {error}
        </p>
      ) : records.length === 0 ? (
        <p className="mt-3 text-small text-text-muted">No linked records yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {records.map((record) => (
            <li key={record.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-body font-medium">
                {record.title || "Untitled"}
              </span>
              {record.status && (
                <span className="text-small text-text-secondary">{record.status}</span>
              )}
              {record.dueDate && (
                <span className="text-small text-text-muted">
                  {record.dueDate.slice(0, 10)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
