import { NextResponse } from "next/server";
import type { CommandIndexEntry } from "@planevo/core/search/command-model";
import { propertyValueToString } from "@planevo/core/validation/property-values";
import { mapTypedError } from "@/lib/api/typed-errors";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit.server";
import { isStarredFileMetadata } from "@planevo/core/types/files";
import { isVisibleFileSourceMetadata } from "@/lib/tasks/task-attachments";

const RECORD_LIMIT = 2000;
const PRODUCT_LIMIT = 500;

// ponytail: refetch-on-open; add invalidation bus when F-16 passive index needs it

export async function GET() {
  try {
    const current = await getCurrentWorkspace();
    if (!current) {
      return NextResponse.json([]);
    }

    const { access, workspace } = current;
    await enforceRateLimit(access, "command-index:get", RATE_LIMITS.read);
    const client = access.client;
    const userId = access.ownerId;

    const [
      { data: pages, error: pagesError },
      { data: databases, error: databasesError },
      { data: tasks, error: tasksError },
      { data: files, error: filesError },
      { data: events, error: eventsError },
    ] = await Promise.all([
      client
        .from("pages")
        .select("id,title,icon")
        .eq("workspace_id", workspace.id)
        .eq("is_archived", false),
      client.from("databases").select("id,name").eq("workspace_id", workspace.id),
      client
        .from("tasks")
        .select("id,title,status,due_at,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(PRODUCT_LIMIT),
      client
        .from("file_sources")
        .select("id,name,folder_id,mime_type,metadata_json,updated_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(PRODUCT_LIMIT * 2),
      client
        .from("calendar_events")
        .select("id,title,starts_at,updated_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("starts_at", { ascending: false })
        .limit(PRODUCT_LIMIT),
    ]);
    if (pagesError) throw pagesError;
    if (databasesError) throw databasesError;
    if (tasksError) throw tasksError;
    if (filesError) throw filesError;
    if (eventsError) throw eventsError;

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
      ...(tasks ?? []).map((task) => ({
        kind: "task" as const,
        id: task.id,
        title: task.title,
        subtitle: task.status,
        updatedAt: task.updated_at,
      })),
      ...(files ?? [])
        .filter((file) => isVisibleFileSourceMetadata(file.metadata_json))
        .slice(0, PRODUCT_LIMIT)
        .map((file) => ({
          kind: "file" as const,
          id: file.id,
          title: file.name,
          mimeType: file.mime_type ?? undefined,
          starred: isStarredFileMetadata(file.metadata_json),
          updatedAt: file.updated_at,
        })),
      ...(events ?? []).map((event) => ({
        kind: "event" as const,
        id: event.id,
        title: event.title,
        subtitle: new Date(event.starts_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        updatedAt: event.updated_at,
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
    const mapped = mapTypedError(cause);
    if (mapped) return mapped;
    const message = cause instanceof Error ? cause.message : "Failed to load command index.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
