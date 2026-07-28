import type { Database } from "./database.types";

export type FileSourceRow = Database["public"]["Tables"]["file_sources"]["Row"];
export type FileStorageKind = FileSourceRow["storage_kind"];
export type LocalFileAvailability =
  | "available"
  | "permission-needed"
  | "missing"
  | "unsupported";

export const FILE_FILTER_TABS = ["all", "documents", "pdfs", "images"] as const;
export type FileFilterTab = (typeof FILE_FILTER_TABS)[number];

export type MimeFamily = "documents" | "pdfs" | "images";

export function mimeFamily(mimeType: string | null): MimeFamily {
  if (!mimeType) return "documents";
  if (mimeType.startsWith("image/")) return "images";
  if (mimeType === "application/pdf") return "pdfs";
  return "documents";
}

import { storageCapBytesForPlan } from "./plans.ts";

/** Default storage cap for the free plan (5 GB). */
export const STORAGE_CAP_BYTES = storageCapBytesForPlan("free");

export function matchesFileFilterTab(
  mimeType: string | null,
  tab: FileFilterTab,
): boolean {
  if (tab === "all") return true;
  return mimeFamily(mimeType) === tab;
}

export function isStarredFileMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  return (metadata as Record<string, unknown>).starred === true;
}

/**
 * Unclaimed task-attachment reservations are storage bookkeeping, not user
 * files — hide them everywhere (mirrors the Phase 2 web-side rule).
 */
export function isVisibleFileMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return true;
  }
  const value = metadata as Record<string, unknown>;
  const isRecoverableReservation =
    value.source_kind === "task-attachment" &&
    value.task_attachment_state !== "claimed";
  return !isRecoverableReservation;
}

/** User-assigned folder chip from metadata_json.folder; null when unfiled. */
export function fileFolder(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const folder = (metadata as Record<string, unknown>).folder;
  return typeof folder === "string" && folder.length > 0 ? folder : null;
}

/** User tags from metadata_json.tags; always an array. */
export function fileTags(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const tags = (metadata as Record<string, unknown>).tags;
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag): tag is string => typeof tag === "string");
}
