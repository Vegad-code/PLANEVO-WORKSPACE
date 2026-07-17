"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DatabaseBundle, RecordItem } from "@planevo/core/queries/records";
import type { DatabasePropertyRow } from "@planevo/core/types/database.types";
import { selectOptions } from "@planevo/core/types/property-roles";
import { IMPLEMENTED_PROPERTY_TYPES } from "@planevo/core/types/property-types";
import { propertyValueToString } from "@planevo/core/validation/property-values";
import {
  updateViewConfig,
  type ViewConfig,
} from "@planevo/core/views/view-config";
import {
  convertPropertyType,
  countPropertyValues,
  createProperty,
  createRecord,
  deleteProperty,
  deleteRecord,
  renameProperty,
  upsertRecordValue,
} from "@/app/(workspace)/databases/[databaseId]/actions";
import { DeleteEntityControl } from "@/components/ui/delete-entity-control";
import { Icon } from "@/components/ui/planevo-icon";
import { toast } from "@/components/ui/toast";
import { RelationPicker } from "@/features/database/relation-picker";
import { useOutsidePointer } from "./use-outside-pointer";

const CELL_INPUT_CLASS =
  "h-8 w-full min-w-28 rounded-md border border-transparent bg-transparent px-2 text-small outline-none transition-colors hover:border-border focus:border-ink focus:bg-surface-raised motion-reduce:transition-none";

const DEFAULT_COLUMN_WIDTH = 160;
const MIN_COLUMN_WIDTH = 96;

function relationTargetDatabaseId(property: DatabasePropertyRow): string | null {
  const config = property.config_json;
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const id = (config as Record<string, unknown>).target_database_id;
  return typeof id === "string" ? id : null;
}

function resolvedColumns(
  properties: DatabasePropertyRow[],
  viewConfig: ViewConfig,
): DatabasePropertyRow[] {
  const ids = viewConfig.visible_properties?.length
    ? viewConfig.visible_properties
    : properties.map((property) => property.id);
  return ids
    .map((id) => properties.find((property) => property.id === id))
    .filter((property): property is DatabasePropertyRow => Boolean(property));
}

