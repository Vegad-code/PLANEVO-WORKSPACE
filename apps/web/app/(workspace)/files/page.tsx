import { FilesProductView } from "@/features/files-product/files-product-view";
import { loadFilesPageData } from "@/lib/queries/product-files";
import type { FilesScope } from "@/lib/files/scope-prefs";

function requestedScope(value: string | undefined): FilesScope {
  return value === "workspace" ? "workspace" : "all";
}

async function FilesProductPage({ scope }: { scope: FilesScope }) {
  let data = await loadFilesPageData(scope);
  if (
    data.status === "ready" &&
    data.scope === "workspace" &&
    data.workspaceId === null
  ) {
    data = await loadFilesPageData("all");
  }

  return (
    <FilesProductView
      initialFiles={data.files}
      folders={data.folders}
      owner={data.owner}
      initialScope={data.scope}
      workspaceId={data.workspaceId}
      usedBytes={data.usedBytes}
      capBytes={data.capBytes}
    />
  );
}

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;
  return <FilesProductPage scope={requestedScope(scope)} />;
}
