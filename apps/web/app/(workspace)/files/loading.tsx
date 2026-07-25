export default function FilesLoading() {
  return (
    <section className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-sidebar" />
          <div className="h-4 w-40 animate-pulse rounded bg-sidebar" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-sidebar" />
          <div className="h-9 w-32 animate-pulse rounded-lg bg-sidebar" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-8 w-28 animate-pulse rounded-full bg-sidebar" />
        ))}
      </div>
      <div className="h-10 w-full animate-pulse rounded-lg bg-sidebar" />
      <div className="min-h-[50vh] flex-1 animate-pulse rounded-card border border-border bg-sidebar" />
      <div className="h-4 w-full animate-pulse rounded bg-sidebar" />
    </section>
  );
}