function Cell({
  record,
  property,
}: {
  record: RecordItem;
  property: DatabasePropertyRow;
}) {
  const stored = propertyValueToString(record.values[property.id]);
  const [error, setError] = useState<string | null>(null);
  const targetDatabaseId = relationTargetDatabaseId(property);

  async function commit(rawValue: string) {
    if (rawValue === stored) return;
    const result = await upsertRecordValue({
      recordId: record.id,
      propertyId: property.id,
      rawValue,
    });
    setError(result.ok ? null : (result.error ?? "Couldn't save."));
  }

  const errorProps = error ? { "aria-invalid": true as const, title: error } : {};

  if (property.type === "relation" && targetDatabaseId) {
    return (
      <RelationPicker
        recordId={record.id}
        propertyId={property.id}
        targetDatabaseId={targetDatabaseId}
        displayValue={stored}
      />
    );
  }

  if (property.type === "checkbox") {
    return (
      <input
        type="checkbox"
        defaultChecked={stored === "true"}
        onChange={(event) => void commit(event.target.checked ? "true" : "false")}
        aria-label={property.name}
        className="size-4 accent-ink"
        {...errorProps}
      />
    );
  }

  if (property.type === "select") {
    const options = selectOptions(property);
    if (options.length > 0) {
      return (
        <select
          defaultValue={stored}
          onChange={(event) => void commit(event.target.value)}
          aria-label={property.name}
          className={CELL_INPUT_CLASS}
          {...errorProps}
        >
          <option value="">—</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          {stored && !options.includes(stored) && (
            <option value={stored}>{stored}</option>
          )}
        </select>
      );
    }
  }

  return (
    <input
      type={property.type === "number" ? "number" : property.type === "date" ? "datetime-local" : "text"}
      defaultValue={property.type === "date" && stored ? stored.slice(0, 16) : stored}
      onBlur={(event) => void commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      aria-label={property.name}
      placeholder={property.type === "multi-select" ? "a, b, c" : ""}
      className={`${CELL_INPUT_CLASS} ${error ? "border-brick" : ""}`}
      {...errorProps}
    />
  );
}

function PropertyHeaderMenu({
  databaseId,
  property,
  onHide,
  onRenamed,
}: {
  databaseId: string;
  property: DatabasePropertyRow;
  onHide: () => void;
  onRenamed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(property.name);
  const [valueCount, setValueCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useOutsidePointer(ref, open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    void countPropertyValues({ databaseId, propertyId: property.id }).then(setValueCount);
  }, [open, databaseId, property.id]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={`${property.name} options`}
        onClick={() => setOpen((value) => !value)}
        className="flex size-6 items-center justify-center rounded-md text-text-muted hover:bg-surface-raised hover:text-ink"
      >
        <Icon name="menu" className="size-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-paper py-1">
          <button
            type="button"
            className="flex h-8 w-full items-center px-3 text-left text-small text-text-secondary hover:bg-surface-raised"
            onClick={() => {
              setRenaming(true);
              setOpen(false);
            }}
          >
            Rename
          </button>
          {!property.is_primary &&
            IMPLEMENTED_PROPERTY_TYPES.filter((type) => type !== property.type).map((type) => (
              <button
                key={type}
                type="button"
                disabled={isPending}
                className="flex h-8 w-full items-center px-3 text-left text-small text-text-secondary hover:bg-surface-raised disabled:opacity-50"
                onClick={() => {
                  startTransition(async () => {
                    const dry = await convertPropertyType({
                      databaseId,
                      propertyId: property.id,
                      newType: type,
                    });
                    if (!dry.ok) {
                      toast(dry.error, { tone: "error" });
                      return;
                    }
                    if (!dry.dryRun) return;
                    const confirmed = window.confirm(dry.plan.summary);
                    if (!confirmed) return;
                    const result = await convertPropertyType({
                      databaseId,
                      propertyId: property.id,
                      newType: type,
                      confirm: true,
                    });
                    if (!result.ok) toast(result.error, { tone: "error" });
                    setOpen(false);
                    onRenamed();
                  });
                }}
              >
                Change to {type}
              </button>
            ))}
          {!property.is_primary && (
            <button
              type="button"
              className="flex h-8 w-full items-center px-3 text-left text-small text-text-secondary hover:bg-surface-raised"
              onClick={() => {
                onHide();
                setOpen(false);
              }}
            >
              Hide
            </button>
          )}
          {!property.is_primary && (
            <div className="border-t border-border px-2 py-1">
              <DeleteEntityControl
                compact
                label={`Delete ${property.name}`}
                title={`Delete “${property.name}”?`}
                description={
                  valueCount === null
                    ? "This removes the property and every value stored in it."
                    : `This removes the property and ${valueCount} stored value${valueCount === 1 ? "" : "s"}.`
                }
                confirmLabel="Delete property"
                onConfirm={() => deleteProperty({ databaseId, propertyId: property.id })}
              />
            </div>
          )}
        </div>
      )}
      {renaming && (
        <form
          className="absolute left-0 top-full z-50 mt-1 flex items-center gap-1 rounded-lg border border-border bg-paper p-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              await renameProperty({ databaseId, propertyId: property.id, name });
              setRenaming(false);
              onRenamed();
            });
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-8 w-28 rounded-md border border-border-strong px-2 text-small outline-none focus:border-ink"
          />
          <button type="submit" className="h-8 rounded-md bg-ink px-2 text-small text-paper">
            Save
          </button>
        </form>
      )}
    </div>
  );
}

