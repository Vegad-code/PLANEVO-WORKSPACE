import { cache } from "react";
import { getDataAccess } from "@/lib/data/access";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";

export type HomeRecentItem = {
  id: string;
  title: string;
  kind: "page" | "database" | "file" | "conversation";
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

type RecentRow = {
  target_type: string;
  target_id: string;
  last_opened_at: string;
};

function idsOf(rows: RecentRow[], type: string): string[] {
  return rows.filter((row) => row.target_type === type).map((row) => row.target_id);
}

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
  const client = access.client;
  const workspaceId = shell.workspace.id;

  const { data: recentRows, error } = await client
    .from("recent_items")
    .select("target_type,target_id,last_opened_at")
    .eq("user_id", access.ownerId)
    .eq("workspace_id", workspaceId)
    .order("last_opened_at", { ascending: false })
    .limit(12);
  if (error) throw error;

  const rows = recentRows ?? [];
  if (rows.length === 0) {
    // Nothing tracked yet (fresh workspace or pre-tracking data): latest pages
    // stand in so an active workspace never reads as first-run.
    const { data: pages, error: pagesError } = await client
      .from("pages")
      .select("id,title,updated_at")
      .eq("workspace_id", workspaceId)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(6);
    if (pagesError) throw pagesError;
    const recents = (pages ?? []).map((page) => ({
      id: page.id,
      title: page.title,
      kind: "page" as const,
      href: `/pages/${page.id}`,
      timestamp: page.updated_at,
    }));
    return { ...base, state: recents.length > 0 ? "lived-in" : base.state, recents };
  }

  const [pageIds, databaseIds, fileIds, conversationIds] = [
    idsOf(rows, "page"),
    idsOf(rows, "database"),
    idsOf(rows, "file"),
    idsOf(rows, "conversation"),
  ];

  const [pages, databases, files, conversations] = await Promise.all([
    pageIds.length
      ? client.from("pages").select("id,title").in("id", pageIds).eq("is_archived", false)
      : { data: [], error: null },
    databaseIds.length
      ? client.from("databases").select("id,name").in("id", databaseIds)
      : { data: [], error: null },
    fileIds.length
      ? client.from("file_sources").select("id,name,page_id").in("id", fileIds)
      : { data: [], error: null },
    conversationIds.length
      ? client.from("ai_conversations").select("id,title").in("id", conversationIds)
      : { data: [], error: null },
  ]);
  for (const result of [pages, databases, files, conversations]) {
    if (result.error) throw result.error;
  }

  const titles = new Map<string, { title: string; href: string; kind: HomeRecentItem["kind"] }>();
  for (const page of pages.data ?? []) {
    titles.set(`page:${page.id}`, { title: page.title, href: `/pages/${page.id}`, kind: "page" });
  }
  for (const database of databases.data ?? []) {
    titles.set(`database:${database.id}`, {
      title: database.name,
      href: `/databases/${database.id}`,
      kind: "database",
    });
  }
  for (const file of files.data ?? []) {
    titles.set(`file:${file.id}`, {
      title: file.name,
      href: file.page_id ? `/pages/${file.page_id}` : "/files",
      kind: "file",
    });
  }
  for (const conversation of conversations.data ?? []) {
    titles.set(`conversation:${conversation.id}`, {
      title: conversation.title,
      href: `/ai/${conversation.id}`,
      kind: "conversation",
    });
  }

  // Deleted targets simply drop out of the list.
  const recents = rows
    .map((row) => {
      const resolved = titles.get(`${row.target_type}:${row.target_id}`);
      if (!resolved) return null;
      return {
        id: row.target_id,
        title: resolved.title,
        kind: resolved.kind,
        href: resolved.href,
        timestamp: row.last_opened_at,
      };
    })
    .filter((item): item is HomeRecentItem => item !== null)
    .slice(0, 6);

  return { ...base, state: recents.length > 0 ? "lived-in" : base.state, recents };
}

// Errors intentionally propagate to the route error boundary — a failed load
// must never render as a first-run home.
export const getHomeData = cache(loadHomeData);
