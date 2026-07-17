"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { DisplayRecord } from "@planevo/core/queries/record-display";
import type { RecordItem } from "@planevo/core/queries/records";
import type { DatabasePropertyRow } from "@planevo/core/types/database.types";
import { selectOptions } from "@planevo/core/types/property-roles";
import { propertyValueToString } from "@planevo/core/validation/property-values";
import { groupIntoColumns } from "@planevo/core/state/board-state";
import {
  deleteRecord,
  upsertRecordValue,
} from "@/app/(workspace)/databases/[databaseId]/actions";
import { toast } from "@/components/ui/toast";
import { DeleteEntityControl } from "@/components/ui/delete-entity-control";

function RecordCard({
  record,
  databaseId,
  onOpen,
  isDragging = false,
  dragHandleProps,
}: {
  record: DisplayRecord;
  databaseId?: string | null;
  onOpen?: (recordId: string) => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}) {
  const label = record.title.trim() || "Untitled";

  return (
    <article
      {...dragHandleProps}
      className={`group rounded-xl border border-border bg-paper p-4 touch-none ${
        isDragging ? "opacity-40" : ""
      } ${
        onOpen
          ? "cursor-pointer outline-none hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          : ""
      } ${dragHandleProps ? "cursor-grab active:cursor-grabbing" : ""}`}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={
        onOpen
          ? (event) => {
              if ((event.target as HTMLElement).closest("button")) return;
              onOpen(record.id);
            }
          : undefined
      }
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(record.id);
              }
            }
          : undefined
      }
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-body font-medium">{record.title}</h3>
        {databaseId && (
          <div className="opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100">
            <DeleteEntityControl
              compact
              label={`Delete ${label}`}
              title={`Delete “${label}”?`}
              description="This moves the record to trash. You can restore it within 30 days."
              confirmLabel="Delete record"
              onConfirm={() => deleteRecord({ databaseId, recordId: record.id })}
            />
          </div>
        )}
      </div>
      {record.description && (
        <p className="mt-2 line-clamp-2 text-small text-text-secondary">{record.description}</p>
      )}
    </article>
  );
}

