import { cache } from "react";
import {
  createWorkspaceShellRepository,
  loadWorkspaceShellData,
  type WorkspaceShellData,
} from "@planevo/core/queries/workspace-shell";

export * from "@planevo/core/queries/workspace-shell";

export const getWorkspaceShellData = cache(async (): Promise<WorkspaceShellData> => {
  const { getDataAccess } = await import("@/lib/data/access");
  const { getPreferredWorkspaceId } = await import("@/lib/data/current-workspace");
  const access = await getDataAccess();
  const repository = access
    ? createWorkspaceShellRepository(access.client)
    : null;

  return loadWorkspaceShellData(
    access,
    repository,
    access ? await getPreferredWorkspaceId() : null,
  );
});
