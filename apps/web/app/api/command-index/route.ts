import { NextResponse } from "next/server";
import type { CommandIndexEntry } from "@planevo/core/search/command-model";
import { propertyValueToString } from "@planevo/core/validation/property-values";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";

const RECORD_LIMIT = 2000;

// ponytail: refetch-on-open; add invalidation bus when F-16 passive index needs it

export async function GET() {
  try {
    const current = await getCurrentWorkspace();
    if (!current) {
      return NextResponse.json([]);
    }

    const { access, workspace } = current;
    const client = access.client;

    const [{ data: pages, error: pagesError }, { data: databases, error: databasesError }] =
      await Promise.all([
        client
          .from("pages")
          .select("id,title,icon")
          .eq("workspace_id", workspace.id)
          .eq("is_archived", false),
        client.from("databases").select("id,name").eq("workspace_id", workspace.id),
      ]);
    if (pagesError) throw pagesError;
    if (databasesError) throw databasesError;

    const entries: CommandIndexEntry[] = [
      ...(pages ?? []).map((page) => ({
        kind: "page" as const,
        id: page.id,
        title: page.title,
        icon: page.icon ?? undefined,
      })),
      ...(databases ?? []).map((database) => ({
        kind: "database" as const,
        id: database.id,
        title: database.name,
      })),
    ];

    const databaseIds = (databases ?? []).map((database) => database.id);
    const databaseNames = new Map(
      (databases ?? []).map((database) => [database.id, database.name]),
    );

    if (databaseIds.length > 0) {
      const { data: records, error: recordsError } = await client
        .from("records")
        .select("id,updated_at,database_id")
        .in("database_id", databaseIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(RECORD_LIMIT);
      if (recordsError) throw recordsError;

      const recordIds = (records ?? []).map((record) => record.id);
      const titlesByRecord = new Map<string, string>();

      if (recordIds.length > 0) {
        const { data: values, error: valuesError } = await client
          .from("record_values")
          .select("record_id,value_json,database_properties!inner(is_primary)")
          .in("record_id", recordIds)
          .eq("database_properties.is_primary", true);
        if (valuesError) throw valuesError;

        for (const row of values ?? []) {
          titlesByRecord.set(
            row.record_id,
            propertyValueToString(row.value_json) || "Untitled",
          );
        }
      }

      for (const record of records ?? []) {
        entries.push({
          kind: "record",
          id: record.id,
          title: titlesByRecord.get(record.id) ?? "Untitled",
          subtitle: databaseNames.get(record.database_id),
        });
      }
    }

    return NextResponse.json(entries);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Failed to load command index.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
