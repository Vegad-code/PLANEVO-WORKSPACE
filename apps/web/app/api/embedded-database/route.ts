import { NextResponse } from "next/server";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { enrichBundleWithRelationTitles } from "@planevo/core/queries/relation-display";
import { toDisplayRecord } from "@planevo/core/queries/record-display";
import { applyView } from "@planevo/core/views/filter-engine";
import { normalizeViewConfig } from "@planevo/core/views/view-config";
import { mapTypedError } from "@/lib/api/typed-errors";
import { requireDataAccess } from "@/lib/data/access";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit.server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const databaseId = url.searchParams.get("databaseId");
  const recordIdsParam = url.searchParams.get("recordIds");
  const viewId = url.searchParams.get("viewId");

  if (!databaseId || !recordIdsParam) {
    return NextResponse.json({ error: "Missing parameters." }, { status: 400 });
  }

  const recordIds = recordIdsParam.split(",").map((id) => id.trim()).filter(Boolean);
  if (recordIds.length === 0) {
    return NextResponse.json({ error: "No record ids provided." }, { status: 400 });
  }

  try {
    const access = await requireDataAccess();
    await enforceRateLimit(access, "embedded-database:get", RATE_LIMITS.read);
    const { data: database, error: databaseError } = await access.client
      .from("databases")
      .select("id, name, workspaces!inner(owner_id)")
      .eq("id", databaseId)
      .eq("workspaces.owner_id", access.ownerId)
      .maybeSingle();
    if (databaseError) throw databaseError;
    if (!database) {
      return NextResponse.json({ error: "Database not found." }, { status: 404 });
    }

    const bundle = await loadDatabaseBundle(access.client, databaseId);
    if (!bundle) {
      return NextResponse.json({ error: "Database not found." }, { status: 404 });
    }

    const enriched = await enrichBundleWithRelationTitles(access.client, bundle);
    const idSet = new Set(recordIds);
    const scoped = enriched.records.filter((record) => idSet.has(record.id));

    // Optional viewId applies the same filter/sort engine as DatabaseWorkspace.
    const view = viewId
      ? enriched.views.find((candidate) => candidate.id === viewId)
      : undefined;
    const filtered = view
      ? applyView(scoped, normalizeViewConfig(view.config_json), enriched.properties)
      : scoped;

    const records = filtered.map((record) =>
      toDisplayRecord(record, enriched.properties),
    );

    return NextResponse.json({
      databaseName: database.name,
      records,
    });
  } catch (cause) {
    const mapped = mapTypedError(cause);
    if (mapped) return mapped;
    const message = cause instanceof Error ? cause.message : "Failed to load embedded view.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
