"use client";

import { useState } from "react";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { PromotePanel } from "@/features/editor/promote-panel";
import type { PlanevoBlock } from "@/features/editor/schema";

const SAMPLE_BLOCKS = [
  {
    id: "b1",
    type: "bulletListItem",
    props: {},
    content: [
      {
        type: "text",
        text: "Draft the lab report — Friday",
        styles: {},
      },
    ],
    children: [],
  },
  {
    id: "b2",
    type: "checkListItem",
    props: { checked: false },
    content: [
      {
        type: "text",
        text: "Review launch checklist p1",
        styles: {},
      },
    ],
    children: [],
  },
  {
    id: "b3",
    type: "heading",
    props: { level: 2 },
    content: [{ type: "text", text: "Not a list item", styles: {} }],
    children: [],
  },
] as unknown as PlanevoBlock[];

/**
 * Kitchen-sink preview for editor chrome states (icon, cover, promote panel).
 * Mounted from /design when that page opts in — safe to render standalone.
 */
export function EditorPreview() {
  const [icon, setIcon] = useState<string | null>("🧪");
  const [showPromote, setShowPromote] = useState(true);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-border bg-surface-raised p-5">
        <p className="text-body font-medium">Page icon</p>
        <p className="mt-1 text-small text-text-secondary">
          Token-styled emoji picker used in page chrome.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <EmojiPicker value={icon} onChange={setIcon} />
          <span className="text-small text-text-muted">
            {icon ? `Selected ${icon}` : "No icon"}
          </span>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface-raised p-5">
        <p className="text-body font-medium">Cover + title chrome</p>
        <p className="mt-1 text-small text-text-secondary">
          Cover sits above the icon/title row. Empty cover shows an Add cover affordance.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-dashed border-border">
          <div className="flex h-28 items-center justify-center bg-sidebar text-small text-text-muted">
            Cover image area
          </div>
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-paper text-h2">
              {icon ?? "📄"}
            </span>
            <p className="text-h1">Lab notes</p>
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface-raised p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-body font-medium">Promote panel v2</p>
            <p className="mt-1 text-small text-text-secondary">
              Heterogeneous selection banner, destination picker, editable columns.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPromote((current) => !current)}
            className="h-8 rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {showPromote ? "Hide panel" : "Show panel"}
          </button>
        </div>
        {showPromote && (
          <div className="mt-4">
            <PromotePanel
              blocks={SAMPLE_BLOCKS}
              databaseOptions={[
                { id: "db-tasks", name: "Tasks" },
                { id: "db-notes", name: "Notes" },
              ]}
              promoting={false}
              onCancel={() => setShowPromote(false)}
              onConfirm={() => setShowPromote(false)}
            />
          </div>
        )}
      </div>

      <div className="rounded-card border border-border bg-surface-raised p-5">
        <p className="text-body font-medium">Editor placeholders</p>
        <p className="mt-1 text-small text-text-secondary">
          Empty paragraph reads “Type &apos;/&apos; for commands”. Slash adds Page,
          Database templates, and Embed existing database.
        </p>
        <ul className="mt-3 list-disc pl-5 text-small text-text-secondary">
          <li>Formatting toolbar: Turn into records (selection-sensitive)</li>
          <li>Drag handle: Duplicate, Delete, Turn into, Copy link, Turn into record</li>
          <li>@ mentions: stubbed until /api/command-index (WS-E)</li>
        </ul>
      </div>
    </div>
  );
}
