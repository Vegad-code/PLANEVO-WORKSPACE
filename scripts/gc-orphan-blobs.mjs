// Storage garbage collector: find (and optionally delete) blobs in the upload
// buckets that have no matching file_sources row. These are the leaks a partial
// delete/upload can leave behind — they cost real storage but are invisible to
// the usage meter (which is derived from rows, not the bucket).
//
// Dry-run by default; pass --apply to actually delete. Uses the service-role key
// in apps/web/.env.local, so it sees every user's rows and objects.
//
// ponytail: no scheduled-job infra exists in this repo — run manually or wire to
// external cron/CI. Upgrade path: a Supabase edge function on a pg_cron schedule.
// Assumes the two-level `{prefix}/{file}` layout every upload path uses today.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const GRACE_MS = 24 * 60 * 60 * 1000; // skip blobs younger than this (in-flight uploads/reservations)

// Each bucket + how one of its object keys maps back to a file_sources.storage_path.
const BUCKETS = [
  { name: "workspace-files", toStoragePath: (key) => key }, // product files + task attachments (bare paths)
  { name: "page-assets", toStoragePath: (key) => `page-assets:${key}` }, // page-editor uploads
];

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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY in apps/web/.env.local");
  process.exit(1);
}

const admin = createClient(url, secretKey, { auth: { persistSession: false } });

/** Every storage_path recorded in file_sources (the set of blobs that SHOULD exist). */
async function knownStoragePaths() {
  const paths = new Set();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("file_sources")
      .select("storage_path")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) paths.add(row.storage_path);
    if (!data || data.length < pageSize) break;
  }
  return paths;
}

async function listPrefix(bucket, prefix) {
  const items = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    items.push(...data);
    if (data.length < limit) break;
  }
  return items;
}

/** Flatten a `{prefix}/{file}` bucket into { key, createdAt } leaves. */
async function listBucketObjects(bucket) {
  const leaves = [];
  for (const entry of await listPrefix(bucket, "")) {
    if (entry.id === null) {
      // Folder placeholder (id is null) — descend one level for the files.
      for (const file of await listPrefix(bucket, entry.name)) {
        if (file.id !== null) {
          leaves.push({ key: `${entry.name}/${file.name}`, createdAt: file.created_at });
        }
      }
    } else {
      leaves.push({ key: entry.name, createdAt: entry.created_at });
    }
  }
  return leaves;
}

const known = await knownStoragePaths();
const now = Date.now();
let totalOrphans = 0;

for (const bucket of BUCKETS) {
  const objects = await listBucketObjects(bucket.name);
  const orphans = objects.filter((object) => {
    if (known.has(bucket.toStoragePath(object.key))) return false;
    const age = object.createdAt ? now - new Date(object.createdAt).getTime() : Infinity;
    return age > GRACE_MS;
  });

  if (orphans.length === 0) {
    console.log(`${bucket.name}: no orphans`);
    continue;
  }

  totalOrphans += orphans.length;
  console.log(`${bucket.name}: ${orphans.length} orphan blob(s)`);
  for (const orphan of orphans) console.log(`  - ${orphan.key}`);

  if (APPLY) {
    const { error } = await admin.storage
      .from(bucket.name)
      .remove(orphans.map((orphan) => orphan.key));
    if (error) {
      console.error(`  remove failed: ${error.message}`);
      process.exitCode = 1;
    } else {
      console.log(`  removed ${orphans.length}`);
    }
  }
}

console.log(
  APPLY
    ? `\nDone. Removed ${totalOrphans} orphan(s).`
    : `\nDry run — ${totalOrphans} orphan(s) would be removed. Re-run with --apply to delete.`,
);
