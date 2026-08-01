import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

export type FolderTreeItem = {
  id: string;
  name: string;
  parentId: string | null;
  depth: number; // 0 for roots
  position: number;
  fileCount: number; // DIRECT files whose folder_id === this folder
};

type FolderRow = {
  id: string;
  parent_id: string | null;
  name: string;
  position: number;
};

/**
 * Flatten folders into pre-order DFS (a folder immediately precedes its
 * subtree); siblings ordered by position asc then name. Folders whose parent is
 * missing are treated as roots so nothing is dropped. Exported for unit tests
 * without a database round trip.
 */
export function buildFolderTree(
  folders: FolderRow[],
  fileCountByFolder: Map<string, number>,
): FolderTreeItem[] {
  const known = new Set(folders.map((folder) => folder.id));
  const childrenByParent = new Map<string | null, FolderRow[]>();
  for (const folder of folders) {
    const parentId =
      folder.parent_id && known.has(folder.parent_id) ? folder.parent_id : null;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(folder);
    childrenByParent.set(parentId, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort(
      (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    );
  }

  const tree: FolderTreeItem[] = [];
  const visited = new Set<string>();
  function visit(folder: FolderRow, depth: number) {
    if (visited.has(folder.id)) return; // defensive cycle guard
    visited.add(folder.id);
    tree.push({
      id: folder.id,
      name: folder.name,
      parentId: folder.parent_id,
      depth,
      position: folder.position,
      fileCount: fileCountByFolder.get(folder.id) ?? 0,
    });
    for (const child of childrenByParent.get(folder.id) ?? []) {
      visit(child, depth + 1);
    }
  }
  for (const root of childrenByParent.get(null) ?? []) visit(root, 0);
  return tree;
}

/**
 * A user's folder tree flattened pre-order for the knowledge-base sidebar, each
 * node carrying its direct file count.
 */
export async function loadFolderTree(
  client: SupabaseClient<Database>,
  ownerId: string,
): Promise<FolderTreeItem[]> {
  const { data: folders, error: foldersError } = await client
    .from("file_folders")
    .select("id, parent_id, name, position")
    .eq("user_id", ownerId);
  if (foldersError) throw foldersError;

  // ponytail: counts reduced in JS from a single cheap folder_id column pull, so
  // they stay accurate past any page cap. Upgrade path if this ever gets huge:
  // a SQL count(*) group-by folder_id RPC (one row per folder).
  const { data: files, error: filesError } = await client
    .from("file_sources")
    .select("folder_id")
    .eq("user_id", ownerId)
    .is("deleted_at", null);
  if (filesError) throw filesError;

  const fileCountByFolder = new Map<string, number>();
  for (const row of files ?? []) {
    const id = row.folder_id;
    if (id) fileCountByFolder.set(id, (fileCountByFolder.get(id) ?? 0) + 1);
  }

  return buildFolderTree((folders ?? []) as FolderRow[], fileCountByFolder);
}
