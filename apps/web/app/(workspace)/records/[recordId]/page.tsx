import Link from "next/link";
import { notFound } from "next/navigation";
import { recordRecentItem } from "@planevo/api/rpc";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { propertyValueToString } from "@planevo/core/validation/property-values";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { RecordEditor } from "@/features/editor/record-editor";
import { RecordPropertyField } from "@/features/database/record-property-field";
import { RecordTitle } from "@/features/database/record-title";

export default async function RecordPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = await params;
  const current = await getCurrentWorkspace();
  if (!current) notFound();

  const { access, workspace } = current;
  const { data: record, error } = await access.client
    .from("records")
    .select("id, database_id, content_json, deleted_at")
    .eq("id", recordId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!record) notFound();

  const bundle = await loadDatabaseBundle(access.client, record.database_id);
  if (!bundle) notFound();

  const pivot = bundle.records.find((row) => row.id === recordId);
  if (!pivot) notFound();

  const primary = bundle.properties.find((property) => property.is_primary);
  const title =
    primary && pivot.values[primary.id] !== undefined
      ? propertyValueToString(pivot.values[primary.id])
      : "Untitled";

  await recordRecentItem(access.client, {
    userId: access.ownerId,
    workspaceId: workspace.id,
    targetType: "record",
    targetId: record.id,
  });

  return (
    <div className="mx-auto min-h-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <Link
        href={`/databases/${record.database_id}`}
        className="mb-4 inline-flex text-small text-text-secondary hover:text-ink"
      >
        Back to {bundle.database.name}
      </Link>

      <RecordTitle
        recordId={record.id}
        propertyId={primary?.id ?? ""}
        initialTitle={title || "Untitled"}
      />

      <dl className="mt-6 flex flex-col gap-3 border-b border-border pb-6">
        {bundle.properties
          .filter((property) => !property.is_primary)
          .map((property) => (
          <RecordPropertyField
            key={property.id}
            recordId={record.id}
            property={property}
            value={pivot.values[property.id]}
          />
        ))}
      </dl>

      <div className="mt-6">
        <RecordEditor recordId={record.id} initialContent={record.content_json} />
      </div>
    </div>
  );
}
