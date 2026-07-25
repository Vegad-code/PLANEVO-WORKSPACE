"use client";

import { Badge } from "@/components/ui/badge";

function PageChromeBar({
  title,
  icon,
  editedLabel = "Edited 2 hours ago",
  visibility = "Private",
  starred = false,
}: {
  title: string;
  icon: string;
  editedLabel?: string;
  visibility?: "Private" | "Shared";
  starred?: boolean;
}) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-paper/95 px-4 py-2 backdrop-blur-sm sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar text-small">
          {icon}
        </span>
        <span className="truncate text-small font-medium text-ink">{title}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{visibility}</Badge>
        <span className="hidden text-label text-text-muted sm:inline">{editedLabel}</span>
        <button
          type="button"
          disabled
          title="Share — coming soon"
          className="h-8 rounded-lg px-2.5 text-small text-text-muted opacity-60"
        >
          Share
        </button>
        <button
          type="button"
          disabled
          title="Star — coming soon"
          aria-pressed={starred}
          className={`h-8 rounded-lg px-2.5 text-small ${
            starred ? "text-marigold" : "text-text-muted opacity-60"
          }`}
        >
          {starred ? "★" : "☆"}
        </button>
        <button
          type="button"
          disabled
          title="More actions — coming soon"
          aria-label="More actions"
          className="flex size-8 items-center justify-center rounded-lg text-text-muted opacity-60"
        >
          •••
        </button>
      </div>
    </div>
  );
}

function PageBodyPlaceholder({
  cover = false,
  title,
  icon,
}: {
  cover?: boolean;
  title: string;
  icon: string;
}) {
  return (
    <div className="flex flex-col">
      {cover ? (
        <div
          className="h-36 w-full overflow-hidden rounded-card bg-sidebar sm:h-44"
          aria-hidden="true"
        />
      ) : (
        <div className="px-6 pt-4">
          <button
            type="button"
            disabled
            className="h-8 rounded-lg px-2 text-small text-text-muted opacity-60"
          >
            Add cover
          </button>
        </div>
      )}
      <div className="flex items-start gap-3 px-6 pt-4 pb-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-paper text-h2">
          {icon}
        </span>
        <h1 className="min-w-0 flex-1 text-h1 text-ink">{title}</h1>
      </div>
      <div className="border-t border-border px-6 py-4">
        <p className="text-small text-text-muted">Page body continues below the chrome bar.</p>
      </div>
    </div>
  );
}

/** Kitchen-sink preview for page chrome — top bar states, cover on/off. */
export function PageChromePreview() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="overflow-hidden rounded-card border border-border bg-paper">
        <p className="border-b border-border px-4 py-2 font-mono text-mono text-text-muted">
          Default · no cover · private
        </p>
        <PageChromeBar title="Getting Started" icon="👋" />
        <PageBodyPlaceholder title="Getting Started" icon="👋" />
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-paper">
        <p className="border-b border-border px-4 py-2 font-mono text-mono text-text-muted">
          With cover · starred scaffold
        </p>
        <PageChromeBar title="Lab notes" icon="🧪" editedLabel="Edited just now" starred />
        <PageBodyPlaceholder cover title="Lab notes" icon="🧪" />
      </div>

      <div className="col-span-full overflow-hidden rounded-card border border-border bg-paper">
        <p className="border-b border-border px-4 py-2 font-mono text-mono text-text-muted">
          Breadcrumb context · nested page under Workspace tree
        </p>
        <div className="border-b border-border px-4 py-2">
          <nav aria-label="Breadcrumb" className="text-small text-text-muted">
            <ol className="flex flex-wrap items-center gap-2">
              <li>Workspace</li>
              <li aria-hidden="true">/</li>
              <li>Physics 2400</li>
              <li aria-hidden="true">/</li>
              <li className="text-ink">Lab notes</li>
            </ol>
          </nav>
        </div>
        <PageChromeBar
          title="Lab notes"
          icon="🧪"
          editedLabel="Edited yesterday"
          visibility="Shared"
        />
        <PageBodyPlaceholder cover title="Lab notes" icon="🧪" />
      </div>
    </div>
  );
}
