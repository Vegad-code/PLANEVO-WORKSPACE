import { cache } from "react";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";

export type FileSourceItem = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
  pageId: string | null;
  previewUrl: string | null;
};

export type FilesData = {
  status: "ready" | "empty" | "unavailable";
  workspaceId: string | null;
  files: FileSourceItem[];
};

export async function loadFilesData(): Promise<FilesData> {
  const current = await getCurrentWorkspace();
  if (!current) return { status: "unavailable", workspaceId: null, files: [] };
  const { access, workspace } = current;

  const { data: rows, error } = await access.client
    .from("file_sources")
    .select("id,name,mime_type,size_bytes,ingestion_status,created_at,page_id,storage_path")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const fileRows = rows ?? [];
  const storageRows = fileRows.filter((row) => !row.page_id);
  const signedUrls = new Map<string, string>();
  if (storageRows.length) {
    const { data: signed, error: signedError } = await access.client.storage
      .from("workspace-files")
      .createSignedUrls(storageRows.map((row) => row.storage_path), 900);
    if (!signedError) {
      signed?.forEach((result, index) => {
        if (result.signedUrl) signedUrls.set(storageRows[index]!.storage_path, result.signedUrl);
      });
    }
  }

  return {
    status: "ready",
    workspaceId: workspace.id,
    files: fileRows.map((row) => ({
      id: row.id,
      name: row.name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      status: row.ingestion_status,
      createdAt: row.created_at,
      pageId: row.page_id,
      previewUrl: row.page_id ? `/pages/${row.page_id}` : signedUrls.get(row.storage_path) ?? null,
    })),
  };
}

// Errors intentionally propagate to the route error boundary — a failed load
// must never render as an empty library. "unavailable" = unauthenticated only.
export const getFilesData = cache(loadFilesData);
