"use client";

import { useMemo, useState } from "react";
import type { CapturedRecordDraft } from "@planevo/core/parsing/natural-capture";
import { parseNaturalCaptureLine } from "@planevo/core/parsing/natural-capture";
import type { PlanevoBlock } from "@/features/editor/schema";

export type PromotableBlock = {
  block: PlanevoBlock;
  draft: CapturedRecordDraft;
};

type ColumnKey = "title" | "dueDate" | "priority" | "status";
type ColumnType = "text" | "date" | "select";

type ColumnDef = {
  key: ColumnKey;
  label: string;
  type: ColumnType;
  visible: boolean;
};

type PromotePanelProps = {
  blocks: PlanevoBlock[];
  databaseOptions: { id: string; name: string }[];
  promoting: boolean;
  onCancel: () => void;
  onConfirm: (input: {
    databaseId: string;
    drafts: PromotableBlock[];
  }) => void;
};

const LIST_BLOCK_TYPES = new Set(["bulletListItem", "checkListItem", "numberedListItem"]);

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: "title", label: "Name", type: "text", visible: true },
  { key: "dueDate", label: "Due", type: "date", visible: true },
  { key: "priority", label: "Priority", type: "select", visible: true },
  { key: "status", label: "Status", type: "select", visible: true },
];

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

function draftFieldValue(draft: CapturedRecordDraft, key: ColumnKey): string {
  switch (key) {
    case "title":
      return draft.title;
    case "dueDate":
      return draft.dueDate ? draft.dueDate.slice(0, 10) : "";
    case "priority":
      return draft.priority ?? "";
    case "status":
      return draft.status ?? "";
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

function withDraftField(
  draft: CapturedRecordDraft,
  key: ColumnKey,
  value: string,
): CapturedRecordDraft {
  switch (key) {
    case "title":
      return { ...draft, title: value };
    case "dueDate":
      return {
        ...draft,
        dueDate: value ? new Date(value).toISOString() : null,
      };
    case "priority":
      return { ...draft, priority: value || null };
    case "status":
      return { ...draft, status: value || null };
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

/**
 * F-10 v2 — inline non-modal promote preview below the selection.
 * Destination picker, editable columns, heterogeneous selection banner.
 */
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
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);

  const skippedCount = blocks.length - promotable.length;
  const visibleColumns = columns.filter((column) => column.visible);

  function updateDraft(index: number, key: ColumnKey, value: string) {
    setDrafts((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index
          ? { ...entry, draft: withDraftField(entry.draft, key, value) }
          : entry,
      ),
    );
  }

  function renameColumn(key: ColumnKey, label: string) {
    setColumns((current) =>
      current.map((column) => (column.key === key ? { ...column, label } : column)),
    );
  }

  function changeColumnType(key: ColumnKey, type: ColumnType) {
    setColumns((current) =>
      current.map((column) => (column.key === key ? { ...column, type } : column)),
    );
  }

  function dropColumn(key: ColumnKey) {
    if (key === "title") return;
    setColumns((current) =>
      current.map((column) =>
        column.key === key ? { ...column, visible: false } : column,
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
    <div className="w-full max-w-3xl rounded-xl border border-border bg-surface-raised p-4">
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
          </select>
        </label>
      </div>

      {skippedCount > 0 && (
        <div
          role="status"
          className="mt-3 rounded-lg border border-border bg-paper px-3 py-2 text-small text-text-secondary"
        >
          {skippedCount} of {blocks.length} selected blocks can&apos;t become records
          (headings, empty lines, and non-list blocks are skipped).
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-left text-small">
          <thead>
            <tr className="border-b border-border bg-paper">
              {visibleColumns.map((column) => (
                <th key={column.key} className="px-2 py-2 align-top font-medium text-text-muted">
                  <div className="flex flex-col gap-1">
                    <input
                      value={column.label}
                      onChange={(event) => renameColumn(column.key, event.target.value)}
                      aria-label={`Rename ${column.label} column`}
                      className="w-full min-w-24 rounded-md border border-transparent bg-transparent px-1 py-0.5 font-medium outline-none focus:border-border-strong"
                    />
                    <div className="flex items-center gap-1">
                      <select
                        value={column.type}
                        onChange={(event) =>
                          changeColumnType(column.key, event.target.value as ColumnType)
                        }
                        aria-label={`Type for ${column.label}`}
                        className="h-7 rounded-md border border-border bg-paper px-1 text-label outline-none"
                      >
                        <option value="text">Text</option>
                        <option value="date">Date</option>
                        <option value="select">Select</option>
                      </select>
                      {column.key !== "title" && (
                        <button
                          type="button"
                          onClick={() => dropColumn(column.key)}
                          className="h-7 rounded-md px-1.5 text-label text-text-muted hover:text-brick"
                        >
                          Drop
                        </button>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drafts.map((entry, index) => (
              <tr key={entry.block.id} className="border-b border-border last:border-b-0">
                {visibleColumns.map((column) => (
                  <td key={column.key} className="px-2 py-1.5">
                    {column.type === "date" || column.key === "dueDate" ? (
                      <input
                        type="date"
                        value={draftFieldValue(entry.draft, column.key)}
                        onChange={(event) =>
                          updateDraft(index, column.key, event.target.value)
                        }
                        className="rounded-md border border-transparent bg-transparent px-1 py-1 outline-none focus:border-border-strong"
                      />
                    ) : (
                      <input
                        value={draftFieldValue(entry.draft, column.key)}
                        onChange={(event) =>
                          updateDraft(index, column.key, event.target.value)
                        }
                        placeholder="—"
                        className="w-full min-w-28 rounded-md border border-transparent bg-transparent px-1 py-1 outline-none focus:border-border-strong"
                      />
                    )}
                  </td>
                ))}
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
