import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DEV_OWNER_ID = "b0000000-0000-4000-8000-000000000001";
const DEV_USER_EMAIL = "dev@planevo.local";
const DEV_WORKSPACE_NAME = "Anthony's workspace";

const SEED_PAGES = [
  { key: "physics", title: "Physics 2400", parentKey: null, position: 0 },
  { key: "lab", title: "Lab notes", parentKey: "physics", position: 0 },
  { key: "apps", title: "Apps tracker", parentKey: null, position: 1 },
  { key: "launch", title: "Launch checklist", parentKey: "apps", position: 0 },
  { key: "reading", title: "Reading list", parentKey: null, position: 2 },
];

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const contents = readFileSync(path, "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serverSecretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serverSecretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or a server secret key in apps/web/.env.local",
  );
  console.error(
    "Set SUPABASE_SECRET_KEY (new) or SUPABASE_SERVICE_ROLE_KEY (legacy) from Supabase → Settings → API Keys.",
  );
  process.exit(1);
}

const admin = createClient(url, serverSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureDevUser() {
  const { data: existing, error: existingError } =
    await admin.auth.admin.getUserById(DEV_OWNER_ID);

  if (!existingError && existing.user) {
    return existing.user.id;
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    id: DEV_OWNER_ID,
    email: DEV_USER_EMAIL,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: "Anthony" },
  });

  if (createError) throw createError;
  return created.user.id;
}

async function ensureWorkspace(ownerId) {
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

async function ensurePages(workspaceId) {
  const { data: existingPages, error: existingError } = await admin
    .from("pages")
    .select("id")
    .eq("workspace_id", workspaceId);

  if (existingError) throw existingError;
  if ((existingPages ?? []).length > 0) {
    return existingPages.length;
  }

  const pageIds = new Map();

  for (const seedPage of SEED_PAGES.filter((page) => page.parentKey === null)) {
    const { data, error } = await admin
      .from("pages")
      .insert({
        workspace_id: workspaceId,
        title: seedPage.title,
        position: seedPage.position,
      })
      .select("id")
      .single();

    if (error) throw error;
    pageIds.set(seedPage.key, data.id);
  }

  for (const seedPage of SEED_PAGES.filter((page) => page.parentKey !== null)) {
    const parentId = pageIds.get(seedPage.parentKey);
    const { error } = await admin.from("pages").insert({
      workspace_id: workspaceId,
      parent_page_id: parentId,
      title: seedPage.title,
      position: seedPage.position,
    });
    if (error) throw error;
  }

  return SEED_PAGES.length;
}

const ownerId = await ensureDevUser();
const workspace = await ensureWorkspace(ownerId);
const pageCount = await ensurePages(workspace.id);

console.log("Dev workspace seeded.");
console.log(`PLANEVO_DEV_OWNER_ID=${ownerId}`);
console.log(`Workspace: ${workspace.name} (${workspace.id})`);
console.log(`Pages: ${pageCount}`);
