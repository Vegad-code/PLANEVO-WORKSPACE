"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DatabaseBundle, RecordItem } from "@planevo/core/queries/records";
import { toDisplayRecord } from "@planevo/core/queries/record-display";
import type { DatabasePropertyRow } from "@planevo/core/types/database.types";
import { propertyValueToString } from "@planevo/core/validation/property-values";
import { applyView } from "@planevo/core/views/filter-engine";
import {
  normalizeViewConfig,
  updateViewConfig,
  type ViewConfig,
} from "@planevo/core/views/view-config";
import { createRecordOnDate, upsertRecordValue } from "@/app/(workspace)/databases/[databaseId]/actions";
import { saveViewConfig } from "@/app/(workspace)/databases/[databaseId]/view-actions";
import { DatabaseHeader } from "./database-header";
import { BulkActionBar } from "./bulk-action-bar";
import { MonthGrid } from "./month-grid";
import { RecordBoard } from "./record-board";
import { RecordList } from "./record-list";
import { RecordPeek, useOpenRecordPeek } from "./record-peek";
import { TableView } from "./table-view";
import { ViewConfigBar } from "./view-config-bar";
import { ViewTabs } from "./view-tabs";
import { useRowSelection } from "./use-row-selection";

function filterRecordsBySearch(
  records: RecordItem[],
  query: string,
  properties: DatabasePropertyRow[],
): RecordItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return records;

  return records.filter((record) => {
    const haystack = properties
      .map((property) => propertyValueToString(record.values[property.id]))
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

function resolvedVisibleProperties(
  config: ViewConfig,
  properties: DatabasePropertyRow[],
): string[] {
  if (config.visible_properties?.length) return config.visible_properties;
  return properties.map((property) => property.id);
}

export function DatabaseWorkspace({
  bundle,
  embedded = false,
}: {
  bundle: DatabaseBundle;
  embedded?: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const views = bundle.views;
  const defaultView = views.find((view) => view.is_default) ?? views[0];
  const queryViewId = searchParams.get("v");
  const activeView =
    views.find((view) => view.id === queryViewId) ??
    views.find((view) => view.id === defaultView?.id) ??
    defaultView;
  const openPeek = useOpenRecordPeek();

  const [viewConfig, setViewConfig] = useState<ViewConfig>(() =>
    normalizeViewConfig(activeView?.config_json),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const savedConfigRef = useRef<ViewConfig>(normalizeViewConfig(activeView?.config_json));

  useEffect(() => {
    const normalized = normalizeViewConfig(activeView?.config_json);
    setViewConfig(normalized);
    savedConfigRef.current = normalized;
    setSearchQuery("");
  }, [activeView?.id, activeView?.config_json]);

  useEffect(() => {
    if (!activeView) return;
    if (JSON.stringify(viewConfig) === JSON.stringify(savedConfigRef.current)) return;

    const timer = window.setTimeout(() => {
      void saveViewConfig({
        databaseId: bundle.database.id,
        viewId: activeView.id,
        config: viewConfig,
      }).then((result) => {
        if (result.ok) savedConfigRef.current = viewConfig;
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [viewConfig, activeView, bundle.database.id]);

  const viewRecords = useMemo(
    () => applyView(bundle.records, viewConfig, bundle.properties),
    [bundle.records, bundle.properties, viewConfig],
  );

  const searchedRecords = useMemo(
    () => filterRecordsBySearch(viewRecords, searchQuery, bundle.properties),
    [viewRecords, searchQuery, bundle.properties],
  );

  const displayRecords = useMemo(
    () => searchedRecords.map((record) => toDisplayRecord(record, bundle.properties)),
    [searchedRecords, bundle.properties],
  );

  const orderedRecordIds = useMemo(
    () => searchedRecords.map((record) => record.id),
    [searchedRecords],
  );

  const { selectedIds, toggleSelect, clearSelection } = useRowSelection(orderedRecordIds);

  const isTableView = !activeView || activeView.type === "table";
  const selectionProps = isTableView
    ? { selectedIds, onToggleSelect: toggleSelect }
    : undefined;

  const groupProperty = viewConfig.group_by_property_id
    ? bundle.properties.find((property) => property.id === viewConfig.group_by_property_id) ?? null
    : null;

  const calendarProperty = viewConfig.calendar_date_property_id
    ? bundle.properties.find((property) => property.id === viewConfig.calendar_date_property_id) ??
      null
    : bundle.properties.find((property) => property.type === "date") ?? null;

  function toggleCollapsedGroup(groupKey: string): void {
    setViewConfig((current) => {
      const collapsed = current.collapsed_groups.includes(groupKey)
        ? current.collapsed_groups.filter((key) => key !== groupKey)
        : [...current.collapsed_groups, groupKey];
      return updateViewConfig(current, { collapsed_groups: collapsed });
    });
  }

  function viewBody() {
    if (!activeView) {
      return (
        <TableView
          bundle={bundle}
          records={searchedRecords}
          viewConfig={viewConfig}
          onViewConfigChange={setViewConfig}
          onOpenRecord={openPeek}
          selection={selectionProps}
        />
      );
    }

    switch (activeView.type) {
      case "board":
        return (
          <RecordBoard
            records={displayRecords}
            rawRecords={searchedRecords}
            databaseId={bundle.database.id}
            groupProperty={groupProperty}
            collapsedGroups={viewConfig.collapsed_groups}
            onToggleGroup={toggleCollapsedGroup}
            onOpenRecord={openPeek}
          />
        );
      case "list":
        return (
          <RecordList
            records={displayRecords}
            rawRecords={searchedRecords}
            properties={bundle.properties}
            visiblePropertyIds={resolvedVisibleProperties(viewConfig, bundle.properties)}
            groupProperty={groupProperty}
            databaseId={bundle.database.id}
            onOpenRecord={openPeek}
          />
        );
      case "calendar":
        return (
          <MonthGrid
            items={searchedRecords
              .filter((record) => {
                if (!calendarProperty) return false;
                const value = record.values[calendarProperty.id];
                return typeof value === "string" && value.trim() !== "";
              })
              .map((record) => ({
                id: record.id,
                recordId: record.id,
                databaseId: bundle.database.id,
                title:
                  propertyValueToString(
                    record.values[
                      bundle.properties.find((property) => property.is_primary)?.id ?? ""
                    ],
                  ) || "Untitled",
                date: String(record.values[calendarProperty!.id]),
              }))}
            onOpenRecord={openPeek}
            onCreateOnDay={
              calendarProperty
                ? (dateIso) =>
                    void createRecordOnDate({
                      databaseId: bundle.database.id,
                      propertyId: calendarProperty.id,
                      dateIso,
                    })
                : undefined
            }
            onRescheduleRecord={
              calendarProperty
                ? (recordId, dateIso) =>
                    upsertRecordValue({
                      recordId,
                      propertyId: calendarProperty.id,
                      rawValue: dateIso,
                    })
                : undefined
            }
          />
        );
      case "table":
        return (
          <TableView
            bundle={bundle}
            records={searchedRecords}
            viewConfig={viewConfig}
            onViewConfigChange={setViewConfig}
            onOpenRecord={openPeek}
            selection={selectionProps}
          />
        );
      default:
        return (
          <TableView
            bundle={bundle}
            records={searchedRecords}
            viewConfig={viewConfig}
            onViewConfigChange={setViewConfig}
            onOpenRecord={openPeek}
            selection={selectionProps}
          />
        );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DatabaseHeader
        bundle={bundle}
        records={searchedRecords}
        visiblePropertyIds={viewConfig.visible_properties}
        embedded={embedded}
      />

      {activeView && (
        <>
          <ViewTabs
            databaseId={bundle.database.id}
            views={views}
            activeViewId={activeView.id}
          />
          <ViewConfigBar
            config={viewConfig}
            properties={bundle.properties}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onConfigChange={setViewConfig}
          />
        </>
      )}

      {viewBody()}

      <Suspense fallback={null}>
        <RecordPeek
          databaseId={bundle.database.id}
          pageId={bundle.database.page_id}
        />
      </Suspense>

      {isTableView && selectedIds.size > 0 && (
        <BulkActionBar
          databaseId={bundle.database.id}
          properties={bundle.properties}
          selectedIds={selectedIds}
          onClearSelection={clearSelection}
          onComplete={() => router.refresh()}
        />
      )}
    </div>
  );
}
