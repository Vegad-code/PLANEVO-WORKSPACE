import Link from "next/link";
import type { FilesData } from "@/lib/queries/files";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/planevo-icon";

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "Planevo page";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesView({ data }: { data: FilesData }) {
  const action = (
    <Link href="/files/new" className="inline-flex h-9 items-center gap-2 rounded-lg bg-marigold px-4 text-small font-medium text-ink outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink">
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
            {data.files.map((file) => {
              const content = (
                <>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary"><Icon name={file.pageId ? "document" : "files"} className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium">{file.name}</span>
                    <span className="mt-1 block text-small text-text-muted">{formatBytes(file.sizeBytes)} · {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(file.createdAt))}</span>
                  </span>
                  <span className="rounded-full bg-slate-tint px-2 py-1 text-label capitalize text-ink">{file.status}</span>
                </>
              );
              return file.previewUrl && file.pageId ? (
                <Link key={file.id} href={file.previewUrl} className="flex items-center gap-4 border-b border-border px-4 py-4 outline-none last:border-b-0 hover:bg-paper focus-visible:bg-paper">{content}</Link>
              ) : file.previewUrl ? (
                <a key={file.id} href={file.previewUrl} target="_blank" rel="noreferrer" className="flex items-center gap-4 border-b border-border px-4 py-4 outline-none last:border-b-0 hover:bg-paper focus-visible:bg-paper">{content}</a>
              ) : (
                <div key={file.id} className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-b-0">{content}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
