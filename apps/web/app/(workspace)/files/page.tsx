import Link from "next/link";
import { DatabaseFace } from "@/features/shell/database-face";
import { RecreateDatabaseButton } from "@/features/shell/recreate-database-button";
import { Icon } from "@/components/ui/planevo-icon";
import { getFilesFaceBundle } from "@/lib/queries/face-databases";
import { recreateFilesDatabase } from "./actions";

export default async function FilesPage() {
  const { workspaceId, bundle } = await getFilesFaceBundle();

  const uploadAction = (
    <Link
      href="/files/new"
      className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink px-4 text-small font-medium text-paper outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <Icon name="upload" />
      New file
    </Link>
  );

  return (
    <DatabaseFace
      eyebrow="Documents database"
      title="Files"
      description="Documents, uploads, and sources available to your workspace."
      bundle={bundle}
      workspaceId={workspaceId}
      unavailable={{
        icon: "files",
        title: "Sign in to see your files",
        description: "Your files database appears here once you're signed in.",
      }}
      empty={{
        icon: "files",
        title: "Bring in your first file",
        description:
          "Create a files database to track documents with type, tags, and relations — then upload or link sources.",
        recreate: (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <RecreateDatabaseButton
              label="Create files database"
              onRecreate={recreateFilesDatabase}
            />
            {uploadAction}
          </div>
        ),
      }}
      headerAction={uploadAction}
    />
  );
}
