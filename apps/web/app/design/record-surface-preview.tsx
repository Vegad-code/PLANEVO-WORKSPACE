"use client";

import type { DatabasePropertyRow } from "@planevo/core/types/database.types";
import type { Json } from "@planevo/core/types/database.types";
import { RecordSurface } from "@/features/database/record-surface";

const SAMPLE_PROPERTIES: DatabasePropertyRow[] = [
  {
    id: "prop-title",
    database_id: "db-preview",
    name: "Name",
    type: "text",
    position: 0,
    is_primary: true,
    config_json: null,
    created_at: "",
  },
  {
    id: "prop-status",
    database_id: "db-preview",
    name: "Status",
    type: "select",
    position: 1,
    is_primary: false,
    config_json: { options: ["Todo", "Doing", "Done"] },
    created_at: "",
  },
  {
    id: "prop-due",
    database_id: "db-preview",
    name: "Due",
    type: "date",
    position: 2,
    is_primary: false,
    config_json: null,
    created_at: "",
  },
];

const SAMPLE_VALUES: Record<string, Json> = {
  "prop-title": "Launch checklist",
  "prop-status": "Doing",
  "prop-due": "2026-07-20T09:00:00.000Z",
};

/** Kitchen-sink preview for RecordSurface page + peek variants. */
export function RecordSurfacePreview() {
  const data = {
    recordId: "rec-preview",
    databaseId: "db-preview",
    properties: SAMPLE_PROPERTIES,
    values: SAMPLE_VALUES,
    contentJson: [
      {
        id: "block-1",
        type: "paragraph",
        props: {
          textColor: "default",
          backgroundColor: "default",
          textAlignment: "left",
        },
        content: [{ type: "text", text: "Notes and block body render below the property stack.", styles: {} }],
        children: [],
      },
    ],
  };

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="mb-3 text-h3 text-ink">Page variant</h3>
        <div className="overflow-hidden rounded-xl border border-border bg-paper">
          <RecordSurface variant="page" data={data} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-h3 text-ink">Peek variant</h3>
        <div className="max-h-[28rem] overflow-hidden overflow-y-auto rounded-xl border border-border bg-surface-raised">
          <RecordSurface variant="peek" data={data} />
        </div>
      </section>
    </div>
  );
}
