"use client";

import { useMemo } from "react";
import type { DisplayRecord } from "@planevo/core/queries/record-display";
import type { RecordItem } from "@planevo/core/queries/records";
import type { DatabasePropertyRow, Json } from "@planevo/core/types/database.types";
import { selectOptions } from "@planevo/core/types/property-roles";
import { propertyValueToString } from "@planevo/core/validation/property-values";
import { groupIntoColumns } from "@planevo/core/state/board-state";
import { RecordDeleteHover } from "@/features/database/delete-record-control";

type RowDisplay = {
  title: string;
  fields: { id: string; value: string }[];
};

function formatPropertyValue(property: DatabasePropertyRow, record: RecordItem): string {
  const raw = propertyValueToString(record.values[property.id]);
  if (!raw) return "—";
  if (property.type === "checkbox") return raw === "true" ? "Yes" : "No";
  return raw;
}

function ListRow({
  record,
  display,
  rawRecord,
  databaseId,
  onOpenRecord,
}: {
  record: DisplayRecord;
  display: RowDisplay;
  rawRecord: RecordItem;
  databaseId?: string | null;
  onOpenRecord?: (recordId: string) => void;
}) {
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
        <p className="truncate text-body font-medium">{display.title}</p>
      </div>
      {display.fields.map((field) => (
        <span key={field.id} className="truncate text-small text-text-secondary sm:w-32">
          {field.value}
        </span>
      ))}
    </div>
  );

  if (!databaseId) {
    return row;
  }

  return (
    <RecordDeleteHover
      databaseId={databaseId}
      recordId={rawRecord.id}
      recordTitle={display.title}
      className="border-b border-border last:border-b-0"
    >
      {row}
    </RecordDeleteHover>
  );
}

export function RecordList({
  records,
  rawRecords,
  properties = [],
  visiblePropertyIds,
  groupProperty,
  databaseId,
  onOpenRecord,
}: {
  records: DisplayRecord[];
  rawRecords?: RecordItem[];
  properties?: DatabasePropertyRow[];
  visiblePropertyIds?: string[];
  groupProperty?: DatabasePropertyRow | null;
  databaseId?: string | null;
  onOpenRecord?: (recordId: string) => void;
}) {
  if (!rawRecords && properties.length === 0) {
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

  const effectiveRawRecords =
    rawRecords ??
    records.map(
      (record) =>
        ({
          id: record.id,
          position: 0,
          createdAt: "",
          updatedAt: "",
          values: {} as Record<string, Json>,
        }) satisfies RecordItem,
    );
  const effectiveVisibleIds =
    visiblePropertyIds ??
    (properties.length > 0
      ? properties.map((property) => property.id)
      : []);


  const rawById = useMemo(
    () => new Map(effectiveRawRecords.map((record) => [record.id, record])),
    [effectiveRawRecords],
  );
  const primaryId = properties.find((property) => property.is_primary)?.id;
  const secondaryProperties = effectiveVisibleIds
    .filter((id) => id !== primaryId)
    .slice(0, 3)
    .map((id) => properties.find((property) => property.id === id))
    .filter((property): property is DatabasePropertyRow => Boolean(property));

  const rows = records.map((record) => {
    const raw =
      rawById.get(record.id) ??
      ({ id: record.id, position: 0, createdAt: "", updatedAt: "", values: {} as Record<string, Json> } satisfies RecordItem);
    return {
      record,
      raw,
      display: {
        title: record.title,
        fields: secondaryProperties.map((property) => ({
          id: property.id,
          value: formatPropertyValue(property, raw),
        })),
      },
    };
  });

  if (!groupProperty) {
    return (
      <div className="overflow-hidden rounded-card border border-border bg-surface-raised">
        {rows.map(({ record, raw, display }) => (
          <ListRow
            key={record.id}
            record={record}
            display={display}
            rawRecord={raw}
            databaseId={databaseId}
            onOpenRecord={onOpenRecord}
          />
        ))}
        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-small text-text-muted">No records match this view.</p>
        )}
      </div>
    );
  }

  const groupOptions =
    groupProperty.type === "select" ? selectOptions(groupProperty) : [];

  const grouped = groupIntoColumns(
    rows,
    (row) => {
      const value = row.raw.values[groupProperty.id];
      return typeof value === "string" ? value : null;
    },
    groupOptions,
  );

  return (
    <div className="flex flex-col gap-4">
      {grouped.map((group) => (
        <section key={group.key} className="overflow-hidden rounded-card border border-border bg-surface-raised">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-small font-medium">{group.label}</h2>
          </header>
          {group.items.map(({ record, raw, display }) => (
            <ListRow
              key={record.id}
              record={record}
              display={display}
              rawRecord={raw}
              databaseId={databaseId}
              onOpenRecord={onOpenRecord}
            />
          ))}
          {group.items.length === 0 && (
            <p className="px-4 py-6 text-center text-small text-text-muted">Nothing here</p>
          )}
        </section>
      ))}
    </div>
  );
}
