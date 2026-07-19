export default function TasksLoading() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 animate-pulse rounded bg-sidebar" />
          <div className="h-8 w-40 animate-pulse rounded-lg bg-sidebar" />
        </div>
        <div className="h-10 w-64 animate-pulse rounded-lg bg-sidebar" />
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="min-h-[70vh] animate-pulse rounded-2xl border border-border bg-sidebar p-4"
          />
        ))}
      </div>
    </section>
  );
}
