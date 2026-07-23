import { getTasksPageLayoutClass } from "@/features/tasks-product/tasks-page-layout"

export default function TasksLoading() {
  return (
    <section className={getTasksPageLayoutClass("list", true)}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 animate-pulse rounded bg-sidebar" />
          <div className="h-8 w-40 animate-pulse rounded-lg bg-sidebar" />
        </div>
      </div>
      <div className="mb-4 h-11 w-full max-w-xl animate-pulse rounded-lg bg-sidebar" />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-paper">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="h-4 w-24 animate-pulse rounded bg-sidebar" />
          <div className="h-8 w-40 animate-pulse rounded-lg bg-sidebar" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 border-b border-border px-4 py-3"
          >
            <div className="size-4 animate-pulse rounded-[3px] bg-sidebar" />
            <div className="size-6 animate-pulse rounded bg-sidebar" />
            <div className="h-4 flex-1 animate-pulse rounded bg-sidebar" />
            <div className="hidden h-5 w-20 animate-pulse rounded-full bg-sidebar sm:block" />
          </div>
        ))}
        <div className="border-t border-border px-4 py-2.5">
          <div className="h-3 w-20 animate-pulse rounded bg-sidebar" />
        </div>
      </div>
    </section>
  )
}
