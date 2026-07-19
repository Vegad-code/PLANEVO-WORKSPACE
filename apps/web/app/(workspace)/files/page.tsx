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

  if (data.status === "unauthenticated") {
    return (
      <section className="mx-auto w-full max-w-3xl px-6 py-12">
        <p className="text-label uppercase text-text-muted">Files</p>
        <h1 className="mt-2 text-h1">Sign in to see your files</h1>
        <p className="mt-2 text-body text-text-secondary">
          Your uploads, documents, and attachments will be ready here after you
          sign in.
        </p>
      </section>
    );
  }

  return (
    <FilesProductView
      initialFiles={data.files}
      initialScope={data.scope}
      workspaceId={data.workspaceId}
      firstName={data.firstName}
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
