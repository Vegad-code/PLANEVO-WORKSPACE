"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createDatabase } from "@planevo/core/mutations/create-database";
import type { DatabaseTemplateType } from "@planevo/core/types/property-types";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";

const TEMPLATE_TYPES: DatabaseTemplateType[] = [
  "task",
  "notes",
  "project",
  "files",
  "custom",
];

function isTemplateType(value: string): value is DatabaseTemplateType {
  return TEMPLATE_TYPES.includes(value as DatabaseTemplateType);
}

export async function createDatabaseFromTemplate(templateType: string): Promise<void> {
  if (!isTemplateType(templateType)) {
    throw new Error("Unknown database type.");
  }

  const current = await getCurrentWorkspace();
  if (!current) throw new Error("Workspace not found.");

  const result = await createDatabase(current.access.client, current.access.ownerId, {
    workspaceId: current.workspace.id,
    templateType,
  });

  revalidatePath("/", "layout");
  redirect(`/databases/${result.databaseId}`);
}
