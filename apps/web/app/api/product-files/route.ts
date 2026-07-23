import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createFileSourceRecord,
  deleteFileSource,
} from "@planevo/core/mutations/product-files";
import { linkResourceToWorkspace } from "@planevo/core/mutations/workspace-links";
import { mapTypedError } from "@/lib/api/typed-errors";
import { requireMutationDataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import {
  MAX_PRODUCT_FILE_BYTES,
  PRODUCT_FILES_BUCKET,
  requireProductFileSize,
} from "@/lib/files/product-files";
import { enforceStorageQuota } from "@/lib/files/storage-quota.server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit.server";

const uploadTargetSchema = z.object({
  operationKey: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().max(255),
  sizeBytes: z.number().finite().int().positive().max(MAX_PRODUCT_FILE_BYTES),
});

const finalizeSchema = z.object({
  sourceId: z.string().uuid(),
});

const discardSchema = z.object({
  sourceId: z.string().uuid(),
});

function cleanFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned || "upload";
}

async function linkUploadedFileToWorkspace(
  access: Awaited<ReturnType<typeof requireMutationDataAccess>>,
  workspaceId: string,
  fileSourceId: string,
): Promise<void> {
  await linkResourceToWorkspace(access.client, access.ownerId, {
    workspaceId,
    resourceType: "file",
    resourceId: fileSourceId,
  });
}

function routeError(cause: unknown, fallback: string) {
  const unauthenticated =
    cause instanceof Error && cause.message.startsWith("No mutation access");
  return NextResponse.json(
    { error: unauthenticated ? "Sign in to upload files." : fallback },
    { status: unauthenticated ? 401 : 500 },
  );
}

/**
 * Issue a signed-upload target for a Files product upload. Same
 * browser-to-storage shape as task attachments: bytes never transit a Server
 * Action, only the metadata row does.
 */
export async function POST(request: Request) {
  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(access, "product-files:post", RATE_LIMITS.upload);
    const current = await getCurrentWorkspace();
    if (!current || current.access.ownerId !== access.ownerId) {
      return NextResponse.json(
        { error: "Open a workspace before uploading files." },
        { status: 409 },
      );
    }

    const parsed = uploadTargetSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Choose a file that is 25 MB or smaller." },
        { status: 400 },
      );
    }
    requireProductFileSize(parsed.data.sizeBytes);
    await enforceStorageQuota(access, parsed.data.sizeBytes);

    const storagePath = `${current.workspace.id}/${randomUUID()}-${cleanFileName(parsed.data.name)}`;
    const source = await createFileSourceRecord(access.client, access.ownerId, {
      workspaceId: current.workspace.id,
      storagePath,
      name: parsed.data.name,
      mimeType: parsed.data.mimeType || null,
      sizeBytes: parsed.data.sizeBytes,
      operationKey: parsed.data.operationKey,
    });
    await linkUploadedFileToWorkspace(
      access,
      current.workspace.id,
      source.id,
    );

    const { data, error } = await access.client.storage
      .from(PRODUCT_FILES_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (error || !data?.path || !data.token) {
      await deleteFileSource(access.client, access.ownerId, source.id);
      throw error ?? new Error("Signed upload target was incomplete.");
    }

    return NextResponse.json({
      sourceId: source.id,
      path: data.path,
      token: data.token,
    });
  } catch (cause) {
    return mapTypedError(cause) ?? routeError(cause, "Could not prepare the file upload.");
  }
}

/** Mark an uploaded file ready once its bytes are in storage. */
export async function PATCH(request: Request) {
  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(access, "product-files:patch", RATE_LIMITS.mutate);
    const parsed = finalizeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
    }

    const { error } = await access.client
      .from("file_sources")
      .update({ ingestion_status: "ready", updated_at: new Date().toISOString() })
      .eq("id", parsed.data.sourceId)
      .eq("user_id", access.ownerId);
    if (error) throw error;

    const current = await getCurrentWorkspace();
    if (current && current.access.ownerId === access.ownerId) {
      await linkUploadedFileToWorkspace(
        access,
        current.workspace.id,
        parsed.data.sourceId,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (cause) {
    return mapTypedError(cause) ?? routeError(cause, "Could not finish the file upload.");
  }
}

/** Remove the storage object and metadata row for a failed upload. */
export async function DELETE(request: Request) {
  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(access, "product-files:delete", RATE_LIMITS.mutate);
    const parsed = discardSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload cleanup." }, { status: 400 });
    }

    // Storage first, then the row — mirroring the cabinet delete. A missing
    // object (upload never finished) is a no-op, but a real storage error keeps
    // the row so its bytes stay counted and retryable rather than orphaning a blob.
    const { data: row, error: lookupError } = await access.client
      .from("file_sources")
      .select("storage_path")
      .eq("id", parsed.data.sourceId)
      .eq("user_id", access.ownerId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!row) return NextResponse.json({ ok: true });

    const { error: removeError } = await access.client.storage
      .from(PRODUCT_FILES_BUCKET)
      .remove([row.storage_path]);
    if (removeError) throw removeError;

    await deleteFileSource(access.client, access.ownerId, parsed.data.sourceId);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return mapTypedError(cause) ?? routeError(cause, "Could not clean up the file upload.");
  }
}
