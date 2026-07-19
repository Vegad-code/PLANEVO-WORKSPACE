import Link from "next/link";
import { createPageAndOpen } from "@/app/(workspace)/actions";
import { readGettingStartedPageId } from "@/lib/onboarding/gate";
import { getWorkspaceDirectory } from "@/lib/queries/workspace-directory";
import { getWorkspaceShellData } from "@/lib/queries/workspace-shell";
import { Icon, type IconName } from "@/components/ui/planevo-icon";

const databaseIcons: Record<string, IconName> = {
  task: "tasks",
  files: "files",
  notes: "page",
  project: "workspace",
  calendar: "calendar",
};

export default async function WorkspaceDirectoryPage() {
  const shell = await getWorkspaceShellData();
  if (shell.status !== "ready" || !shell.workspace) {
    return null;
  }

  const directory = await getWorkspaceDirectory(shell);
  const gettingStartedPageId = readGettingStartedPageId(shell.workspace.settings_json);
  const pages = shell.pages;
  const isEmpty = pages.length === 0 && directory.databases.length === 0;

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <p className="text-label uppercase text-text-muted">Workspace</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-h1">
            {shell.workspace.icon ? (
              <span aria-hidden className="text-[1.5em] leading-none">
                {shell.workspace.icon}
              </span>
            ) : null}
            <span className="min-w-0 truncate">{shell.workspace.name}</span>
          </h1>
          <p className="mt-2 text-body text-text-secondary">
            The open canvas — every page and database, rearrangeable and yours.
          </p>
        </div>
        <form action={createPageAndOpen}>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface-raised px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="plus" className="size-4" />
            New page
          </button>
        </form>
      </div>

      {gettingStartedPageId ? (
        <Link
          href={`/pages/${gettingStartedPageId}`}
          className="mt-8 flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 outline-none transition-colors hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
        >
          <span className="text-h2" aria-hidden>
            👋
          </span>
          <span className="min-w-0">
            <span className="block text-small font-medium">Getting Started</span>
            <span className="mt-0.5 block text-label text-text-muted">
              Open your checklist — learn by using the product
            </span>
          </span>
          <Icon name="arrow-right" className="ml-auto size-4 shrink-0 text-text-muted" />
        </Link>
      ) : null}

      {isEmpty ? (
        <div className="mt-12 flex flex-col items-center rounded-xl border border-dashed border-border-strong px-6 py-12 text-center">
          <Icon name="page" className="size-5 text-text-muted" />
          <p className="mt-4 text-small text-text-secondary">
            No pages yet. Use New page to start writing, or open Getting Started above.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-9">
            <h2 className="text-label uppercase text-text-muted">Pages</h2>
            <nav aria-label="Pages" className="mt-3 flex flex-col gap-0.5">
              {pages.map((page) => (
                <Link
                  key={page.id}
                  href={`/pages/${page.id}`}
                  style={{ paddingLeft: `${page.depth * 20}px` }}
                  className="flex h-9 items-center gap-3 rounded-lg px-3 text-small font-medium text-text-secondary outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <Icon name="page" className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">{page.label}</span>
                </Link>
              ))}
            </nav>
            {pages.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-border-strong px-4 py-6 text-small text-text-muted">
                No pages yet. Use New page to start writing.
              </p>
            ) : null}
          </section>

          <section className="mt-9">
            <h2 className="text-label uppercase text-text-muted">Databases</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {directory.databases.map((database) => (
                <Link
                  key={database.id}
                  href={`/databases/${database.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised p-4 outline-none hover:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary">
                    <Icon
                      name={databaseIcons[database.templateType] ?? "page"}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-small font-medium">
                      {database.name}
                    </span>
                    <span className="mt-1 block text-label capitalize text-text-muted">
                      {database.templateType}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
            {directory.databases.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-border-strong px-4 py-6 text-small text-text-muted">
                No databases yet. Every database is born with views — start one from a
                template.
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
