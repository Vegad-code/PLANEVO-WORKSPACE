import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PRODUCT_FILES_BUCKET,
  requireProductFileSize,
} from "@/lib/files/product-files";
import { enforceStorageQuota } from "@/lib/files/storage-quota.server";
import { requireMutationDataAccess } from "@/lib/data/access";
import {
  enforceRateLimit,
  RATE_LIMITS,
} from "@/lib/security/rate-limit.server";

const targetSchema = z.object({
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().max(255).nullable(),
  sizeBytes: z.number().int().nonnegative(),
});

const pathSchema = z.object({
  path: z.string().min(1).max(1024),
  sizeBytes: z.number().int().nonnegative(),
});

function cleanFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "file";
}

async function ownedLocalSource(
  fileSourceId: string,
  ownerId: string,
  client: Awaited<ReturnType<typeof requireMutationDataAccess>>["client"],
) {
  const { data, error } = await client
    .from("file_sources")
    .select("id,workspace_id,storage_kind")
    .eq("id", fileSourceId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data?.storage_kind === "local" ? data : null;
}

function expectedPrefix(workspaceId: string, fileSourceId: string): string {
  return `${workspaceId}/synced-${fileSourceId}-`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ fileSourceId: string }> },
) {
  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(access, "product-files:sync", RATE_LIMITS.upload);
    const parsed = targetSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid local file." }, { status: 400 });
    }
    requireProductFileSize(parsed.data.sizeBytes);
    await enforceStorageQuota(access, parsed.data.sizeBytes);
    const { fileSourceId } = await context.params;
    const source = await ownedLocalSource(
      fileSourceId,
      access.ownerId,
      access.client,
    );
    if (!source) {
      return NextResponse.json(
        { error: "This file is not local-only." },
        { status: 409 },
      );
    }
    const path = `${expectedPrefix(source.workspace_id, fileSourceId)}${randomUUID()}-${cleanFileName(parsed.data.name)}`;
    const { data, error } = await access.client.storage
      .from(PRODUCT_FILES_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !data?.path || !data.token) {
      throw error ?? new Error("Signed upload target was incomplete.");
    }
    return NextResponse.json({ path: data.path, token: data.token });
  } catch {
    return NextResponse.json(
      { error: "Could not prepare local file sync." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ fileSourceId: string }> },
) {
  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(access, "product-files:sync-finish", RATE_LIMITS.mutate);
    const parsed = pathSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid sync target." }, { status: 400 });
    }
    const { fileSourceId } = await context.params;
    const source = await ownedLocalSource(
      fileSourceId,
      access.ownerId,
      access.client,
    );
    if (
      !source ||
      !parsed.data.path.startsWith(
        expectedPrefix(source.workspace_id, fileSourceId),
      )
    ) {
      return NextResponse.json({ error: "Sync target mismatch." }, { status: 409 });
    }
    const { data, error } = await access.client
      .from("file_sources")
      .update({
        storage_path: parsed.data.path,
        storage_kind: "synced",
        size_bytes: parsed.data.sizeBytes,
        ingestion_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", fileSourceId)
      .eq("user_id", access.ownerId)
      .eq("storage_kind", "local")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "The file changed before sync completed." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "The upload finished but sync could not be enabled." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ fileSourceId: string }> },
) {
  try {
    const access = await requireMutationDataAccess();
    const parsed = z
      .object({ path: z.string().min(1).max(1024) })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid sync target." }, { status: 400 });
    }
    const { fileSourceId } = await context.params;
    const source = await ownedLocalSource(
      fileSourceId,
      access.ownerId,
      access.client,
    );
    if (
      !source ||
      !parsed.data.path.startsWith(
        expectedPrefix(source.workspace_id, fileSourceId),
      )
    ) {
      return NextResponse.json({ error: "Sync target mismatch." }, { status: 409 });
    }
    await access.client.storage
      .from(PRODUCT_FILES_BUCKET)
      .remove([parsed.data.path]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not discard sync upload." }, { status: 500 });
  }
}
