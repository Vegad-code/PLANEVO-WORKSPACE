import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogIcon } from "@planevo/core/tasks/icon-catalog";
import { searchIconCatalog } from "@planevo/core/tasks/icon-catalog";

const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_RESULTS = 20;

type CachedRow = {
  results_json: CatalogIcon[];
  expires_at: string;
};

function hashQuery(query: string): string {
  return createHash("sha256").update(query.toLowerCase()).digest("hex");
}

function catalogFromDbRow(row: Record<string, unknown>): CatalogIcon {
  return {
    id: String(row.id),
    library: row.library as CatalogIcon["library"],
    iconName: String(row.icon_name),
    label: String(row.label),
    searchText: String(row.search_text),
    svgPath: String(row.svg_path),
    width: Number(row.width),
    height: Number(row.height),
  };
}

async function searchCatalogDb(
  client: SupabaseClient,
  query: string,
  limit: number,
): Promise<CatalogIcon[] | null> {
  const { data, error } = await client
    .from("icon_catalog")
    .select("id, library, icon_name, label, search_text, svg_path, width, height")
    .textSearch("search_vector", query, {
      type: "websearch",
      config: "english",
    })
    .limit(limit);

  if (error || !data?.length) return null;
  return data.map(catalogFromDbRow);
}

export async function searchTaskIconsWithCache(
  client: SupabaseClient | null,
  query: string,
): Promise<CatalogIcon[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const queryHash = hashQuery(trimmed);

  if (client) {
    const { data: cached } = await client
      .from("icon_search_cache")
      .select("results_json, expires_at")
      .eq("query_hash", queryHash)
      .maybeSingle();

    const row = cached as CachedRow | null;
    if (row && new Date(row.expires_at).getTime() > Date.now()) {
      await client
        .from("icon_search_cache")
        .update({ hit_count: (row as { hit_count?: number }).hit_count ?? 1 })
        .eq("query_hash", queryHash);
      return row.results_json.slice(0, MAX_RESULTS);
    }

    const dbResults = await searchCatalogDb(client, trimmed, MAX_RESULTS);
    const results = dbResults ?? searchIconCatalog(trimmed, MAX_RESULTS);

    await client.from("icon_search_cache").upsert({
      query_hash: queryHash,
      query_text: trimmed,
      results_json: results,
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    });

    return results;
  }

  return searchIconCatalog(trimmed, MAX_RESULTS);
}
