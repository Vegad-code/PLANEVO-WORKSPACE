"use client";

import { useMemo, useState } from "react";
import type { DatabaseBundle } from "@planevo/core/queries/records";
import { toDisplayRecord } from "@planevo/core/queries/record-display";
import { findPropertyByRole, selectOptions } from "@planevo/core/types/property-roles";
import type { ViewRow } from "@planevo/core/types/database.types";
import { duplicateDatabase } from "@/app/(workspace)/databases/[databaseId]/actions";
import { TableView } from "./table-view";
import { RecordBoard, RecordList } from "./record-board";
import { MonthGrid } from "./month-grid";

export function DatabaseWorkspace({ bundle }: { bundle: DatabaseBundle }) {
  const views = bundle.views;
  const defaultView = views.find((view) => view.is_default) ?? views[0];
  const [activeViewId, setActiveViewId] = useState<string | null>(defaultView?.id ?? null);
  const activeView = views.find((view) => view.id === activeViewId) ?? defaultView;

  const displayRecords = useMemo(
    () => bundle.records.map((record) => toDisplayRecord(record, bundle.properties)),
    [bundle],
  );
  const statusProperty = findPropertyByRole(bundle.properties, "status");
  const statusOptions = statusProperty ? selectOptions(statusProperty) : [];

  function viewBody(view: ViewRow | undefined) {
    // ponytail: board groups by the status role and calendar uses the record's
    // date role — per-view config_json property picks return when a view
    // editor exists; born-with-views always aligns config with roles today.
    switch (view?.type) {
      case "board":
        return <RecordBoard records={displayRecords} statusOptions={statusOptions} />;
      case "list":
        return <RecordList records={displayRecords} />;
      case "calendar":
        return (
          <MonthGrid
            items={displayRecords
              .filter((record) => record.dueDate)
              .map((record) => ({
                id: record.id,
                title: record.title,
                date: record.dueDate!,
              }))}
          />
        );
      default:
        return <TableView bundle={bundle} />;
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div role="tablist" aria-label="Database views" className="flex flex-wrap gap-1">
          {views.map((view) => {
            const active = view.id === activeView?.id;
            return (
              <button
                key={view.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveViewId(view.id)}
                className={`h-8 rounded-lg px-3 text-small font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
                  active
                    ? "bg-ink text-paper"
                    : "text-text-secondary hover:bg-surface-raised hover:text-ink"
                }`}
              >
                {view.name}
              </button>
            );
          })}
          {views.length === 0 && <span className="text-small text-text-muted">Table</span>}
        </div>
        <form action={duplicateDatabase.bind(null, bundle.database.id)}>
          <button
            type="submit"
            className="h-8 rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            title="Duplicate this database's structure with no records"
          >
            Duplicate structure
          </button>
        </form>
      </div>
      <div className="mt-4">{viewBody(activeView)}</div>
    </div>
  );
}
