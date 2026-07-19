"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMutationDataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import {
  createDocumentPage,
  createWorkspace,
} from "@/lib/mutations/create-foundations";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function cleanFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned || "upload";
}

// Resolved server-side only — a client-supplied workspace id is never trusted.
async function resolveWorkspaceId(): Promise<string> {
  const current = await getCurrentWorkspace();
  if (current) return current.workspace.id;
  return (await createWorkspace({ name: "My workspace" })).workspaceId;
}

export async function uploadWorkspaceFile(formData: FormData): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Files must be 25 MB or smaller.");

  const workspaceId = await resolveWorkspaceId();
  const access = await requireMutationDataAccess();
  const storagePath = `${workspaceId}/${randomUUID()}-${cleanFileName(file.name)}`;
  const payload = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await access.client.storage
    .from("workspace-files")
    .upload(storagePath, payload, { contentType: file.type || undefined, upsert: false });
  if (uploadError) throw uploadError;

  const { error: rowError } = await access.client.from("file_sources").insert({
    workspace_id: workspaceId,
    created_by: access.ownerId,
    user_id: access.ownerId,
    storage_path: storagePath,
    name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    ingestion_status: "pending",
  });
  if (rowError) {
    await access.client.storage.from("workspace-files").remove([storagePath]);
    throw rowError;
  }

  revalidatePath("/files");
  redirect("/files");
}

export async function createPlanevoDocument(formData: FormData): Promise<void> {
  const workspaceId = await resolveWorkspaceId();
  const titleValue = formData.get("title");
  const title = typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : "Untitled";
  const access = await requireMutationDataAccess();
  const document = await createDocumentPage({ workspaceId, title });
  const { error } = await access.client.from("file_sources").insert({
    workspace_id: workspaceId,
    page_id: document.pageId,
    created_by: access.ownerId,
    user_id: access.ownerId,
    storage_path: `page:${document.pageId}`,
    name: title,
    mime_type: "application/x-planevo-page",
    ingestion_status: "ready",
  });
  if (error) throw error;

  revalidatePath("/files");
  revalidatePath("/", "layout");
  redirect("/files");
}