function SortableHeader({
  property,
  width,
  databaseId,
  onResize,
  onHide,
  onRenamed,
}: {
  property: DatabasePropertyRow;
  width: number;
  databaseId: string;
  onResize: (width: number) => void;
  onHide: () => void;
  onRenamed: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `col:${property.id}`,
  });
  const resizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  function onResizePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    resizing.current = true;
    startX.current = event.clientX;
    startWidth.current = width;

    function onMove(moveEvent: globalThis.PointerEvent) {
      if (!resizing.current) return;
      const next = Math.max(MIN_COLUMN_WIDTH, startWidth.current + moveEvent.clientX - startX.current);
      onResize(next);
    }

    function onUp() {
      resizing.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <th
      ref={setNodeRef}
      scope="col"
      style={{
        width,
        minWidth: width,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="relative whitespace-nowrap border-r border-border px-3 py-2 text-left text-label uppercase text-text-muted last:border-r-0"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Reorder ${property.name}`}
          className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-text-muted active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <Icon name="menu" className="size-3.5" />
        </button>
        <span className="truncate">{property.name}</span>
        <PropertyHeaderMenu
          databaseId={databaseId}
          property={property}
          onHide={onHide}
          onRenamed={onRenamed}
        />
      </div>
      <button
        type="button"
        aria-label={`Resize ${property.name}`}
        onPointerDown={onResizePointerDown}
        className="absolute inset-y-0 right-0 w-1 cursor-col-resize touch-none"
      />
    </th>
  );
}

function AddPropertyMenu({ databaseId }: { databaseId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createProperty({
        databaseId,
        name: String(formData.get("name") ?? ""),
        type: String(formData.get("type") ?? "text"),
      });
      if (result.ok) {
        setOpen(false);
        setError(null);
      } else {
        setError(result.error ?? "Couldn't add the property.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-8 whitespace-nowrap rounded-lg px-2 text-small font-medium text-text-muted outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        + Property
      </button>
    );
  }

  return (
    <form action={submit} className="flex items-center gap-1">
      <input
        autoFocus
        required
        name="name"
        placeholder="Name"
        className="h-8 w-28 rounded-md border border-border-strong bg-surface-raised px-2 text-small outline-none focus:border-ink"
      />
      <select
        name="type"
        defaultValue="text"
        aria-label="Property type"
        className="h-8 rounded-md border border-border-strong bg-surface-raised px-1 text-small outline-none focus:border-ink"
      >
        {IMPLEMENTED_PROPERTY_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="h-8 rounded-md bg-ink px-2 text-small font-medium text-paper disabled:opacity-50"
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        aria-label="Cancel adding property"
        className="h-8 rounded-md px-2 text-small text-text-muted hover:text-ink"
      >
        ✕
      </button>
      {error && (
        <span role="alert" className="text-small text-ink">
          {error}
        </span>
      )}
    </form>
  );
}

export function TableView({
  bundle,
  records: recordsOverride,
  viewConfig,
  onViewConfigChange,
  onOpenRecord,
  selection,
}: {
  bundle: DatabaseBundle;
  records?: RecordItem[];
  viewConfig: ViewConfig;
  onViewConfigChange: (config: ViewConfig) => void;
  onOpenRecord?: (recordId: string) => void;
  selection?: {
    selectedIds: Set<string>;
    onToggleSelect: (recordId: string, shiftKey: boolean) => void;
  };
}) {
  const { database, properties } = bundle;
  const records = recordsOverride ?? bundle.records;
  const [isPending, startTransition] = useTransition();
  const columns = useMemo(
    () => resolvedColumns(properties, viewConfig),
    [properties, viewConfig],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function patchConfig(patch: Partial<ViewConfig>): void {
    onViewConfigChange(updateViewConfig(viewConfig, patch));
  }

  function hideColumn(propertyId: string): void {
    const currentIds = viewConfig.visible_properties ?? properties.map((property) => property.id);
    const next = currentIds.filter((id) => id !== propertyId);
    patchConfig({ visible_properties: next.length ? next : null });
  }

  function handleHeaderDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id).replace(/^col:/, "");
    const overId = String(over.id).replace(/^col:/, "");
    const ids = columns.map((column) => column.id);
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;
    patchConfig({ visible_properties: arrayMove(ids, oldIndex, newIndex) });
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleHeaderDragEnd}>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border">
              {selection && (
                <th scope="col" className="w-10 px-2 py-2">
                  <span className="sr-only">Select</span>
                </th>
              )}
              <SortableContext
                items={columns.map((column) => `col:${column.id}`)}
                strategy={horizontalListSortingStrategy}
              >
                {columns.map((property) => (
                  <SortableHeader
                    key={property.id}
                    property={property}
                    databaseId={database.id}
                    width={viewConfig.column_widths[property.id] ?? DEFAULT_COLUMN_WIDTH}
                    onResize={(width) =>
                      patchConfig({
                        column_widths: { ...viewConfig.column_widths, [property.id]: width },
                      })
                    }
                    onHide={() => hideColumn(property.id)}
                    onRenamed={() => startTransition(() => undefined)}
                  />
                ))}
              </SortableContext>
              <th scope="col" className="w-full px-2 py-2">
                <AddPropertyMenu databaseId={database.id} />
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const recordTitle =
                propertyValueToString(
                  record.values[properties.find((property) => property.is_primary)?.id ?? ""],
                ) || "Untitled";

              const isSelected = selection?.selectedIds.has(record.id) ?? false;

              return (
                <tr
                  key={record.id}
                  data-selected={isSelected || undefined}
                  className={`group relative border-b border-border last:border-b-0 ${
                    isSelected ? "bg-paper" : ""
                  }`}
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    if (
                      target.closest(
                        "input, select, button, a, textarea, [role='menuitem']",
                      )
                    ) {
                      return;
                    }
                    if (selection) {
                      if (event.shiftKey) {
                        selection.onToggleSelect(record.id, true);
                        return;
                      }
                      if (onOpenRecord) {
                        onOpenRecord(record.id);
                        return;
                      }
                      selection.onToggleSelect(record.id, false);
                      return;
                    }
                    onOpenRecord?.(record.id);
                  }}
                >
                  {selection && (
                    <td className="w-10 px-2 py-1 align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(event) => {
                          event.stopPropagation();
                          selection.onToggleSelect(record.id, event.shiftKey);
                        }}
                        onChange={() => undefined}
                        aria-label={`Select ${recordTitle}`}
                        className="size-4 accent-ink"
                      />
                    </td>
                  )}
                  {columns.map((property) => (
                    <td
                      key={property.id}
                      style={{
                        width: viewConfig.column_widths[property.id] ?? DEFAULT_COLUMN_WIDTH,
                        minWidth: viewConfig.column_widths[property.id] ?? DEFAULT_COLUMN_WIDTH,
                      }}
                      className="px-1.5 py-1 align-middle"
                    >
                      <Cell record={record} property={property} />
                    </td>
                  ))}
                  <td className="w-10 px-1 py-1 align-middle">
                    <div className="opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100">
                      <DeleteEntityControl
                        compact
                        label={`Delete ${recordTitle}`}
                        title={`Delete “${recordTitle}”?`}
                        description="This moves the record to trash. You can restore it within 30 days."
                        confirmLabel="Delete record"
                        onConfirm={() =>
                          deleteRecord({ databaseId: database.id, recordId: record.id })
                        }
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {records.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1 + (selection ? 1 : 0)}
                  className="px-4 py-10 text-center text-small text-text-muted"
                >
                  <div className="mx-auto max-w-xs flex flex-col gap-2 opacity-60">
                    <div className="h-2 rounded border border-dashed border-border-strong" />
                    <div className="h-2 w-4/5 rounded border border-dashed border-border-strong" />
                    <div className="h-2 w-3/5 rounded border border-dashed border-border-strong" />
                  </div>
                  <p className="mt-4">No records yet — add the first one below.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </DndContext>
      <div className="border-t border-border p-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => createRecord(database.id))}
          className="h-8 rounded-lg px-3 text-small font-medium text-text-secondary outline-none hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
        >
          + New record
        </button>
      </div>
    </div>
  );
}
