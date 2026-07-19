"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { parseQuickCapture } from "@planevo/core/parsing/natural-capture";
import { quickCaptureToTaskInsert } from "@planevo/core/parsing/quick-capture-to-task";
import { createTask, deleteTask } from "@planevo/core/mutations/product-tasks";
import { fuzzyMatch } from "@planevo/core/search/fuzzy";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { findPropertyByRole } from "@planevo/core/types/property-roles";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { requireMutationDataAccess } from "@/lib/data/access";

export type QuickCaptureResult = {
  id: string;
  databaseName: string;
  kind: "task" | "record";
};

function mergeDueDateTime(
  dueDate: string | null,
  time: { hour: number; minute: number } | null,
): string | null {
  if (!dueDate) return null;
  const merged = new Date(dueDate);
  if (time) merged.setHours(time.hour, time.minute, 0, 0);
  return merged.toISOString();
}

async function nextRecordPosition(
  client: Awaited<ReturnType<typeof requireMutationDataAccess>>["client"],
  databaseId: string,
): Promise<number> {
  const { data, error } = await client
    .from("records")
    .select("position")
    .eq("database_id", databaseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.position ?? -1) + 1;
}

async function writeRoleValue(
  client: Awaited<ReturnType<typeof requireMutationDataAccess>>["client"],
  recordId: string,
  propertyId: string,
  value: string,
): Promise<void> {
  const { error } = await client.from("record_values").upsert(
    {
      record_id: recordId,
      property_id: propertyId,
      value_json: value,
    },
    { onConflict: "record_id,property_id" },
  );
  if (error) throw error;
}

async function createRecordInDatabase(
  access: Awaited<ReturnType<typeof requireMutationDataAccess>>,
  databaseId: string,
  draft: ReturnType<typeof parseQuickCapture>,
): Promise<QuickCaptureResult> {
  const bundle = await loadDatabaseBundle(access.client, databaseId);
  if (!bundle) throw new Error("Database not found.");

  const titleProperty = findPropertyByRole(bundle.properties, "title");
  if (!titleProperty) throw new Error("Database is missing a title property.");

  const statusProperty = findPropertyByRole(bundle.properties, "status");
  const priorityProperty = findPropertyByRole(bundle.properties, "priority");
  const dueProperty = findPropertyByRole(bundle.properties, "due_date");

  const title = draft.title.trim();
  if (!title) throw new Error("Add a title before capturing.");

  const position = await nextRecordPosition(access.client, databaseId);
  const { data: record, error: recordError } = await access.client
    .from("records")
    .insert({
      database_id: databaseId,
      position,
      created_by: access.ownerId,
    })
    .select("id")
    .single();
  if (recordError) throw recordError;

  await writeRoleValue(access.client, record.id, titleProperty.id, title);
  if (draft.status && statusProperty) {
    await writeRoleValue(access.client, record.id, statusProperty.id, draft.status);
  }
  if (draft.priority && priorityProperty) {
    await writeRoleValue(access.client, record.id, priorityProperty.id, draft.priority);
  }
  const due = mergeDueDateTime(draft.dueDate, draft.time);
  if (due && dueProperty) {
    await writeRoleValue(access.client, record.id, dueProperty.id, due);
  }

  return { id: record.id, databaseName: bundle.database.name, kind: "record" };
}

async function resolveTargetDatabase(
  client: Awaited<ReturnType<typeof requireMutationDataAccess>>["client"],
  workspaceId: string,
  databaseToken: string,
): Promise<{ id: string; name: string }> {
  const { data: databases, error } = await client
    .from("databases")
    .select("id,name")
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  const rows = databases ?? [];
  if (rows.length === 0) throw new Error("No databases in this workspace.");

  const scored = rows
    .map((database) => ({
      database,
      match: fuzzyMatch(databaseToken, database.name),
    }))
    .filter(
      (row): row is { database: (typeof rows)[number]; match: NonNullable<ReturnType<typeof fuzzyMatch>> } =>
        row.match !== null,
    )
    .sort((a, b) => b.match.score - a.match.score);
  if (!scored[0]) throw new Error(`No database matches "${databaseToken}".`);

  return { id: scored[0].database.id, name: scored[0].database.name };
}

/**
 * F-15 quick capture. Default capture writes a real row in the `tasks` table
 * (the Tasks product), so it works with or without a workspace and never
 * touches the kernel. Only an explicit #database token routes into a
 * workspace database.
 */
export async function quickCapture(raw: string): Promise<QuickCaptureResult> {
  const draft = parseQuickCapture(raw);
  const title = draft.title.trim();
  if (!title) throw new Error("Add a title before capturing.");

  const access = await requireMutationDataAccess();

  if (!draft.databaseToken) {
    const payload = quickCaptureToTaskInsert(draft);
    const task = await createTask(access.client, access.ownerId, {
      ...payload,
      title,
      operationKey: randomUUID(),
    });
    revalidatePath("/", "layout");
    revalidatePath("/tasks");
    return { id: task.id, databaseName: "Tasks", kind: "task" };
  }

  const current = await getCurrentWorkspace();
  if (!current) throw new Error("Workspace not found.");

  const target = await resolveTargetDatabase(
    access.client,
    current.workspace.id,
    draft.databaseToken,
  );
  const result = await createRecordInDatabase(access, target.id, draft);

  revalidatePath("/", "layout");
  revalidatePath(`/databases/${target.id}`);
  return result;
}

export async function undoQuickCapture(
  id: string,
  kind: QuickCaptureResult["kind"] = "record",
): Promise<void> {
  const access = await requireMutationDataAccess();

  if (kind === "task") {
    await deleteTask(access.client, access.ownerId, id);
    revalidatePath("/", "layout");
    revalidatePath("/tasks");
    return;
  }

  const { data: record, error: recordError } = await access.client
    .from("records")
    .select("id,database_id,databases!inner(workspace_id,workspaces!inner(owner_id))")
    .eq("id", id)
    .eq("databases.workspaces.owner_id", access.ownerId)
    .maybeSingle();
  if (recordError) throw recordError;
  if (!record) throw new Error("Record not found.");

  const { error } = await access.client.from("records").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/", "layout");
  revalidatePath(`/databases/${record.database_id}`);
}
