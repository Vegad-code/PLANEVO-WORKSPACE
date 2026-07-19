"use client";

import { createClient } from "@/utils/supabase/client";
import {
  MAX_PRODUCT_FILE_UPLOADS,
  PRODUCT_FILES_BUCKET,
  requireProductFileSize,
} from "@/lib/files/product-files";

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

  const client = createClient();
  let uploadedCount = 0;

  for (const file of files) {
    const target = await requestUploadTarget(file);
    try {
      const { error } = await client.storage
        .from(PRODUCT_FILES_BUCKET)
        .uploadToSignedUrl(target.path, target.token, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (error) throw error;
      await finalizeUpload(target.sourceId);
      uploadedCount += 1;
    } catch (cause) {
      await discardUpload(target.sourceId);
      throw cause instanceof Error
        ? cause
        : new Error(`Could not upload ${file.name}.`);
    }
  }

  return uploadedCount;
}
