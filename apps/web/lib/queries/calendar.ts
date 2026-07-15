import { cache } from "react";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import type { Json } from "@/lib/database.types";

export type CalendarItem = {
  id: string;
  title: string;
  date: string;
  databaseName: string;
};

export type CalendarData = {
  status: "ready" | "empty" | "unavailable";
  workspaceId: string | null;
  hasCalendarDatabase: boolean;
  items: CalendarItem[];
};

function stringValue(value: Json | undefined): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function loadCalendarData(): Promise<CalendarData> {
  const current = await getCurrentWorkspace();
  if (!current) {
    return { status: "unavailable", workspaceId: null, hasCalendarDatabase: false, items: [] };
  }
  const { access, workspace } = current;

  const { data: databases, error: databaseError } = await access.client
    .from("databases")
    .select("id,name,template_type")
    .eq("workspace_id", workspace.id);
  if (databaseError) throw databaseError;

  const databaseRows = databases ?? [];
  if (!databaseRows.length) {
    return {
      status: "empty",
      workspaceId: workspace.id,
      hasCalendarDatabase: false,
      items: [],
    };
  }

  const databaseNames = new Map(databaseRows.map((database) => [database.id, database.name]));
  const databaseIds = databaseRows.map((database) => database.id);
  const [{ data: properties, error: propertyError }, { data: records, error: recordError }] =
    await Promise.all([
      access.client
        .from("database_properties")
        .select("id,database_id,name,type,is_primary")
        .in("database_id", databaseIds),
      access.client.from("records").select("id,database_id").in("database_id", databaseIds),
    ]);
  if (propertyError) throw propertyError;
  if (recordError) throw recordError;

  const recordRows = records ?? [];
  if (!recordRows.length) {
    return {
      status: "ready",
      workspaceId: workspace.id,
      hasCalendarDatabase: databaseRows.some((database) => database.template_type === "calendar"),
      items: [],
    };
  }

  const propertyRows = properties ?? [];
  const propertyById = new Map(propertyRows.map((property) => [property.id, property]));
  const { data: values, error: valueError } = await access.client
    .from("record_values")
    .select("record_id,property_id,value_json")
    .in("record_id", recordRows.map((record) => record.id));
  if (valueError) throw valueError;

  const valuesByRecord = new Map<string, Map<string, Json>>();
  for (const value of values ?? []) {
    const property = propertyById.get(value.property_id);
    if (!property) continue;
    const row = valuesByRecord.get(value.record_id) ?? new Map<string, Json>();
    row.set(property.id, value.value_json);
    valuesByRecord.set(value.record_id, row);
  }

  const items: CalendarItem[] = [];
  for (const record of recordRows) {
    const recordValues = valuesByRecord.get(record.id);
    if (!recordValues) continue;
    const databaseProperties = propertyRows.filter(
      (property) => property.database_id === record.database_id,
    );
    const titleProperty = databaseProperties.find((property) => property.is_primary);
    const dateProperties = databaseProperties.filter((property) => property.type === "date");
    const title = titleProperty
      ? stringValue(recordValues.get(titleProperty.id)) ?? "Untitled"
      : "Untitled";

    for (const dateProperty of dateProperties) {
      const date = stringValue(recordValues.get(dateProperty.id));
      if (!date || Number.isNaN(Date.parse(date))) continue;
      items.push({
        id: `${record.id}:${dateProperty.id}`,
        title,
        date,
        databaseName: databaseNames.get(record.database_id) ?? "Workspace",
      });
    }
  }

  return {
    status: "ready",
    workspaceId: workspace.id,
    hasCalendarDatabase: databaseRows.some((database) => database.template_type === "calendar"),
    items,
  };
}

// Errors intentionally propagate to the route error boundary — a failed load
// must never render as an empty calendar. "unavailable" = unauthenticated only.
export const getCalendarData = cache(loadCalendarData);
