export default function PageLoading() {
  return (
    <div className="mx-auto min-h-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12" aria-busy="true">
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-surface-raised" />
      <div className="mt-6 space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-surface-raised" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-surface-raised" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-raised" />
      </div>
    </div>
  );
}
