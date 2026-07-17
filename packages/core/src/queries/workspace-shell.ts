import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataAccess } from "../types/data-access";
import type { Database, PageRow, WorkspaceRow } from "../types/database.types";

export type PageTreeItem = {
  id: string;
  label: string;
  depth: number;
  parentPageId: string | null;
  position: number;
};

export type WorkspaceShellStatus = "ready" | "empty" | "unavailable";

export type WorkspaceSummary = Pick<WorkspaceRow, "id" | "name" | "icon">;

export type WorkspaceShellData = {
  status: WorkspaceShellStatus;
  workspace: WorkspaceRow | null;
  workspaces: WorkspaceSummary[];
  pages: PageTreeItem[];
  userDisplayName: string | null;
  userInitials: string | null;
  userEmail: string | null;
  /** Owner-only V1 workspaces report a single member until team seats ship. */
  memberCount: number;
};

export type WorkspaceShellRepository = {
  listWorkspaces(ownerId: string): Promise<WorkspaceRow[]>;
  listPages(workspaceId: string): Promise<PageRow[]>;
  getUser(): Promise<{
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null>;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function displayNameFromUser(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}): string | null {
  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();

  const emailName = user.email?.split("@")[0]?.trim();
  return emailName || null;
}

function buildPageTree(pages: PageRow[]): PageTreeItem[] {
  const activePages = pages.filter((page) => !page.is_archived);
  const byId = new Map(activePages.map((page) => [page.id, page]));
  const childrenByParent = new Map<string | null, PageRow[]>();

  for (const page of activePages) {
    const parentId =
      page.parent_page_id && byId.has(page.parent_page_id)
        ? page.parent_page_id
        : null;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(page);
    childrenByParent.set(parentId, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort(
      (left, right) =>
        left.position - right.position || left.title.localeCompare(right.title),
    );
  }

  const tree: PageTreeItem[] = [];
  const visited = new Set<string>();

  function visit(page: PageRow, depth: number) {
    if (visited.has(page.id)) return;
    visited.add(page.id);
    tree.push({
      id: page.id,
      label: page.title,
      depth,
      parentPageId: page.parent_page_id,
      position: page.position,
    });

    for (const child of childrenByParent.get(page.id) ?? []) {
      visit(child, depth + 1);
    }
  }

  for (const rootPage of childrenByParent.get(null) ?? []) {
    visit(rootPage, 0);
  }

  for (const page of activePages) {
    visit(page, 0);
  }

  return tree;
}

export async function listPagesForWorkspace(
  client: SupabaseClient<Database>,
  workspaceId: string,
): Promise<PageRow[]> {
  const { data, error } = await client
    .from("pages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export function createWorkspaceShellRepository(
  client: SupabaseClient<Database>,
): WorkspaceShellRepository {
  return {
    async listWorkspaces(ownerId) {
      const { data, error } = await client
        .from("workspaces")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    listPages(workspaceId) {
      return listPagesForWorkspace(client, workspaceId);
    },
    async getUser() {
      const {
        data: { user },
        error,
      } = await client.auth.getUser();

      if (error) throw error;
      return user;
    },
  };
}

export async function loadWorkspaceShellData(
  access: DataAccess | null,
  repository: WorkspaceShellRepository | null,
  preferredWorkspaceId: string | null = null,
): Promise<WorkspaceShellData> {
  if (!access || !repository) {
    return {
      status: "unavailable",
      workspace: null,
      workspaces: [],
      pages: [],
      userDisplayName: null,
      userInitials: null,
      userEmail: null,
      memberCount: 0,
    };
  }

  const allWorkspaces = await repository.listWorkspaces(access.ownerId);
  const workspace =
    allWorkspaces.find((candidate) => candidate.id === preferredWorkspaceId) ??
    allWorkspaces[0];
  const workspaces = allWorkspaces.map(({ id, name, icon }) => ({ id, name, icon }));
  if (!workspace) {
    return {
      status: "empty",
      workspace: null,
      workspaces: [],
      pages: [],
      userDisplayName: null,
      userInitials: null,
      userEmail: null,
      memberCount: 0,
    };
  }

  const pageRows = await repository.listPages(workspace.id);
  const user = access.mode === "auth" ? await repository.getUser() : null;
  const userDisplayName = user ? displayNameFromUser(user) : null;
  const userEmail = user?.email?.trim() || null;

  return {
    status: "ready",
    workspace,
    workspaces,
    pages: buildPageTree(pageRows),
    userDisplayName,
    userInitials: userDisplayName ? initialsFromName(userDisplayName) : null,
    userEmail,
    memberCount: 1,
  };
}
