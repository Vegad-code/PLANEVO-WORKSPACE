import Link from "next/link";
import { notFound } from "next/navigation";
import { recordRecentItem } from "@planevo/api/rpc";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { DatabaseWorkspace } from "@/features/database/database-workspace";
import { Icon } from "@/components/ui/planevo-icon";

export default async function DatabaseRoute({
  params,
}: {
  params: Promise<{ databaseId: string }>;
}) {
  const { databaseId } = await params;
  const current = await getCurrentWorkspace();
  if (!current) notFound();

  const { access, workspace } = current;
  const bundle = await loadDatabaseBundle(access.client, databaseId);
  if (!bundle || bundle.database.workspace_id !== workspace.id) notFound();

  await recordRecentItem(access.client, {
    userId: access.ownerId,
    workspaceId: workspace.id,
    targetType: "database",
    targetId: databaseId,
  });

  return (
    <div className="mx-auto min-h-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label uppercase text-text-muted">Database</p>
          <h1 className="mt-1 text-h1">{bundle.database.name}</h1>
        </div>
        {bundle.database.page_id && (
          <Link
            href={`/pages/${bundle.database.page_id}`}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="page" />
            Open page
          </Link>
        )}
      </div>
      <div className="mt-6">
        <DatabaseWorkspace bundle={bundle} />
      </div>
    </div>
  );
}
