import {
  Bold,
  ChevronRight,
  Code2,
  Columns2,
  Eye,
  FileText,
  Italic,
  LayoutTemplate,
  Link2,
  List,
  ListOrdered,
  PanelBottom,
  Pilcrow,
  Quote,
  Strikethrough,
  X,
} from "lucide-react";

/**
 * Review surface for the Files document editor. Everything here is static markup mirroring the
 * real components — the point is to see every state side by side (all layouts, all three views,
 * the bubble above / flipped / clamped, glass and solid) without opening a file.
 */

function BubbleToolbar({ className = "" }: { className?: string }) {
  return (
    <div
      role="toolbar"
      aria-label="Format selection"
      className={`files-bubble ${className}`}
    >
      <span className="files-bubble__button">H1</span>
      <span className="files-bubble__button">H2</span>
      <span className="files-bubble__divider" />
      <span className="files-bubble__button" aria-pressed="true">
        <Bold aria-hidden="true" className="size-4" />
      </span>
      <span className="files-bubble__button">
        <Italic aria-hidden="true" className="size-4" />
      </span>
      <span className="files-bubble__button">
        <Strikethrough aria-hidden="true" className="size-4" />
      </span>
      <span className="files-bubble__divider" />
      <span className="files-bubble__button">
        <Link2 aria-hidden="true" className="size-4" />
      </span>
      <span className="files-bubble__button">
        <Code2 aria-hidden="true" className="size-4" />
      </span>
      <span className="files-bubble__divider" />
      <span className="files-bubble__button">
        <Quote aria-hidden="true" className="size-4" />
      </span>
      <span className="files-bubble__divider" />
      <span className="files-bubble__button">
        <List aria-hidden="true" className="size-4" />
      </span>
      <span className="files-bubble__button">
        <ListOrdered aria-hidden="true" className="size-4" />
      </span>
    </div>
  );
}

/** The two chrome rows: a tab for identity, a breadcrumb for place. Nothing else. */
function EditorChrome({ dirty = false }: { dirty?: boolean }) {
  return (
    <>
      <div className="flex items-stretch gap-2 border-b border-files-border pr-2">
        <div className="flex min-w-0 items-center gap-2 border-t-2 border-files-cta bg-files-editor-solid px-3 py-2">
          <FileText aria-hidden="true" className="size-3.5 text-files-cta" />
          <span className="truncate text-product-title text-files-text">
            005-caching-and-invalidation.md
          </span>
          <span className="flex size-5 items-center justify-center text-files-text-muted">
            {dirty ? (
              <span className="size-1.5 rounded-full bg-files-text-muted" />
            ) : (
              <X aria-hidden="true" className="size-3.5" />
            )}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <div className="flex items-center rounded-full border border-files-border p-0.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-files-surface-muted text-files-text">
              <Pilcrow aria-hidden="true" className="size-3.5" />
            </span>
            <span className="flex size-7 items-center justify-center rounded-full text-files-text-muted">
              <Eye aria-hidden="true" className="size-3.5" />
            </span>
            <span className="flex size-7 items-center justify-center rounded-full text-files-text-muted">
              <Columns2 aria-hidden="true" className="size-3.5" />
            </span>
          </div>
          <span className="flex size-8 items-center justify-center rounded-full text-files-text-muted">
            <LayoutTemplate aria-hidden="true" className="size-4" />
          </span>
          <span className="flex size-8 items-center justify-center rounded-full text-files-text-muted">
            <PanelBottom aria-hidden="true" className="size-4" />
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 border-b border-files-border px-3 py-1.5 text-product-meta text-files-text-muted">
        <FileText aria-hidden="true" className="size-3" />
        <ChevronRight aria-hidden="true" className="size-3" />
        <span className="text-product-body text-files-text">
          005-caching-and-invalidation.md
        </span>
        <span className="ml-auto">1.7 KB · {dirty ? "Saving…" : "Saved"}</span>
      </div>
    </>
  );
}

/** Prose painted by the same decoration classes the real editor applies. */
function DocumentBody() {
  return (
    <div className="files-doc-prose h-full overflow-hidden">
      <div className="cm-content">
        <p className="md-h1">ADR-005: Caching and invalidation</p>
        <p className="md-h2 mt-6">Status</p>
        <p className="mt-2">Accepted</p>
        <p className="md-h2 mt-6">Context</p>
        <p className="mt-2">
          Planevo mixes App Router caching, client fetches, and Postgres as
          source of truth. Integration secrets must never be cached in the
          browser.
        </p>
        <p className="mt-3">
          <span className="md-strong">Integration tokens:</span>{" "}
          <span className="md-code-inline">cache: no-store</span> on every
          external call that uses a decrypted token.
        </p>
        <blockquote className="md-quote mt-3 border-l-2 border-files-doc-rule pl-4">
          Never store plaintext tokens in local storage.
        </blockquote>
      </div>
    </div>
  );
}

