import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bootstrapDevWorkspace } from "@/lib/data/dev-workspace";
import { getDataAccess } from "@/lib/data/access";
import type { Database, PageRow, WorkspaceRow } from "@/lib/database.types";

export type PageTreeItem = {
  id: string;
  label: string;
  depth: number;
};

export type WorkspaceShellData = {
  dataSource: "database" | "fixture";
  workspace: WorkspaceRow | null;
  pages: PageTreeItem[];
  userDisplayName: string | null;
  userInitials: string | null;
};

const FIXTURE_PAGES: PageTreeItem[] = [
  { id: "fixture-physics", label: "Physics 2400", depth: 0 },
  { id: "fixture-lab", label: "Lab notes", depth: 1 },
  { id: "fixture-apps", label: "Apps tracker", depth: 0 },
  { id: "fixture-launch", label: "Launch checklist", depth: 1 },
  { id: "fixture-reading", label: "Reading list", depth: 0 },
];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function displayNameFromUser(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}): string {
  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  if (user.email) return user.email.split("@")[0] ?? "Account";
  return "Account";
}

function buildPageTree(pages: PageRow[]): PageTreeItem[] {
  const byId = new Map(pages.map((page) => [page.id, page]));

  function depthFor(pageId: string, seen = new Set<string>()): number {
    if (seen.has(pageId)) return 0;
    seen.add(pageId);
    const page = byId.get(pageId);
    if (!page?.parent_page_id) return 0;
    return 1 + depthFor(page.parent_page_id, seen);
  }

  return pages
    .filter((page) => !page.is_archived)
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
    .map((page) => ({
      id: page.id,
      label: page.title,
      depth: depthFor(page.id),
    }));
}

async function listWorkspaces(
  client: SupabaseClient<Database>,
  ownerId: string,
): Promise<WorkspaceRow[]> {
  const { data, error } = await client
    .from("workspaces")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
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

export async function getOrCreateDefaultWorkspace(
  client: SupabaseClient<Database>,
  ownerId: string,
): Promise<WorkspaceRow> {
  const workspaces = await listWorkspaces(client, ownerId);
  if (workspaces[0]) return workspaces[0];

  const insert: Database["public"]["Tables"]["workspaces"]["Insert"] = {
    owner_id: ownerId,
    name: "My workspace",
  };

  const { data: created, error: insertError } = await client
    .from("workspaces")
    .insert(insert)
    .select("*")
    .single();

  if (insertError) throw insertError;
  return created;
}

const FIXTURE_SHELL: WorkspaceShellData = {
  dataSource: "fixture",
  workspace: null,
  pages: FIXTURE_PAGES,
  userDisplayName: "Anthony",
  userInitials: "AP",
};

export const getWorkspaceShellData = cache(async (): Promise<WorkspaceShellData> => {
  const access = await getDataAccess();

  if (!access) {
    return FIXTURE_SHELL;
  }

  let workspace: WorkspaceRow;
  let pageRows: PageRow[];
  let userDisplayName: string;

  if (access.mode === "dev") {
    const bootstrapped = await bootstrapDevWorkspace(access.client);
    workspace = bootstrapped.workspace;
    pageRows = bootstrapped.pages;
    userDisplayName = "Anthony";
  } else {
    workspace = await getOrCreateDefaultWorkspace(access.client, access.ownerId);
    pageRows = await listPagesForWorkspace(access.client, workspace.id);

    const {
      data: { user },
    } = await access.client.auth.getUser();
    userDisplayName = user ? displayNameFromUser(user) : "Account";
  }

  const pages = pageRows.length > 0 ? buildPageTree(pageRows) : FIXTURE_PAGES;

  return {
    dataSource: "database",
    workspace,
    pages,
    userDisplayName,
    userInitials: initialsFromName(userDisplayName),
  };
});

export { FIXTURE_PAGES, FIXTURE_SHELL };
