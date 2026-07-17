"use client";

import { useMemo, useState } from "react";
import type { CapturedRecordDraft } from "@planevo/core/parsing/natural-capture";
import { parseNaturalCaptureLine } from "@planevo/core/parsing/natural-capture";
import type { PlanevoBlock } from "@/features/editor/schema";

export type PromotableBlock = {
  block: PlanevoBlock;
  draft: CapturedRecordDraft;
};

export const NEW_TASK_DATABASE = "__new_task_database__";

type PromotePanelProps = {
  blocks: PlanevoBlock[];
  databaseOptions: { id: string; name: string }[];
  promoting: boolean;
  onCancel: () => void;
  onConfirm: (input: {
    databaseId: string;
    drafts: PromotableBlock[];
    createNewTaskDatabase?: boolean;
  }) => void;
};

const LIST_BLOCK_TYPES = new Set(["bulletListItem", "checkListItem", "numberedListItem"]);

function blockText(block: PlanevoBlock): string {
  if (!Array.isArray(block.content)) return "";
  return block.content
    .map((inline) => {
      if (typeof inline !== "object" || inline === null) return "";
      if ("text" in inline && typeof inline.text === "string") return inline.text;
      return "";
    })
    .join("");
}

export function blocksToPromotable(blocks: PlanevoBlock[]): PromotableBlock[] {
  return blocks
    .filter((block) => LIST_BLOCK_TYPES.has(block.type))
    .map((block) => ({
      block,
      draft: parseNaturalCaptureLine(blockText(block)),
    }))
    .filter((entry) => entry.draft.title.trim().length > 0);
}

export function PromotePanel({
  blocks,
  databaseOptions,
  promoting,
  onCancel,
  onConfirm,
}: PromotePanelProps) {
  const promotable = useMemo(() => blocksToPromotable(blocks), [blocks]);
  const [databaseId, setDatabaseId] = useState(databaseOptions[0]?.id ?? "");
  const [drafts, setDrafts] = useState(promotable);

  const skippedCount = blocks.length - promotable.length;

  function updateDraft(index: number, field: keyof CapturedRecordDraft, value: string) {
    setDrafts((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              draft: {
                ...entry.draft,
                [field]: value || null,
              },
            }
          : entry,
      ),
    );
  }

  if (promotable.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-4">
        <p className="text-small text-text-secondary">
          Select bullet or checklist items to turn into records.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 h-8 rounded-lg px-3 text-small text-text-muted hover:text-ink"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl rounded-xl border border-border bg-surface-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label uppercase text-text-muted">Turn into records</p>
          <p className="mt-1 text-small text-text-secondary">
            {promotable.length} of {blocks.length} selected block
            {blocks.length === 1 ? "" : "s"} can become records.
            {skippedCount > 0 ? ` ${skippedCount} will be left unchanged.` : ""}
          </p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-label text-text-muted">Where</span>
          <select
            value={databaseId}
            onChange={(event) => setDatabaseId(event.target.value)}
            className="h-8 min-w-40 rounded-lg border border-border-strong bg-paper px-2 text-small outline-none focus:border-ink"
          >
            {databaseOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
            <option value={NEW_TASK_DATABASE}>+ New task database</option>
          </select>
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-left text-small">
          <thead>
            <tr className="border-b border-border bg-paper">
              <th className="px-3 py-2 font-medium text-text-muted">Name</th>
              <th className="px-3 py-2 font-medium text-text-muted">Due</th>
              <th className="px-3 py-2 font-medium text-text-muted">Priority</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((entry, index) => (
              <tr key={entry.block.id} className="border-b border-border last:border-b-0">
                <td className="px-2 py-1.5">
                  <input
                    value={entry.draft.title}
                    onChange={(event) => updateDraft(index, "title", event.target.value)}
                    className="w-full min-w-48 rounded-md border border-transparent bg-transparent px-1 py-1 outline-none focus:border-border-strong"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="date"
                    value={entry.draft.dueDate ? entry.draft.dueDate.slice(0, 10) : ""}
                    onChange={(event) =>
                      updateDraft(
                        index,
                        "dueDate",
                        event.target.value
                          ? new Date(event.target.value).toISOString()
                          : "",
                      )
                    }
                    className="rounded-md border border-transparent bg-transparent px-1 py-1 outline-none focus:border-border-strong"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    value={entry.draft.priority ?? ""}
                    onChange={(event) => updateDraft(index, "priority", event.target.value)}
                    placeholder="—"
                    className="w-24 rounded-md border border-transparent bg-transparent px-1 py-1 outline-none focus:border-border-strong"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={promoting || !databaseId}
          onClick={() =>
            onConfirm({
              databaseId,
              drafts,
              createNewTaskDatabase: databaseId === NEW_TASK_DATABASE,
            })
          }
          className="h-8 rounded-lg bg-ink px-4 text-small font-medium text-paper disabled:opacity-50"
        >
          {promoting ? "Creating records…" : "Confirm"}
        </button>
        <button
          type="button"
          disabled={promoting}
          onClick={onCancel}
          className="h-8 rounded-lg px-3 text-small text-text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
