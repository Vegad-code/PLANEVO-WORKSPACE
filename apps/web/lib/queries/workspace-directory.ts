import { cache } from "react";
import { getDataAccess } from "@/lib/data/access";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";

export type WorkspaceDirectoryDatabase = {
  id: string;
  name: string;
  templateType: string;
};

export type WorkspaceDirectory = {
  databases: WorkspaceDirectoryDatabase[];
};

async function loadWorkspaceDirectory(
  shell: WorkspaceShellData,
): Promise<WorkspaceDirectory> {
  if (!shell.workspace) return { databases: [] };
  const access = await getDataAccess();
  if (!access) return { databases: [] };

  const { data, error } = await access.client
    .from("databases")
    .select("id,name,template_type")
    .eq("workspace_id", shell.workspace.id)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return {
    databases: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      templateType: row.template_type,
    })),
  };
}

export const getWorkspaceDirectory = cache(loadWorkspaceDirectory);
