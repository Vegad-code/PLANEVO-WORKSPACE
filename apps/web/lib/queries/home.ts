import { cache } from "react";
import { getDataAccess } from "@/lib/data/access";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";

export type HomeRecentItem = {
  id: string;
  title: string;
  kind: "page" | "file" | "conversation";
  href: string;
  timestamp: string;
};

export type HomeData = {
  state: "first-run" | "lived-in";
  workspaceId: string | null;
  workspaceName: string | null;
  userName: string | null;
  recents: HomeRecentItem[];
};

export async function loadHomeData(shell: WorkspaceShellData): Promise<HomeData> {
  const base: HomeData = {
    state: shell.workspace ? "lived-in" : "first-run",
    workspaceId: shell.workspace?.id ?? null,
    workspaceName: shell.workspace?.name ?? null,
    userName: shell.userDisplayName,
    recents: [],
  };
  if (!shell.workspace) return base;

  const access = await getDataAccess();
  if (!access) return base;

  const [{ data: pages }, { data: files }, { data: conversations }] = await Promise.all([
    access.client
      .from("pages")
      .select("id,title,updated_at")
      .eq("workspace_id", shell.workspace.id)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(4),
    access.client
      .from("file_sources")
      .select("id,name,created_at,page_id")
      .eq("workspace_id", shell.workspace.id)
      .order("created_at", { ascending: false })
      .limit(4),
    access.client
      .from("ai_conversations")
      .select("id,title,updated_at")
      .eq("workspace_id", shell.workspace.id)
      .order("updated_at", { ascending: false })
      .limit(4),
  ]);

  const recents = [
    ...(pages ?? []).map((page) => ({
      id: page.id,
      title: page.title,
      kind: "page" as const,
      href: `/pages/${page.id}`,
      timestamp: page.updated_at,
    })),
    ...(files ?? []).map((file) => ({
      id: file.id,
      title: file.name,
      kind: "file" as const,
      href: file.page_id ? `/pages/${file.page_id}` : "/files",
      timestamp: file.created_at,
    })),
    ...(conversations ?? []).map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      kind: "conversation" as const,
      href: `/ai/${conversation.id}`,
      timestamp: conversation.updated_at,
    })),
  ]
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index)
    .slice(0, 6);

  return { ...base, state: recents.length > 0 ? "lived-in" : base.state, recents };
}

export const getHomeData = cache(async (shell: WorkspaceShellData): Promise<HomeData> => {
  try {
    return await loadHomeData(shell);
  } catch {
    return {
      state: shell.workspace ? "lived-in" : "first-run",
      workspaceId: shell.workspace?.id ?? null,
      workspaceName: shell.workspace?.name ?? null,
      userName: shell.userDisplayName,
      recents: [],
    };
  }
});
