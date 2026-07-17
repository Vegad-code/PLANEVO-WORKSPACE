import { NextResponse } from "next/server";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { enrichBundleWithRelationTitles } from "@planevo/core/queries/relation-display";
import { toDisplayRecord } from "@planevo/core/queries/record-display";
import { requireDataAccess } from "@/lib/data/access";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const databaseId = url.searchParams.get("databaseId");
  const recordIdsParam = url.searchParams.get("recordIds");

  if (!databaseId || !recordIdsParam) {
    return NextResponse.json({ error: "Missing parameters." }, { status: 400 });
  }

  const recordIds = recordIdsParam.split(",").map((id) => id.trim()).filter(Boolean);
  if (recordIds.length === 0) {
    return NextResponse.json({ error: "No record ids provided." }, { status: 400 });
  }

  try {
    const access = await requireDataAccess();
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
    const records = enriched.records
      .filter((record) => idSet.has(record.id))
      .map((record) => toDisplayRecord(record, enriched.properties));

    return NextResponse.json({
      databaseName: database.name,
      records,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed to load embedded view.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
