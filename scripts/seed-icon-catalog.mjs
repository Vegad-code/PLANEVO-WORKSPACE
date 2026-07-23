/**
 * Seeds public.icon_catalog from packages/core/src/tasks/icon-catalog.json.
 * Safe to re-run — upserts by id.
 *
 * Uses small batches, per-batch clients, and retries because bulk REST upserts
 * often drop the socket around request 6–7 on a reused connection.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, "../packages/core/src/tasks/icon-catalog.json");
const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 200;
const MAX_RETRIES = 5;

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding icon catalog.",
  );
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));

function makeClient() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(cause) {
  const message = String(cause?.message ?? cause?.details ?? cause);
  return (
    message.includes("fetch failed") ||
    message.includes("SocketError") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("network")
  );
}

function toRow(icon) {
  return {
    id: icon.id,
    library: icon.library,
    icon_name: icon.iconName,
    label: icon.label,
    search_text: icon.searchText,
    svg_path: icon.svgPath,
    width: icon.width,
    height: icon.height,
  };
}

async function upsertBatch(batch, batchNumber) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const client = makeClient();
    const { error } = await client.from("icon_catalog").upsert(batch, {
      onConflict: "id",
    });

    if (!error) return;

    const retryable = isRetryableError(error);
    const isLast = attempt === MAX_RETRIES;
    if (!retryable || isLast) {
      throw new Error(
        `Batch ${batchNumber} failed after ${attempt} attempt(s): ${error.message}`,
        { cause: error },
      );
    }

    const waitMs = 400 * attempt;
    console.warn(
      `  Batch ${batchNumber} attempt ${attempt} failed (${error.message}); retrying in ${waitMs}ms…`,
    );
    await sleep(waitMs);
  }
}

async function seed() {
  console.log(
    `Seeding ${catalog.length} icons (${BATCH_SIZE} per batch, ${MAX_RETRIES} retries)…`,
  );

  let done = 0;
  for (let index = 0; index < catalog.length; index += BATCH_SIZE) {
    const batchNumber = Math.floor(index / BATCH_SIZE) + 1;
    const batch = catalog.slice(index, index + BATCH_SIZE).map(toRow);
    await upsertBatch(batch, batchNumber);
    done = Math.min(index + BATCH_SIZE, catalog.length);
    console.log(`  ${done}/${catalog.length}`);
    if (index + BATCH_SIZE < catalog.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  const client = makeClient();
  const { count, error } = await client
    .from("icon_catalog")
    .select("*", { count: "exact", head: true });
  if (error) throw error;

  console.log(`Icon catalog seed complete. ${count ?? done} rows in icon_catalog.`);
}

seed().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
