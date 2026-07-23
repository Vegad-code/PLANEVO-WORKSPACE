import { mimeFamily, type MimeFamily } from "@planevo/core/types/files";

export type StorageCategoryId = MimeFamily;

export type StorageFileLike = {
  id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
};

export type StorageSegment = {
  id: StorageCategoryId;
  label: string;
  bytes: number;
  /** Tailwind bg utility mapped to files-storage-* tokens */
  swatchClass: string;
};

const CATEGORY_ORDER: StorageCategoryId[] = ["images", "pdfs", "documents"];

const CATEGORY_META: Record<
  StorageCategoryId,
  { label: string; swatchClass: string }
> = {
  images: { label: "Images", swatchClass: "bg-files-storage-images" },
  pdfs: { label: "PDFs", swatchClass: "bg-files-storage-pdfs" },
  documents: { label: "Documents", swatchClass: "bg-files-storage-documents" },
};

export function computeCategoryBytes(
  files: Pick<StorageFileLike, "mime_type" | "size_bytes">[],
): Record<StorageCategoryId, number> {
  const totals: Record<StorageCategoryId, number> = {
    images: 0,
    pdfs: 0,
    documents: 0,
  };

  for (const file of files) {
    const family = mimeFamily(file.mime_type);
    totals[family] += file.size_bytes ?? 0;
  }

  return totals;
}

/** Segments with bytes > 0, in fixed category order (Images → PDFs → Documents). */
export function buildStorageSegments(
  files: Pick<StorageFileLike, "mime_type" | "size_bytes">[],
): StorageSegment[] {
  const totals = computeCategoryBytes(files);
  return CATEGORY_ORDER.filter((id) => totals[id] > 0).map((id) => ({
    id,
    label: CATEGORY_META[id].label,
    bytes: totals[id],
    swatchClass: CATEGORY_META[id].swatchClass,
  }));
}

export function segmentPercentOfCap(bytes: number, capBytes: number): number {
  if (capBytes <= 0 || bytes <= 0) return 0;
  return Math.min((bytes / capBytes) * 100, 100);
}

/** Largest files first — for clear-storage review list. */
export function largestStorageFiles(
  files: StorageFileLike[],
  limit = 8,
): StorageFileLike[] {
  return [...files]
    .sort((left, right) => (right.size_bytes ?? 0) - (left.size_bytes ?? 0))
    .filter((file) => (file.size_bytes ?? 0) > 0)
    .slice(0, limit);
}

export function storageCategoryLabel(id: StorageCategoryId): string {
  return CATEGORY_META[id].label;
}

export function storageCategorySwatch(id: StorageCategoryId): string {
  return CATEGORY_META[id].swatchClass;
}
