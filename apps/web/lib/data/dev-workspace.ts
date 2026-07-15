import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PageRow, WorkspaceRow } from "@/lib/database.types";

export const DEV_OWNER_ID = "b0000000-0000-4000-8000-000000000001";
export const DEV_USER_EMAIL = "dev@planevo.local";
export const DEV_WORKSPACE_NAME = "Anthony's workspace";

type SeedPage = {
  key: string;
  title: string;
  parentKey: string | null;
  position: number;
};

const SEED_PAGES: SeedPage[] = [
  { key: "physics", title: "Physics 2400", parentKey: null, position: 0 },
  { key: "lab", title: "Lab notes", parentKey: "physics", position: 0 },
  { key: "apps", title: "Apps tracker", parentKey: null, position: 1 },
  { key: "launch", title: "Launch checklist", parentKey: "apps", position: 0 },
  { key: "reading", title: "Reading list", parentKey: null, position: 2 },
];

export async function ensureDevAuthUser(
  admin: SupabaseClient<Database>,
): Promise<string> {
  const { data: existing, error: existingError } =
    await admin.auth.admin.getUserById(DEV_OWNER_ID);

  if (!existingError && existing.user) {
    return existing.user.id;
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    id: DEV_OWNER_ID,
    email: DEV_USER_EMAIL,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: "Anthony" },
  });

  if (createError) {
    throw createError;
  }

  return created.user.id;
}

export async function getOrCreateDevWorkspace(
  admin: SupabaseClient<Database>,
  ownerId: string,
): Promise<WorkspaceRow> {
  const { data: existing, error: selectError } = await admin
    .from("workspaces")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data: created, error: insertError } = await admin
    .from("workspaces")
    .insert({ owner_id: ownerId, name: DEV_WORKSPACE_NAME })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return created;
}

export async function seedDevPages(
  admin: SupabaseClient<Database>,
  workspaceId: string,
): Promise<PageRow[]> {
  const { data: existingPages, error: existingError } = await admin
    .from("pages")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (existingError) throw existingError;
  if ((existingPages ?? []).length > 0) {
    return existingPages ?? [];
  }

  const pageIds = new Map<string, string>();

  for (const seedPage of SEED_PAGES.filter((page) => page.parentKey === null)) {
    const { data, error } = await admin
      .from("pages")
      .insert({
        workspace_id: workspaceId,
        title: seedPage.title,
        position: seedPage.position,
      })
      .select("*")
      .single();

    if (error) throw error;
    pageIds.set(seedPage.key, data.id);
  }

  for (const seedPage of SEED_PAGES.filter((page) => page.parentKey !== null)) {
    const parentId = pageIds.get(seedPage.parentKey!);
    if (!parentId) {
      throw new Error(`Missing parent page for seed key: ${seedPage.key}`);
    }

    const { data, error } = await admin
      .from("pages")
      .insert({
        workspace_id: workspaceId,
        parent_page_id: parentId,
        title: seedPage.title,
        position: seedPage.position,
      })
      .select("*")
      .single();

    if (error) throw error;
    pageIds.set(seedPage.key, data.id);
  }

  const { data: pages, error: pagesError } = await admin
    .from("pages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });

  if (pagesError) throw pagesError;
  return pages ?? [];
}

export async function bootstrapDevWorkspace(
  admin: SupabaseClient<Database>,
): Promise<{ ownerId: string; workspace: WorkspaceRow; pages: PageRow[] }> {
  const ownerId = await ensureDevAuthUser(admin);
  const workspace = await getOrCreateDevWorkspace(admin, ownerId);
  const pages = await seedDevPages(admin, workspace.id);
  return { ownerId, workspace, pages };
}
