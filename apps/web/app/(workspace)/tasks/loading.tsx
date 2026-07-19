import { getTasksPageLayoutClass } from "@/features/tasks-product/tasks-page-layout";

export default function TasksLoading() {
  return (
    <section className={getTasksPageLayoutClass("board", true)}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 animate-pulse rounded bg-sidebar" />
          <div className="h-8 w-40 animate-pulse rounded-lg bg-sidebar" />
        </div>
        <div className="h-10 w-64 animate-pulse rounded-lg bg-sidebar" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-paper p-4 pb-6">
          <div className="grid min-h-[70vh] flex-1 gap-4 md:grid-cols-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="min-h-[70vh] animate-pulse rounded-2xl border border-border bg-sidebar p-4 md:min-h-0"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
