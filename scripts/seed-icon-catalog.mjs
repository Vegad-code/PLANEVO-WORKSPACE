/**
 * Seeds public.icon_catalog from packages/core/src/tasks/icon-catalog.json.
 * Safe to re-run — upserts by id.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, "../packages/core/src/tasks/icon-catalog.json");
const BATCH_SIZE = 100;

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

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function seed() {
  console.log(`Seeding ${catalog.length} icons…`);

  for (let index = 0; index < catalog.length; index += BATCH_SIZE) {
    const batch = catalog.slice(index, index + BATCH_SIZE).map((icon) => ({
      id: icon.id,
      library: icon.library,
      icon_name: icon.iconName,
      label: icon.label,
      search_text: icon.searchText,
      svg_path: icon.svgPath,
      width: icon.width,
      height: icon.height,
    }));

    const { error } = await client.from("icon_catalog").upsert(batch, {
      onConflict: "id",
    });
    if (error) throw error;
    console.log(`  ${Math.min(index + BATCH_SIZE, catalog.length)}/${catalog.length}`);
  }

  console.log("Icon catalog seed complete.");
}

seed().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
