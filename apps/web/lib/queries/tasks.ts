import { cache } from "react";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import type { Json } from "@/lib/database.types";

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  dueDate: string | null;
  estimateMinutes: number | null;
  tags: string[];
};

export type TasksData = {
  status: "ready" | "empty" | "unavailable";
  workspaceId: string | null;
  databaseId: string | null;
  tasks: TaskItem[];
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

export async function loadTasksData(): Promise<TasksData> {
  const current = await getCurrentWorkspace();
  if (!current) {
    return { status: "unavailable", workspaceId: null, databaseId: null, tasks: [] };
  }
  const { access, workspace } = current;

  const { data: taskDatabase, error: databaseError } = await access.client
    .from("databases")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("template_type", "task")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (databaseError) throw databaseError;
  if (!taskDatabase) {
    return {
      status: "empty",
      workspaceId: workspace.id,
      databaseId: null,
      tasks: [],
    };
  }

  const [{ data: properties, error: propertyError }, { data: records, error: recordError }] =
    await Promise.all([
      access.client
        .from("database_properties")
        .select("id,name")
        .eq("database_id", taskDatabase.id),
      access.client
        .from("records")
        .select("id,position")
        .eq("database_id", taskDatabase.id)
        .order("position", { ascending: true }),
    ]);

  if (propertyError) throw propertyError;
  if (recordError) throw recordError;
  if (!records?.length) {
    return {
      status: "ready",
      workspaceId: workspace.id,
      databaseId: taskDatabase.id,
      tasks: [],
    };
  }

  const propertyNames = new Map((properties ?? []).map((property) => [property.id, property.name]));
  const { data: values, error: valuesError } = await access.client
    .from("record_values")
    .select("record_id,property_id,value_json")
    .in("record_id", records.map((record) => record.id));

  if (valuesError) throw valuesError;

  const valuesByRecord = new Map<string, Map<string, Json>>();
  for (const value of values ?? []) {
    const propertyName = propertyNames.get(value.property_id);
    if (!propertyName) continue;
    const recordValues = valuesByRecord.get(value.record_id) ?? new Map<string, Json>();
    recordValues.set(propertyName, value.value_json);
    valuesByRecord.set(value.record_id, recordValues);
  }

  return {
    status: "ready",
    workspaceId: workspace.id,
    databaseId: taskDatabase.id,
    tasks: records.map((record) => {
      const taskValues = valuesByRecord.get(record.id);
      return {
        id: record.id,
        title: textValue(taskValues?.get("Task")) ?? "Untitled task",
        description: textValue(taskValues?.get("Description")),
        status: textValue(taskValues?.get("Status")) ?? "To do",
        priority: textValue(taskValues?.get("Priority")),
        dueDate: textValue(taskValues?.get("Due date")),
        estimateMinutes: numberValue(taskValues?.get("Estimate")),
        tags: stringList(taskValues?.get("Tags")),
      };
    }),
  };
}

// Errors intentionally propagate to the route error boundary — a failed load
// must never render as an empty workspace. "unavailable" = unauthenticated only.
export const getTasksData = cache(loadTasksData);
