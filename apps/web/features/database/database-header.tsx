"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DatabaseBundle } from "@planevo/core/queries/records";
import type { RecordItem } from "@planevo/core/queries/records";
import type { DatabasePropertyRow } from "@planevo/core/types/database.types";
import { propertyValueToString } from "@planevo/core/validation/property-values";
import {
  deleteDatabase,
  duplicateDatabase,
  duplicateDatabaseAsTemplate,
  renameDatabase,
  updateDatabaseIcon,
} from "@/app/(workspace)/databases/[databaseId]/actions";
import { DeleteEntityControl } from "@/components/ui/delete-entity-control";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { Icon } from "@/components/ui/planevo-icon";
import { toast } from "@/components/ui/toast";
import { RecordTrashPanel } from "./record-trash-panel";
import { useOutsidePointer } from "./use-outside-pointer";

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function exportCsv(
  records: RecordItem[],
  properties: DatabasePropertyRow[],
  visiblePropertyIds: string[] | null,
  databaseName: string,
): void {
  const columns = visiblePropertyIds?.length
    ? visiblePropertyIds
        .map((id) => properties.find((property) => property.id === id))
        .filter((property): property is DatabasePropertyRow => Boolean(property))
    : properties;

  const header = columns.map((property) => escapeCsv(property.name)).join(",");
  const rows = records.map((record) =>
    columns
      .map((property) => escapeCsv(propertyValueToString(record.values[property.id])))
      .join(","),
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${databaseName.replaceAll(/[^\w.-]+/g, "-") || "database"}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DatabaseHeader({
  bundle,
  records,
  visiblePropertyIds,
  embedded = false,
}: {
  bundle: DatabaseBundle;
  records: RecordItem[];
  visiblePropertyIds: string[] | null;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(bundle.database.name);
  const [icon, setIcon] = useState(bundle.database.icon);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useOutsidePointer(menuRef, menuOpen, () => setMenuOpen(false));

  function commitIcon(next: string | null): void {
    setIcon(next);
    startTransition(async () => {
      const result = await updateDatabaseIcon({
        databaseId: bundle.database.id,
        icon: next,
      });
      if (!result.ok) {
        setIcon(bundle.database.icon);
        toast(result.error ?? "Couldn't update the icon.", { tone: "error" });
        return;
      }
      router.refresh();
    });
  }

  function submitRename(): void {
    startTransition(async () => {
      const result = await renameDatabase({ databaseId: bundle.database.id, name });
      if (!result.ok) {
        toast(result.error ?? "Couldn't rename the database.", { tone: "error" });
        return;
      }
      setRenaming(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <EmojiPicker value={icon} onChange={commitIcon} label="Database icon" />
        <div className="min-w-0 flex-1">
          {renaming ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submitRename();
              }}
            >
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-9 min-w-48 flex-1 rounded-lg border border-border-strong bg-paper px-3 text-h3 outline-none focus:border-ink"
              />
              <button
                type="submit"
                disabled={isPending}
                className="h-9 rounded-lg bg-ink px-3 text-small font-medium text-paper disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenaming(false);
                  setName(bundle.database.name);
                }}
                className="h-9 rounded-lg px-3 text-small text-text-muted hover:text-ink"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="text-left text-h2 font-medium text-ink outline-none hover:opacity-80 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {bundle.database.name}
            </button>
          )}
          <p className="mt-1 text-small text-text-muted">
            {records.length} record{records.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <RecordTrashPanel databaseId={bundle.database.id} />
        {embedded && (
          <Link
            href={`/databases/${bundle.database.id}`}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="page" className="size-4" />
            Open as full page
          </Link>
        )}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="Database options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
            className="flex size-8 items-center justify-center rounded-lg border border-border-strong bg-paper text-text-secondary outline-none hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="menu" className="size-4" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-paper py-1"
            >
              <form action={duplicateDatabase.bind(null, bundle.database.id)}>
                <button
                  type="submit"
                  role="menuitem"
                  className="flex h-9 w-full items-center px-3 text-left text-small text-text-secondary hover:bg-surface-raised hover:text-ink"
                >
                  Duplicate
                </button>
              </form>
              <form action={duplicateDatabaseAsTemplate.bind(null, bundle.database.id)}>
                <button
                  type="submit"
                  role="menuitem"
                  className="flex h-9 w-full items-center px-3 text-left text-small text-text-secondary hover:bg-surface-raised hover:text-ink"
                >
                  Duplicate as template
                </button>
              </form>
              <button
                type="button"
                role="menuitem"
                className="flex h-9 w-full items-center px-3 text-left text-small text-text-secondary hover:bg-surface-raised hover:text-ink"
                onClick={() => {
                  exportCsv(records, bundle.properties, visiblePropertyIds, bundle.database.name);
                  setMenuOpen(false);
                }}
              >
                Export CSV
              </button>
              {bundle.database.page_id && !embedded && (
                <Link
                  role="menuitem"
                  href={`/pages/${bundle.database.page_id}`}
                  className="flex h-9 items-center px-3 text-small text-text-secondary hover:bg-surface-raised hover:text-ink"
                  onClick={() => setMenuOpen(false)}
                >
                  Open page
                </Link>
              )}
              <div className="my-1 border-t border-border px-3 py-2">
                <DeleteEntityControl
                  label="Delete database"
                  title={`Delete “${bundle.database.name}”?`}
                  description={`This permanently removes the database and its ${bundle.records.length} record${bundle.records.length === 1 ? "" : "s"}, including all properties and views. This can't be undone.`}
                  confirmLabel="Delete database"
                  onConfirm={() => deleteDatabase(bundle.database.id)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
