import { getWorkspaceShellData } from "@/lib/queries/workspace-shell";
import { createInitialWorkspace } from "./actions";

export default async function WorkspaceCanvas() {
  const shell = await getWorkspaceShellData();

  if (shell.status === "unavailable") {
    return (
      <div className="flex min-h-full flex-col gap-2 p-8">
        <h1 className="text-h3 text-ink">Workspace unavailable</h1>
        <p className="max-w-prose text-body text-text-secondary">
          Configure the Supabase public environment variables for this app. For
          pre-auth development access, also provide a fixed{" "}
          <code className="font-mono text-small">PLANEVO_DEV_OWNER_ID</code> and a
          server secret in <code className="font-mono text-small">.env.local</code>.
        </p>
      </div>
    );
  }

  if (shell.status === "empty") {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <div className="w-full max-w-prose rounded-xl border border-border bg-surface-raised p-8">
          <p className="text-label uppercase text-text-muted">Home</p>
          <h1 className="mt-2 text-h2 text-ink">Your workspace starts here</h1>
          <p className="mt-2 text-body text-text-secondary">
            Create a workspace to begin adding pages and shaping a place for your work.
          </p>
          <form action={createInitialWorkspace}>
            <button
              type="submit"
              className="mt-6 rounded-lg bg-ink px-4 py-2 text-small font-medium text-paper"
            >
              Create a workspace
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-2 p-8">
      <h1 className="text-h3 text-ink">{shell.workspace?.name ?? "Workspace"}</h1>
      <p className="text-body text-text-secondary">
        Loaded from Supabase. {shell.pages.length} page
        {shell.pages.length === 1 ? "" : "s"} in the sidebar tree.
      </p>
    </div>
  );
}
