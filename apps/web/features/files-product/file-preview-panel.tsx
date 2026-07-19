"use client";

import { useEffect, useState } from "react";
import { Download, FileQuestion, X } from "lucide-react";
import { mimeFamily } from "@planevo/core/types/files";
import { formatBytes } from "./storage-meter";
import type { ProductFileItem } from "./files-table";

const TEXT_SNIPPET_CHARS = 2000;

type FilePreviewPanelProps = {
  file: ProductFileItem;
  onClose: () => void;
  onUpdateTags: (tags: string[]) => void;
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
      <p className="text-product-body text-text-muted">
        The text preview could not be loaded.
      </p>
    );
  }
  if (snippet === null) {
    return <p className="text-product-body text-text-muted">Loading preview…</p>;
  }
  return (
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-raised p-3 font-mono text-mono text-ink">
      {snippet}
    </pre>
  );
}

function PreviewBody({ file }: { file: ProductFileItem }) {
  if (!file.previewUrl) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface-raised px-4 py-10 text-center">
        <FileQuestion aria-hidden="true" className="size-8 text-text-muted" />
        <p className="text-product-body text-text-muted">No preview available</p>
      </div>
    );
  }
  const family = mimeFamily(file.mime_type);
  if (family === "images") {
    return (
      <img
        src={file.previewUrl}
        alt={file.name}
        className="max-h-96 w-full rounded-lg border border-border object-contain"
      />
    );
  }
  if (family === "pdfs") {
    return (
      <iframe
        src={file.previewUrl}
        title={file.name}
        className="h-96 w-full rounded-lg border border-border"
      />
    );
  }
  if (isTextFile(file.mime_type)) {
    return <TextSnippet url={file.previewUrl} />;
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface-raised px-4 py-10 text-center">
      <FileQuestion aria-hidden="true" className="size-8 text-text-muted" />
      <p className="text-product-body text-text-muted">
        This file type has no inline preview
      </p>
    </div>
  );
}

export function FilePreviewPanel({
  file,
  onClose,
  onUpdateTags,
}: FilePreviewPanelProps) {
  const [tagDraft, setTagDraft] = useState("");

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
      className="flex w-full flex-col gap-4 overflow-y-auto border-l border-border bg-paper p-4 lg:w-96 lg:shrink-0"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-h3 text-ink">{file.name}</h2>
          <p className="mt-0.5 text-product-meta text-text-muted">
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
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
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
          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-product-body font-medium text-ink outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <Download aria-hidden="true" className="size-4" />
          Download
        </a>
      ) : null}

      <section aria-label="Tags" className="flex flex-col gap-2">
        <h3 className="text-label uppercase text-text-muted">Tags</h3>
        <div className="flex flex-wrap gap-1.5">
          {file.tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full border border-border bg-surface-raised px-2 py-0.5 text-product-meta text-ink"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => removeTag(tag)}
                className="text-text-muted outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-1 focus-visible:outline-ink"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          ))}
          {file.tags.length === 0 ? (
            <span className="text-product-meta text-text-muted">No tags yet</span>
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
          className="w-full rounded-lg border border-border bg-paper px-3 py-2 text-product-body text-ink outline-none placeholder:text-text-muted focus-visible:border-border-strong"
        />
      </section>
    </aside>
  );
}
