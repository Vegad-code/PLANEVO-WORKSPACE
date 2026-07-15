export default function DatabaseLoading() {
  return (
    <div className="mx-auto min-h-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12" aria-busy="true">
      <div className="h-8 w-1/3 animate-pulse rounded-lg bg-surface-raised" />
      <div className="mt-6 h-64 animate-pulse rounded-card border border-border bg-surface-raised" />
    </div>
  );
}
