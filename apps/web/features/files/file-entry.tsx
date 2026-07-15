import Link from "next/link";
import { createPlanevoDocument, uploadWorkspaceFile } from "@/app/(workspace)/files/new/actions";
import { Icon } from "@/components/ui/planevo-icon";

export function FileEntry({ workspaceId }: { workspaceId: string | null }) {
  return (
    <div className="mx-auto min-h-full max-w-4xl px-5 py-6 sm:px-8 sm:py-10">
      <Link href="/files" className="inline-flex items-center gap-2 text-small text-text-muted hover:text-ink"><Icon name="arrow-left" />Back to Files</Link>
      <div className="mt-8">
        <p className="text-label uppercase text-text-muted">New file</p>
        <h1 className="mt-2 text-h1">What do you want to add?</h1>
        <p className="mt-2 text-body text-text-secondary">Choose a Planevo document, a device upload, or an external import.</p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <section className="rounded-card border border-border bg-surface-raised p-5">
          <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary"><Icon name="document" className="size-5" /></span>
          <h2 className="mt-5 text-h3">Planevo document</h2>
          <p className="mt-2 min-h-12 text-small text-text-secondary">Start a clean page that lives in Files and your workspace.</p>
          <form action={createPlanevoDocument} className="mt-5 space-y-3">
            <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
            <input name="title" placeholder="Document title" className="h-10 w-full rounded-lg border border-border-strong bg-paper px-3 text-body outline-none placeholder:text-text-muted focus:border-ink" />
            <button type="submit" className="h-9 w-full rounded-lg bg-ink px-3 text-small font-medium text-paper outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink">Create document</button>
          </form>
        </section>

        <section className="rounded-card border border-border bg-surface-raised p-5">
          <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary"><Icon name="upload" className="size-5" /></span>
          <h2 className="mt-5 text-h3">Upload from device</h2>
          <p className="mt-2 min-h-12 text-small text-text-secondary">Store a real private file and make it available as a source.</p>
          <form action={uploadWorkspaceFile} className="mt-5 space-y-3">
            <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
            <input required type="file" name="file" className="block w-full text-small text-text-secondary file:mr-3 file:rounded-lg file:border file:border-border-strong file:bg-paper file:px-3 file:py-2 file:text-small file:text-ink" />
            <button type="submit" className="h-9 w-full rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink">Upload file</button>
          </form>
        </section>

        <section className="rounded-card border border-border bg-surface-raised p-5">
          <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary"><Icon name="import" className="size-5" /></span>
          <h2 className="mt-5 text-h3">Import</h2>
          <p className="mt-2 min-h-12 text-small text-text-secondary">Bring content from Drive, Notion export, CSV, or another source.</p>
          <div className="mt-5 rounded-lg border border-dashed border-border-strong bg-paper px-3 py-3 text-small text-text-muted">Connect an integration to import external content.</div>
        </section>
      </div>
    </div>
  );
}
