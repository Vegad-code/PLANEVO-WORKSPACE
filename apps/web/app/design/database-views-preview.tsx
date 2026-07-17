"use client";

import type { DatabaseBundle, RecordItem } from "@planevo/core/queries/records";
import { toDisplayRecord } from "@planevo/core/queries/record-display";
import type { DatabasePropertyRow, ViewRow } from "@planevo/core/types/database.types";
import { EMPTY_VIEW_CONFIG } from "@planevo/core/views/view-config";
import { DatabaseHeader } from "@/features/database/database-header";
import { FilterEditor } from "@/features/database/filter-editor";
import { RecordBoard } from "@/features/database/record-board";
import { RecordList } from "@/features/database/record-list";
import { SortEditor } from "@/features/database/sort-editor";
import { TableView } from "@/features/database/table-view";
import { ViewConfigBar } from "@/features/database/view-config-bar";
import { ViewTabs } from "@/features/database/view-tabs";

const previewProperties: DatabasePropertyRow[] = [
  {
    id: "prop-title",
    database_id: "db-preview",
    name: "Name",
    type: "text",
    config_json: { role: "title" },
    position: 0,
    is_primary: true,
    created_at: "",
  },
  {
    id: "prop-status",
    database_id: "db-preview",
    name: "Status",
    type: "select",
    config_json: {
      role: "status",
      options: ["Backlog", "In progress", "Done"],
    },
    position: 1,
    is_primary: false,
    created_at: "",
  },
  {
    id: "prop-due",
    database_id: "db-preview",
    name: "Due",
    type: "date",
    config_json: { role: "due_date" },
    position: 2,
    is_primary: false,
    created_at: "",
  },
];

const previewRecords: RecordItem[] = [
  {
    id: "rec-1",
    position: 0,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    values: {
      "prop-title": "Plan the launch",
      "prop-status": "In progress",
      "prop-due": "2026-07-20T00:00:00.000Z",
    },
  },
  {
    id: "rec-2",
    position: 1,
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
    values: {
      "prop-title": "Review copy",
      "prop-status": "Backlog",
      "prop-due": "2026-07-18T00:00:00.000Z",
    },
  },
];

const previewViews: ViewRow[] = [
  {
    id: "view-table",
    database_id: "db-preview",
    type: "table",
    name: "Table",
    config_json: EMPTY_VIEW_CONFIG,
    position: 0,
    is_default: true,
    created_at: "",
  },
  {
    id: "view-board",
    database_id: "db-preview",
    type: "board",
    name: "Board",
    config_json: {
      ...EMPTY_VIEW_CONFIG,
      group_by_property_id: "prop-status",
    },
    position: 1,
    is_default: false,
    created_at: "",
  },
  {
    id: "view-list",
    database_id: "db-preview",
    type: "list",
    name: "List",
    config_json: EMPTY_VIEW_CONFIG,
    position: 2,
    is_default: false,
    created_at: "",
  },
];

const previewBundle: DatabaseBundle = {
  database: {
    id: "db-preview",
    workspace_id: "ws-preview",
    page_id: "page-preview",
    name: "Project tracker",
    icon: null,
    template_type: "",
    created_at: "",
  },
  properties: previewProperties,
  views: previewViews,
  records: previewRecords,
};

const displayRecords = previewRecords.map((record) =>
  toDisplayRecord(record, previewProperties),
);

/** Kitchen sink for database view chrome — static data, no server actions. */
export function DatabaseViewsPreview() {
  const viewConfig = {
    ...EMPTY_VIEW_CONFIG,
    group_by_property_id: "prop-status",
    visible_properties: previewProperties.map((property) => property.id),
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-card border border-border bg-paper p-5">
        <p className="text-label uppercase text-text-muted">Database header</p>
        <div className="mt-4">
          <DatabaseHeader
            bundle={previewBundle}
            records={previewRecords}
            visiblePropertyIds={viewConfig.visible_properties}
          />
        </div>
      </section>

      <section className="rounded-card border border-border bg-paper p-5">
        <p className="text-label uppercase text-text-muted">View tabs</p>
        <div className="mt-4">
          <ViewTabs
            databaseId={previewBundle.database.id}
            views={previewViews}
            activeViewId="view-table"
          />
        </div>
      </section>

      <section className="rounded-card border border-border bg-paper p-5">
        <p className="text-label uppercase text-text-muted">View config bar</p>
        <div className="mt-4">
          <ViewConfigBar
            config={viewConfig}
            properties={previewProperties}
            searchQuery=""
            onSearchChange={() => undefined}
            onConfigChange={() => undefined}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-border bg-paper p-5">
          <p className="text-label uppercase text-text-muted">Filter editor</p>
          <div className="mt-4">
            <FilterEditor
              filters={[
                {
                  id: "f1",
                  property_id: "prop-status",
                  operator: "is",
                  value: "In progress",
                },
              ]}
              properties={previewProperties}
              onChange={() => undefined}
            />
          </div>
        </div>
        <div className="rounded-card border border-border bg-paper p-5">
          <p className="text-label uppercase text-text-muted">Sort editor</p>
          <div className="mt-4">
            <SortEditor
              sorts={[{ property_id: "prop-due", direction: "asc" }]}
              properties={previewProperties}
              onChange={() => undefined}
            />
          </div>
        </div>
      </section>

      <section className="rounded-card border border-border bg-paper p-5">
        <p className="text-label uppercase text-text-muted">Table view</p>
        <div className="mt-4">
          <TableView
            bundle={previewBundle}
            records={previewRecords}
            viewConfig={viewConfig}
            onViewConfigChange={() => undefined}
          />
        </div>
      </section>

      <section className="rounded-card border border-border bg-paper p-5">
        <p className="text-label uppercase text-text-muted">Board view</p>
        <div className="mt-4">
          <RecordBoard
            records={displayRecords}
            rawRecords={previewRecords}
            databaseId={previewBundle.database.id}
            groupProperty={previewProperties[1]!}
            collapsedGroups={[]}
          />
        </div>
      </section>

      <section className="rounded-card border border-border bg-paper p-5">
        <p className="text-label uppercase text-text-muted">List view</p>
        <div className="mt-4">
          <RecordList
            records={displayRecords}
            rawRecords={previewRecords}
            properties={previewProperties}
            visiblePropertyIds={previewProperties.map((property) => property.id)}
            groupProperty={previewProperties[1]!}
            databaseId={previewBundle.database.id}
          />
        </div>
      </section>
    </div>
  );
}
