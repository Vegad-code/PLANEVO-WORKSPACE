import Link from "next/link";
import type { DatabaseBundle } from "@planevo/core/queries/records";
import { DatabaseWorkspace } from "@/features/database/database-workspace";
import { TaskComposer } from "@/features/tasks/task-composer";

/**
 * F-08 Tasks face — always shows the task database kernel, including empty board columns.
 */
export function TaskDatabaseFace({
  bundle,
  workspaceId,
}: {
  bundle: DatabaseBundle;
  workspaceId: string;
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label uppercase text-text-muted">Workspace database</p>
          <h1 className="mt-2 text-h1">Tasks</h1>
          <p className="mt-2 text-body text-text-secondary">
            Plan the work, then move it forward.
          </p>
        </div>
        <TaskComposer workspaceId={workspaceId} appearance="quiet" />
      </div>

      <div className="mt-8 min-h-0 flex-1">
        <DatabaseWorkspace bundle={bundle} />
      </div>

      <p className="mt-6 text-center text-small text-text-muted">
        <Link href={`/databases/${bundle.database.id}`} className="hover:text-ink">
          Open full database
        </Link>
      </p>
    </div>
  );
}