function SourceBody() {
  return (
    <div className="flex h-full font-mono text-mono text-files-text">
      <div className="border-r border-files-border bg-files-editor-overlay px-2 py-4 text-files-text-muted">
        {[1, 2, 3, 4, 5].map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <div className="min-w-0 flex-1 p-4">
        <p># ADR-005: Caching and invalidation</p>
        <p>&nbsp;</p>
        <p>## Status</p>
        <p>&nbsp;</p>
        <p>Accepted</p>
      </div>
    </div>
  );
}

function EditorSurface({
  label,
  layout,
  solid = false,
  view = "document",
  bubble,
}: {
  label: string;
  layout: "bottom" | "side" | "full";
  solid?: boolean;
  view?: "document" | "markdown" | "split";
  /** Exercises the flip and clamp rules from lib/files/bubble-position.ts. */
  bubble?: "above" | "below" | "clamped";
}) {
  return (
    <figure className="flex flex-col gap-2">
      <div
        data-liquid-glass={solid ? "off" : "on"}
        className="relative h-96 overflow-hidden rounded-card border border-files-border bg-files-bg p-3"
      >
        {/* Cards behind, to confirm nothing bleeds through in the docked layouts. */}
        {layout !== "full" ? (
          <div className="grid grid-cols-3 gap-2">
            {["Research", "Notes", "Draft"].map((name) => (
              <div
                key={name}
                className="rounded-files-card border border-files-border bg-files-surface p-3"
              >
                <div className="h-3 w-2/3 rounded-full bg-files-border-strong" />
                <div className="mt-3 h-16 rounded-lg bg-files-surface-muted" />
              </div>
            ))}
          </div>
        ) : null}
        <div
          className={`files-editor-shell absolute flex flex-col overflow-hidden ${
            layout === "bottom"
              ? "inset-x-3 bottom-3 h-72 rounded-files-editor"
              : layout === "side"
                ? "inset-y-3 right-3 w-2/3 rounded-l-files-editor"
                : "inset-0"
          }`}
        >
          <EditorChrome dirty={bubble === "below"} />
          <div className="relative min-h-0 flex-1 overflow-hidden bg-files-editor-solid">
            {view === "split" ? (
              <div className="flex h-full">
                <div className="w-1/2 border-r border-files-border">
                  <SourceBody />
                </div>
                <div className="w-1/2 overflow-hidden p-5">
                  <p className="text-doc-h1">ADR-005</p>
                  <p className="mt-2 text-doc-body">Accepted</p>
                </div>
              </div>
            ) : view === "markdown" ? (
              <SourceBody />
            ) : (
              <DocumentBody />
            )}
            {bubble === "above" ? (
              <BubbleToolbar className="absolute left-1/2 top-24 -translate-x-1/2" />
            ) : null}
            {bubble === "below" ? (
              <BubbleToolbar className="absolute left-1/2 top-2 -translate-x-1/2" />
            ) : null}
            {bubble === "clamped" ? (
              <BubbleToolbar className="absolute right-2 top-24" />
            ) : null}
          </div>
        </div>
      </div>
      <figcaption className="text-product-meta text-files-text-muted">
        {label}
      </figcaption>
    </figure>
  );
}

export function FilesEditorPreview() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <EditorSurface
        label="Full · document view · bubble above the selection"
        layout="full"
        bubble="above"
      />
      <EditorSurface
        label="Full · document view · bubble flipped below (selection near top), unsaved tab"
        layout="full"
        bubble="below"
      />
      <EditorSurface
        label="Full · document view · bubble clamped to the right edge"
        layout="full"
        bubble="clamped"
      />
      <EditorSurface
        label="Full · markdown source view — the only place the gutter appears"
        layout="full"
        view="markdown"
      />
      <EditorSurface label="Full · split view" layout="full" view="split" />
      <EditorSurface
        label="Side · document view"
        layout="side"
        bubble="above"
      />
      <EditorSurface
        label="Bottom · document view"
        layout="bottom"
        bubble="above"
      />
      <EditorSurface
        label="Full · solid surfaces (glass off)"
        layout="full"
        bubble="above"
        solid
      />
    </div>
  );
}
