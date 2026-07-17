import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { TaskComposer } from "@/features/tasks/task-composer";
import { TaskDatabaseFace } from "@/features/tasks/task-database-face";
import { getTaskDatabaseBundle } from "@/lib/queries/tasks";

export default async function TasksPage() {
  const { workspaceId, bundle } = await getTaskDatabaseBundle();

  if (!workspaceId) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <EmptyState
          icon="tasks"
          title="Sign in to see your tasks"
          description="Your task database appears here once you're signed in."
        />
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <EmptyState
          icon="tasks"
          title="Your task board is ready when you are"
          description="Create your first real task. Planevo will add only the database structure and views it needs."
          action={
            <TaskComposer
              workspaceId={workspaceId}
              buttonLabel="Create first task"
              appearance="quiet"
            />
          }
        />
      </div>
    );
  }

  return (
    <Suspense fallback={<p className="p-8 text-small text-text-muted">Loading tasks…</p>}>
      <TaskDatabaseFace bundle={bundle} workspaceId={workspaceId} />
    </Suspense>
  );
}
