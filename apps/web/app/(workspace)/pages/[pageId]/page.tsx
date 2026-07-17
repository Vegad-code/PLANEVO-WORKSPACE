import Link from "next/link";
import { notFound } from "next/navigation";
import { recordRecentItem } from "@planevo/api/rpc";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { PageEditor } from "@/features/editor/page-editor";
import { PageHeaderActions } from "@/features/editor/page-header-actions";
import { PageTitle } from "@/features/editor/page-title";
import { Icon } from "@/components/ui/planevo-icon";

export default async function PageRoute({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const current = await getCurrentWorkspace();
  if (!current) notFound();

  const { access, workspace } = current;
  const { data: page, error } = await access.client
    .from("pages")
    .select("*")
    .eq("id", pageId)
    .eq("workspace_id", workspace.id)
    .eq("is_archived", false)
    .maybeSingle();
  if (error) throw error;
  if (!page) notFound();

  await recordRecentItem(access.client, {
    userId: access.ownerId,
    workspaceId: workspace.id,
    targetType: "page",
    targetId: page.id,
  });

  const { data: databases, error: databasesError } = await access.client
    .from("databases")
    .select("id, name")
    .eq("workspace_id", workspace.id)
    .order("name", { ascending: true });
  if (databasesError) throw databasesError;

  return (
    <div className="mx-auto min-h-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      {page.database_id && (
        <Link
          href={`/databases/${page.database_id}`}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface-raised px-3 py-1.5 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <Icon name="workspace" />
          Open database
        </Link>
      )}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageTitle
          pageId={page.id}
          initialTitle={page.title}
          initialIcon={page.icon}
          initialCoverImage={page.cover_image}
        />
        <PageHeaderActions pageId={page.id} pageTitle={page.title} />
      </div>
      <div>
        <PageEditor
          pageId={page.id}
          initialContent={page.content_json}
          databaseOptions={databases ?? []}
        />
      </div>
    </div>
  );
}
