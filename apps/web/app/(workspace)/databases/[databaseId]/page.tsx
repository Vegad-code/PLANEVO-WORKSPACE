import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { recordRecentItem } from "@planevo/api/rpc";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { DatabaseWorkspace } from "@/features/database/database-workspace";
import { Icon } from "@/components/ui/planevo-icon";

// The pivot RPC caps a single page at 500 rows; "Show more" grows the limit.
// ponytail: limit-growth pagination — switch to cursor pages if anyone scrolls
// past a few thousand records in one sitting.
const ROW_STEP = 200;
const ROW_MAX = 500;

export default async function DatabaseRoute({
  params,
  searchParams,
}: {
  params: Promise<{ databaseId: string }>;
  searchParams: Promise<{ rows?: string }>;
}) {
  const [{ databaseId }, { rows }] = await Promise.all([params, searchParams]);
  const parsedRows = Number.parseInt(rows ?? "", 10);
  const limit = Math.min(
    Number.isFinite(parsedRows) && parsedRows > 0 ? parsedRows : ROW_STEP,
    ROW_MAX,
  );
  const current = await getCurrentWorkspace();
  if (!current) notFound();

  const { access, workspace } = current;
  const bundle = await loadDatabaseBundle(access.client, databaseId, { limit });
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
        <Suspense fallback={<p className="text-small text-text-muted">Loading database…</p>}>
          <DatabaseWorkspace bundle={bundle} />
        </Suspense>
        {bundle.records.length >= limit && limit < ROW_MAX && (
          <div className="mt-4 text-center">
            <Link
              href={`/databases/${databaseId}?rows=${Math.min(limit + ROW_STEP, ROW_MAX)}`}
              className="inline-flex h-8 items-center rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Show more records
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
