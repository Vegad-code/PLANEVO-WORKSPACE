import Link from "next/link";
import { getWorkspaceShellData } from "@/lib/queries/workspace-shell";
import { getWorkspaceDirectory } from "@/lib/queries/workspace-directory";
import { Icon, type IconName } from "@/components/ui/planevo-icon";

const databaseIcons: Record<string, IconName> = {
  task: "tasks",
  files: "files",
  notes: "page",
  project: "workspace",
};

export default async function WorkspaceDirectoryPage() {
  const shell = await getWorkspaceShellData();
  const directory = await getWorkspaceDirectory(shell);

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <p className="text-label uppercase text-text-muted">Workspace</p>
      <h1 className="mt-2 text-h1">{shell.workspace?.name ?? "Workspace"}</h1>
      <p className="mt-2 text-body text-text-secondary">
        The open canvas — every page and database, rearrangeable and yours.
      </p>

      <section className="mt-9">
        <h2 className="text-label uppercase text-text-muted">Pages</h2>
        <nav aria-label="Pages" className="mt-3 flex flex-col gap-0.5">
          {shell.pages.map((page) => (
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
        {shell.pages.length === 0 && (
          <p className="mt-3 rounded-xl border border-dashed border-border-strong px-4 py-6 text-small text-text-muted">
            No pages yet. Use New in the sidebar to start writing.
          </p>
        )}
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
                <Icon name={databaseIcons[database.templateType] ?? "page"} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-small font-medium">{database.name}</span>
                <span className="mt-1 block text-label capitalize text-text-muted">
                  {database.templateType}
                </span>
              </span>
            </Link>
          ))}
        </div>
        {directory.databases.length === 0 && (
          <p className="mt-3 rounded-xl border border-dashed border-border-strong px-4 py-6 text-small text-text-muted">
            No databases yet. Every database is born with views — start one from a template.
          </p>
        )}
      </section>
    </div>
  );
}
