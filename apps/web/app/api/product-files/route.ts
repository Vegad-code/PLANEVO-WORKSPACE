import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createFileSourceRecord } from "@planevo/core/mutations/product-files";
import { deleteFileSource } from "@planevo/core/mutations/product-files";
import { requireMutationDataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import {
  MAX_PRODUCT_FILE_BYTES,
  PRODUCT_FILES_BUCKET,
  requireProductFileSize,
} from "@/lib/files/product-files";

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

    const storagePath = `${current.workspace.id}/${randomUUID()}-${cleanFileName(parsed.data.name)}`;
    const source = await createFileSourceRecord(access.client, access.ownerId, {
      workspaceId: current.workspace.id,
      storagePath,
      name: parsed.data.name,
      mimeType: parsed.data.mimeType || null,
      sizeBytes: parsed.data.sizeBytes,
      operationKey: parsed.data.operationKey,
    });

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
    return routeError(cause, "Could not prepare the file upload.");
  }
}

/** Mark an uploaded file ready once its bytes are in storage. */
export async function PATCH(request: Request) {
  try {
    const access = await requireMutationDataAccess();
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

    return NextResponse.json({ ok: true });
  } catch (cause) {
    return routeError(cause, "Could not finish the file upload.");
  }
}

/** Remove the metadata row and storage object for a failed upload. */
export async function DELETE(request: Request) {
  try {
    const access = await requireMutationDataAccess();
    const parsed = discardSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload cleanup." }, { status: 400 });
    }

    const { storagePath } = await deleteFileSource(
      access.client,
      access.ownerId,
      parsed.data.sourceId,
    );
    const { error } = await access.client.storage
      .from(PRODUCT_FILES_BUCKET)
      .remove([storagePath]);
    // A missing object is fine — the upload may never have finished.
    if (error) console.error("[product-files] storage cleanup failed", error);

    return NextResponse.json({ ok: true });
  } catch (cause) {
    return routeError(cause, "Could not clean up the file upload.");
  }
}
