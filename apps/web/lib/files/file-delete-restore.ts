/**
 * Pure copy + list helpers for Files soft-delete / multi-delete UX.
 * Keep UI wording and restore eligibility decisions out of React leaves.
 */

export type FileDeleteListItem = {
  id: string;
  name: string;
};

/** Soft-deleted files stay restorable until purge_after (DB enforces). */
export const FILE_SOFT_DELETE_RESTORE_WINDOW_DAYS = 30;

export function shouldShowBulkDeleteFileList(count: number): boolean {
  return Number.isFinite(count) && count > 1;
}

export function formatBulkDeleteConfirmTitle(files: readonly FileDeleteListItem[]): string {
  if (files.length === 1) {
    const name = files[0]?.name?.trim() || "file";
    return `Delete “${name}”?`;
  }
  return `Delete ${files.length} files?`;
}

export function formatBulkDeleteConfirmBody(count: number): string {
  if (count <= 1) {
    return "Removes this file from your library. You can restore it from the toast that appears after.";
  }
  return "Removes the selected files from your library. You can restore them from the toast that appears after.";
}

export function formatBulkDeleteButtonLabel(input: {
  count: number;
  isDeleting: boolean;
  completed?: number;
}): string {
  if (input.isDeleting) {
    const total = Math.max(0, input.count);
    const completed = Math.max(0, Math.min(input.completed ?? 0, total));
    if (total <= 1) return "Deleting…";
    return `Deleting ${completed} of ${total}…`;
  }
  return input.count === 1 ? "Delete file" : "Delete files";
}

export function formatFilesDeletedToastMessage(count: number): string {
  if (count <= 0) return "Nothing deleted";
  if (count === 1) return "File deleted";
  return `${count} files deleted`;
}

export function formatFilesRestoredToastMessage(count: number): string {
  if (count <= 0) return "Nothing restored";
  if (count === 1) return "File restored";
  return `${count} files restored`;
}

/** Names shown in the confirm / in-flight disclosure, stable order. */
export function listBulkDeleteFileNames(
  files: readonly FileDeleteListItem[],
): string[] {
  return files.map((file) => {
    const name = file.name?.trim();
    return name && name.length > 0 ? name : "Untitled file";
  });
}

export function canRestoreSoftDeletedFile(input: {
  deletedAt: string | null | undefined;
  purgeAfter: string | null | undefined;
  nowMs?: number;
}): boolean {
  if (!input.deletedAt) return false;
  if (!input.purgeAfter) return true;
  const purgeMs = Date.parse(input.purgeAfter);
  if (!Number.isFinite(purgeMs)) return false;
  const now = input.nowMs ?? Date.now();
  return purgeMs > now;
}
