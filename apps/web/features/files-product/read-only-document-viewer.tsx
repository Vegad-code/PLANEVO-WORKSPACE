"use client";

import { FileQuestion } from "lucide-react";
import type { DocumentFormat } from "@planevo/core/files/document-descriptor";

import { resolvePdfPreviewOnlyBanner } from "./pdf-save-copy";

/**
 * Preview-only document surface. For scanned / non-text PDFs this stays the
 * fallback (iframe + honest banner). Text-extractable PDFs open in the
 * markdown shell instead — this viewer is not their primary editing surface.
 */
export function ReadOnlyDocumentViewer({
  format,
  previewUrl,
  previewOnlyBanner = null,
}: {
  format: DocumentFormat;
  previewUrl: string | null;
  previewOnlyBanner?: string | null;
}) {
  if (format === "pdf" && previewUrl) {
    const bannerText = resolvePdfPreviewOnlyBanner(previewOnlyBanner);
    // Nested shell: layout-only under the panel (CSS clears frost). Parent canvas owns the sheet.
    return (
      <div className="files-editor-shell flex h-full min-h-0 flex-col bg-transparent">
        {bannerText ? (
          <div role="status" className="files-editor-banner">
            {bannerText}
          </div>
        ) : null}
        <iframe
          src={previewUrl}
          title="PDF document"
          className="h-full min-h-0 w-full flex-1 border-0 bg-transparent"
        />
      </div>
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
