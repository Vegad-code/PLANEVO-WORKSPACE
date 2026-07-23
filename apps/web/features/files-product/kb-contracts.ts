import type { FolderTreeItem } from "@planevo/core/queries/file-folders";

export type { FolderTreeItem };

/**
 * Display info for the "Added by" column. Single-owner today, but shaped so PRD
 * integrations / multi-user contributors slot in later without a rewrite.
 */
export type OwnerDisplay = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

/** A distinct tag and how many files carry it (Tags tab). */
export type TagCount = { tag: string; count: number };

/**
 * Shared drag-and-drop id scheme for the Files Library. A single <DndContext>
 * lives in files-product-view: files are draggable, folders (tree rows + cards)
 * are drop targets. Ids are namespaced strings so onDragEnd routes by prefix.
 */
const FILE_DRAG_PREFIX = "kb-file:";
const FOLDER_DROP_PREFIX = "kb-folder:";

/** Drop target that removes a file from its folder (unfiled / root). */
export const ROOT_DROP_ID = `${FOLDER_DROP_PREFIX}__root__`;

export function fileDragId(fileId: string): string {
  return `${FILE_DRAG_PREFIX}${fileId}`;
}

export function folderDropId(folderId: string): string {
  return `${FOLDER_DROP_PREFIX}${folderId}`;
}

/** fileId if this id is a file drag id, else null. */
export function parseFileDragId(id: string): string | null {
  return id.startsWith(FILE_DRAG_PREFIX) ? id.slice(FILE_DRAG_PREFIX.length) : null;
}

/**
 * Resolve a droppable id to a folder target:
 *  - a folder id string for a real folder,
 *  - `null` for the root/unfiled target,
 *  - `undefined` if the id is not a folder drop target.
 */
export function parseFolderDropId(id: string): string | null | undefined {
  if (id === ROOT_DROP_ID) return null;
  if (id.startsWith(FOLDER_DROP_PREFIX)) return id.slice(FOLDER_DROP_PREFIX.length);
  return undefined;
}
