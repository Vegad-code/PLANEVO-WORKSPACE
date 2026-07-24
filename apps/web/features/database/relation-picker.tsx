"use client";

import { useEffect, useState } from "react";
import { upsertRecordValue } from "@/app/(workspace)/databases/[databaseId]/actions";
import { Badge } from "@/components/ui/badge";

type RelationTarget = {
  id: string;
  title: string;
};

/**
 * F-07 relation cell editor — search targets by primary title, pick or create inline.
 */
export function RelationPicker({
  recordId,
  propertyId,
  targetDatabaseId,
  displayValue,
  allowCreate = true,
}: {
  recordId: string;
  propertyId: string;
  targetDatabaseId: string;
  displayValue: string;
  allowCreate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [targets, setTargets] = useState<RelationTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState(displayValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLabel(displayValue);
  }, [displayValue]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          databaseId: targetDatabaseId,
          q: query,
        });
        const response = await fetch(`/api/relation-targets?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to load records.");
        const payload = (await response.json()) as { targets: RelationTarget[] };
        if (!cancelled) setTargets(payload.targets);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load records.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, query, targetDatabaseId]);

  async function linkTarget(target: RelationTarget) {
    const result = await upsertRecordValue({
      recordId,
      propertyId,
      rawValue: target.id,
    });
    if (!result.ok) {
      setError(result.error ?? "Failed to link record.");
      return;
    }
    setLabel(target.title);
    setOpen(false);
    setError(null);
  }

  async function createAndLink() {
    const title = query.trim();
    if (!title) return;

    const response = await fetch("/api/relation-targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ databaseId: targetDatabaseId, title }),
    });
    if (!response.ok) {
      setError("Failed to create record.");
      return;
    }
    const payload = (await response.json()) as { id: string; title: string };
    await linkTarget({ id: payload.id, title: payload.title });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-8 w-full items-center rounded-md border border-transparent px-2 text-left text-small outline-none hover:border-border focus:border-ink"
      >
        {label ? (
          <Badge variant="outline">{label}</Badge>
        ) : (
          <span className="text-text-muted">Link record…</span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-lg border border-border bg-paper p-2 shadow-sm">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search records"
            className="h-8 w-full rounded-md border border-border-strong px-2 text-small outline-none focus:border-ink"
          />
          <div className="mt-2 max-h-48 overflow-y-auto">
            {loading && <p className="px-2 py-1 text-small text-text-muted">Loading…</p>}
            {!loading &&
              targets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => void linkTarget(target)}
                  className="flex w-full rounded-md px-2 py-1.5 text-left text-small hover:bg-surface-raised"
                >
                  {target.title}
                </button>
              ))}
            {!loading && targets.length === 0 && query.trim() && allowCreate && (
              <button
                type="button"
                onClick={() => void createAndLink()}
                className="flex w-full rounded-md px-2 py-1.5 text-left text-small text-ink hover:bg-surface-raised"
              >
                + Create &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
          {error && (
            <p className="mt-1 px-1 text-label text-brick" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
