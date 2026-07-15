import { Icon } from "./planevo-icon";

export function TopBar({ breadcrumb = ["Workspace"] }: { breadcrumb?: string[] }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-paper px-4 sm:px-6">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-2 text-small text-text-muted">
          {breadcrumb.map((item, index) => (
            <li key={item} className="flex min-w-0 items-center gap-2">
              {index > 0 && <span aria-hidden="true">/</span>}
              <span className={index === breadcrumb.length - 1 ? "truncate text-ink" : "truncate"}>
                {item}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <div className="ml-4 flex shrink-0 items-center gap-3">
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-full border border-slate bg-slate-tint px-3 text-small text-ink outline-none transition-colors hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
        >
          <Icon name="ask" className="size-4 text-slate" />
          <span className="hidden sm:inline">Ask Planevo AI</span>
          <span className="sm:hidden">Ask AI</span>
        </button>
        <button
          type="button"
          aria-label="Open account menu"
          className="flex size-8 items-center justify-center rounded-full border border-border-strong bg-surface-raised text-label font-medium text-ink outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          AP
        </button>
      </div>
    </header>
  );
}
