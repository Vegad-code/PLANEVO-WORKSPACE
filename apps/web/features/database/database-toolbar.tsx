"use client";

import { useEffect, useMemo, useState } from "react";
import type { DisplayRecord } from "@planevo/core/queries/record-display";
import { NO_GROUP_LABEL } from "@planevo/core/state/board-state";
import { Icon } from "@/components/ui/planevo-icon";

const NO_STATUS_FILTER = "__no_group__";

function filterRecords(
  records: DisplayRecord[],
  query: string,
  statusFilter: string | null,
): DisplayRecord[] {
  const normalizedQuery = query.trim().toLowerCase();

  return records.filter((record) => {
    if (statusFilter !== null) {
      const recordStatus = record.status?.trim() || null;
      if (statusFilter === NO_STATUS_FILTER) {
        if (recordStatus !== null) return false;
      } else if (recordStatus !== statusFilter) {
        return false;
      }
    }

    if (!normalizedQuery) return true;

    const haystack = [
      record.title,
      record.description,
      record.status,
      record.priority,
      ...record.tags,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function DatabaseToolbar({
  records,
  statusOptions = [],
  onFilteredChange,
}: {
  records: DisplayRecord[];
  statusOptions?: string[];
  onFilteredChange: (filtered: DisplayRecord[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const hasNoStatusRecords = useMemo(
    () => records.some((record) => !record.status?.trim()),
    [records],
  );

  const filtered = useMemo(
    () => filterRecords(records, query, statusFilter),
    [records, query, statusFilter],
  );

  useEffect(() => {
    onFilteredChange(filtered);
  }, [filtered, onFilteredChange]);

  const showStatusChips = statusOptions.length > 0 || hasNoStatusRecords;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex min-h-10 items-center gap-3 rounded-card border border-border-strong bg-surface-raised px-4">
        <Icon name="search" className="size-4 shrink-0 text-text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search records"
          className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-muted"
        />
      </label>

      {showStatusChips && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          <button
            type="button"
            aria-pressed={statusFilter === null}
            onClick={() => setStatusFilter(null)}
            className={`h-8 rounded-full border px-4 text-small font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
              statusFilter === null
                ? "border-ink bg-surface-raised text-ink"
                : "border-border bg-paper text-text-secondary hover:border-border-strong hover:text-ink"
            }`}
          >
            All
          </button>
          {statusOptions.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={statusFilter === option}
              onClick={() => setStatusFilter(option)}
              className={`h-8 rounded-full border px-4 text-small font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
                statusFilter === option
                  ? "border-ink bg-surface-raised text-ink"
                  : "border-border bg-paper text-text-secondary hover:border-border-strong hover:text-ink"
              }`}
            >
              {option}
            </button>
          ))}
          {hasNoStatusRecords && (
            <button
              type="button"
              aria-pressed={statusFilter === NO_STATUS_FILTER}
              onClick={() => setStatusFilter(NO_STATUS_FILTER)}
              className={`h-8 rounded-full border px-4 text-small font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
                statusFilter === NO_STATUS_FILTER
                  ? "border-ink bg-surface-raised text-ink"
                  : "border-border bg-paper text-text-secondary hover:border-border-strong hover:text-ink"
              }`}
            >
              {NO_GROUP_LABEL}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
