"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { DatabasePropertyRow } from "@planevo/core/types/database.types";
import { IMPLEMENTED_PROPERTY_TYPES } from "@planevo/core/types/property-types";
import { selectOptions } from "@planevo/core/types/property-roles";
import {
  bulkDeleteRecords,
  bulkDuplicateRecords,
  bulkMoveRecords,
  bulkSetProperty,
  listWorkspaceDatabases,
} from "@/app/(workspace)/databases/[databaseId]/bulk-actions";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { toast } from "@/components/ui/toast";

type PendingAction =
  | { kind: "delete" }
  | { kind: "duplicate" }
  | { kind: "move"; targetDatabaseId: string; targetDatabaseName: string };

export function BulkActionBar({
  databaseId,
  properties,
  selectedIds,
  onClearSelection,
  onComplete,
}: {
  databaseId: string;
  properties: DatabasePropertyRow[];
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onComplete: () => void;
}) {
  const count = selectedIds.size;
  const recordIds = [...selectedIds];
  const [setPropertyOpen, setSetPropertyOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [rawValue, setRawValue] = useState("");
  const [databases, setDatabases] = useState<{ id: string; name: string }[]>([]);
  const [targetDatabaseId, setTargetDatabaseId] = useState("");
  const [isPending, startTransition] = useTransition();
  const setPropertyRef = useRef<HTMLDivElement>(null);
  const moveRef = useRef<HTMLDivElement>(null);

  const editableProperties = properties.filter(
    (property) =>
      !property.is_primary &&
      property.type !== "relation" &&
      property.type !== "person",
  );
  const selectedProperty = editableProperties.find((property) => property.id === propertyId);

  useEffect(() => {
    if (!setPropertyOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!setPropertyRef.current?.contains(event.target as Node)) {
        setSetPropertyOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [setPropertyOpen]);

  useEffect(() => {
    if (!moveOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!moveRef.current?.contains(event.target as Node)) {
        setMoveOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [moveOpen]);

  useEffect(() => {
    if (!moveOpen) return;
    void listWorkspaceDatabases(databaseId).then(setDatabases).catch(() => {
      toast("Couldn't load databases.", { tone: "error" });
    });
  }, [moveOpen, databaseId]);

  if (count === 0) return null;

  function runSetProperty() {
    if (!propertyId) return;
    startTransition(async () => {
      const result = await bulkSetProperty({
        databaseId,
        recordIds,
        propertyId,
        rawValue,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      setSetPropertyOpen(false);
      setPropertyId("");
      setRawValue("");
      onClearSelection();
      onComplete();
    });
  }

  function confirmPending() {
    if (!pending) return Promise.resolve({ ok: true as const });
    const ids = recordIds;
    switch (pending.kind) {
      case "delete":
        return bulkDeleteRecords({ databaseId, recordIds: ids });
      case "duplicate":
        return bulkDuplicateRecords({ databaseId, recordIds: ids });
      case "move":
        return bulkMoveRecords({
          sourceDatabaseId: databaseId,
          targetDatabaseId: pending.targetDatabaseId,
          recordIds: ids,
        });
      default: {
        const _exhaustive: never = pending;
        return Promise.resolve({ ok: false, error: "Unknown action." });
      }
    }
  }

  function pendingCopy(): { title: string; description: string; confirmLabel: string } {
    if (!pending) {
      return { title: "", description: "", confirmLabel: "Confirm" };
    }
    switch (pending.kind) {
      case "delete":
        return {
          title: `Delete ${count} record${count === 1 ? "" : "s"}?`,
          description:
            "Selected records move to trash. You can restore them within 30 days.",
          confirmLabel: "Delete",
        };
      case "duplicate":
        return {
          title: `Duplicate ${count} record${count === 1 ? "" : "s"}?`,
          description: "Copies land at the end of this database with the same values.",
          confirmLabel: "Duplicate",
        };
      case "move":
        return {
          title: `Move ${count} record${count === 1 ? "" : "s"}?`,
          description: `Records move to “${pending.targetDatabaseName}”. Properties match by name and type; unmapped values are dropped.`,
          confirmLabel: "Move",
        };
      default: {
        const _exhaustive: never = pending;
        return { title: "", description: "", confirmLabel: "Confirm" };
      }
    }
  }

  const copy = pendingCopy();

  function valueField() {
    if (!selectedProperty) {
      return (
        <input
          disabled
          placeholder="Choose a property"
          className="h-9 w-full rounded-lg border border-border bg-paper px-3 text-small outline-none"
        />
      );
    }

    if (selectedProperty.type === "checkbox") {
      return (
        <select
          value={rawValue}
          onChange={(event) => setRawValue(event.target.value)}
          aria-label="Value"
          className="h-9 w-full rounded-lg border border-border bg-paper px-3 text-small outline-none focus:border-ink"
        >
          <option value="true">Checked</option>
          <option value="false">Unchecked</option>
        </select>
      );
    }

    if (selectedProperty.type === "select") {
      const options = selectOptions(selectedProperty);
      return (
        <select
          value={rawValue}
          onChange={(event) => setRawValue(event.target.value)}
          aria-label="Value"
          className="h-9 w-full rounded-lg border border-border bg-paper px-3 text-small outline-none focus:border-ink"
        >
          <option value="">Clear</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (selectedProperty.type === "date") {
      return (
        <input
          type="datetime-local"
          value={rawValue}
          onChange={(event) => setRawValue(event.target.value)}
          aria-label="Value"
          className="h-9 w-full rounded-lg border border-border bg-paper px-3 text-small outline-none focus:border-ink"
        />
      );
    }

    return (
      <input
        type={selectedProperty.type === "number" ? "number" : "text"}
        value={rawValue}
        onChange={(event) => setRawValue(event.target.value)}
        aria-label="Value"
        placeholder={selectedProperty.type === "multi-select" ? "a, b, c" : ""}
        className="h-9 w-full rounded-lg border border-border bg-paper px-3 text-small outline-none focus:border-ink"
      />
    );
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label="Bulk actions"
        className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2 shadow-sm"
      >
        <span className="whitespace-nowrap px-2 text-small text-ink">
          {count} selected
        </span>

        <div ref={setPropertyRef} className="relative">
          <button
            type="button"
            disabled={isPending || editableProperties.length === 0}
            onClick={() => setSetPropertyOpen((open) => !open)}
            className="h-8 whitespace-nowrap rounded-lg px-3 text-small text-text-secondary outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
          >
            Set property…
          </button>
          {setPropertyOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-border bg-paper p-3">
              <p className="text-label text-text-muted">Set property</p>
              <select
                value={propertyId}
                onChange={(event) => {
                  setPropertyId(event.target.value);
                  setRawValue("");
                }}
                aria-label="Property"
                className="mt-2 h-9 w-full rounded-lg border border-border bg-paper px-3 text-small outline-none focus:border-ink"
              >
                <option value="">Choose property</option>
                {editableProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
              <div className="mt-2">{valueField()}</div>
              {selectedProperty &&
                !(IMPLEMENTED_PROPERTY_TYPES as readonly string[]).includes(
                  selectedProperty.type,
                ) && (
                  <p className="mt-2 text-label text-text-muted">
                    This property type can&apos;t be bulk-edited yet.
                  </p>
                )}
              <button
                type="button"
                disabled={isPending || !propertyId}
                onClick={runSetProperty}
                className="mt-3 h-8 w-full rounded-lg bg-ink text-small font-medium text-paper disabled:opacity-50"
              >
                Apply to {count}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={() => setPending({ kind: "duplicate" })}
          className="h-8 whitespace-nowrap rounded-lg px-3 text-small text-text-secondary outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
        >
          Duplicate
        </button>

        <div ref={moveRef} className="relative">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setMoveOpen((open) => !open)}
            className="h-8 whitespace-nowrap rounded-lg px-3 text-small text-text-secondary outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
          >
            Move to…
          </button>
          {moveOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-border bg-paper p-3">
              <p className="text-label text-text-muted">Move to database</p>
              <select
                value={targetDatabaseId}
                onChange={(event) => setTargetDatabaseId(event.target.value)}
                aria-label="Target database"
                className="mt-2 h-9 w-full rounded-lg border border-border bg-paper px-3 text-small outline-none focus:border-ink"
              >
                <option value="">Choose database</option>
                {databases.map((database) => (
                  <option key={database.id} value={database.id}>
                    {database.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!targetDatabaseId}
                onClick={() => {
                  const target = databases.find((database) => database.id === targetDatabaseId);
                  if (!target) return;
                  setMoveOpen(false);
                  setPending({
                    kind: "move",
                    targetDatabaseId: target.id,
                    targetDatabaseName: target.name,
                  });
                }}
                className="mt-3 h-8 w-full rounded-lg bg-ink text-small font-medium text-paper disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={() => setPending({ kind: "delete" })}
          className="h-8 whitespace-nowrap rounded-lg px-3 text-small text-brick outline-none hover:bg-brick-tint focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
        >
          Delete
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          aria-label="Clear selection"
          className="h-8 rounded-lg px-2 text-small text-text-muted outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          ✕
        </button>
      </div>

      <ConfirmActionDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={copy.title}
        description={copy.description}
        confirmLabel={copy.confirmLabel}
        destructive={pending?.kind === "delete"}
        onConfirm={confirmPending}
        onSuccess={() => {
          onClearSelection();
          onComplete();
        }}
      />
    </>
  );
}
