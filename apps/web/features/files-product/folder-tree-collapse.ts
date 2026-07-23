import type { FolderTreeItem } from "./kb-contracts";

export const FILES_FOLDER_COLLAPSE_KEY = "planevo:files:folder-collapsed";

/** True when this row has at least one direct child in the DFS-ordered list. */
export function folderHasChildren(
  folders: FolderTreeItem[],
  index: number,
): boolean {
  const next = folders[index + 1];
  return Boolean(next && next.depth === folders[index]!.depth + 1);
}

/**
 * True when any ancestor folder is collapsed — the row should not render.
 * Walks backward through the DFS list to find parents by depth.
 */
export function isHiddenByCollapsedAncestor(
  folders: FolderTreeItem[],
  index: number,
  collapsedIds: ReadonlySet<string>,
): boolean {
  let targetDepth = folders[index]!.depth;
  if (targetDepth === 0) return false;

  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = folders[i]!;
    if (candidate.depth !== targetDepth - 1) continue;
    if (collapsedIds.has(candidate.id)) return true;
    targetDepth = candidate.depth;
    if (targetDepth === 0) return false;
  }

  return false;
}

/** Visible rows after applying collapse — keeps original DFS index for connectors. */
export function visibleFolderEntries(
  folders: FolderTreeItem[],
  collapsedIds: ReadonlySet<string>,
): Array<{ folder: FolderTreeItem; index: number }> {
  const entries: Array<{ folder: FolderTreeItem; index: number }> = [];
  for (let index = 0; index < folders.length; index += 1) {
    if (isHiddenByCollapsedAncestor(folders, index, collapsedIds)) continue;
    entries.push({ folder: folders[index]!, index });
  }
  return entries;
}

/** Ancestor ids from root → parent for a folder id (empty when root or missing). */
export function folderAncestorIds(
  folders: FolderTreeItem[],
  folderId: string,
): string[] {
  const index = folders.findIndex((folder) => folder.id === folderId);
  if (index < 0) return [];

  const ancestors: string[] = [];
  let targetDepth = folders[index]!.depth;
  for (let i = index - 1; i >= 0 && targetDepth > 0; i -= 1) {
    const candidate = folders[i]!;
    if (candidate.depth !== targetDepth - 1) continue;
    ancestors.push(candidate.id);
    targetDepth = candidate.depth;
  }
  return ancestors.reverse();
}

export function getCollapsedFolderIds(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const raw = window.localStorage.getItem(FILES_FOLDER_COLLAPSE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is string => typeof id === "string" && id.length > 0),
    );
  } catch {
    return new Set();
  }
}

export function setCollapsedFolderIds(ids: ReadonlySet<string>): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      FILES_FOLDER_COLLAPSE_KEY,
      JSON.stringify([...ids]),
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
