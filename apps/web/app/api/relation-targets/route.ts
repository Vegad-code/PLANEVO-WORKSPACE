import { NextResponse } from "next/server";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { findPropertyByRole } from "@planevo/core/types/property-roles";
import { propertyValueToString } from "@planevo/core/validation/property-values";
import { mapTypedError } from "@/lib/api/typed-errors";
import { requireDataAccess } from "@/lib/data/access";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit.server";

async function requireOwnedDatabase(databaseId: string) {
  const access = await requireDataAccess();
  const { data, error } = await access.client
    .from("databases")
    .select("id, workspaces!inner(owner_id)")
    .eq("id", databaseId)
    .eq("workspaces.owner_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return access;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const databaseId = url.searchParams.get("databaseId");
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  if (!databaseId) {
    return NextResponse.json({ error: "Missing databaseId." }, { status: 400 });
  }

  try {
    const access = await requireOwnedDatabase(databaseId);
    if (!access) {
      return NextResponse.json({ error: "Database not found." }, { status: 404 });
    }
    await enforceRateLimit(access, "relation-targets:get", RATE_LIMITS.read);

    const bundle = await loadDatabaseBundle(access.client, databaseId);
    if (!bundle) {
      return NextResponse.json({ error: "Database not found." }, { status: 404 });
    }

    const titleProperty = findPropertyByRole(bundle.properties, "title");
    if (!titleProperty) {
      return NextResponse.json({ targets: [] });
    }

    const targets = bundle.records
      .map((record) => ({
        id: record.id,
        title: propertyValueToString(record.values[titleProperty.id]) || "Untitled",
      }))
      .filter((target) => !query || target.title.toLowerCase().includes(query))
      .slice(0, 20);

    return NextResponse.json({ targets });
  } catch (cause) {
    const mapped = mapTypedError(cause);
    if (mapped) return mapped;
    const message = cause instanceof Error ? cause.message : "Failed to load targets.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { databaseId?: string; title?: string };
    const databaseId = body.databaseId?.trim();
    const title = body.title?.trim();
    if (!databaseId || !title) {
      return NextResponse.json({ error: "databaseId and title are required." }, { status: 400 });
    }

    const access = await requireOwnedDatabase(databaseId);
    if (!access) {
      return NextResponse.json({ error: "Database not found." }, { status: 404 });
    }
    await enforceRateLimit(access, "relation-targets:post", RATE_LIMITS.mutate);

    const bundle = await loadDatabaseBundle(access.client, databaseId);
    if (!bundle) {
      return NextResponse.json({ error: "Database not found." }, { status: 404 });
    }

    const titleProperty = findPropertyByRole(bundle.properties, "title");
    if (!titleProperty) {
      return NextResponse.json({ error: "Database is missing a title property." }, { status: 400 });
    }

    const { data: last, error: maxError } = await access.client
      .from("records")
      .select("position")
      .eq("database_id", databaseId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) throw maxError;

    const { data: record, error: recordError } = await access.client
      .from("records")
      .insert({
        database_id: databaseId,
        position: (last?.position ?? -1) + 1,
        created_by: access.ownerId,
      })
      .select("id")
      .single();
    if (recordError) throw recordError;

    const { error: valueError } = await access.client.from("record_values").insert({
      record_id: record.id,
      property_id: titleProperty.id,
      value_json: title,
    });
    if (valueError) throw valueError;

    return NextResponse.json({ id: record.id, title });
  } catch (cause) {
    const mapped = mapTypedError(cause);
    if (mapped) return mapped;
    const message = cause instanceof Error ? cause.message : "Failed to create record.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
