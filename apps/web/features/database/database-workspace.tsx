"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import type { DatabaseBundle } from "@planevo/core/queries/records";
import { toDisplayRecord } from "@planevo/core/queries/record-display";
import { findPropertyByRole, selectOptions } from "@planevo/core/types/property-roles";
import type { ViewRow } from "@planevo/core/types/database.types";
import {
  createRecordOnDate,
  duplicateDatabase,
  deleteDatabase,
  upsertRecordValue,
} from "@/app/(workspace)/databases/[databaseId]/actions";
import { DeleteEntityControl } from "@/components/ui/delete-entity-control";
import { DatabaseToolbar } from "./database-toolbar";
import { TableView } from "./table-view";
import { RecordBoard, RecordList } from "./record-board";
import { MonthGrid } from "./month-grid";
import { RecordPeek, useOpenRecordPeek } from "./record-peek";
import { RecordTrashPanel } from "./record-trash-panel";

export function DatabaseWorkspace({ bundle }: { bundle: DatabaseBundle }) {
  const views = bundle.views;
  const defaultView = views.find((view) => view.is_default) ?? views[0];
  const [activeViewId, setActiveViewId] = useState<string | null>(defaultView?.id ?? null);
  const activeView = views.find((view) => view.id === activeViewId) ?? defaultView;
  const openPeek = useOpenRecordPeek();

  const displayRecords = useMemo(
    () => bundle.records.map((record) => toDisplayRecord(record, bundle.properties)),
    [bundle],
  );
  const [filteredRecords, setFilteredRecords] = useState(displayRecords);
  const statusProperty = findPropertyByRole(bundle.properties, "status");
  const dueProperty = findPropertyByRole(bundle.properties, "due_date");
  const statusOptions = statusProperty ? selectOptions(statusProperty) : [];

  useEffect(() => {
    setFilteredRecords(displayRecords);
  }, [displayRecords]);

  function viewBody(view: ViewRow | undefined) {
    switch (view?.type) {
      case "board":
        return (
          <RecordBoard
            records={filteredRecords}
            statusOptions={statusOptions}
            databaseId={bundle.database.id}
            statusPropertyId={statusProperty?.id}
            onOpenRecord={openPeek}
          />
        );
      case "list":
        return (
          <RecordList
            records={filteredRecords}
            databaseId={bundle.database.id}
            onOpenRecord={openPeek}
          />
        );
      case "calendar":
        return (
          <MonthGrid
            items={filteredRecords
              .filter((record) => record.dueDate)
              .map((record) => ({
                id: record.id,
                recordId: record.id,
                databaseId: bundle.database.id,
                title: record.title,
                date: record.dueDate!,
              }))}
            onOpenRecord={openPeek}
            onCreateOnDay={
              dueProperty
                ? (dateIso) =>
                    void createRecordOnDate({
                      databaseId: bundle.database.id,
                      propertyId: dueProperty.id,
                      dateIso,
                    })
                : undefined
            }
            onRescheduleRecord={
              dueProperty
                ? (recordId, dateIso) =>
                    upsertRecordValue({
                      recordId,
                      propertyId: dueProperty.id,
                      rawValue: dateIso,
                    })
                : undefined
            }
          />
        );
      default: {
        const filteredIds = new Set(filteredRecords.map((record) => record.id));
        const tableRecords = bundle.records.filter((record) => filteredIds.has(record.id));
        return (
          <TableView
            bundle={bundle}
            records={tableRecords}
            onOpenRecord={openPeek}
          />
        );
      }
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
        <div className="flex flex-wrap items-center gap-2">
          <RecordTrashPanel databaseId={bundle.database.id} />
          <form action={duplicateDatabase.bind(null, bundle.database.id)}>
            <button
              type="submit"
              className="h-8 rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
              title="Duplicate this database's structure with no records"
            >
              Duplicate structure
            </button>
          </form>
          <DeleteEntityControl
            label="Delete database"
            title={`Delete “${bundle.database.name}”?`}
            description={`This permanently removes the database and its ${bundle.records.length} record${bundle.records.length === 1 ? "" : "s"}, including all properties and views. This can't be undone.`}
            confirmLabel="Delete database"
            onConfirm={() => deleteDatabase(bundle.database.id)}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <DatabaseToolbar
          records={displayRecords}
          statusOptions={statusOptions}
          onFilteredChange={setFilteredRecords}
        />
        {viewBody(activeView)}
      </div>
      <Suspense fallback={null}>
        <RecordPeek
          records={displayRecords}
          databaseId={bundle.database.id}
          pageId={bundle.database.page_id}
        />
      </Suspense>
    </div>
  );
}
