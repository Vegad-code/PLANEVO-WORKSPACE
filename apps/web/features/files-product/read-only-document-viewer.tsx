"use client";

import { useEffect, useState } from "react";
import { FileQuestion } from "lucide-react";
import type { DocumentFormat } from "@planevo/core/files/document-descriptor";

function DocxPreview({
  url,
  onTextExtracted,
}: {
  url: string;
  onTextExtracted?: (text: string) => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("The DOCX preview could not be loaded.");
        const arrayBuffer = await response.arrayBuffer();
        const [{ convertToHtml }, { default: DOMPurify }] = await Promise.all([
          import("mammoth"),
          import("dompurify"),
        ]);
        const converted = await convertToHtml({ arrayBuffer });
        const textResult = await (
          await import("mammoth")
        ).extractRawText({ arrayBuffer });
        onTextExtracted?.(textResult.value);
        setHtml(
          DOMPurify.sanitize(converted.value, {
            USE_PROFILES: { html: true },
          }),
        );
      } catch (cause) {
        if ((cause as { name?: string })?.name === "AbortError") return;
        setError(
          cause instanceof Error
            ? cause.message
            : "The DOCX preview could not be loaded.",
        );
      }
    }
    void load();
    return () => controller.abort();
  }, [onTextExtracted, url]);

  if (error) {
    return (
      <p role="alert" className="p-4 text-product-body text-brick">
        {error}
      </p>
    );
  }
  if (html === null) {
    return (
      <p className="p-4 text-product-body text-files-text-muted">
        Preparing DOCX preview…
      </p>
    );
  }
  return (
    <article
      className="mx-auto w-full max-w-3xl overflow-auto p-6 text-body text-files-text [&_a]:text-files-cta [&_h1]:mb-4 [&_h1]:text-h1 [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-h2 [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-h3 [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-files-border [&_td]:p-2 [&_th]:border [&_th]:border-files-border [&_th]:p-2 [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function ReadOnlyDocumentViewer({
  format,
  previewUrl,
  onTextExtracted,
}: {
  format: DocumentFormat;
  previewUrl: string | null;
  onTextExtracted?: (text: string) => void;
}) {
  if (format === "pdf" && previewUrl) {
    return (
      <iframe
        src={previewUrl}
        title="PDF document"
        className="h-full min-h-0 w-full border-0"
      />
    );
  }
  if (format === "docx" && previewUrl) {
    return (
      <DocxPreview url={previewUrl} onTextExtracted={onTextExtracted} />
    );
  }
  return (
    <div className="m-4 flex flex-col items-center gap-2 rounded-files-card border border-dashed border-files-border bg-files-surface-muted px-4 py-10 text-center">
      <FileQuestion
        aria-hidden="true"
        className="size-8 text-files-text-muted"
      />
      <p className="text-product-body text-files-text-muted">
        This format is available for download, but not inline editing.
      </p>
    </div>
  );
}
