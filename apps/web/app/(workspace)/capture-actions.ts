"use server";

import { revalidatePath } from "next/cache";
import { parseQuickCapture } from "@planevo/core/parsing/natural-capture";
import { fuzzyMatch } from "@planevo/core/search/fuzzy";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { findPropertyByRole } from "@planevo/core/types/property-roles";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { requireMutationDataAccess } from "@/lib/data/access";
import { createTaskWithRequiredFoundation } from "@/lib/mutations/create-foundations";

export type QuickCaptureResult = {
  id: string;
  databaseName: string;
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

  return { id: record.id, databaseName: bundle.database.name };
}

async function resolveTargetDatabase(
  client: Awaited<ReturnType<typeof requireMutationDataAccess>>["client"],
  workspaceId: string,
  databaseToken: string | null,
): Promise<{ id: string; name: string; templateType: string }> {
  const { data: databases, error } = await client
    .from("databases")
    .select("id,name,template_type")
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  const rows = databases ?? [];
  if (rows.length === 0) throw new Error("No databases in this workspace.");

  if (databaseToken) {
    const scored = rows
      .map((database) => ({
        database,
        match: fuzzyMatch(databaseToken, database.name),
      }))
      .filter((row): row is { database: (typeof rows)[number]; match: NonNullable<ReturnType<typeof fuzzyMatch>> } =>
        row.match !== null,
      )
      .sort((a, b) => b.match.score - a.match.score);
    if (scored[0]) {
      return {
        id: scored[0].database.id,
        name: scored[0].database.name,
        templateType: scored[0].database.template_type,
      };
    }
    throw new Error(`No database matches "${databaseToken}".`);
  }

  const taskDatabase =
    rows.find((database) => database.template_type === "task") ?? rows[0]!;
  return {
    id: taskDatabase.id,
    name: taskDatabase.name,
    templateType: taskDatabase.template_type,
  };
}

export async function quickCapture(raw: string): Promise<QuickCaptureResult> {
  const draft = parseQuickCapture(raw);
  const title = draft.title.trim();
  if (!title) throw new Error("Add a title before capturing.");

  const access = await requireMutationDataAccess();
  const current = await getCurrentWorkspace();
  if (!current) throw new Error("Workspace not found.");

  const target = await resolveTargetDatabase(
    access.client,
    current.workspace.id,
    draft.databaseToken,
  );

  let result: QuickCaptureResult;

  if (target.templateType === "task") {
    const created = await createTaskWithRequiredFoundation({
      workspaceId: current.workspace.id,
      title,
      priority: draft.priority ?? undefined,
      dueDate: mergeDueDateTime(draft.dueDate, draft.time),
      status: draft.status ?? undefined,
    });
    result = { id: created.recordId, databaseName: target.name };
  } else {
    result = await createRecordInDatabase(access, target.id, draft);
  }

  revalidatePath("/", "layout");
  revalidatePath("/tasks");
  revalidatePath(`/databases/${target.id}`);
  return result;
}

export async function undoQuickCapture(recordId: string): Promise<void> {
  const access = await requireMutationDataAccess();

  const { data: record, error: recordError } = await access.client
    .from("records")
    .select("id,database_id,databases!inner(workspace_id,workspaces!inner(owner_id))")
    .eq("id", recordId)
    .eq("databases.workspaces.owner_id", access.ownerId)
    .maybeSingle();
  if (recordError) throw recordError;
  if (!record) throw new Error("Record not found.");

  const { error } = await access.client.from("records").delete().eq("id", recordId);
  if (error) throw error;

  revalidatePath("/", "layout");
  revalidatePath("/tasks");
  revalidatePath(`/databases/${record.database_id}`);
}
