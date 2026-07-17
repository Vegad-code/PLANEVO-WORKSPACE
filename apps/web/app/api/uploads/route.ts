import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireDataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";

const BUCKET = "page-assets";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7; // 7 days — private bucket

function cleanFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned || "upload";
}

/**
 * Upload a file into the private `page-assets` bucket under `{owner_id}/...`.
 * Returns a signed URL the editor can embed. Optionally registers a Files row
 * when a workspace is available.
 */
export async function POST(request: Request) {
  try {
    const access = await requireDataAccess();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Files must be 10 MB or smaller." },
        { status: 400 },
      );
    }

    const storagePath = `${access.ownerId}/${randomUUID()}-${cleanFileName(file.name)}`;
    const payload = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";

    const { error: uploadError } = await access.client.storage
      .from(BUCKET)
      .upload(storagePath, payload, { contentType, upsert: false });
    if (uploadError) throw uploadError;

    const { data: signed, error: signedError } = await access.client.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
    if (signedError) throw signedError;
    if (!signed?.signedUrl) {
      return NextResponse.json({ error: "Could not create a file URL." }, { status: 500 });
    }

    // Best-effort Files-database registration — skip quietly if no workspace.
    try {
      const current = await getCurrentWorkspace();
      if (current) {
        const { error: rowError } = await access.client.from("file_sources").insert({
          workspace_id: current.workspace.id,
          created_by: access.ownerId,
          storage_path: `${BUCKET}:${storagePath}`,
          name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          ingestion_status: "ready",
          metadata_json: { bucket: BUCKET, path: storagePath, source: "page-upload" },
        });
        if (rowError) {
          console.warn("[uploads] file_sources insert skipped:", rowError.message);
        }
      }
    } catch (cause) {
      console.warn(
        "[uploads] file_sources registration skipped:",
        cause instanceof Error ? cause.message : cause,
      );
    }

    return NextResponse.json({
      url: signed.signedUrl,
      path: storagePath,
      name: file.name,
      mimeType: contentType,
      sizeBytes: file.size,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Upload failed.";
    const status = message.startsWith("No data access") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Refresh a signed URL for a previously uploaded page-asset path. */
export async function GET(request: Request) {
  try {
    const access = await requireDataAccess();
    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    if (!path) {
      return NextResponse.json({ error: "Missing path." }, { status: 400 });
    }

    // Path must stay under the caller's folder.
    if (!path.startsWith(`${access.ownerId}/`)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const { data: signed, error } = await access.client.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_SECONDS);
    if (error) throw error;
    if (!signed?.signedUrl) {
      return NextResponse.json({ error: "Could not create a file URL." }, { status: 500 });
    }

    return NextResponse.json({ url: signed.signedUrl });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed to resolve file URL.";
    const status = message.startsWith("No data access") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
