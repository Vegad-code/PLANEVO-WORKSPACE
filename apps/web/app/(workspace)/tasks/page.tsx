import { DatabaseFace } from "@/features/shell/database-face";
import { RecreateDatabaseButton } from "@/features/shell/recreate-database-button";
import { TaskComposer } from "@/features/tasks/task-composer";
import { getTaskFaceBundle } from "@/lib/queries/face-databases";
import { recreateTaskDatabase } from "./actions";

export default async function TasksPage() {
  const { workspaceId, bundle } = await getTaskFaceBundle();

  return (
    <DatabaseFace
      eyebrow="Workspace database"
      title="Tasks"
      description="Plan the work, then move it forward."
      bundle={bundle}
      workspaceId={workspaceId}
      unavailable={{
        icon: "tasks",
        title: "Sign in to see your tasks",
        description: "Your task database appears here once you're signed in.",
      }}
      empty={{
        icon: "tasks",
        title: "Your task board is ready when you are",
        description:
          "Recreate the task database with board, list, calendar, and table views — or add your first task.",
        recreate: (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <RecreateDatabaseButton
              label="Create task database"
              onRecreate={recreateTaskDatabase}
            />
            {workspaceId ? (
              <TaskComposer
                workspaceId={workspaceId}
                buttonLabel="Create first task"
                appearance="quiet"
              />
            ) : null}
          </div>
        ),
      }}
      headerAction={
        workspaceId ? <TaskComposer workspaceId={workspaceId} appearance="quiet" /> : undefined
      }
    />
  );
}
