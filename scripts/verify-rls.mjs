// RLS integration check: creates two throwaway users against the project in
// apps/web/.env.local, gives user A real data, and asserts user B can see and
// touch none of it. Run with: npm run test:rls
// Requires SUPABASE_SECRET_KEY (admin user management) — never run against a
// project whose data you can't afford to touch; it only creates/deletes its
// own throwaway users.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = loadEnv(new URL("../apps/web/.env.local", import.meta.url));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !secretKey) {
  console.error("Missing Supabase keys in apps/web/.env.local");
  process.exit(1);
}

const admin = createClient(url, secretKey, { auth: { persistSession: false } });

const TABLES = [
  "workspaces",
  "pages",
  "databases",
  "database_properties",
  "records",
  "record_values",
  "views",
  "file_sources",
  "ai_conversations",
];

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ok - ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL - ${name}${detail ? ` (${detail})` : ""}`);
  }
}

async function createUser(label) {
  const email = `rls-check-${label}-${randomUUID()}@local.invalid`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const userA = await createUser("a");
const userB = await createUser("b");

try {
  console.log("Seeding user A via create_task_with_required_foundation…");
  const { data: seeded, error: seedError } = await userA.client.rpc(
    "create_task_with_required_foundation",
    { p_owner_id: userA.id, p_title: "RLS probe task" },
  );
  if (seedError) throw seedError;
  const workspaceId = seeded.workspace_id;

  console.log("User A sees own data:");
  {
    const { data } = await userA.client.from("workspaces").select("id");
    check("A reads own workspace", (data ?? []).length === 1);
  }

  console.log("User B is fully isolated:");
  for (const table of TABLES) {
    const { data, error } = await userB.client.from(table).select("*").limit(10);
    check(`B reads zero rows from ${table}`, !error && (data ?? []).length === 0, error?.message);
  }

  {
    const { error } = await userB.client.rpc("create_task_with_required_foundation", {
      p_owner_id: userA.id,
      p_workspace_id: workspaceId,
      p_title: "cross-tenant write attempt",
    });
    check("B cannot call task RPC as A", Boolean(error), "RPC succeeded cross-tenant");
  }

  {
    const { data, error } = await userB.client
      .from("pages")
      .insert({ workspace_id: workspaceId, title: "intruder page" })
      .select("id");
    check("B cannot insert into A's workspace", Boolean(error) || (data ?? []).length === 0);
  }

  {
    const { data } = await userB.client
      .from("workspaces")
      .update({ name: "hijacked" })
      .eq("id", workspaceId)
      .select("id");
    check("B cannot update A's workspace", (data ?? []).length === 0);
  }
} finally {
  console.log("Cleaning up throwaway users…");
  await admin.auth.admin.deleteUser(userA.id);
  await admin.auth.admin.deleteUser(userB.id);
}

if (failures > 0) {
  console.error(`\n${failures} RLS check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll RLS checks passed.");
