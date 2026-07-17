import { DatabaseFace } from "@/features/shell/database-face";
import { RecreateDatabaseButton } from "@/features/shell/recreate-database-button";
import { TaskComposer } from "@/features/tasks/task-composer";
import { isEcosystemV2Enabled } from "@/lib/ecosystem/feature-flags";
import { getTaskFaceBundle } from "@/lib/queries/face-databases";
import {
  loadTasksPageData,
  type TasksPageData,
} from "@/lib/queries/product-tasks";
import { recreateTaskDatabase } from "./actions";

function TasksProductView({
  tasks,
  status,
}: Pick<TasksPageData, "tasks" | "status">) {
  if (status === "unauthenticated") {
    return (
      <section>
        <h1>Tasks</h1>
        <p>Sign in to see your tasks.</p>
      </section>
    );
  }

  return (
    <section>
      <h1>Tasks</h1>
      <p>{tasks.length === 1 ? "1 task" : `${tasks.length} tasks`}</p>
    </section>
  );
}

export default async function TasksPage() {
  if (isEcosystemV2Enabled()) {
    const data = await loadTasksPageData();
    return <TasksProductView tasks={data.tasks} status={data.status} />;
  }

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
