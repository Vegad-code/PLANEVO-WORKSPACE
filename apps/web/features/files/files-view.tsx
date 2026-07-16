import Link from "next/link";
import type { FilesData } from "@/lib/queries/files";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/planevo-icon";
import { FileRow } from "@/features/files/file-row";

export function FilesView({ data }: { data: FilesData }) {
  const action = (
    <Link href="/files/new" className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink px-4 text-small font-medium text-paper outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink">
      <Icon name="upload" />
      New file
    </Link>
  );

  return (
    <div className="mx-auto min-h-full max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label uppercase text-text-muted">Documents database</p>
          <h1 className="mt-2 text-h1">Files</h1>
          <p className="mt-2 text-body text-text-secondary">Documents, uploads, and sources available to your workspace.</p>
        </div>
        {action}
      </div>

      <div className="mt-8">
        {data.files.length === 0 ? (
          <EmptyState
            icon="files"
            title="Bring in your first file"
            description="Create a Planevo document or upload a real file. Nothing appears here until you add it."
            action={action}
          />
        ) : (
          <div className="overflow-hidden rounded-card border border-border bg-surface-raised">
            {data.files.map((file) => (
              <FileRow key={file.id} file={file} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
