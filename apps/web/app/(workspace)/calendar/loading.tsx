export default function CalendarLoading() {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-paper">
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-56 shrink-0 flex-col gap-3 border-r border-border p-4 lg:flex">
          <div className="h-4 w-24 animate-pulse rounded bg-sidebar" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-8 animate-pulse rounded-lg bg-sidebar" />
          ))}
        </div>
        <div className="hidden w-72 shrink-0 flex-col gap-3 border-r border-border p-4 xl:flex">
          <div className="h-6 w-20 animate-pulse rounded bg-sidebar" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-9 animate-pulse rounded-lg bg-sidebar" />
          ))}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-sidebar" />
            <div className="h-9 w-64 animate-pulse rounded-lg bg-sidebar" />
          </div>
          <div className="min-h-[70vh] flex-1 animate-pulse rounded-card border border-border bg-sidebar" />
        </div>
      </div>
    </section>
  );
}
