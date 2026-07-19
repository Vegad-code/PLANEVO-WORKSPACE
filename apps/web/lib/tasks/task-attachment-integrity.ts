import { MAX_TASK_ATTACHMENT_BYTES } from "./task-attachments.ts";

function metadataObject(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Attachment recovery metadata is invalid.");
  }
  return metadata as Record<string, unknown>;
}

/**
 * Validate byte counts at both the browser upload boundary and the Storage
 * verification boundary. Storage metadata is untrusted: absence, non-numeric
 * values, fractional bytes, non-positive values, and oversized values all fail
 * closed.
 */
export function requireTaskAttachmentSize(
  sizeBytes: unknown,
  expectedSizeBytes?: number,
): number {
  if (
    typeof sizeBytes !== "number" ||
    !Number.isFinite(sizeBytes) ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > MAX_TASK_ATTACHMENT_BYTES
  ) {
    throw new Error("Attachment is missing a valid size.");
  }

  if (expectedSizeBytes !== undefined && sizeBytes !== expectedSizeBytes) {
    throw new Error("Uploaded attachment size does not match its descriptor.");
  }

  return sizeBytes;
}

export function requireTaskAttachmentCleanupCandidate(
  metadata: unknown,
): Record<string, unknown> {
  const value = metadataObject(metadata);
  if (value.source_kind !== "task-attachment") {
    throw new Error("Attachment source is not a task upload.");
  }
  if (value.task_attachment_state === "claimed") {
    throw new Error("A claimed attachment cannot be cleaned up.");
  }
  if (
    value.task_attachment_state !== "unclaimed" &&
    value.task_attachment_state !== "cleanup_pending"
  ) {
    throw new Error("Attachment recovery metadata is invalid.");
  }
  return value;
}
