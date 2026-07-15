import { redirect } from "next/navigation";
import { AppShell } from "@/features/shell/app-shell";
import { getWorkspaceShellData } from "@/lib/queries/workspace-shell";
import { createInitialWorkspace } from "./actions";

function CreateWorkspaceScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface-raised p-6 text-center">
        <h1 className="text-h2">Set up your workspace</h1>
        <p className="mt-2 text-small text-text-secondary">
          Planevo starts with one workspace that holds your pages, tasks, and files.
        </p>
        <form action={createInitialWorkspace} className="mt-6">
          <button
            type="submit"
            className="h-10 w-full rounded-lg bg-marigold px-4 text-small font-medium text-ink outline-none transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
          >
            Create my workspace
          </button>
        </form>
      </div>
    </main>
  );
}

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = await getWorkspaceShellData();

  if (shell.status === "unavailable") redirect("/login");
  if (shell.status === "empty") return <CreateWorkspaceScreen />;

  return <AppShell shell={shell}>{children}</AppShell>;
}
