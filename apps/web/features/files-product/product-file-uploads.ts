"use client";

import imageCompression from "browser-image-compression";
import { createClient } from "@/utils/supabase/client";
import {
  MAX_PRODUCT_FILE_UPLOADS,
  PRODUCT_FILES_BUCKET,
  requireProductFileSize,
} from "@/lib/files/product-files";
import { readLocalFile } from "./local-file-mirror";

// Only re-encode raster images that actually shrink. Already-compressed formats
// (PDF, video, Office/zip) and vector/animated images (SVG, GIF) are left alone.
const COMPRESSIBLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_COMPRESSION_THRESHOLD_BYTES = 1024 * 1024; // 1 MB — below this, not worth it.

/**
 * Client-side image processing: shrink large photos in the browser before they
 * upload, so stored bytes (and the storage meter / quota) reflect the smaller
 * size. Best-effort — any failure, or a result that isn't smaller, falls back to
 * the original bytes untouched.
 */
async function prepareForUpload(file: File): Promise<File> {
  if (
    !COMPRESSIBLE_IMAGE_TYPES.has(file.type) ||
    file.size <= IMAGE_COMPRESSION_THRESHOLD_BYTES
  ) {
    return file;
  }
  try {
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: 2560,
      maxSizeMB: 4,
      useWebWorker: true,
      fileType: file.type, // keep PNG transparency / original format
    });
    return compressed.size < file.size ? compressed : file;
  } catch {
    return file;
  }
}

type UploadTargetResponse = {
  sourceId?: string;
  path?: string;
  token?: string;
  error?: string;
};

async function requestUploadTarget(file: File): Promise<{
  sourceId: string;
  path: string;
  token: string;
}> {
  requireProductFileSize(file.size);
  const response = await fetch("/api/product-files", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      operationKey: crypto.randomUUID(),
    }),
  });
  const payload = (await response.json().catch(() => null)) as
    | UploadTargetResponse
    | null;
  if (!response.ok || !payload?.sourceId || !payload.path || !payload.token) {
    throw new Error(payload?.error ?? `Could not upload ${file.name}.`);
  }
  return { sourceId: payload.sourceId, path: payload.path, token: payload.token };
}

async function discardUpload(sourceId: string): Promise<void> {
  await fetch("/api/product-files", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sourceId }),
  });
}

async function finalizeUpload(sourceId: string): Promise<void> {
  const response = await fetch("/api/product-files", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sourceId }),
  });
  if (!response.ok) {
    throw new Error("The upload finished but could not be marked ready.");
  }
}

export async function uploadSingleProductFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  onProgress?.(8);
  requireProductFileSize(file.size);
  const prepared = await prepareForUpload(file);
  const target = await requestUploadTarget(prepared);
  onProgress?.(28);
  const client = createClient();
  try {
    const { error } = await client.storage
      .from(PRODUCT_FILES_BUCKET)
      .uploadToSignedUrl(target.path, target.token, prepared, {
        contentType: prepared.type || "application/octet-stream",
        upsert: false,
      });
    if (error) throw error;
    onProgress?.(78);
    await finalizeUpload(target.sourceId);
    onProgress?.(100);
  } catch (cause) {
    await discardUpload(target.sourceId);
    throw cause instanceof Error
      ? cause
      : new Error(`Could not upload ${file.name}.`);
  }
}

/**
 * Upload files for the Files product: reserve a signed target per file, push
 * bytes browser-to-storage, then mark the row ready. A failed file is cleaned
 * up and aborts the batch with its error.
 */
export async function uploadProductFiles(files: File[]): Promise<number> {
  if (files.length === 0) return 0;
  if (files.length > MAX_PRODUCT_FILE_UPLOADS) {
    throw new Error(`Upload up to ${MAX_PRODUCT_FILE_UPLOADS} files at a time.`);
  }

  let uploadedCount = 0;
  for (const file of files) {
    await uploadSingleProductFile(file);
    uploadedCount += 1;
  }

  return uploadedCount;
}

export async function syncLocalProductFile(
  fileSourceId: string,
): Promise<void> {
  const local = await readLocalFile(fileSourceId);
  if (local.state !== "available") {
    throw new Error(
      local.state === "permission-needed"
        ? `Reconnect ${local.name} before syncing.`
        : local.state === "missing"
          ? `${local.name} was moved or deleted.`
          : "This browser cannot reopen local files.",
    );
  }
  requireProductFileSize(local.file.size);
  const response = await fetch(`/api/product-files/${fileSourceId}/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: local.file.name,
      mimeType: local.file.type || null,
      sizeBytes: local.file.size,
    }),
  });
  const target = (await response.json().catch(() => null)) as
    | { path?: string; token?: string; error?: string }
    | null;
  if (!response.ok || !target?.path || !target.token) {
    throw new Error(target?.error ?? "Could not prepare local file sync.");
  }
  const client = createClient();
  const { error } = await client.storage
    .from(PRODUCT_FILES_BUCKET)
    .uploadToSignedUrl(target.path, target.token, local.file, {
      contentType: local.file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;
  const finalize = await fetch(`/api/product-files/${fileSourceId}/sync`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      path: target.path,
      sizeBytes: local.file.size,
    }),
  });
  if (!finalize.ok) {
    await fetch(`/api/product-files/${fileSourceId}/sync`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: target.path }),
    });
    const payload = (await finalize.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "Could not finish local file sync.");
  }
}
