import type { DatabasePropertyRow, Json } from "../types/database.types";
import { findPropertyByRole, type PropertyRole } from "../types/property-roles";
import type { RecordItem } from "./records";

/** A record projected through its property ROLES — rename-proof. */
export type DisplayRecord = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  estimateMinutes: number | null;
  tags: string[];
};

function textValue(value: Json | undefined): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: Json | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringList(value: Json | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function roleValue(
  record: RecordItem,
  properties: DatabasePropertyRow[],
  role: PropertyRole,
): Json | undefined {
  const property = findPropertyByRole(properties, role);
  return property ? record.values[property.id] : undefined;
}

export function toDisplayRecord(
  record: RecordItem,
  properties: DatabasePropertyRow[],
): DisplayRecord {
  return {
    id: record.id,
    title: textValue(roleValue(record, properties, "title")) ?? "Untitled",
    description: textValue(roleValue(record, properties, "description")),
    status: textValue(roleValue(record, properties, "status")),
    priority: textValue(roleValue(record, properties, "priority")),
    dueDate:
      textValue(roleValue(record, properties, "due_date")) ??
      textValue(roleValue(record, properties, "event_date")),
    estimateMinutes: numberValue(roleValue(record, properties, "estimate")),
    tags: stringList(roleValue(record, properties, "tags")),
  };
}
