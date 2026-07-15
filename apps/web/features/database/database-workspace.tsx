"use client";

import { useState } from "react";
import type { DatabaseBundle } from "@planevo/core/queries/records";
import type { ViewRow } from "@planevo/core/types/database.types";
import { duplicateDatabase } from "@/app/(workspace)/databases/[databaseId]/actions";
import { TableView } from "./table-view";
import { EmptyState } from "@/components/ui/empty-state";

function viewBody(view: ViewRow | undefined, bundle: DatabaseBundle) {
  // Table is the canonical kernel view; board/list/calendar bodies arrive with
  // the entry-point de-fragmentation pass.
  if (!view || view.type === "table") return <TableView bundle={bundle} />;
  return (
    <EmptyState
      icon="workspace"
      title={`${view.name} view is on its way`}
      description="This view type is being rebuilt on the shared kernel. Use Table meanwhile — it's the same records."
    />
  );
}

export function DatabaseWorkspace({ bundle }: { bundle: DatabaseBundle }) {
  const views = bundle.views;
  const defaultView = views.find((view) => view.is_default) ?? views[0];
  const [activeViewId, setActiveViewId] = useState<string | null>(defaultView?.id ?? null);
  const activeView = views.find((view) => view.id === activeViewId) ?? defaultView;

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
          {views.length === 0 && (
            <span className="text-small text-text-muted">Table</span>
          )}
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
      <div className="mt-4">{viewBody(activeView, bundle)}</div>
    </div>
  );
}
