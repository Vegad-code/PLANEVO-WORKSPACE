"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileQuestion, X } from "lucide-react";
import { mimeFamily } from "@planevo/core/types/files";
import { Badge } from "@/components/ui/badge";
import {
  MAX_PREVIEW_WIDTH,
  MIN_PREVIEW_WIDTH,
  getPreviewWidth,
  setPreviewWidth,
} from "@/lib/files/preview-prefs";
import { SaveIndicator } from "@/features/editor/toolbar/save-indicator";
import { useAutosaveField } from "./use-autosave-field";
import { formatBytes } from "./storage-meter";
import type { ProductFileItem } from "./files-table";

const TEXT_SNIPPET_CHARS = 2000;

type FilePreviewPanelProps = {
  file: ProductFileItem;
  onClose: () => void;
  onUpdateTags: (tags: string[]) => void;
  onRenameFile?: (name: string) => Promise<boolean>;
};

function isTextFile(mimeType: string | null): boolean {
  return Boolean(mimeType?.startsWith("text/"));
}

function TextSnippet({ url }: { url: string }) {
  const [snippet, setSnippet] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Preview fetch ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setSnippet(text.slice(0, TEXT_SNIPPET_CHARS));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed) {
    return (
      <p className="text-product-body text-files-text-muted">
        The text preview could not be loaded.
      </p>
    );
  }
  if (snippet === null) {
    return <p className="text-product-body text-files-text-muted">Loading preview…</p>;
  }
  return (
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-files-card border border-files-border bg-files-surface-muted p-3 font-mono text-mono text-files-text">
      {snippet}
    </pre>
  );
}

function PreviewBody({ file }: { file: ProductFileItem }) {
  if (!file.previewUrl) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-files-card border border-dashed border-files-border bg-files-surface-muted px-4 py-10 text-center">
        <FileQuestion aria-hidden="true" className="size-8 text-files-text-muted" />
        <p className="text-product-body text-files-text-muted">No preview available</p>
      </div>
    );
  }
  const family = mimeFamily(file.mime_type);
  if (family === "images") {
    return (
      <img
        src={file.previewUrl}
        alt={file.name}
        className="max-h-96 w-full rounded-files-card border border-files-border object-contain"
      />
    );
  }
  if (family === "pdfs") {
    return (
      <iframe
        src={file.previewUrl}
        title={file.name}
        className="h-96 w-full rounded-files-card border border-files-border"
      />
    );
  }
  if (isTextFile(file.mime_type)) {
    return <TextSnippet url={file.previewUrl} />;
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-files-card border border-dashed border-files-border bg-files-surface-muted px-4 py-10 text-center">
      <FileQuestion aria-hidden="true" className="size-8 text-files-text-muted" />
      <p className="text-product-body text-files-text-muted">
        This file type has no inline preview
      </p>
    </div>
  );
}

/** Inline, autosaved title. Only mounted when a rename handler is supplied. */
function EditableTitle({
  name,
  onRenameFile,
}: {
  name: string;
  onRenameFile: (name: string) => Promise<boolean>;
}) {
  const { value, setValue, status } = useAutosaveField({
    initial: name,
    onSave: onRenameFile,
  });
  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label="File name"
        className="min-w-0 flex-1 truncate rounded-md bg-transparent text-h3 font-semibold text-files-text outline-none focus-visible:bg-files-surface-muted focus-visible:px-1"
      />
      <SaveIndicator state={status} />
    </div>
  );
}

export function FilePreviewPanel({
  file,
  onClose,
  onUpdateTags,
  onRenameFile,
}: FilePreviewPanelProps) {
  const [tagDraft, setTagDraft] = useState("");
  const [width, setWidth] = useState(getPreviewWidth);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    // Dragging the left-edge handle left widens the panel.
    const next = drag.current.startWidth + (drag.current.startX - event.clientX);
    setWidth(Math.min(MAX_PREVIEW_WIDTH, Math.max(MIN_PREVIEW_WIDTH, next)));
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPreviewWidth(width);
  }

  function addTag() {
    const tag = tagDraft.trim();
    setTagDraft("");
    if (!tag || file.tags.includes(tag)) return;
    onUpdateTags([...file.tags, tag]);
  }

  function removeTag(tag: string) {
    onUpdateTags(file.tags.filter((existing) => existing !== tag));
  }

  return (
    <aside
      aria-label={`Preview of ${file.name}`}
      style={{ width }}
      className="relative flex w-full flex-col gap-4 overflow-y-auto border-t border-files-border bg-files-surface p-4 max-lg:w-full! lg:shrink-0 lg:border-l lg:border-t-0"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize preview"
        title="Drag to resize"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="absolute inset-y-0 left-0 z-50 hidden w-1 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-files-border-strong motion-reduce:transition-none lg:block"
      />

      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {onRenameFile ? (
            <EditableTitle name={file.name} onRenameFile={onRenameFile} />
          ) : (
            <h2 className="truncate text-h3 font-semibold text-files-text">{file.name}</h2>
          )}
          <p className="mt-0.5 text-product-meta text-files-text-muted">
            {file.size_bytes === null ? "Unknown size" : formatBytes(file.size_bytes)}
            {" · "}
            {file.ingestion_status === "ready"
              ? "Ready"
              : file.ingestion_status === "failed"
                ? "Failed"
                : "Processing"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close preview"
          onClick={onClose}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-files-text-muted outline-none hover:text-files-text focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>

      <PreviewBody file={file} />

      {file.previewUrl ? (
        <a
          href={file.previewUrl}
          download={file.name}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-files-card border border-files-border bg-files-surface-muted px-3 py-2 text-product-body font-medium text-files-text outline-none hover:bg-files-surface focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-files-cta"
        >
          <Download aria-hidden="true" className="size-4" />
          Download
        </a>
      ) : null}

      <section aria-label="Tags" className="flex flex-col gap-2">
        <h3 className="text-label uppercase text-files-text-muted">Tags</h3>
        <div className="flex flex-wrap gap-1.5">
          {file.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => removeTag(tag)}
                className="text-files-text-muted outline-none hover:text-files-text focus-visible:outline focus-visible:outline-offset-1 focus-visible:outline-files-cta"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </Badge>
          ))}
          {file.tags.length === 0 ? (
            <span className="text-product-meta text-files-text-muted">No tags yet</span>
          ) : null}
        </div>
        <input
          value={tagDraft}
          onChange={(event) => setTagDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addTag();
          }}
          placeholder="Add a tag and press Enter"
          aria-label="Add a tag"
          className="w-full rounded-files-card border border-files-border bg-files-surface px-3 py-2 text-product-body text-files-text outline-none placeholder:text-files-text-muted focus-visible:border-files-border-strong"
        />
      </section>
    </aside>
  );
}
