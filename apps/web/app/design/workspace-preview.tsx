"use client";

import { useState } from "react";
import type { DatabaseBundle, RecordItem } from "@planevo/core/queries/records";
import type { DatabasePropertyRow, ViewRow } from "@planevo/core/types/database.types";
import { EMPTY_VIEW_CONFIG } from "@planevo/core/views/view-config";
import { DatabaseFace } from "@/features/shell/database-face";
import { WorkspaceCreateButton } from "@/features/shell/workspace-create-button";
import { WorkspaceManagePopover } from "@/features/shell/workspace-manage-popover";
import { WorkspaceSwitcher } from "@/features/shell/workspace-switcher";
import type { WorkspaceSummary } from "@/lib/queries/workspace-shell";

const PREVIEW_WORKSPACES: WorkspaceSummary[] = [
  { id: "ws-1", name: "Anthony's workspace", icon: "🌱" },
  { id: "ws-2", name: "Lab notes", icon: "🔬" },
];

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
    config_json: { role: "status", options: ["To do", "In progress", "Done"] },
    position: 1,
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
    values: { "prop-title": "Ship workspace faces", "prop-status": "In progress" },
  },
  {
    id: "rec-2",
    position: 1,
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
    values: { "prop-title": "Review sidebar tree", "prop-status": "To do" },
  },
];

const previewViews: ViewRow[] = [
  {
    id: "view-board",
    database_id: "db-preview",
    type: "board",
    name: "Board",
    config_json: { ...EMPTY_VIEW_CONFIG, group_by_property_id: "prop-status" },
    position: 0,
    is_default: true,
    created_at: "",
  },
];

const previewBundle: DatabaseBundle = {
  database: {
    id: "db-preview",
    workspace_id: "ws-1",
    page_id: "page-preview",
    name: "Tasks",
    icon: "check-circle",
    template_type: "task",
    created_at: "",
  },
  properties: previewProperties,
  views: previewViews,
  records: previewRecords,
};

export function WorkspacePreview() {
  const [manageOpen, setManageOpen] = useState(true);

  return (
    <div className="grid gap-6">
      <section className="rounded-card border border-border bg-surface-raised p-5">
        <p className="text-body font-medium">Sidebar header — workspace switcher</p>
        <p className="mt-1 text-small text-text-secondary">
          Click the name to rename inline. Pick an icon from the emoji grid. Chevron opens the
          menu with New workspace.
        </p>
        <div className="mt-4 max-w-xs rounded-xl border border-border bg-sidebar p-2">
          <WorkspaceSwitcher
            workspaces={PREVIEW_WORKSPACES}
            activeWorkspaceId="ws-1"
            workspaceName="Anthony's workspace"
            workspaceInitial="🌱"
            userEmail="anthony@example.com"
            memberCount={1}
          />
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface-raised p-5">
        <p className="text-body font-medium">New workspace control</p>
        <p className="mt-1 text-small text-text-secondary">
          Visible in the switcher menu — opens the create dialog.
        </p>
        <div className="mt-4 max-w-xs rounded-xl border border-border bg-sidebar p-2">
          <WorkspaceCreateButton />
        </div>
      </section>

      <section className="relative rounded-card border border-border bg-surface-raised p-5">
        <p className="text-body font-medium">Manage workspace popover</p>
        <p className="mt-1 text-small text-text-secondary">
          Double-click a workspace in the switcher. Typed-name delete is unchanged.
        </p>
        <div className="relative mt-4 min-h-64 max-w-sm">
          {manageOpen && (
            <WorkspaceManagePopover
              workspace={PREVIEW_WORKSPACES[0]!}
              onClose={() => setManageOpen(false)}
            />
          )}
          {!manageOpen && (
            <button
              type="button"
              onClick={() => setManageOpen(true)}
              className="h-9 rounded-lg border border-border-strong px-4 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Show manage popover
            </button>
          )}
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface-raised p-5">
        <p className="text-body font-medium">F-08 database face — loaded</p>
        <p className="mt-1 text-small text-text-secondary">
          Tasks, calendar, and files routes share this shell around DatabaseWorkspace.
        </p>
        <div className="mt-4 rounded-xl border border-border bg-paper p-4">
          <DatabaseFace
            eyebrow="Workspace database"
            title="Tasks"
            description="Plan the work, then move it forward."
            bundle={previewBundle}
            workspaceId="ws-1"
            empty={{
              icon: "tasks",
              title: "Empty",
              description: "Not shown when a bundle is present.",
              recreate: <span />,
            }}
          />
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface-raised p-5">
        <p className="text-body font-medium">F-08 database face — missing database</p>
        <DatabaseFace
          eyebrow="Workspace database"
          title="Calendar"
          description="Events and dated records from your calendar database."
          bundle={null}
          workspaceId="ws-1"
          empty={{
            icon: "calendar",
            title: "Your calendar is ready when you are",
            description: "One-click recreate via the calendar foundation path.",
            recreate: (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg bg-ink px-4 text-small font-medium text-paper"
              >
                Create calendar database
              </button>
            ),
          }}
        />
      </section>
    </div>
  );
}
