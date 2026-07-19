import Link from "next/link";
import { notFound } from "next/navigation";
import { recordRecentItem } from "@planevo/api/rpc";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { RecordSurface } from "@/features/database/record-surface";

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

  await recordRecentItem(access.client, {
    userId: access.ownerId,
    workspaceId: workspace.id,
    targetType: "record",
    targetId: record.id,
  });

  return (
    <>
      <div className="mx-auto max-w-3xl px-5 pt-8 sm:px-8 sm:pt-12">
        <Link
          href={`/databases/${record.database_id}`}
          className="mb-4 inline-flex text-small text-text-secondary hover:text-ink"
        >
          Back to {bundle.database.name}
        </Link>
      </div>
      <RecordSurface
        variant="page"
        data={{
          recordId: record.id,
          databaseId: record.database_id,
          properties: bundle.properties,
          values: pivot.values,
          contentJson: record.content_json,
        }}
      />
    </>
  );
}
