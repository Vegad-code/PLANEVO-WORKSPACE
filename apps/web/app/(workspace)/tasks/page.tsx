import { TasksProductView } from "@/features/tasks-product/tasks-product-view";
import { loadTasksPageData } from "@/lib/queries/product-tasks";
import type { TasksScope } from "@/lib/tasks/scope-prefs";

function requestedScope(value: string | undefined): TasksScope {
  return value === "workspace" ? "workspace" : "all";
}

async function TasksProductPage({ scope }: { scope: TasksScope }) {
  let data = await loadTasksPageData(scope);
  if (
    data.status === "ready" &&
    data.scope === "workspace" &&
    data.workspaceId === null
  ) {
    data = await loadTasksPageData("all");
  }

  if (data.status === "unauthenticated") {
    return (
      <section className="mx-auto w-full max-w-3xl px-6 py-12">
        <p className="text-label uppercase text-text-muted">Tasks</p>
        <h1 className="mt-2 text-h1">Sign in to see your tasks</h1>
        <p className="mt-2 text-body text-text-secondary">
          Your task board, list, and table will be ready here after you sign in.
        </p>
      </section>
    );
  }

  return (
    <TasksProductView
      initialTasks={data.tasks}
      initialScope={data.scope}
      workspaceId={data.workspaceId}
    />
  );
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;
  return <TasksProductPage scope={requestedScope(scope)} />;
}
