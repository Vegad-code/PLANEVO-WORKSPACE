import { NextResponse } from "next/server";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { mapTypedError } from "@/lib/api/typed-errors";
import { requireDataAccess } from "@/lib/data/access";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit.server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ recordId: string }> },
) {
  const { recordId } = await context.params;

  try {
    const access = await requireDataAccess();
    await enforceRateLimit(access, "record-peek:get", RATE_LIMITS.read);

    const { data: record, error: recordError } = await access.client
      .from("records")
      .select("id, database_id, content_json, deleted_at, databases!inner(workspace_id, workspaces!inner(owner_id))")
      .eq("id", recordId)
      .is("deleted_at", null)
      .eq("databases.workspaces.owner_id", access.ownerId)
      .maybeSingle();
    if (recordError) throw recordError;
    if (!record) {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }

    const bundle = await loadDatabaseBundle(access.client, record.database_id);
    if (!bundle) {
      return NextResponse.json({ error: "Database not found." }, { status: 404 });
    }

    const pivot = bundle.records.find((row) => row.id === recordId);
    if (!pivot) {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }

    return NextResponse.json({
      recordId: record.id,
      databaseId: record.database_id,
      databaseName: bundle.database.name,
      pageId: bundle.database.page_id,
      properties: bundle.properties,
      values: pivot.values,
      contentJson: record.content_json,
    });
  } catch (cause) {
    const mapped = mapTypedError(cause);
    if (mapped) return mapped;
    const message = cause instanceof Error ? cause.message : "Failed to load record.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
