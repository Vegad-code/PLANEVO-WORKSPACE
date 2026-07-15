import { getWorkspaceShellData } from "@/lib/queries/workspace-shell";

export default async function WorkspaceCanvas() {
  const shell = await getWorkspaceShellData();

  if (shell.dataSource === "fixture") {
    return (
      <div className="flex min-h-full flex-col gap-2 p-8">
        <p className="text-h3 text-ink">Workspace canvas</p>
        <p className="max-w-prose text-body text-text-secondary">
          Add a server secret (
          <code className="font-mono text-small">SUPABASE_SECRET_KEY</code> or{" "}
          <code className="font-mono text-small">SUPABASE_SERVICE_ROLE_KEY</code>
          ) plus{" "}
          <code className="font-mono text-small">PLANEVO_DEV_OWNER_ID</code> in{" "}
          <code className="font-mono text-small">.env.local</code>, then run{" "}
          <code className="font-mono text-small">npm run db:seed</code> to load the shell from
          Supabase.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-2 p-8">
      <p className="text-h3 text-ink">{shell.workspace?.name ?? "Workspace"}</p>
      <p className="text-body text-text-secondary">
        Loaded from Supabase. {shell.pages.length} page
        {shell.pages.length === 1 ? "" : "s"} in the sidebar tree.
      </p>
    </div>
  );
}