function DraggableRecordCard({
  record,
  databaseId,
  onOpen,
}: {
  record: DisplayRecord;
  databaseId?: string | null;
  onOpen?: (recordId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: record.id,
  });
  const style: CSSProperties | undefined = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div ref={setNodeRef} style={style}>
      <RecordCard
        record={record}
        databaseId={databaseId}
        onOpen={onOpen}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function BoardColumn({
  columnKey,
  label,
  items,
  databaseId,
  onOpenRecord,
  draggable,
  collapsed,
  onToggleCollapsed,
}: {
  columnKey: string;
  label: string;
  items: DisplayRecord[];
  databaseId?: string | null;
  onOpenRecord?: (recordId: string) => void;
  draggable: boolean;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey, disabled: !draggable });

  return (
    <section
      ref={setNodeRef}
      className={`w-72 shrink-0 rounded-card border bg-surface-raised p-3 transition-colors motion-reduce:transition-none lg:w-auto ${
        isOver ? "border-ink" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between px-1 py-1">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <h2 className="truncate text-small font-medium">{label}</h2>
          <span className="text-label text-text-muted">{items.length}</span>
        </button>
        {onToggleCollapsed && (
          <span className="text-label text-text-muted">{collapsed ? "Show" : "Hide"}</span>
        )}
      </div>
      {!collapsed && (
        <div className="mt-3 flex min-h-16 flex-col gap-3">
          {items.map((record) =>
            draggable ? (
              <DraggableRecordCard
                key={record.id}
                record={record}
                databaseId={databaseId}
                onOpen={onOpenRecord}
              />
            ) : (
              <RecordCard
                key={record.id}
                record={record}
                databaseId={databaseId}
                onOpen={onOpenRecord}
              />
            ),
          )}
          {items.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-small text-text-muted">
              Nothing here
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export function RecordBoard({
  records,
  rawRecords,
  databaseId,
  groupProperty,
  statusOptions = [],
  statusPropertyId,
  collapsedGroups = [],
  onToggleGroup,
  onOpenRecord,
}: {
  records: DisplayRecord[];
  rawRecords?: RecordItem[];
  databaseId?: string | null;
  groupProperty?: DatabasePropertyRow | null;
  statusOptions?: string[];
  statusPropertyId?: string | null;
  collapsedGroups?: string[];
  onToggleGroup?: (groupKey: string) => void;
  onOpenRecord?: (recordId: string) => void;
}) {
  const legacyGroupProperty: DatabasePropertyRow | null =
    groupProperty ??
    (statusPropertyId
      ? {
          id: statusPropertyId,
          database_id: databaseId ?? "",
          name: "Status",
          type: "select",
          config_json: { options: statusOptions },
          position: 0,
          is_primary: false,
          created_at: "",
        }
      : null);

  const effectiveRawRecords =
    rawRecords ??
    records.map((record) => ({
      id: record.id,
      position: 0,
      createdAt: "",
      updatedAt: "",
      values: {
        ...(statusPropertyId ? { [statusPropertyId]: record.status } : {}),
      },
    }));

  const [boardRecords, setBoardRecords] = useState(records);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);

  useEffect(() => {
    setBoardRecords(records);
  }, [records]);

  const rawById = useMemo(
    () => new Map(effectiveRawRecords.map((record) => [record.id, record])),
    [effectiveRawRecords],
  );

  const groupOptions =
    legacyGroupProperty?.type === "select" ? selectOptions(legacyGroupProperty) : statusOptions;
  const columns = legacyGroupProperty
    ? groupIntoColumns(boardRecords, (record) => {
        const raw = rawById.get(record.id);
        const value = raw?.values[legacyGroupProperty.id];
        return typeof value === "string" ? value : null;
      }, groupOptions)
    : [{ key: "__all__", label: "All records", items: boardRecords }];

  const draggable = Boolean(legacyGroupProperty && databaseId && legacyGroupProperty.type === "select");
  const activeRecord = activeRecordId
    ? boardRecords.find((record) => record.id === activeRecordId)
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveRecordId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveRecordId(null);

    const { active, over } = event;
    if (!over || !legacyGroupProperty || !databaseId) return;

    const recordId = String(active.id);
    const columnKey = String(over.id);
    const record = boardRecords.find((item) => item.id === recordId);
    const raw = rawById.get(recordId);
    if (!record || !raw) return;

    const targetValue = columnKey === "__no_group__" ? null : columnKey;
    const currentValue = raw.values[legacyGroupProperty.id];
    const current =
      typeof currentValue === "string" && currentValue.trim() ? currentValue.trim() : null;
    if (targetValue === current) return;

    const result = await upsertRecordValue({
      recordId,
      propertyId: legacyGroupProperty.id,
      rawValue: targetValue ?? "",
    });

    if (!result.ok) {
      toast(result.error ?? "Couldn't move the record.", { tone: "error" });
    }
  }

  const board = (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-4 lg:grid lg:min-w-0 lg:auto-cols-fr lg:grid-flow-col">
        {columns.map((column) => (
          <BoardColumn
            key={column.key}
            columnKey={column.key}
            label={column.label}
            items={column.items}
            databaseId={databaseId}
            onOpenRecord={onOpenRecord}
            draggable={draggable}
            collapsed={collapsedGroups.includes(column.key)}
            onToggleCollapsed={
              onToggleGroup ? () => onToggleGroup(column.key) : undefined
            }
          />
        ))}
      </div>
    </div>
  );

  if (!draggable) {
    return board;
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {board}
      <DragOverlay dropAnimation={null}>
        {activeRecord ? (
          <RecordCard record={activeRecord} databaseId={databaseId} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export { RecordList } from "./record-list";
