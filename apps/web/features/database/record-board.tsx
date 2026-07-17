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
import { groupIntoColumns } from "@planevo/core/state/board-state";
import {
  deleteRecord,
  upsertRecordValue,
} from "@/app/(workspace)/databases/[databaseId]/actions";
import { DeleteEntityControl } from "@/components/ui/delete-entity-control";
import { RecordDeleteHover } from "@/features/database/delete-record-control";

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
  const formattedDate = record.dueDate
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
        new Date(record.dueDate),
      )
    : null;
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
        <div className="flex shrink-0 items-center gap-2">
          {record.priority && (
            <span className="rounded-full bg-slate-tint px-2 py-1 text-label text-ink">
              {record.priority}
            </span>
          )}
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
      </div>
      {record.description && (
        <p className="mt-2 line-clamp-2 text-small text-text-secondary">{record.description}</p>
      )}
      {(formattedDate || record.estimateMinutes !== null || record.tags.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-label text-text-muted">
          {formattedDate && <span>{formattedDate}</span>}
          {record.estimateMinutes !== null && <span>{record.estimateMinutes} min</span>}
          {record.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border px-2 py-1">
              {tag}
            </span>
          ))}
        </div>
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
}: {
  columnKey: string;
  label: string;
  items: DisplayRecord[];
  databaseId?: string | null;
  onOpenRecord?: (recordId: string) => void;
  draggable: boolean;
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
        <h2 className="text-small font-medium">{label}</h2>
        <span className="text-label text-text-muted">{items.length}</span>
      </div>
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
    </section>
  );
}

/** Board over DisplayRecords: configured columns + orphan values + no-status
 *  lane — a record never disappears because its status string is unexpected. */
export function RecordBoard({
  records,
  statusOptions,
  databaseId,
  statusPropertyId,
  onOpenRecord,
}: {
  records: DisplayRecord[];
  statusOptions: string[];
  databaseId?: string | null;
  statusPropertyId?: string | null;
  onOpenRecord?: (recordId: string) => void;
}) {
  const [boardRecords, setBoardRecords] = useState(records);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);

  useEffect(() => {
    setBoardRecords(records);
  }, [records]);

  const columns = groupIntoColumns(boardRecords, (record) => record.status, statusOptions);
  const draggable = Boolean(statusPropertyId && databaseId);
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
    if (!over || !statusPropertyId || !databaseId) return;

    const recordId = String(active.id);
    const columnKey = String(over.id);
    const record = boardRecords.find((item) => item.id === recordId);
    if (!record) return;

    const targetStatus = columnKey === "__no_group__" ? null : columnKey;
    const currentStatus = record.status?.trim() || null;
    if (targetStatus === currentStatus) return;

    const previous = boardRecords;
    setBoardRecords((current) =>
      current.map((item) =>
        item.id === recordId ? { ...item, status: targetStatus } : item,
      ),
    );

    const result = await upsertRecordValue({
      recordId,
      propertyId: statusPropertyId,
      rawValue: targetStatus ?? "",
    });

    if (!result.ok) {
      setBoardRecords(previous);
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

export function RecordList({
  records,
  databaseId,
  onOpenRecord,
}: {
  records: DisplayRecord[];
  databaseId?: string | null;
  onOpenRecord?: (recordId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface-raised">
      {records.map((record) => {
        const row = (
          <div
            className={`flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center ${
              onOpenRecord ? "cursor-pointer" : ""
            }`}
            role={onOpenRecord ? "button" : undefined}
            tabIndex={onOpenRecord ? 0 : undefined}
            onClick={
              onOpenRecord
                ? (event) => {
                    if ((event.target as HTMLElement).closest("button")) return;
                    onOpenRecord(record.id);
                  }
                : undefined
            }
            onKeyDown={
              onOpenRecord
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenRecord(record.id);
                    }
                  }
                : undefined
            }
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium">{record.title}</p>
              {record.description && (
                <p className="mt-1 truncate text-small text-text-muted">{record.description}</p>
              )}
            </div>
            <span className="text-small text-text-secondary sm:w-32">
              {record.status ?? "No status"}
            </span>
            <span className="text-small text-text-muted sm:w-32">
              {record.priority ?? "No priority"}
            </span>
          </div>
        );

        if (!databaseId) {
          return (
            <div key={record.id} className="border-b border-border last:border-b-0">
              {row}
            </div>
          );
        }

        return (
          <RecordDeleteHover
            key={record.id}
            databaseId={databaseId}
            recordId={record.id}
            recordTitle={record.title}
            className="border-b border-border last:border-b-0"
          >
            {row}
          </RecordDeleteHover>
        );
      })}
    </div>
  );
}
