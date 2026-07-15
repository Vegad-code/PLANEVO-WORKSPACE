// Seeds a throwaway "Perf sandbox (seed)" workspace with ~10k task records
// for query-plan checks. Run with: npm run db:seed [-- --records 10000]
// Uses the service key from apps/web/.env.local; re-running wipes and reseeds
// the sandbox workspace only — your real workspaces are never touched.
import { readFileSync } from "node:fs";
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
const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secretKey) {
  console.error("Missing Supabase keys in apps/web/.env.local");
  process.exit(1);
}

const recordsArg = process.argv.indexOf("--records");
const RECORD_COUNT = recordsArg > -1 ? Number(process.argv[recordsArg + 1]) : 10_000;
const SEED_WORKSPACE_NAME = "Perf sandbox (seed)";
const STATUSES = ["To do", "In progress", "In review", "Done"];

const admin = createClient(url, secretKey, { auth: { persistSession: false } });

// Owner: the dev alias user (same resolution as the app's dev mode).
const alias = env.PLANEVO_DEV_OWNER_ID;
let ownerId = null;
for (let page = 1; page <= 10 && !ownerId; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  ownerId = data.users.find(
    (user) => user.user_metadata?.planevo_dev_owner_alias === alias,
  )?.id;
  if (data.users.length < 1000) break;
}
if (!ownerId) {
  console.error("Dev owner not found — open the app once in dev mode first.");
  process.exit(1);
}

// Wipe a previous sandbox (cascade removes pages/databases/records/values).
const { data: existing } = await admin
  .from("workspaces")
  .select("id")
  .eq("owner_id", ownerId)
  .eq("name", SEED_WORKSPACE_NAME);
for (const workspace of existing ?? []) {
  await admin.from("workspaces").delete().eq("id", workspace.id);
}

const { data: workspace, error: workspaceError } = await admin
  .from("workspaces")
  .insert({ owner_id: ownerId, name: SEED_WORKSPACE_NAME })
  .select("id")
  .single();
if (workspaceError) throw workspaceError;

const { data: foundation, error: foundationError } = await admin.rpc(
  "create_task_database_with_views",
  { p_owner_id: ownerId, p_workspace_id: workspace.id, p_name: "Seed tasks" },
);
if (foundationError) throw foundationError;
const databaseId = foundation.database_id;

const { data: properties, error: propertiesError } = await admin
  .from("database_properties")
  .select("id,name,type,is_primary")
  .eq("database_id", databaseId);
if (propertiesError) throw propertiesError;
const titleProperty = properties.find((property) => property.is_primary);
const statusProperty = properties.find((property) => property.name === "Status");
const dateProperty = properties.find((property) => property.type === "date");

console.log(`Seeding ${RECORD_COUNT} records into workspace ${workspace.id}…`);
const CHUNK = 500;
const startDate = Date.now();
for (let offset = 0; offset < RECORD_COUNT; offset += CHUNK) {
  const size = Math.min(CHUNK, RECORD_COUNT - offset);
  const recordRows = Array.from({ length: size }, (_, index) => ({
    database_id: databaseId,
    position: offset + index,
    created_by: ownerId,
  }));
  const { data: inserted, error: recordError } = await admin
    .from("records")
    .insert(recordRows)
    .select("id");
  if (recordError) throw recordError;

  const valueRows = inserted.flatMap((record, index) => {
    const n = offset + index;
    const rows = [
      { record_id: record.id, property_id: titleProperty.id, value_json: `Seed task ${n}` },
      {
        record_id: record.id,
        property_id: statusProperty.id,
        value_json: STATUSES[n % STATUSES.length],
      },
    ];
    if (dateProperty && n % 3 === 0) {
      rows.push({
        record_id: record.id,
        property_id: dateProperty.id,
        value_json: new Date(startDate + n * 3_600_000).toISOString(),
      });
    }
    return rows;
  });
  const { error: valueError } = await admin.from("record_values").insert(valueRows);
  if (valueError) throw valueError;
  process.stdout.write(`\r${Math.min(offset + size, RECORD_COUNT)}/${RECORD_COUNT}`);
}

console.log(`\nDone. Sandbox workspace: ${workspace.id}, database: ${databaseId}`);
console.log("Run the EXPLAIN checks in supabase/performance-checks.md against it.");
