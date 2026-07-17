"use client";

import { useEffect, useState } from "react";
import type { DisplayRecord } from "@planevo/core/queries/record-display";
import { RecordList } from "@/features/database/record-board";

export const FLATTEN_DATABASE_VIEW_EVENT = "planevo:flatten-database-view";

export type FlattenDatabaseViewDetail = {
  databaseId: string;
  recordIds: string;
};

type EmbeddedDatabaseViewProps = {
  databaseId: string;
  recordIds: string;
};

/**
 * Inline database view block (F-10). Shows a compact linked list for promoted records.
 */
export function EmbeddedDatabaseView({ databaseId, recordIds }: EmbeddedDatabaseViewProps) {
  const [records, setRecords] = useState<DisplayRecord[]>([]);
  const [databaseName, setDatabaseName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams({ databaseId, recordIds });
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
  }, [databaseId, recordIds]);

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
        <div className="mt-3">
          <RecordList records={records} databaseId={databaseId} />
        </div>
      )}
    </div>
  );
}
